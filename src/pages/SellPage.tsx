import {
  calculateLiters,
  confirmToken,
  getAttendantPumps,
  getAvailableProducts,
  getTokenDetails,
  normalizeAvailableProducts,
  rejectToken,
  reserveToken,
  resolvePumpForProduct,
  searchTokens,
  type AttendantProductOption,
  type AttendantPumpOption,
} from '@/api/attendant';
import { createIdempotencyKey } from '@/api/idempotency';
import { QrScanner } from '@/components/QrScanner';
import { Sheet } from '@/components/Sheet';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useFeedback } from '@/context/FeedbackContext';
import { useBidiTheme } from '@/context/ThemeContext';
import type { Transaction } from '@/types';
import { formatAxiosError } from '@/utils/apiMessage';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import { toDisplayLocalPhone } from '@/utils/ghana-momo';
import { hapticError, hapticSuccess } from '@/utils/haptics';
import {
  isTerminalFulfillment,
  tokenStatusLabel,
  tokenStatusPill,
} from '@/utils/token-status';
import { useEffect, useMemo, useRef, useState } from 'react';

function isTokenTerminal(txn: Transaction | null): boolean {
  if (!txn) return false;
  return isTerminalFulfillment(txn.status);
}

function driverDisplayName(txn: Transaction): string {
  const name = [txn.driver?.firstName, txn.driver?.lastName].filter(Boolean).join(' ').trim();
  return name || 'N/A';
}

function driverDisplayPhone(txn: Transaction): string {
  const phone = txn.driver?.phone?.trim();
  if (!phone) return 'N/A';
  return toDisplayLocalPhone(phone) || phone;
}

function formatLiters(value: number): string {
  return value.toLocaleString(undefined, {
    minimumFractionDigits: 0,
    maximumFractionDigits: 3,
  });
}

export default function SellPage() {
  const { tokens } = useBidiTheme();
  const { user } = useAuth();
  const { showMessage } = useFeedback();
  const { showConfirm } = useDialog();

  const [tokenInput, setTokenInput] = useState('');
  const [scanVisible, setScanVisible] = useState(false);

  const [selectedProduct, setSelectedProduct] = useState('');
  const [selectedProductId, setSelectedProductId] = useState<string | null>(null);
  const [selectedPump, setSelectedPump] = useState<{
    id: string;
    pumpNumber: number | string;
    dispenserId: string;
  } | null>(null);
  const [stationId, setStationId] = useState<string | null>(null);
  const [pumps, setPumps] = useState<AttendantPumpOption[]>([]);
  const [productOptions, setProductOptions] = useState<AttendantProductOption[]>([]);
  const [pumpsLoadError, setPumpsLoadError] = useState<string | null>(null);
  const [lookupLoading, setLookupLoading] = useState(false);
  const [litersLoading, setLitersLoading] = useState(false);
  const [completeLoading, setCompleteLoading] = useState(false);
  const [rejectLoading, setRejectLoading] = useState(false);
  const [fetched, setFetched] = useState<Transaction | null>(null);
  const [error, setError] = useState('');
  const [liters, setLiters] = useState<number | null>(null);
  const [pricePerLiter, setPricePerLiter] = useState<number | string | null>(null);
  const [searchResults, setSearchResults] = useState<string[]>([]);
  const [showDropdown, setShowDropdown] = useState(false);
  const searchDebounce = useRef<ReturnType<typeof setTimeout> | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);
  const hasScannedRef = useRef(false);
  const litersRequestRef = useRef(0);
  const reserveIdempotencyKey = useRef<string | null>(null);
  const confirmIdempotencyKey = useRef<string | null>(null);
  const rejectIdempotencyKey = useRef<string | null>(null);

  const handlePaste = async () => {
    try {
      const text = await navigator.clipboard.readText();
      if (text) setTokenInput(text.trim());
    } catch {
      showMessage('Paste failed — copy the token first.');
    }
  };

  const handleOpenScanner = () => {
    hasScannedRef.current = false;
    setScanVisible(true);
  };

  const resetSelection = () => {
    setSelectedProduct('');
    setSelectedProductId(null);
    setSelectedPump(null);
    setLiters(null);
    setPricePerLiter(null);
    setLitersLoading(false);
  };

  useEffect(() => {
    const run = async () => {
      if (!user?.id) return;
      setPumpsLoadError(null);
      try {
        const avail = await getAvailableProducts();
        let boot = normalizeAvailableProducts(avail as Record<string, unknown>);

        if (boot.pumps.length === 0) {
          try {
            const assigned = await getAttendantPumps(user.id);
            const list = Array.isArray(assigned)
              ? assigned
              : (assigned as { pumps?: unknown; data?: unknown })?.pumps ??
                (assigned as { data?: unknown })?.data ??
                [];
            boot = normalizeAvailableProducts({
              station: (avail as { station?: unknown })?.station,
              stationId: boot.stationId,
              products: boot.products,
              assignedPumps: list as Record<string, unknown>[],
            });
          } catch {
            // keep bootstrap
          }
        }

        setStationId(boot.stationId);
        setProductOptions(boot.products);
        setPumps(boot.pumps);
        if (boot.pumps.length === 0) {
          setPumpsLoadError(
            'No pumps assigned to this attendant. Ask a manager to assign pumps.',
          );
          showMessage('No pumps assigned to this attendant. Ask a manager to assign pumps.');
        }
      } catch (e) {
        const message = formatAxiosError(e, 'Could not load station products');
        setPumps([]);
        setProductOptions([]);
        setPumpsLoadError(message);
        showMessage(message);
      }
    };
    void run();
  }, [user?.id, showMessage]);

  const sellableProducts = useMemo(() => {
    if (pumps.length === 0) return [];
    return productOptions.filter((product) =>
      Boolean(resolvePumpForProduct(pumps, product.id, product.name)),
    );
  }, [productOptions, pumps]);

  const handleLookup = async (overrideToken?: string) => {
    const token = (overrideToken ?? tokenInput).trim();
    if (!token) {
      setError('Enter a valid token');
      return;
    }
    setError('');
    setFetched(null);
    resetSelection();
    reserveIdempotencyKey.current = null;
    confirmIdempotencyKey.current = null;
    rejectIdempotencyKey.current = null;
    setLookupLoading(true);
    try {
      const data = (await getTokenDetails(token)) as Transaction;
      if (isTokenTerminal(data)) {
        await hapticError();
        setError(
          `This token is already ${tokenStatusLabel(data.status).toLowerCase()} and cannot be used.`,
        );
        return;
      }
      setFetched(data);
    } catch {
      setError('Token not found. Please verify and try again.');
    } finally {
      setLookupLoading(false);
    }
  };

  const handleSelectProduct = async (product: AttendantProductOption) => {
    if (!fetched || !tokenInput.trim() || isTokenTerminal(fetched)) return;

    const pump = resolvePumpForProduct(pumps, product.id, product.name);
    setSelectedProduct(product.name);
    setSelectedProductId(product.id);
    setLiters(null);
    setPricePerLiter(product.pricePerLiter ?? null);
    setError('');

    if (!pump || !pump.dispenserId) {
      setSelectedPump(null);
      setError(`No assigned pump for ${product.name}. Ask a manager to assign one.`);
      return;
    }

    setSelectedPump({
      id: pump.id,
      pumpNumber: pump.pumpNumber,
      dispenserId: pump.dispenserId,
    });

    const requestId = ++litersRequestRef.current;
    setLitersLoading(true);
    try {
      const res = (await calculateLiters(tokenInput.trim(), product.name)) as
        | number
        | {
            liters?: number;
            pricePerLiter?: number | string;
          };
      if (requestId !== litersRequestRef.current) return;
      const value = typeof res === 'number' ? res : res?.liters;
      if (value == null) throw new Error('Invalid response');
      setLiters(value);
      if (typeof res === 'object' && res?.pricePerLiter != null) {
        setPricePerLiter(res.pricePerLiter);
      }
    } catch (e: unknown) {
      if (requestId !== litersRequestRef.current) return;
      setLiters(null);
      setError(formatAxiosError(e, 'Could not calculate liters for this product.'));
    } finally {
      if (requestId === litersRequestRef.current) {
        setLitersLoading(false);
      }
    }
  };

  useEffect(() => {
    const q = tokenInput.trim();
    if (!q) {
      setSearchResults([]);
      setShowDropdown(false);
      return;
    }

    if (q.length < 2) {
      setSearchResults([]);
      setShowDropdown(true);
      return;
    }

    if (searchDebounce.current) clearTimeout(searchDebounce.current);

    searchDebounce.current = setTimeout(async () => {
      try {
        const results = await searchTokens(q);
        setSearchResults(results);
        setShowDropdown(true);
      } catch {
        setSearchResults([]);
        setShowDropdown(true);
      }
    }, 300);

    return () => {
      if (searchDebounce.current) clearTimeout(searchDebounce.current);
    };
  }, [tokenInput]);

  const buildPayload = () => {
    if (!selectedPump || !stationId || !selectedProductId || liters == null) return null;
    return {
      stationId,
      dispenserId: selectedPump.dispenserId,
      pumpId: selectedPump.id,
      productCatalogId: selectedProductId,
      liters,
    };
  };

  const handleComplete = async () => {
    if (!fetched || !tokenInput.trim()) return;
    if (isTokenTerminal(fetched)) {
      showMessage(`Token is already ${tokenStatusLabel(fetched.status).toLowerCase()}.`);
      return;
    }
    if (!selectedProduct || !selectedProductId) {
      setError('Select a product');
      return;
    }
    if (!selectedPump || !stationId) {
      setError('No assigned pump for this product. Ask a manager to assign one.');
      return;
    }
    if (liters == null) {
      setError('Liters are still calculating. Wait a moment and try again.');
      return;
    }
    setError('');
    setCompleteLoading(true);
    const payload = buildPayload();
    if (!payload) {
      setCompleteLoading(false);
      return;
    }
    if (!reserveIdempotencyKey.current) {
      reserveIdempotencyKey.current = createIdempotencyKey();
    }
    if (!confirmIdempotencyKey.current) {
      confirmIdempotencyKey.current = createIdempotencyKey();
    }
    try {
      await reserveToken(tokenInput.trim(), payload, reserveIdempotencyKey.current);
      await confirmToken(tokenInput.trim(), payload, confirmIdempotencyKey.current);
      reserveIdempotencyKey.current = null;
      confirmIdempotencyKey.current = null;
      await hapticSuccess();
      showMessage('Transaction complete. Token redeemed.');
      setFetched({ ...fetched, status: 'REDEEMED' });
      resetSelection();
      setTokenInput('');
    } catch (e: unknown) {
      await hapticError();
      setError(formatAxiosError(e, 'Failed to complete transaction.'));
    } finally {
      setCompleteLoading(false);
    }
  };

  const performReject = async (reason?: string) => {
    if (!fetched || !tokenInput.trim()) return;
    if (isTokenTerminal(fetched)) {
      showMessage(`Token is already ${tokenStatusLabel(fetched.status).toLowerCase()}.`);
      return;
    }
    setError('');
    setRejectLoading(true);
    if (!rejectIdempotencyKey.current) {
      rejectIdempotencyKey.current = createIdempotencyKey();
    }
    try {
      const result = await rejectToken(
        tokenInput.trim(),
        reason,
        rejectIdempotencyKey.current,
      );
      rejectIdempotencyKey.current = null;
      reserveIdempotencyKey.current = null;
      await hapticSuccess();
      const refunded = result?.refunded;
      if (refunded != null && String(refunded).trim() !== '') {
        showMessage(
          `Token rejected. Refunded ${formatDisplayMoney(refunded)} to the driver wallet.`,
        );
      } else {
        showMessage('Token rejected. No refund due (already reversed).');
      }
      setFetched({
        ...fetched,
        status: 'REJECTED',
        rejectionReason:
          result?.rejectionReason ??
          (reason?.trim() ? reason.trim() : fetched.rejectionReason) ??
          null,
      });
      resetSelection();
      setTokenInput('');
    } catch (e: unknown) {
      await hapticError();
      setError(formatAxiosError(e, 'Failed to reject token.'));
    } finally {
      setRejectLoading(false);
    }
  };

  const handleReject = () => {
    if (!fetched || !tokenInput.trim()) return;
    showConfirm({
      title: 'Reject token?',
      message:
        'Rejecting returns the prepaid purchase to the driver wallet automatically. This cannot be undone.',
      confirmLabel: 'Reject',
      cancelLabel: 'Cancel',
      destructive: true,
      promptPlaceholder: 'Reason (optional)',
      onConfirm: (r) => {
        void performReject(r);
      },
    });
  };

  const disabledComplete =
    !fetched ||
    isTokenTerminal(fetched) ||
    !selectedProduct ||
    !selectedProductId ||
    !selectedPump ||
    liters == null ||
    litersLoading;
  const disabledReject =
    !fetched || isTokenTerminal(fetched) || completeLoading || rejectLoading;

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
          Sell Fuel
        </h1>

        <div className={fetched ? 'bidi-layout-split bidi-layout-split--natural' : undefined}>
          <div className={fetched ? 'bidi-layout-split__primary' : undefined}>
            <section className="bidi-card" style={{ backgroundColor: tokens.surfaceElevated }}>
              <div className="bidi-token-field-wrap">
                <label className="bidi-field">
                  <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                    Token
                  </span>
                  <div className="bidi-field__row">
                    <input
                      ref={inputRef}
                      className="bidi-input"
                      placeholder="Enter token number"
                      value={tokenInput}
                      onChange={(e) => setTokenInput(e.target.value)}
                      onFocus={() => tokenInput && setShowDropdown(true)}
                      onBlur={() => setTimeout(() => setShowDropdown(false), 150)}
                      autoCapitalize="off"
                      autoCorrect="off"
                      spellCheck={false}
                      aria-label="Fuel token input"
                    />
                    <button
                      type="button"
                      className="bidi-icon-btn"
                      onClick={() => void handlePaste()}
                      aria-label="Paste"
                    >
                      <span className="material-symbols-outlined">content_paste</span>
                    </button>
                    <button
                      type="button"
                      className="bidi-icon-btn"
                      onClick={handleOpenScanner}
                      aria-label="Scan token QR code"
                    >
                      <span className="material-symbols-outlined">qr_code_scanner</span>
                    </button>
                  </div>
                </label>

                {showDropdown ? (
                  <div
                    className="bidi-dropdown"
                    style={{ backgroundColor: tokens.surfaceSunken, borderColor: tokens.divider }}
                  >
                    {tokenInput.trim().length < 2 ? (
                      <div className="bidi-dropdown__row" style={{ color: tokens.textTertiary }}>
                        Type at least 2 characters…
                      </div>
                    ) : searchResults.length === 0 ? (
                      <div className="bidi-dropdown__row" style={{ color: tokens.textTertiary }}>
                        No results
                      </div>
                    ) : (
                      searchResults.map((item) => (
                        <button
                          key={item}
                          type="button"
                          className="bidi-dropdown__item"
                          onMouseDown={(e) => e.preventDefault()}
                          onClick={() => {
                            setTokenInput(item);
                            setShowDropdown(false);
                          }}
                        >
                          {item}
                        </button>
                      ))
                    )}
                  </div>
                ) : null}

                {error ? (
                  <p className="bidi-field__error" role="alert">
                    {error}
                  </p>
                ) : null}

                <button
                  type="button"
                  className="bidi-btn bidi-btn--primary bidi-mt-3"
                  onClick={() => void handleLookup()}
                  disabled={lookupLoading}
                >
                  {lookupLoading ? 'Loading…' : 'Fetch Token Details'}
                </button>
              </div>
            </section>
          </div>

          {fetched ? (
            <div className="bidi-layout-split__aside">
              <section className="bidi-card bidi-mt-3" style={{ backgroundColor: tokens.surfaceElevated }}>
                <h2 className="bidi-section-title" style={{ color: tokens.textPrimary }}>
                  Token Details
                </h2>
                <ul className="bidi-detail-list">
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Token</span>
                    <span style={{ color: tokens.textPrimary }}>{fetched.token || 'N/A'}</span>
                  </li>
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Driver</span>
                    <span style={{ color: tokens.textPrimary }}>{driverDisplayName(fetched)}</span>
                  </li>
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Phone</span>
                    <span style={{ color: tokens.textPrimary }}>{driverDisplayPhone(fetched)}</span>
                  </li>
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Amount</span>
                    <span style={{ color: tokens.textPrimary }}>GHS {fetched.amount ?? 'N/A'}</span>
                  </li>
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Issued</span>
                    <span style={{ color: tokens.textPrimary }}>
                      {new Date(fetched.createdAt).toLocaleString()}
                    </span>
                  </li>
                  <li>
                    <span style={{ color: tokens.textTertiary }}>Status</span>
                    <span style={{ color: tokens.textPrimary }}>{tokenStatusPill(fetched.status)}</span>
                  </li>
                </ul>

                <h3
                  className="bidi-section-title bidi-mt-3"
                  style={{ color: tokens.textPrimary, fontSize: '0.95rem' }}
                >
                  Product
                </h3>

                {pumpsLoadError ? (
                  <p className="bidi-field__error" role="alert">
                    {pumpsLoadError}
                  </p>
                ) : pumps.length === 0 ? (
                  <p className="bidi-hint" style={{ color: tokens.textTertiary }}>
                    No pumps assigned to your account yet.
                  </p>
                ) : sellableProducts.length === 0 ? (
                  <p className="bidi-hint" style={{ color: tokens.textTertiary }}>
                    No products match your assigned pumps. Ask a manager to check assignments.
                  </p>
                ) : (
                  <div
                    className="bidi-product-select"
                    role="listbox"
                    aria-label="Select fuel product"
                    style={{ borderColor: tokens.divider, backgroundColor: tokens.surfaceSunken }}
                  >
                    {sellableProducts.map((item) => {
                      const selected = selectedProductId === item.id;
                      const displayPrice =
                        selected && pricePerLiter != null
                          ? pricePerLiter
                          : item.pricePerLiter;
                      return (
                        <button
                          key={item.id}
                          type="button"
                          role="option"
                          aria-selected={selected}
                          className={
                            selected
                              ? 'bidi-product-select__item bidi-product-select__item--selected'
                              : 'bidi-product-select__item'
                          }
                          style={{
                            borderColor: selected ? tokens.brand.accent500 : 'transparent',
                            backgroundColor: selected ? tokens.accentTint : 'transparent',
                            color: tokens.textPrimary,
                          }}
                          onClick={() => void handleSelectProduct(item)}
                          disabled={isTokenTerminal(fetched) || completeLoading || rejectLoading}
                        >
                          <span className="bidi-product-select__main">
                            <span className="bidi-product-select__name">{item.name}</span>
                            {displayPrice != null && displayPrice !== '' ? (
                              <span
                                className="bidi-product-select__price"
                                style={{ ...tabularNumsStyle, color: tokens.textSecondary }}
                              >
                                {formatDisplayMoney(displayPrice)}/L
                              </span>
                            ) : null}
                          </span>
                          {selected ? (
                            <span
                              className="bidi-product-select__liters"
                              style={{ ...tabularNumsStyle, color: tokens.textPrimary }}
                            >
                              {litersLoading
                                ? 'Calculating…'
                                : liters != null
                                  ? `${formatLiters(liters)} L`
                                  : '—'}
                            </span>
                          ) : null}
                        </button>
                      );
                    })}
                  </div>
                )}

                <button
                  type="button"
                  className="bidi-btn bidi-btn--primary bidi-mt-3"
                  onClick={() => void handleComplete()}
                  disabled={disabledComplete || completeLoading}
                >
                  {completeLoading ? 'Completing…' : 'Transaction Complete'}
                </button>
                <button
                  type="button"
                  className="bidi-btn bidi-btn--danger-outline bidi-mt-2"
                  onClick={handleReject}
                  disabled={disabledReject || rejectLoading}
                >
                  {rejectLoading ? 'Rejecting…' : 'Reject Token'}
                </button>
              </section>
            </div>
          ) : null}
        </div>
      </div>

      <Sheet open={scanVisible} onClose={() => setScanVisible(false)} ariaLabel="QR scanner">
        <QrScanner
          onScan={(code) => {
            if (!hasScannedRef.current && code) {
              hasScannedRef.current = true;
              setTokenInput(code);
              setScanVisible(false);
              void handleLookup(code);
            }
          }}
          onClose={() => setScanVisible(false)}
        />
      </Sheet>
    </div>
  );
}
