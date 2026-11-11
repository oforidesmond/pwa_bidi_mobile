import { createIdempotencyKey } from '@/api/idempotency';
import {
  getWalletBalance,
  getWalletFunding,
  startWalletFunding,
  submitWalletFundingOtp,
} from '@/api/wallet';
import {
  PENDING_FUNDING_TTL_MS,
  isBankTransferProvider,
  pendingFundingStorageKey,
} from '@/constants/funding';
import { storage } from '@/lib/storage';
import type {
  FundingProvider,
  FundingTransferInstructions,
  WalletBalance,
  WalletFunding,
} from '@/types';
import { amountGuidanceHint, isAmountInGuidanceRange } from '@/utils/amounts';
import { formatAxiosError } from '@/utils/apiMessage';
import {
  CONFIRMING_PAYMENT_COPY,
  fundingApproveCopy,
  fundingBankTransferCopy,
  fundingPollIntervalMs,
  fundingTerminalFailureCopy,
  isFundingOtpCode,
  isFundingSettled,
  isFundingSuccessful,
  isPendingFundingExpired,
  isPendingFundingPollExhausted,
  isTerminalFundingFailure,
  isValidPendingFunding,
  normalizeFundingNextAction,
  parseBalance,
  walletFundingFromPayload,
  type PendingFunding,
} from '@/utils/funding';
import { isValidGhanaLocalMsisdn, toKorbaCustomerNumber } from '@/utils/ghana-momo';
import { hapticError, hapticMedium, hapticSuccess } from '@/utils/haptics';
import { emitWalletActivityChanged } from '@/utils/wallet-activity-events';
import { useCallback, useEffect, useRef, useState } from 'react';

type UseWalletFundingOptions = {
  userId: string | undefined;
  showMessage: (message: string) => void;
  showAlert: (opts: { title: string; message: string }) => void;
  /** Called after pending top-up settles successfully (balance already refreshed). */
  onFundingSettledSuccess?: (availableBalance: string | number) => void;
};

export type FundingOtpSubmitResult = {
  /** False closes the SMS sheet. True leaves it open for another code. */
  keepOpen: boolean;
  message?: string;
};

function fundingStartFailureMessage(error: unknown): string {
  const base = formatAxiosError(error, 'Unable to start funding');
  const lower = base.toLowerCase();
  if (
    lower.includes('whitelist') ||
    lower.includes('not allowed') ||
    lower.includes('sandbox')
  ) {
    return `${base}\n\nIf you are on Korba sandbox, whitelist this MoMo number (and your server IP) in the Korba dashboard.`;
  }
  if (lower.includes('customer') || lower.includes('phone') || lower.includes('msisdn')) {
    return `${base}\n\nCheck the Mobile Money number and try again.`;
  }
  return base;
}

function axiosStatus(error: unknown): number | undefined {
  return (error as { response?: { status?: number } })?.response?.status;
}

function pendingFromCreate(
  fundingId: string,
  amount: number,
  provider: FundingProvider,
  phone: string,
  baselineAvailable: number,
  row: WalletFunding,
): PendingFunding {
  return {
    fundingId,
    amount,
    provider,
    phone,
    baselineAvailable,
    submittedAt: Date.now(),
    nextAction: normalizeFundingNextAction(row.nextAction),
    displayText: row.displayText ?? null,
    transferInstructions: row.transferInstructions ?? null,
  };
}

export function useWalletFunding({
  userId,
  showMessage,
  showAlert,
  onFundingSettledSuccess,
}: UseWalletFundingOptions) {
  const [wallet, setWallet] = useState<WalletBalance | null>(null);
  const [balanceLoading, setBalanceLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [funding, setFunding] = useState(false);
  const [pendingFunding, setPendingFunding] = useState<PendingFunding | null>(null);
  const [pendingExpired, setPendingExpired] = useState(false);
  const [otpSheetOpen, setOtpSheetOpen] = useState(false);
  const [otpSubmitting, setOtpSubmitting] = useState(false);

  const fundKeyRef = useRef<string | null>(null);
  const pollRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const pendingRef = useRef<PendingFunding | null>(null);
  const statusCheckInFlight = useRef(false);
  /** Bumped when an OTP response is applied so an in-flight poll cannot reopen the sheet. */
  const pollGenerationRef = useRef(0);
  const onFundingSettledSuccessRef = useRef(onFundingSettledSuccess);
  onFundingSettledSuccessRef.current = onFundingSettledSuccess;

  pendingRef.current = pendingFunding;

  const clearPoll = useCallback(() => {
    if (pollRef.current) {
      clearTimeout(pollRef.current);
      pollRef.current = null;
    }
  }, []);

  const persistPending = useCallback(
    async (pending: PendingFunding | null) => {
      if (!userId) return;
      const key = pendingFundingStorageKey(userId);
      try {
        if (!pending) {
          await storage.removeItem(key);
        } else {
          await storage.setItem(key, JSON.stringify(pending));
        }
      } catch {
        // Non-fatal — in-memory pending still works for this session.
      }
    },
    [userId],
  );

  const clearPending = useCallback(async () => {
    setPendingFunding(null);
    setPendingExpired(false);
    setOtpSheetOpen(false);
    clearPoll();
    await persistPending(null);
  }, [clearPoll, persistPending]);

  const onSettledSuccess = useCallback(
    async (availableBalance: string | number) => {
      await clearPending();
      fundKeyRef.current = null;
      hapticSuccess();
      emitWalletActivityChanged();
      showMessage('Wallet funded — balance updated.');
      onFundingSettledSuccessRef.current?.(availableBalance);
    },
    [clearPending, showMessage],
  );

  const onSettledFailure = useCallback(
    async (status: string | undefined, failureReason?: string | null) => {
      const provider = pendingRef.current?.provider;
      await clearPending();
      fundKeyRef.current = null;
      await hapticError();
      showAlert({
        title: 'Top-up not completed',
        message: fundingTerminalFailureCopy(status, failureReason, provider),
      });
    },
    [clearPending, showAlert],
  );

  const applyBalance = useCallback(
    async (data: WalletBalance) => {
      setWallet(data);
      const pending = pendingRef.current;
      if (pending && isFundingSettled(data.availableBalance, pending.baselineAvailable)) {
        await onSettledSuccess(data.availableBalance);
        return true;
      }
      if (pending) {
        setPendingExpired(isPendingFundingExpired(pending.submittedAt));
      }
      return false;
    },
    [onSettledSuccess],
  );

  const loadBalance = useCallback(async () => {
    try {
      const data = await getWalletBalance();
      await applyBalance(data);
      return data;
    } catch (e) {
      showMessage(formatAxiosError(e, 'Could not load wallet balance'));
      return null;
    } finally {
      setBalanceLoading(false);
      setRefreshing(false);
    }
  }, [applyBalance, showMessage]);

  const finishSuccessful = useCallback(
    async (pending: PendingFunding) => {
      setOtpSheetOpen(false);
      const data = await loadBalance();
      if (pendingRef.current?.fundingId === pending.fundingId) {
        await onSettledSuccess(data?.availableBalance ?? pending.baselineAvailable);
      }
    },
    [loadBalance, onSettledSuccess],
  );

  /**
   * Update the persisted pending row from a create, poll, or OTP body.
   * Does not treat the body as a balance credit — callers refresh balance only on SUCCESSFUL.
   * Returns true when the request reached a terminal status.
   */
  const applyFundingRow = useCallback(
    async (row: WalletFunding, pending: PendingFunding): Promise<boolean> => {
      if (pendingRef.current?.fundingId !== pending.fundingId) return true;
      if (isFundingSuccessful(row.status)) {
        await finishSuccessful(pending);
        return true;
      }
      if (isTerminalFundingFailure(row.status)) {
        await onSettledFailure(row.status, row.failureReason);
        return true;
      }

      const previous = normalizeFundingNextAction(pendingRef.current?.nextAction);
      const nextAction = normalizeFundingNextAction(row.nextAction);
      const displayText = row.displayText ?? null;
      const transferInstructions: FundingTransferInstructions | null =
        row.transferInstructions ?? pendingRef.current?.transferInstructions ?? null;
      const current = pendingRef.current;
      const instructionsChanged =
        JSON.stringify(current?.transferInstructions ?? null) !==
        JSON.stringify(transferInstructions);
      const changed =
        !current ||
        previous !== nextAction ||
        (current.displayText ?? null) !== displayText ||
        instructionsChanged;
      if (changed && current) {
        const updated: PendingFunding = {
          ...current,
          nextAction,
          displayText,
          transferInstructions,
        };
        pendingRef.current = updated;
        setPendingFunding(updated);
        await persistPending(updated);
      }
      if (nextAction === 'submit_otp' && previous !== 'submit_otp') {
        setOtpSheetOpen(true);
      } else if (nextAction !== 'submit_otp') {
        setOtpSheetOpen(false);
      }
      setPendingExpired(isPendingFundingExpired(pending.submittedAt));
      return false;
    },
    [finishSuccessful, onSettledFailure, persistPending],
  );

  /** Poll funding row; returns true if pending was cleared (terminal). */
  const checkFundingStatus = useCallback(async (): Promise<boolean> => {
    const pending = pendingRef.current;
    if (!pending || statusCheckInFlight.current) return false;
    statusCheckInFlight.current = true;
    const generation = pollGenerationRef.current;
    try {
      const row = await getWalletFunding(pending.fundingId);
      if (generation !== pollGenerationRef.current) return false;
      if (pendingRef.current?.fundingId !== pending.fundingId) return false;
      const terminal = await applyFundingRow(row, pending);
      if (terminal) return true;

      try {
        const data = await getWalletBalance();
        setWallet(data);
        if (
          pendingRef.current?.fundingId === pending.fundingId &&
          isFundingSettled(data.availableBalance, pending.baselineAvailable)
        ) {
          await onSettledSuccess(data.availableBalance);
          return true;
        }
      } catch {
        // Ignore balance errors during status poll.
      }
      return false;
    } catch (e) {
      if (axiosStatus(e) === 404 || axiosStatus(e) === 403) {
        await clearPending();
        showMessage('This top-up is no longer available. You can try again.');
        return true;
      }
      return false;
    } finally {
      statusCheckInFlight.current = false;
      setRefreshing(false);
    }
  }, [applyFundingRow, onSettledSuccess, clearPending, showMessage]);

  const checkFundingStatusRef = useRef(checkFundingStatus);
  checkFundingStatusRef.current = checkFundingStatus;

  // Hydrate persisted pending, then immediately resolve terminal status if any.
  useEffect(() => {
    if (!userId) {
      setPendingFunding(null);
      setPendingExpired(false);
      setOtpSheetOpen(false);
      return;
    }

    let cancelled = false;
    (async () => {
      try {
        const raw = await storage.getItem(pendingFundingStorageKey(userId));
        if (cancelled) return;
        if (!raw) return;
        const parsed: unknown = JSON.parse(raw);
        if (!isValidPendingFunding(parsed)) {
          await storage.removeItem(pendingFundingStorageKey(userId));
          return;
        }
        setPendingFunding(parsed);
        setPendingExpired(isPendingFundingExpired(parsed.submittedAt));
        pendingRef.current = parsed;
        if (normalizeFundingNextAction(parsed.nextAction) === 'submit_otp') {
          setOtpSheetOpen(true);
        }
        await checkFundingStatusRef.current();
      } catch {
        // Ignore corrupt storage.
      }
    })();

    return () => {
      cancelled = true;
    };
  }, [userId]);

  useEffect(() => {
    if (!userId) return;
    setBalanceLoading(true);
    void loadBalance();
  }, [userId, loadBalance]);

  // Refresh balance & funding when tab becomes visible or window regains focus (replaces AppState / focus effect).
  useEffect(() => {
    if (!userId) return;
    const refresh = () => {
      if (document.visibilityState !== 'visible') return;
      void loadBalance();
      if (pendingRef.current) {
        void checkFundingStatus();
      }
    };
    const onVis = () => refresh();
    const onFocus = () => refresh();
    document.addEventListener('visibilitychange', onVis);
    window.addEventListener('focus', onFocus);
    return () => {
      document.removeEventListener('visibilitychange', onVis);
      window.removeEventListener('focus', onFocus);
    };
  }, [userId, loadBalance, checkFundingStatus]);

  // Show "I'll check later" / still-waiting copy after the short dismiss TTL.
  useEffect(() => {
    if (!pendingFunding) {
      setPendingExpired(false);
      return;
    }
    if (isPendingFundingExpired(pendingFunding.submittedAt)) {
      setPendingExpired(true);
      return;
    }
    const remaining = pendingFunding.submittedAt + PENDING_FUNDING_TTL_MS - Date.now();
    const timer = setTimeout(() => {
      setPendingExpired(true);
    }, Math.max(0, remaining));
    return () => clearTimeout(timer);
  }, [pendingFunding]);

  // Adaptive poll while pending — continues after dismiss is available so fail/abandoned can still surface.
  useEffect(() => {
    clearPoll();
    if (!pendingFunding) return;

    const schedule = () => {
      const submittedAt = pendingFunding.submittedAt;
      const interval = fundingPollIntervalMs(submittedAt);
      pollRef.current = setTimeout(() => {
        void checkFundingStatus().then((cleared) => {
          if (cleared) return;
          const current = pendingRef.current;
          if (!current) return;
          if (isPendingFundingExpired(current.submittedAt)) {
            setPendingExpired(true);
          }
          if (!isPendingFundingPollExhausted(current.submittedAt)) {
            schedule();
          }
        });
      }, interval);
    };

    schedule();
    return clearPoll;
  }, [pendingFunding, checkFundingStatus, clearPoll]);

  const resetFundKey = useCallback(() => {
    fundKeyRef.current = null;
  }, []);

  const submitFunding = useCallback(
    async (amount: number, provider: FundingProvider, phoneInput?: string) => {
      const bank = isBankTransferProvider(provider);
      const phone = bank ? '' : toKorbaCustomerNumber(phoneInput ?? '');
      if (!bank && !isValidGhanaLocalMsisdn(phone)) {
        void hapticError();
        showAlert({
          title: 'Invalid number',
          message: 'Enter a valid Ghana Mobile Money number (e.g. 0241234567).',
        });
        return false;
      }
      if (!isAmountInGuidanceRange(amount)) {
        void hapticError();
        showAlert({ title: 'Invalid Input', message: amountGuidanceHint() });
        return false;
      }
      if (pendingRef.current) {
        showAlert({
          title: 'Top-up in progress',
          message:
            'A top-up is already in progress. Finish it on this screen, or refresh your balance.',
        });
        return false;
      }

      void hapticMedium();
      if (!fundKeyRef.current) {
        fundKeyRef.current = createIdempotencyKey();
      }

      setFunding(true);
      try {
        const before = wallet ? parseBalance(wallet.availableBalance) : 0;
        const fundingRes = await startWalletFunding(
          bank ? { amount, provider } : { amount, provider, phone },
          fundKeyRef.current,
        );
        const fundingId = fundingRes?.id;
        if (!fundingId) {
          showMessage('Funding request submitted — pending confirmation.');
          fundKeyRef.current = null;
          await loadBalance();
          return true;
        }

        const pending = pendingFromCreate(fundingId, amount, provider, phone, before, fundingRes);
        pendingRef.current = pending;
        setPendingFunding(pending);
        setPendingExpired(false);
        await persistPending(pending);
        fundKeyRef.current = null;

        if (isFundingSuccessful(fundingRes.status) || isTerminalFundingFailure(fundingRes.status)) {
          await applyFundingRow(fundingRes, pending);
          return true;
        }

        const action = normalizeFundingNextAction(fundingRes.nextAction);
        if (action === 'submit_otp') {
          setOtpSheetOpen(true);
        } else if (action === 'approve_on_phone') {
          showMessage(
            `${fundingApproveCopy(fundingRes.displayText)} Your balance updates when payment succeeds.`,
          );
        } else if (action === 'await_bank_transfer') {
          showMessage(
            `${fundingBankTransferCopy(fundingRes.displayText)} Your balance updates when payment succeeds.`,
          );
        } else {
          showMessage(CONFIRMING_PAYMENT_COPY);
        }
        try {
          const data = await getWalletBalance();
          setWallet(data);
        } catch {
          // Create is not a balance credit.
        }
        return true;
      } catch (e) {
        await hapticError();
        showAlert({
          title: 'Funding failed',
          message: fundingStartFailureMessage(e),
        });
        return false;
      } finally {
        setFunding(false);
      }
    },
    [wallet, showAlert, showMessage, persistPending, loadBalance, applyFundingRow],
  );

  const submitFundingOtp = useCallback(
    async (otp: string): Promise<FundingOtpSubmitResult> => {
      const pending = pendingRef.current;
      if (!pending) return { keepOpen: false };
      const code = otp.trim();
      if (!isFundingOtpCode(code)) {
        return { keepOpen: true, message: 'Enter the 4–8 digit SMS code.' };
      }

      setOtpSubmitting(true);
      pollGenerationRef.current += 1;
      try {
        const row = await submitWalletFundingOtp(pending.fundingId, code, createIdempotencyKey());
        pollGenerationRef.current += 1;
        if (pendingRef.current?.fundingId !== pending.fundingId) {
          return { keepOpen: false };
        }
        const terminal = await applyFundingRow(row, pending);
        if (terminal) return { keepOpen: false };
        const action = normalizeFundingNextAction(row.nextAction);
        if (action === 'submit_otp') {
          setOtpSheetOpen(true);
          return { keepOpen: true };
        }
        return { keepOpen: false };
      } catch (e) {
        pollGenerationRef.current += 1;
        const statusCode = axiosStatus(e);
        if (statusCode === 403 || statusCode === 404) {
          await clearPending();
          showMessage('This top-up is no longer available. You can try again.');
          return { keepOpen: false };
        }

        const echoed = walletFundingFromPayload(
          (e as { response?: { data?: unknown } })?.response?.data,
        );
        const message = formatAxiosError(e, 'Could not submit the code. Try the latest SMS.');

        if (statusCode === 422) {
          setOtpSheetOpen(true);
          return { keepOpen: true, message };
        }

        if (
          statusCode === 400 &&
          echoed &&
          pendingRef.current?.fundingId === pending.fundingId
        ) {
          if (isFundingSuccessful(echoed.status)) {
            await finishSuccessful(pending);
            return { keepOpen: false };
          }
          if (isTerminalFundingFailure(echoed.status)) {
            await onSettledFailure(echoed.status, echoed.failureReason);
            return { keepOpen: false };
          }
          const action = normalizeFundingNextAction(echoed.nextAction ?? pending.nextAction);
          const status = String(echoed.status ?? 'PENDING').toUpperCase();
          const current = pendingRef.current;
          if (current) {
            const updated: PendingFunding = {
              ...current,
              nextAction: action,
              displayText: echoed.displayText ?? current.displayText ?? null,
            };
            pendingRef.current = updated;
            setPendingFunding(updated);
            await persistPending(updated);
          }
          if (status === 'PENDING' && action === 'submit_otp') {
            setOtpSheetOpen(true);
            return { keepOpen: true, message };
          }
          setOtpSheetOpen(false);
          if (message) showMessage(message);
          return { keepOpen: false };
        }

        if (normalizeFundingNextAction(pending.nextAction) === 'submit_otp') {
          setOtpSheetOpen(true);
          return { keepOpen: true, message };
        }
        return { keepOpen: false, message };
      } finally {
        setOtpSubmitting(false);
      }
    },
    [applyFundingRow, clearPending, finishSuccessful, onSettledFailure, persistPending, showMessage],
  );

  const dismissPending = useCallback(async () => {
    await clearPending();
    fundKeyRef.current = null;
    showMessage('You can top up again anytime. Balance still updates if payment lands.');
  }, [clearPending, showMessage]);

  const dismissOtpSheet = useCallback(() => {
    setOtpSheetOpen(false);
  }, []);

  const openOtpSheet = useCallback(() => {
    if (normalizeFundingNextAction(pendingRef.current?.nextAction) !== 'submit_otp') return;
    setOtpSheetOpen(true);
  }, []);

  const checkBalanceNow = useCallback(() => {
    setRefreshing(true);
    void (async () => {
      if (pendingRef.current) {
        const cleared = await checkFundingStatus();
        if (cleared) return;
        const data = await loadBalance();
        if (pendingRef.current && data) {
          showMessage('Checked — this top-up is still pending.');
        }
        return;
      }
      const data = await loadBalance();
      if (data) showMessage('Balance updated.');
    })();
  }, [checkFundingStatus, loadBalance, showMessage]);

  return {
    wallet,
    balanceLoading,
    refreshing,
    setRefreshing,
    funding,
    pendingFunding,
    pendingExpired,
    otpSheetOpen,
    otpSubmitting,
    loadBalance,
    checkBalanceNow,
    submitFunding,
    submitFundingOtp,
    dismissPending,
    dismissOtpSheet,
    openOtpSheet,
    resetFundKey,
  };
}
