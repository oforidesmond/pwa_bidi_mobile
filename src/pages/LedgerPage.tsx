import {
  formatMoney,
  getWalletBalance,
  getWalletLedger,
  getWalletLedgerEntry,
} from '@/api/wallet';
import {
  CategoryIconChip,
  signalCategoryFromReason,
} from '@/components/CategoryIconChip';
import { EmptyState } from '@/components/EmptyState';
import { MomoTrustFooter } from '@/components/MomoTrustFooter';
import { Sheet } from '@/components/Sheet';
import { CrossPlatformHint } from '@/components/CrossPlatformHint';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useSetupBanner } from '@/context/SetupBannerContext';
import { useBidiTheme } from '@/context/ThemeContext';
import type { LedgerEntry } from '@/types';
import { formatAxiosError } from '@/utils/apiMessage';
import { tabularNumsStyle } from '@/utils/currency-display';
import { hapticSelection } from '@/utils/haptics';
import {
  ledgerDetailRows,
  ledgerReasonLabel,
  ledgerSubtitle,
  ledgerTotalPages,
  type LedgerDetailRow,
} from '@/utils/ledger';
import { subscribeWalletActivityChanged } from '@/utils/wallet-activity-events';
import { useCallback, useEffect, useRef, useState } from 'react';

const PAGE_SIZE = 20;

function FactRow({
  row,
  isLast,
  onCopy,
}: {
  row: LedgerDetailRow;
  isLast: boolean;
  onCopy?: (value: string) => void;
}) {
  const { tokens } = useBidiTheme();
  return (
    <div
      className="bidi-fact-row"
      style={{
        borderBottom: isLast ? 'none' : `1px solid ${tokens.divider}`,
      }}
    >
      <span className="bidi-fact-label" style={{ color: tokens.textTertiary }}>
        {row.label}
      </span>
      <span
        className={`bidi-fact-value${row.selectable ? ' bidi-fact-value--select' : ''}`}
        style={{
          ...tabularNumsStyle,
          color: tokens.textPrimary,
          fontFamily: row.selectable ? 'monospace' : undefined,
        }}
      >
        {row.value}
      </span>
      {row.copyable && onCopy ? (
        <button type="button" className="bidi-chip bidi-chip--copy" onClick={() => onCopy(row.value)}>
          Copy
        </button>
      ) : null}
    </div>
  );
}

function LedgerRow({ item, onPress }: { item: LedgerEntry; onPress: () => void }) {
  const { tokens } = useBidiTheme();
  const credit = item.direction === 'CREDIT';
  const category = signalCategoryFromReason(item.reason);
  const amountText = formatMoney(item.amount, item.currency || 'GHS').replace(/^GHS\s*/, '');
  const title = ledgerReasonLabel(String(item.reason));
  const subtitle = ledgerSubtitle(item);

  return (
    <button
      type="button"
      className="bidi-list-row"
      style={{ backgroundColor: tokens.surfaceElevated }}
      onClick={onPress}
    >
      <CategoryIconChip category={category} size={40} accessibilityLabel={`${title} category`} />
      <div className="bidi-list-row__mid">
        <div className="bidi-list-row__title" style={{ color: tokens.textPrimary }}>
          {title}
        </div>
        {subtitle ? (
          <div className="bidi-list-row__sub" style={{ color: tokens.textSecondary }}>
            {subtitle}
          </div>
        ) : null}
        <div className="bidi-list-row__sub" style={{ color: tokens.textTertiary }}>
          Balance {formatMoney(item.balanceAfter, item.currency || 'GHS')}
        </div>
      </div>
      <div
        className="tabular-nums bidi-list-row__amt"
        style={{
          ...tabularNumsStyle,
          color: credit ? tokens.brand.success : tokens.brand.error,
        }}
      >
        {credit ? '+' : '−'}
        {amountText}
      </div>
    </button>
  );
}

export default function LedgerPage() {
  const { tokens } = useBidiTheme();
  const { user } = useAuth();
  const { showMessage } = useFeedback();
  const { dismissed: bannerDismissed, dismiss: dismissBanner } = useSetupBanner();

  const [walletId, setWalletId] = useState<string | null>(null);
  const [entries, setEntries] = useState<LedgerEntry[]>([]);
  const [page, setPage] = useState(1);
  const [totalPages, setTotalPages] = useState(1);
  const [loading, setLoading] = useState(true);
  const [loadingMore, setLoadingMore] = useState(false);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedEntry, setSelectedEntry] = useState<LedgerEntry | null>(null);
  const [detailLoading, setDetailLoading] = useState(false);
  const hasLoadedRef = useRef(false);
  const detailRequestRef = useRef(0);

  const loadPage = useCallback(
    async (nextPage: number, replace: boolean) => {
      if (!user?.id) {
        setLoading(false);
        setLoadingMore(false);
        return;
      }
      try {
        let id = walletId;
        if (!id) {
          const balance = await getWalletBalance();
          id = balance.id;
          setWalletId(id);
        }
        if (!id) throw new Error('Wallet not found');

        const res = await getWalletLedger(id, {
          page: nextPage,
          limit: PAGE_SIZE,
          sortBy: 'createdAt',
          order: 'desc',
        });
        const list = Array.isArray(res?.data) ? res.data : [];
        const meta = res?.meta || {};
        const pages = ledgerTotalPages(meta, PAGE_SIZE);

        setTotalPages(pages);
        setPage(nextPage);
        setEntries((prev) => (replace ? list : [...prev, ...list]));
      } catch (e) {
        showMessage(formatAxiosError(e, 'Could not load ledger'));
      } finally {
        setLoading(false);
        setLoadingMore(false);
        setRefreshing(false);
      }
    },
    [user?.id, walletId, showMessage],
  );

  const loadPageRef = useRef(loadPage);
  loadPageRef.current = loadPage;

  useEffect(() => {
    if (!user?.id) {
      setLoading(false);
      return;
    }
    setLoading(true);
    hasLoadedRef.current = false;
    void (async () => {
      await loadPageRef.current(1, true);
      hasLoadedRef.current = true;
    })();
  }, [user?.id]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (!user?.id || !hasLoadedRef.current) return;
      void loadPageRef.current(1, true);
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [user?.id]);

  useEffect(() => {
    return subscribeWalletActivityChanged(() => {
      if (!user?.id || !hasLoadedRef.current) return;
      void loadPageRef.current(1, true);
    });
  }, [user?.id]);

  const onRefresh = () => {
    setRefreshing(true);
    loadPage(1, true);
  };

  const onLoadMore = () => {
    if (loadingMore || loading || page >= totalPages) return;
    setLoadingMore(true);
    loadPage(page + 1, false);
  };

  const dismissSheet = useCallback(() => {
    detailRequestRef.current += 1;
    setSelectedEntry(null);
    setDetailLoading(false);
  }, []);

  const openEntry = useCallback(
    async (item: LedgerEntry) => {
      void hapticSelection();
      setSelectedEntry(item);
      const requestId = ++detailRequestRef.current;

      let id = walletId;
      if (!id) {
        try {
          const balance = await getWalletBalance();
          id = balance.id;
          setWalletId(id);
        } catch {
          return;
        }
      }
      if (!id) return;

      setDetailLoading(true);
      try {
        const full = await getWalletLedgerEntry(id, item.id);
        if (detailRequestRef.current !== requestId) return;
        if (full?.id) setSelectedEntry(full);
      } catch {
        // Keep list row
      } finally {
        if (detailRequestRef.current === requestId) {
          setDetailLoading(false);
        }
      }
    },
    [walletId],
  );

  const copyValue = useCallback(
    async (value: string) => {
      try {
        await navigator.clipboard.writeText(value);
        void hapticSelection();
        showMessage('Copied — send this to support if you need help.');
      } catch {
        showMessage('Could not copy. Long-press the value to select it.');
      }
    },
    [showMessage],
  );

  if (loading && entries.length === 0) {
    return (
      <div className="bidi-app-loading" style={{ backgroundColor: tokens.surfaceBg }}>
        <div className="bidi-spinner" style={{ borderTopColor: tokens.brand.accent500 }} />
      </div>
    );
  }

  const sheetTitle = selectedEntry
    ? ledgerReasonLabel(String(selectedEntry.reason))
    : 'Activity';
  const sheetSubtitle = selectedEntry
    ? ledgerSubtitle(selectedEntry) || 'Wallet activity'
    : '';
  const sheetCredit = selectedEntry?.direction === 'CREDIT';
  const sheetAmount = selectedEntry
    ? formatMoney(selectedEntry.amount, selectedEntry.currency || 'GHS').replace(/^GHS\s*/, '')
    : '';
  const sheetCategory = selectedEntry
    ? signalCategoryFromReason(selectedEntry.reason)
    : null;
  const detailRows = selectedEntry ? ledgerDetailRows(selectedEntry) : [];
  const factRows = detailRows.filter((r) => r.label !== 'Amount' && r.label !== 'Direction');

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <div className="bidi-page-head">
          <div>
            <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
              Wallet activity
            </h1>
            <p className="bidi-page-subtitle" style={{ color: tokens.textSecondary }}>
              Top-ups, purchases, and refunds
            </p>
          </div>
          <button type="button" className="bidi-icon-btn" onClick={onRefresh} disabled={refreshing}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <CrossPlatformHint
          needsPin={user?.needsPin}
          needsProfile={user?.needsProfile}
          visible={!bannerDismissed}
          onDismiss={dismissBanner}
        />

        {entries.length === 0 ? (
          <EmptyState
            title="You're all caught up"
            subtitle="New activity shows up here — top-ups, token purchases, and refunds."
          />
        ) : (
          <>
            <div className="bidi-list">
              {entries.map((item) => (
                <LedgerRow key={item.id} item={item} onPress={() => void openEntry(item)} />
              ))}
            </div>
            {page < totalPages ? (
              <button
                type="button"
                className="bidi-btn-text bidi-mt-2"
                onClick={onLoadMore}
                disabled={loadingMore}
                style={{ color: tokens.brand.accent500 }}
              >
                {loadingMore ? 'Loading…' : 'Load more'}
              </button>
            ) : (
              <p className="bidi-hint bidi-mt-3" style={{ color: tokens.textTertiary, textAlign: 'center' }}>
                You&apos;re all caught up — new activity shows up here
              </p>
            )}
          </>
        )}

        <MomoTrustFooter />
      </div>

      <Sheet open={!!selectedEntry} onClose={dismissSheet} ariaLabel="Activity details">
        {selectedEntry ? (
          <div className="bidi-sheet-body">
            <div className="bidi-ledger-hero">
              <CategoryIconChip category={sheetCategory} size={56} accessibilityLabel={`${sheetTitle} category`} />
              <h2 className="bidi-sheet-title bidi-mt-2" style={{ color: tokens.textPrimary }}>
                {sheetTitle}
              </h2>
              {sheetSubtitle ? (
                <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
                  {sheetSubtitle}
                </p>
              ) : null}
              <div
                className="tabular-nums bidi-ledger-hero-amt"
                style={{
                  ...tabularNumsStyle,
                  color: sheetCredit ? tokens.brand.success : tokens.brand.error,
                }}
              >
                {sheetCredit ? '+' : '−'}
                {sheetAmount}
              </div>
              <span
                className="bidi-pill bidi-mt-2"
                style={{
                  backgroundColor: sheetCredit ? `${tokens.brand.success}22` : `${tokens.brand.error}22`,
                  color: sheetCredit ? tokens.brand.success : tokens.brand.error,
                }}
              >
                {sheetCredit ? 'Credit' : 'Debit'}
              </span>
            </div>

            {detailLoading ? (
              <div className="bidi-inline-loading bidi-mt-2">
                <div className="bidi-spinner bidi-spinner--small" style={{ borderTopColor: tokens.brand.accent500 }} />
              </div>
            ) : null}

            <div
              className="bidi-fact-list bidi-mt-3"
              style={{ backgroundColor: tokens.surfaceSunken }}
            >
              {factRows.map((row, index) => (
                <FactRow
                  key={row.label}
                  row={row}
                  isLast={index === factRows.length - 1}
                  onCopy={copyValue}
                />
              ))}
            </div>

            <button type="button" className="bidi-btn-text bidi-mt-3" onClick={dismissSheet}>
              Close
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
