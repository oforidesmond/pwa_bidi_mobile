import { getDriverTransactions } from '@/api/driver';
import { CategoryIconChip } from '@/components/CategoryIconChip';
import { EmptyState } from '@/components/EmptyState';
import { UssdSetupBanner } from '@/components/UssdSetupBanner';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useSetupBanner } from '@/context/SetupBannerContext';
import { useBidiTheme } from '@/context/ThemeContext';
import type { Transaction } from '@/types';
import { formatAxiosError } from '@/utils/apiMessage';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import { hapticSelection } from '@/utils/haptics';
import { setTokenDetailPayload } from '@/utils/token-cache';
import {
  isActiveToken,
  isRefundedTokenStatus,
  tokenStatusCategory,
  tokenStatusLabel,
} from '@/utils/token-status';
import { useCallback, useEffect, useRef, useState } from 'react';
import { useNavigate } from 'react-router-dom';

function formatShortTime(iso: string): string {
  const d = new Date(iso);
  if (Number.isNaN(d.getTime())) return '';
  return d.toLocaleString(undefined, {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
}

function tokenLabel(token?: string | null): string {
  if (!token) return 'Fuel token';
  if (token.length <= 10) return token;
  return `${token.slice(0, 4)}…${token.slice(-4)}`;
}

function TokenRow({ item, onPress }: { item: Transaction; onPress: () => void }) {
  const { tokens } = useBidiTheme();
  const statusLabel = tokenStatusLabel(item.status);
  const category = tokenStatusCategory(item.status);
  const active = isActiveToken(item.status);
  const amount = formatDisplayMoney(item.amount);
  const when = formatShortTime(item.createdAt);
  const label = tokenLabel(item.token);

  return (
    <button
      type="button"
      className="bidi-list-row"
      style={{ backgroundColor: tokens.surfaceElevated }}
      onClick={onPress}
    >
      <CategoryIconChip category={category} size={40} accessibilityLabel={`${statusLabel} token`} />
      <div className="bidi-list-row__mid">
        <div className="bidi-list-row__title" style={{ color: tokens.textPrimary }}>
          {label}
        </div>
        <div className="bidi-list-row__sub" style={{ color: tokens.textSecondary }}>
          {statusLabel}
          {when ? ` · ${when}` : ''}
        </div>
      </div>
      <div
        className="tabular-nums bidi-list-row__amt"
        style={{
          ...tabularNumsStyle,
          color: active
            ? tokens.brand.success
            : isRefundedTokenStatus(item.status)
              ? tokens.brand.accent500
              : tokens.textSecondary,
        }}
      >
        {amount}
      </div>
    </button>
  );
}

export default function TokensPage() {
  const [transactions, setTransactions] = useState<Transaction[]>([]);
  const [status, setStatus] = useState<'ALL' | 'USED' | 'UNUSED'>('ALL');
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const knownIdsRef = useRef<Set<string>>(new Set());

  const { user } = useAuth();
  const { showMessage } = useFeedback();
  const { dismissed: bannerDismissed, dismiss: dismissBanner } = useSetupBanner();
  const { tokens } = useBidiTheme();
  const navigate = useNavigate();

  const fetchTransactions = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.soft) setLoading(true);
      try {
        const data = await getDriverTransactions(status === 'ALL' ? undefined : status);
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { data?: unknown })?.data)
            ? ((data as { data: Transaction[] }).data)
            : [];
        knownIdsRef.current = new Set(list.map((t: Transaction) => String(t.id)));
        setTransactions(list);
      } catch (e) {
        showMessage(formatAxiosError(e, 'Could not load tokens'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, status, showMessage],
  );

  useEffect(() => {
    void fetchTransactions();
  }, [fetchTransactions]);

  useEffect(() => {
    const onVis = () => {
      if (document.visibilityState !== 'visible') return;
      if (knownIdsRef.current.size > 0) {
        void fetchTransactions({ soft: true });
      }
    };
    document.addEventListener('visibilitychange', onVis);
    return () => document.removeEventListener('visibilitychange', onVis);
  }, [fetchTransactions]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchTransactions({ soft: true });
  };

  const openDetail = (item: Transaction) => {
    void hapticSelection();
    const id = item.id.toString();
    setTokenDetailPayload({
      ...item,
      id,
      token: item.token || '',
      amount: String(item.amount ?? ''),
      rejectionReason: item.rejectionReason ?? null,
    });
    navigate(`/app/tokens/${id}`);
  };

  if (loading && transactions.length === 0) {
    return (
      <div className="bidi-app-loading" style={{ backgroundColor: tokens.surfaceBg }}>
        <div className="bidi-spinner" style={{ borderTopColor: tokens.brand.accent500 }} />
      </div>
    );
  }

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <div className="bidi-page-head">
          <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
            My Fuel Tokens
          </h1>
          <button
            type="button"
            className="bidi-icon-btn"
            onClick={onRefresh}
            disabled={refreshing}
            aria-label="Refresh tokens"
          >
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        <UssdSetupBanner
          needsPin={user?.needsPin}
          needsProfile={user?.needsProfile}
          visible={!bannerDismissed}
          onDismiss={dismissBanner}
        />

        <div className="bidi-segmented" role="group" aria-label="Token filter">
          {(
            [
              { v: 'ALL' as const, label: 'All' },
              { v: 'UNUSED' as const, label: 'Unused' },
              { v: 'USED' as const, label: 'Used' },
            ] as const
          ).map(({ v, label }) => (
            <button
              key={v}
              type="button"
              className={`bidi-segmented__btn${status === v ? ' bidi-segmented__btn--active' : ''}`}
              style={{
                backgroundColor: status === v ? tokens.accentTint : 'transparent',
                color: status === v ? tokens.brand.accent600 : tokens.textSecondary,
              }}
              onClick={() => setStatus(v)}
            >
              {label}
            </button>
          ))}
        </div>

        {transactions.length === 0 ? (
          <EmptyState title="No tokens yet" subtitle="Buy a fuel token to see it here." />
        ) : (
          <div className="bidi-list">
            {transactions.map((item) => (
              <TokenRow key={String(item.id)} item={item} onPress={() => openDetail(item)} />
            ))}
          </div>
        )}
      </div>
    </div>
  );
}
