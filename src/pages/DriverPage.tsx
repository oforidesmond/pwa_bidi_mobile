import { createIdempotencyKey } from '@/api/idempotency';
import { buyFuelToken } from '@/api/driver';
import { formatMoney, getWalletBalance } from '@/api/wallet';
import { MomoTrustFooter } from '@/components/MomoTrustFooter';
import { Sheet } from '@/components/Sheet';
import { CrossPlatformHint } from '@/components/CrossPlatformHint';
import { WalletCard } from '@/components/WalletCard';
import { FUNDING_PROVIDERS, fundingProviderLabel, maskPhone } from '@/constants/funding';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useSetupBanner } from '@/context/SetupBannerContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { useWalletFunding } from '@/hooks/useWalletFunding';
import type { FundingProvider } from '@/types';
import {
  amountGuidanceHint,
  formatAmountInput,
  isAmountInGuidanceRange,
  isInsufficientBalanceMessage,
  suggestedTopUpAmount,
  walletShortfall,
} from '@/utils/amounts';
import { formatAxiosError } from '@/utils/apiMessage';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import {
  CONFIRMING_PAYMENT_COPY,
  fundingApproveCopy,
  fundingOtpTitle,
  isFundingOtpCode,
  normalizeFundingNextAction,
  OTP_NOT_PIN_HINT,
  parseBalance,
  truncateFundingId,
} from '@/utils/funding';
import {
  detectGhanaMomoNetwork,
  isValidGhanaLocalMsisdn,
  normalizeGhanaLocalPhone,
  toDisplayLocalPhone,
} from '@/utils/ghana-momo';
import { hapticError, hapticLight, hapticMedium, hapticSuccess } from '@/utils/haptics';
import { emitWalletActivityChanged } from '@/utils/wallet-activity-events';
import { useCallback, useEffect, useRef, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

export default function DriverPage() {
  const [amount, setAmount] = useState('');
  const [fundAmount, setFundAmount] = useState('');
  const [fundPhone, setFundPhone] = useState('');
  const [fundProvider, setFundProvider] = useState<FundingProvider | null>(null);
  const [loading, setLoading] = useState(false);
  const [topUpOpen, setTopUpOpen] = useState(false);
  const [otpCode, setOtpCode] = useState('');
  const [otpError, setOtpError] = useState('');
  const otpSheetWasOpen = useRef(false);
  const buyKeyRef = useRef<string | null>(null);
  const resumeBuyAfterFundRef = useRef(false);
  const lastDetectedProviderRef = useRef<FundingProvider | null>(null);
  const amountRef = useRef(amount);
  amountRef.current = amount;

  const { user } = useAuth();
  const { showMessage } = useFeedback();
  const { showAlert, showConfirm } = useDialog();
  const { dismissed: bannerDismissed, dismiss: dismissBanner } = useSetupBanner();
  const { tokens } = useBidiTheme();
  const navigate = useNavigate();

  const applyPhoneForTopUp = useCallback((phone: string | null | undefined) => {
    const display = toDisplayLocalPhone(phone);
    setFundPhone(display);
    const detectedNetwork = detectGhanaMomoNetwork(display);
    lastDetectedProviderRef.current = detectedNetwork?.provider ?? null;
    setFundProvider(detectedNetwork?.provider ?? null);
  }, []);

  const executeBuy = useCallback(
    async (buyValue: number) => {
      if (!buyKeyRef.current) {
        buyKeyRef.current = createIdempotencyKey();
      }

      setLoading(true);
      try {
        await buyFuelToken({ amount: buyValue }, buyKeyRef.current);
        buyKeyRef.current = null;
        resumeBuyAfterFundRef.current = false;
        await hapticSuccess();
        showMessage('Fuel token purchased successfully');
        setAmount('');
        await loadBalanceRef.current();
        emitWalletActivityChanged();
        navigate('/app/tokens');
        return true;
      } catch (e: unknown) {
        await hapticError();
        const msg = formatAxiosError(e, 'Purchase failed');
        if (isInsufficientBalanceMessage(msg)) {
          try {
            const data = await getWalletBalance();
            await loadBalanceRef.current();
            const available = parseBalance(data.availableBalance);
            const shortfall = walletShortfall(buyValue, available);
            if (shortfall > 0) {
              if (pendingFundingRef.current) {
                showAlert({
                  title: 'Top-up in progress',
                  message:
                    'A MoMo top-up is already awaiting approval. Approve the prompt on your phone, then try buying again.',
                });
                return false;
              }
              promptShortfallTopUpRef.current(buyValue, available, shortfall);
              return false;
            }
          } catch {
            // Fall through
          }
        }
        showAlert({ title: 'Failed', message: msg });
        return false;
      } finally {
        setLoading(false);
      }
    },
    [navigate, showAlert, showMessage],
  );

  const promptShortfallTopUp = useCallback(
    (buyValue: number, available: number, shortfall: number) => {
      const suggested = suggestedTopUpAmount(shortfall);
      showConfirm({
        title: 'Not enough balance',
        message: `You need ${formatDisplayMoney(buyValue)} but only have ${formatDisplayMoney(available)}. Top up ${formatDisplayMoney(suggested)} to continue.`,
        confirmLabel: `Top up ${formatDisplayMoney(suggested)}`,
        cancelLabel: 'Change amount',
        onConfirm: () => {
          resumeBuyAfterFundRef.current = true;
          setFundAmount(formatAmountInput(suggested));
          applyPhoneForTopUp(user?.phone);
          setTopUpOpen(true);
        },
      });
    },
    [applyPhoneForTopUp, showConfirm, user?.phone],
  );

  const handleFundingSettledSuccess = useCallback(
    (availableBalance: string | number) => {
      if (!resumeBuyAfterFundRef.current) return;
      const buyValue = Number(amountRef.current);
      if (!isAmountInGuidanceRange(buyValue)) {
        resumeBuyAfterFundRef.current = false;
        return;
      }
      if (walletShortfall(buyValue, availableBalance) > 0) {
        resumeBuyAfterFundRef.current = false;
        return;
      }
      resumeBuyAfterFundRef.current = false;
      showConfirm({
        title: 'Wallet funded',
        message: `Buy a ${formatDisplayMoney(buyValue)} fuel token now?`,
        confirmLabel: 'Buy Token',
        cancelLabel: 'Not now',
        onConfirm: () => {
          void hapticMedium();
          void executeBuy(buyValue);
        },
      });
    },
    [executeBuy, showConfirm],
  );

  const {
    wallet,
    balanceLoading,
    funding,
    pendingFunding,
    pendingExpired,
    loadBalance,
    checkBalanceNow,
    submitFunding,
    submitFundingOtp,
    dismissPending,
    otpSheetOpen,
    otpSubmitting,
    dismissOtpSheet,
    openOtpSheet,
    resetFundKey,
  } = useWalletFunding({
    userId: user?.id,
    showMessage,
    showAlert,
    onFundingSettledSuccess: handleFundingSettledSuccess,
  });

  const loadBalanceRef = useRef(loadBalance);
  loadBalanceRef.current = loadBalance;
  const pendingFundingRef = useRef(pendingFunding);
  pendingFundingRef.current = pendingFunding;
  const promptShortfallTopUpRef = useRef(promptShortfallTopUp);
  promptShortfallTopUpRef.current = promptShortfallTopUp;

  useEffect(() => {
    if (otpSheetOpen && !otpSheetWasOpen.current) {
      setOtpCode('');
      setOtpError('');
    }
    otpSheetWasOpen.current = otpSheetOpen;
  }, [otpSheetOpen]);

  const openTopUp = () => {
    resumeBuyAfterFundRef.current = false;
    applyPhoneForTopUp(user?.phone);
    setTopUpOpen(true);
  };

  const abandonTopUp = () => {
    setTopUpOpen(false);
    resumeBuyAfterFundRef.current = false;
  };

  const fundNum = Number(fundAmount);
  const buyNum = Number(amount);
  const localPhone = normalizeGhanaLocalPhone(fundPhone);
  const detected = detectGhanaMomoNetwork(fundPhone);
  const phoneValid = isValidGhanaLocalMsisdn(localPhone) && !!fundProvider;
  const isValidFund =
    fundAmount !== '' && !Number.isNaN(fundNum) && isAmountInGuidanceRange(fundNum);
  const isValidAmount =
    amount !== '' && !Number.isNaN(buyNum) && isAmountInGuidanceRange(buyNum);
  const canSubmitFund = isValidFund && phoneValid && !funding && !pendingFunding;

  useEffect(() => {
    const next = detected?.provider ?? null;
    if (next !== lastDetectedProviderRef.current) {
      lastDetectedProviderRef.current = next;
      if (next) setFundProvider(next);
    }
  }, [detected?.provider]);

  const phoneFieldError =
    (!!fundPhone && !isValidGhanaLocalMsisdn(localPhone) && localPhone.length >= 10) ||
    (isValidGhanaLocalMsisdn(localPhone) && !fundProvider);

  const phoneHint =
    fundPhone !== '' && !isValidGhanaLocalMsisdn(localPhone) && localPhone.length >= 10
      ? 'Enter a 10-digit Ghana number starting with 0'
      : localPhone.length >= 3 && !detected
        ? "Couldn't detect network — select one"
        : isValidGhanaLocalMsisdn(localPhone) && !fundProvider
          ? 'Select the MoMo network for this number'
          : detected && fundProvider && fundProvider !== detected.provider
            ? `Using ${fundingProviderLabel(fundProvider)}`
            : detected && fundProvider === detected.provider
              ? `${detected.label} suggested from number`
              : 'Pre-filled with your login number — edit if funding from another wallet';

  const handleBuy = async () => {
    if (!isValidAmount) {
      void hapticError();
      showAlert({ title: 'Invalid Input', message: amountGuidanceHint() });
      return;
    }

    const available = parseBalance(wallet?.availableBalance);
    const shortfall = walletShortfall(buyNum, available);
    if (shortfall > 0) {
      void hapticError();
      if (pendingFunding) {
        const waitingOnCode =
          normalizeFundingNextAction(pendingFunding.nextAction) === 'submit_otp';
        showAlert({
          title: 'Top-up in progress',
          message: waitingOnCode
            ? 'Enter the SMS code for your top-up, then try buying again.'
            : 'A MoMo top-up is already awaiting approval. Approve the prompt on your phone, then try buying again.',
        });
        return;
      }
      promptShortfallTopUp(buyNum, available, shortfall);
      return;
    }

    void hapticMedium();
    await executeBuy(buyNum);
  };

  const handleFund = async () => {
    if (!fundProvider) {
      void hapticError();
      showAlert({
        title: 'Network required',
        message: 'Select MTN, Telecel, or AT for this MoMo number.',
      });
      return;
    }
    const ok = await submitFunding(fundNum, fundProvider, fundPhone);
    if (ok) {
      setFundAmount('');
      resetFundKey();
      setTopUpOpen(false);
    }
  };

  const handleSubmitOtp = async () => {
    const result = await submitFundingOtp(otpCode);
    if (!result.keepOpen) {
      setOtpCode('');
      setOtpError('');
      return;
    }
    setOtpCode('');
    if (!result.message) {
      setOtpError('');
      return;
    }
    window.setTimeout(() => {
      setOtpError(result.message ?? '');
    }, 0);
  };

  const pendingLabel =
    wallet?.pendingBalance != null && Number(wallet.pendingBalance) > 0
      ? `Pending: ${formatMoney(wallet.pendingBalance, wallet?.currency || 'GHS')}`
      : null;

  const pendingPhoneMasked = pendingFunding
    ? maskPhone(pendingFunding.phone) ?? pendingFunding.phone
    : null;
  const pendingAction = normalizeFundingNextAction(pendingFunding?.nextAction);
  const otpReady = isFundingOtpCode(otpCode);
  const pendingDetail = !pendingFunding
    ? ''
    : pendingAction === 'submit_otp'
      ? `Enter the SMS code sent to your phone to continue this top-up of ${formatDisplayMoney(pendingFunding.amount)}. This is not your MoMo PIN.`
      : pendingExpired
        ? `Top-up of ${formatDisplayMoney(pendingFunding.amount)} via ${fundingProviderLabel(pendingFunding.provider)} to ${pendingPhoneMasked} is taking longer than usual. Check MoMo SMS, or try again later. Ref ${truncateFundingId(pendingFunding.fundingId)}`
        : pendingAction === 'none'
          ? `${CONFIRMING_PAYMENT_COPY} Top-up of ${formatDisplayMoney(pendingFunding.amount)} via ${fundingProviderLabel(pendingFunding.provider)}.`
          : `Top-up of ${formatDisplayMoney(pendingFunding.amount)} via ${fundingProviderLabel(pendingFunding.provider)} to ${pendingPhoneMasked}. ${fundingApproveCopy(pendingFunding.displayText)} Your balance updates when payment succeeds.`;
  const pendingChipLabel =
    pendingAction === 'submit_otp'
      ? 'SMS code needed'
      : pendingExpired
        ? 'Still waiting for payment'
        : pendingAction === 'none'
          ? 'Confirming payment'
          : 'Awaiting MoMo approval';

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
          Buy Fuel Token
        </h1>
        <p className="bidi-page-subtitle" style={{ color: tokens.textSecondary }}>
          Purchase a token with your wallet balance
        </p>

        <CrossPlatformHint
          needsPin={user?.needsPin}
          needsProfile={user?.needsProfile}
          visible={!bannerDismissed}
          onDismiss={dismissBanner}
        />

        {balanceLoading && !wallet ? (
          <div className="bidi-wallet-card-wrap">
            <div className="bidi-skeleton bidi-skeleton--wallet" />
          </div>
        ) : (
          <WalletCard
            balance={wallet?.availableBalance}
            currency={wallet?.currency || 'GHS'}
            loading={balanceLoading}
            pendingLabel={pendingLabel}
            topRight={
              <button
                type="button"
                className="bidi-wallet-btn bidi-wallet-btn--primary"
                onClick={openTopUp}
                disabled={!!pendingFunding}
              >
                <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                  add
                </span>
                Top up
              </button>
            }
            footer={
              <>
                {pendingFunding ? (
                  <div className="bidi-pending-block">
                    <span
                      className="bidi-chip bidi-chip--small"
                      style={{
                        backgroundColor: tokens.onGradientOverlay,
                        color: tokens.onGradient,
                      }}
                    >
                      <span className="material-symbols-outlined" style={{ fontSize: 16 }} aria-hidden>
                        schedule
                      </span>
                      {pendingChipLabel}
                    </span>
                    <p className="bidi-pending-detail" style={{ color: tokens.onGradientMuted }}>
                      {pendingDetail}
                    </p>
                    <div className="bidi-pending-actions">
                      {pendingAction === 'submit_otp' ? (
                        <button
                          type="button"
                          className="bidi-wallet-btn bidi-wallet-btn--primary"
                          onClick={openOtpSheet}
                        >
                          Enter SMS code
                        </button>
                      ) : null}
                      <button
                        type="button"
                        className="bidi-wallet-btn bidi-wallet-btn--secondary"
                        onClick={checkBalanceNow}
                      >
                        Check balance now
                      </button>
                      {pendingExpired ? (
                        <button
                          type="button"
                          className="bidi-wallet-btn bidi-wallet-btn--ghost"
                          onClick={() => void dismissPending()}
                        >
                          I&apos;ll check later
                        </button>
                      ) : null}
                    </div>
                  </div>
                ) : null}
                <Link to="/app/ledger" className="bidi-wallet-btn bidi-wallet-btn--secondary">
                  View activity
                  <span className="material-symbols-outlined" style={{ fontSize: 18 }} aria-hidden>
                    chevron_right
                  </span>
                </Link>
              </>
            }
          />
        )}

        <div className="bidi-layout-split">
          <div className="bidi-layout-split__primary">
            <section className="bidi-card" style={{ backgroundColor: tokens.surfaceElevated }}>
              <h2 className="bidi-section-title" style={{ color: tokens.textPrimary }}>
                Purchase token
              </h2>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Amount (E.g., 100)
                </span>
                <div className="bidi-field__row">
                  <span className="bidi-affix" style={{ color: tokens.textTertiary }}>
                    GHS
                  </span>
                  <input
                    className="bidi-input tabular-nums"
                    style={{ ...tabularNumsStyle, backgroundColor: tokens.surfaceElevated }}
                    inputMode="decimal"
                    value={amount}
                    onChange={(e) => {
                      setAmount(e.target.value);
                      buyKeyRef.current = null;
                    }}
                    aria-invalid={!isValidAmount && amount !== ''}
                    aria-label="Buy token amount in Ghana cedis"
                  />
                </div>
                {!isValidAmount && amount !== '' ? (
                  <span className="bidi-field__error">{amountGuidanceHint()}</span>
                ) : null}
              </label>
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-3"
                onClick={() => void handleBuy()}
                disabled={loading || !isValidAmount}
              >
                {loading ? 'Processing...' : 'Buy Token'}
              </button>
            </section>
          </div>
          <div className="bidi-layout-split__aside">
            <MomoTrustFooter />
          </div>
        </div>
      </div>

      <Sheet open={topUpOpen} onClose={abandonTopUp} ariaLabel="Top up wallet">
        <div className="bidi-sheet-body">
          <h2 className="bidi-sheet-title" style={{ color: tokens.textPrimary }}>
            Top up wallet
          </h2>
          <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
            Enter the MoMo number that should receive the payment prompt. Your balance updates when
            payment succeeds.
          </p>
          <label className="bidi-field">
            <span className="bidi-field__label">MoMo number</span>
            <input
              className="bidi-input"
              inputMode="tel"
              autoComplete="tel"
              value={fundPhone}
              onChange={(e) => {
                setFundPhone(e.target.value);
                resetFundKey();
              }}
              aria-invalid={phoneFieldError}
              aria-label="MoMo phone number"
            />
          </label>
          <div className="bidi-field">
            <span className="bidi-field__label" id="momo-network-label">
              Network
            </span>
            <div
              className="bidi-segmented"
              role="group"
              aria-labelledby="momo-network-label"
            >
              {FUNDING_PROVIDERS.map((option) => {
                const active = fundProvider === option.value;
                return (
                  <button
                    key={option.value}
                    type="button"
                    className={`bidi-segmented__btn${active ? ' bidi-segmented__btn--active' : ''}`}
                    style={{
                      backgroundColor: active ? tokens.accentTint : 'transparent',
                      color: active ? tokens.brand.accent600 : tokens.textSecondary,
                    }}
                    aria-pressed={active}
                    onClick={() => {
                      void hapticLight();
                      setFundProvider(option.value);
                      resetFundKey();
                    }}
                  >
                    {option.shortLabel}
                  </button>
                );
              })}
            </div>
          </div>
          <p
            className={phoneFieldError ? 'bidi-field__error' : 'bidi-hint'}
            style={{ color: phoneFieldError ? undefined : tokens.textSecondary }}
          >
            {phoneHint}
          </p>
          <label className="bidi-field bidi-mt-3">
            <span className="bidi-field__label">Amount (E.g., 100)</span>
            <div className="bidi-field__row">
              <span className="bidi-affix" style={{ color: tokens.textTertiary }}>
                GHS
              </span>
              <input
                className="bidi-input tabular-nums"
                style={{ ...tabularNumsStyle }}
                inputMode="decimal"
                value={fundAmount}
                onChange={(e) => {
                  setFundAmount(e.target.value);
                  resetFundKey();
                }}
                aria-invalid={!isValidFund && fundAmount !== ''}
                aria-label="Fund amount in Ghana cedis"
              />
            </div>
            {!isValidFund && fundAmount !== '' ? (
              <span className="bidi-field__error">{amountGuidanceHint()}</span>
            ) : null}
          </label>
          <button
            type="button"
            className="bidi-btn bidi-btn--primary bidi-mt-3"
            onClick={() => void handleFund()}
            disabled={!canSubmitFund}
          >
            {funding ? 'Submitting…' : 'Fund Wallet'}
          </button>
          <button type="button" className="bidi-btn-text bidi-mt-2" onClick={abandonTopUp}>
            Cancel
          </button>
          <MomoTrustFooter compact />
        </div>
      </Sheet>

      <Sheet open={otpSheetOpen} onClose={dismissOtpSheet} ariaLabel="SMS code">
        <div className="bidi-sheet-body">
          <h2 className="bidi-sheet-title" style={{ color: tokens.textPrimary }}>
            {fundingOtpTitle(pendingFunding?.displayText)}
          </h2>
          <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
            {OTP_NOT_PIN_HINT}.
          </p>
          <label className="bidi-field">
            <span className="bidi-field__label">SMS code</span>
            <input
              className="bidi-input tabular-nums"
              inputMode="numeric"
              autoComplete="one-time-code"
              maxLength={8}
              value={otpCode}
              onChange={(e) => {
                setOtpCode(e.target.value.replace(/\D/g, '').slice(0, 8));
                setOtpError('');
              }}
              disabled={otpSubmitting}
              aria-invalid={!!otpError}
              aria-label="SMS code"
            />
          </label>
          <p className={otpError ? 'bidi-field__error' : 'bidi-hint'}>
            {otpError || 'Enter the 4 to 8 digit code from your SMS.'}
          </p>
          <button
            type="button"
            className="bidi-btn bidi-btn--primary bidi-mt-3"
            onClick={() => void handleSubmitOtp()}
            disabled={!otpReady || otpSubmitting}
          >
            {otpSubmitting ? 'Submitting…' : 'Submit code'}
          </button>
          <button
            type="button"
            className="bidi-btn-text bidi-mt-2"
            onClick={dismissOtpSheet}
            disabled={otpSubmitting}
          >
            Close
          </button>
        </div>
      </Sheet>

      {loading ? (
        <div className="bidi-overlay" style={{ backgroundColor: tokens.scrim }} aria-busy>
          <div className="bidi-spinner" style={{ borderTopColor: tokens.onGradient }} />
        </div>
      ) : null}
    </div>
  );
}
