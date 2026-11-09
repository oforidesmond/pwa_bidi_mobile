import { SignalPalette, type SignalCategory } from '@/theme/bidi-theme';
import { useBidiTheme } from '@/context/ThemeContext';
import type { LedgerReason } from '@/types';

const CATEGORY_ICONS: Record<SignalCategory, string> = {
  topup: 'account_balance_wallet',
  purchase: 'confirmation_number',
  redemption: 'local_gas_station',
  loyalty: 'star',
  fuelSale: 'local_gas_station',
};

export function signalCategoryFromReason(reason: LedgerReason | string): SignalCategory | null {
  switch (String(reason).toUpperCase()) {
    case 'TOPUP':
    case 'TRANSFER_IN':
    case 'BUSINESS_ALLOCATION':
      return 'topup';
    case 'REFUND':
      return 'topup';
    case 'TOKEN_PURCHASE':
      return 'purchase';
    case 'FUEL_REDEMPTION':
      return 'redemption';
    case 'LOYALTY_REWARD':
    case 'REFERRAL_BONUS':
      return 'loyalty';
    case 'AGENT_COMMISSION':
      return 'fuelSale';
    default:
      return null;
  }
}

type Props = {
  category: SignalCategory | null;
  size?: number;
  accessibilityLabel?: string;
};

export function CategoryIconChip({ category, size = 40, accessibilityLabel }: Props) {
  const { tokens } = useBidiTheme();
  const bg = category ? SignalPalette[category] : tokens.surfaceSunken;
  const icon = category ? CATEGORY_ICONS[category] : 'swap_horiz';
  const iconColor = category ? tokens.onGradient : tokens.textSecondary;
  const radius = Math.round(size * 0.28);

  return (
    <div
      className="bidi-category-chip"
      style={{
        width: size,
        height: size,
        borderRadius: radius,
        backgroundColor: bg,
      }}
      role="img"
      aria-label={accessibilityLabel}
    >
      <span className="material-symbols-outlined" style={{ fontSize: size * 0.5, color: iconColor }}>
        {icon}
      </span>
    </div>
  );
}
