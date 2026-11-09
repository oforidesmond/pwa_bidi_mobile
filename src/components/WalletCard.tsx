import { useBidiTheme } from '@/context/ThemeContext';
import { getBidiLogo } from '@/utils/bidi-logo';
import {
  formatDisplayMoney,
  formatMaskedMoney,
  tabularNumsStyle,
} from '@/utils/currency-display';
import { hapticSelection } from '@/utils/haptics';
import { storage } from '@/lib/storage';
import { useEffect, useState, type ReactNode } from 'react';

const BALANCE_PRIVACY_KEY = 'bidi_balance_hidden';

type Props = {
  balance: string | number | null | undefined;
  currency?: string;
  loading?: boolean;
  pendingLabel?: string | null;
  footer?: ReactNode;
  topRight?: ReactNode;
};

export function WalletCard({
  balance,
  currency = 'GHS',
  loading,
  pendingLabel,
  footer,
  topRight,
}: Props) {
  const { tokens } = useBidiTheme();
  const [hidden, setHidden] = useState(false);

  useEffect(() => {
    void storage.getItem(BALANCE_PRIVACY_KEY).then((v) => {
      if (v === '1') setHidden(true);
    });
  }, []);

  const toggleHidden = () => {
    void hapticSelection();
    setHidden((prev) => {
      const next = !prev;
      void storage.setItem(BALANCE_PRIVACY_KEY, next ? '1' : '0');
      return next;
    });
  };

  const display = hidden ? formatMaskedMoney(currency) : formatDisplayMoney(balance, currency);
  const logoSrc = getBidiLogo('dark');

  return (
    <div className="bidi-wallet-card-wrap">
      <div className="bidi-wallet-card">
        <div className="bidi-wallet-card__shine" aria-hidden />
        <div className="bidi-wallet-card__top">
          <img src={logoSrc} alt="Bidi" className="bidi-wallet-card__logo" />
          <div className="bidi-wallet-card__top-right">{topRight}</div>
        </div>
        <div
          className="bidi-wallet-card__label"
          style={{ color: tokens.onGradientMuted }}
        >
          Wallet balance
        </div>
        <div className="bidi-wallet-card__balance-row">
          <div
            className="bidi-wallet-card__balance tabular-nums"
            style={{
              ...tabularNumsStyle,
              color: tokens.onGradient,
              opacity: loading ? 0.35 : 1,
            }}
          >
            {loading ? formatMaskedMoney(currency) : display}
          </div>
          <button
            type="button"
            className="bidi-icon-btn"
            onClick={toggleHidden}
            disabled={loading}
            aria-label={hidden ? 'Show balance' : 'Hide balance'}
          >
            <span className="material-symbols-outlined" aria-hidden>
              {hidden ? 'visibility_off' : 'visibility'}
            </span>
          </button>
        </div>
        {pendingLabel ? (
          <p className="bidi-wallet-card__pending" style={{ color: tokens.onGradientMuted }}>
            {pendingLabel}
          </p>
        ) : null}
        {footer ? <div className="bidi-wallet-card__footer">{footer}</div> : null}
      </div>
    </div>
  );
}
