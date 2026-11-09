import { getAttendantSales } from '@/api/attendant';
import { CategoryIconChip } from '@/components/CategoryIconChip';
import { EmptyState } from '@/components/EmptyState';
import { Sheet } from '@/components/Sheet';
import { useAuth } from '@/context/AuthContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useBidiTheme } from '@/context/ThemeContext';
import type { Transaction } from '@/types';
import { formatAxiosError } from '@/utils/apiMessage';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import { hapticSelection } from '@/utils/haptics';
import { useCallback, useEffect, useState } from 'react';

function productName(item: Transaction): string {
  return (
    item.productCatalog?.name ||
    item.catalog?.name ||
    item.product?.name ||
    item.product?.type ||
    'Fuel sale'
  );
}

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

function DetailRow({ label, value }: { label: string; value: string }) {
  const { tokens } = useBidiTheme();
  return (
    <div className="bidi-detail-block">
      <div className="bidi-detail-label" style={{ color: tokens.textTertiary }}>
        {label}
      </div>
      <div
        className="tabular-nums bidi-detail-value"
        style={{ ...tabularNumsStyle, color: tokens.textPrimary }}
      >
        {value}
      </div>
    </div>
  );
}

function SaleRow({ item, onPress }: { item: Transaction; onPress: () => void }) {
  const { tokens } = useBidiTheme();
  const name = productName(item);
  const amount = formatDisplayMoney(item.amount);
  const when = formatShortTime(item.createdAt);

  return (
    <button
      type="button"
      className="bidi-list-row"
      style={{ backgroundColor: tokens.surfaceElevated }}
      onClick={onPress}
    >
      <CategoryIconChip category="fuelSale" size={40} accessibilityLabel="Fuel sale category" />
      <div className="bidi-list-row__mid">
        <div className="bidi-list-row__title" style={{ color: tokens.textPrimary }}>
          {name}
        </div>
        {when ? (
          <div className="bidi-list-row__sub" style={{ color: tokens.textSecondary }}>
            {when}
          </div>
        ) : null}
      </div>
      <div
        className="tabular-nums bidi-list-row__amt"
        style={{ ...tabularNumsStyle, color: tokens.brand.success }}
      >
        {amount}
      </div>
    </button>
  );
}

export default function SalesPage() {
  const { tokens } = useBidiTheme();
  const { user } = useAuth();
  const { showMessage } = useFeedback();
  const [sales, setSales] = useState<Transaction[]>([]);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [selectedSale, setSelectedSale] = useState<Transaction | null>(null);

  const fetchSales = useCallback(
    async (opts?: { soft?: boolean }) => {
      if (!user?.id) {
        setLoading(false);
        setRefreshing(false);
        return;
      }
      if (!opts?.soft) setLoading(true);
      try {
        const data = await getAttendantSales(user.id);
        const list = Array.isArray(data)
          ? data
          : Array.isArray((data as { data?: unknown })?.data)
            ? (data as { data: Transaction[] }).data
            : [];
        setSales(list);
      } catch (e) {
        showMessage(formatAxiosError(e, 'Could not load sales'));
      } finally {
        setLoading(false);
        setRefreshing(false);
      }
    },
    [user?.id, showMessage],
  );

  useEffect(() => {
    void fetchSales();
  }, [fetchSales]);

  const onRefresh = () => {
    setRefreshing(true);
    void fetchSales({ soft: true });
  };

  const openSale = (item: Transaction) => {
    void hapticSelection();
    setSelectedSale(item);
  };

  const dismissSheet = () => setSelectedSale(null);

  const copyToken = async () => {
    if (!selectedSale?.token) return;
    try {
      await navigator.clipboard.writeText(selectedSale.token);
      showMessage('Token copied to clipboard');
    } catch {
      showMessage('Could not copy');
    }
  };

  if (loading && sales.length === 0) {
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
          <div>
            <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
              Sales
            </h1>
            <p className="bidi-page-subtitle" style={{ color: tokens.textSecondary }}>
              Your recent completed fuel transactions
            </p>
          </div>
          <button type="button" className="bidi-icon-btn" onClick={onRefresh} disabled={refreshing}>
            <span className="material-symbols-outlined">refresh</span>
          </button>
        </div>

        {sales.length === 0 ? (
          <EmptyState
            title="No sales yet"
            subtitle="Completed transactions will appear here"
          />
        ) : (
          <div className="bidi-list">
            {sales.map((item) => (
              <SaleRow key={String(item.id)} item={item} onPress={() => openSale(item)} />
            ))}
          </div>
        )}
      </div>

      <Sheet open={!!selectedSale} onClose={dismissSheet} ariaLabel="Sale details">
        {selectedSale ? (
          <div className="bidi-sheet-body">
            <h2 className="bidi-sheet-title" style={{ color: tokens.textPrimary }}>
              Sale details
            </h2>
            <p className="bidi-sheet-message" style={{ color: tokens.textSecondary }}>
              Completed fuel transaction
            </p>
            <DetailRow label="Amount" value={formatDisplayMoney(selectedSale.amount)} />
            {selectedSale.liters != null ? (
              <DetailRow
                label="Volume"
                value={`${Number(selectedSale.liters).toLocaleString(undefined, {
                  maximumFractionDigits: 3,
                })} L`}
              />
            ) : null}
            <DetailRow label="Product" value={productName(selectedSale)} />
            <DetailRow
              label="Date"
              value={new Date(selectedSale.createdAt).toLocaleString()}
            />
            {selectedSale.station?.name ? (
              <DetailRow label="Station" value={selectedSale.station.name} />
            ) : null}
            {selectedSale.pump?.pumpNumber != null ? (
              <DetailRow label="Pump" value={`Pump ${selectedSale.pump.pumpNumber}`} />
            ) : null}
            {selectedSale.token ? (
              <div className="bidi-detail-block">
                <div className="bidi-detail-label" style={{ color: tokens.textTertiary }}>
                  Token
                </div>
                <code className="bidi-token-mono" style={{ color: tokens.textPrimary }}>
                  {selectedSale.token}
                </code>
                <button
                  type="button"
                  className="bidi-btn bidi-btn--outline bidi-mt-2"
                  onClick={() => void copyToken()}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Copy token
                </button>
              </div>
            ) : null}
            <button type="button" className="bidi-btn-text bidi-mt-3" onClick={dismissSheet}>
              Close
            </button>
          </div>
        ) : null}
      </Sheet>
    </div>
  );
}
