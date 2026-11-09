import { SignalPalette } from '@/theme/bidi-theme';
import { useBidiTheme } from '@/context/ThemeContext';
import { formatDisplayMoney, tabularNumsStyle } from '@/utils/currency-display';
import {
  isActiveToken,
  normalizeTokenStatus,
  tokenStatusPill,
} from '@/utils/token-status';
import type { ReactNode, Ref } from 'react';

function pillColor(status?: string | null): string {
  switch (normalizeTokenStatus(status)) {
    case 'REDEEMED':
    case 'USED':
      return SignalPalette.redemption;
    case 'REJECTED':
    case 'REVERSED':
      return SignalPalette.topup;
    case 'RESERVED':
      return SignalPalette.fuelSale;
    case 'EXPIRED':
      return SignalPalette.loyalty;
    default:
      return SignalPalette.fuelSale;
  }
}

type ArtifactActionProps = {
  icon: string;
  label: string;
  onPress: () => void;
  disabled?: boolean;
  accessibilityLabel: string;
  color: string;
};

function ArtifactAction({
  icon,
  label,
  onPress,
  disabled,
  accessibilityLabel,
  color,
}: ArtifactActionProps) {
  const { tokens } = useBidiTheme();
  return (
    <button
      type="button"
      className="bidi-artifact-action"
      onClick={onPress}
      disabled={disabled}
      aria-label={accessibilityLabel}
      style={{ opacity: disabled ? 0.4 : 1 }}
    >
      <span className="material-symbols-outlined" style={{ fontSize: 26, color }} aria-hidden>
        {icon}
      </span>
      <span
        className="bidi-artifact-action__label"
        style={{ color: tokens.onGradient }}
      >
        {label}
      </span>
    </button>
  );
}

type Props = {
  tokenCode: string;
  amount: string | number | null | undefined;
  currency?: string;
  issuedAt?: string;
  status?: string | null;
  onPress?: () => void;
  onQr?: () => void;
  onShare?: () => void;
  onCopy?: () => void;
  sharing?: boolean;
  footer?: ReactNode;
  cardRef?: Ref<HTMLDivElement>;
};

export function TokenArtifactCard({
  tokenCode,
  amount,
  currency = 'GHS',
  issuedAt,
  status,
  onPress,
  onQr,
  onShare,
  onCopy,
  sharing,
  cardRef,
}: Props) {
  const { tokens } = useBidiTheme();
  const statusLabel = tokenStatusPill(status);
  const statusColor = pillColor(status);
  const redeemable = isActiveToken(status);
  const gradient = `var(--token-grad)`;

  const inner = (
    <>
      <div className="bidi-token-card__shine" aria-hidden />
      <div className="bidi-token-card__header">
        <div className="bidi-token-card__header-left">
          <div className="bidi-token-card__eyebrow" style={{ color: tokens.onGradientMuted }}>
            Fuel token
          </div>
          <div
            className="bidi-token-card__amount tabular-nums"
            style={{ ...tabularNumsStyle, color: tokens.onGradient }}
          >
            {formatDisplayMoney(amount, currency)}
          </div>
        </div>
        <div
          className="bidi-token-card__pill"
          style={{ backgroundColor: statusColor }}
          aria-label={`Status ${statusLabel}`}
        >
          {statusLabel}
        </div>
      </div>
      <div className="bidi-token-card__code" style={{ color: tokens.onGradient }}>
        {tokenCode}
      </div>
      {issuedAt ? (
        <p className="bidi-token-card__issued" style={{ color: tokens.onGradientSubtle }}>
          Issued {issuedAt}
        </p>
      ) : null}
      <div
        className="bidi-token-card__actions"
        style={{ borderTopColor: tokens.onGradientOverlay }}
      >
        <ArtifactAction
          icon="qr_code_2"
          label="QR"
          onPress={() => onQr?.()}
          disabled={!redeemable || !onQr}
          accessibilityLabel="Show token QR code"
          color={tokens.onGradient}
        />
        <ArtifactAction
          icon="share"
          label="Share"
          onPress={() => onShare?.()}
          disabled={!!sharing || !onShare}
          accessibilityLabel="Share fuel token receipt"
          color={tokens.onGradient}
        />
        <ArtifactAction
          icon="content_copy"
          label="Copy"
          onPress={() => onCopy?.()}
          disabled={!onCopy}
          accessibilityLabel="Copy token code"
          color={tokens.onGradient}
        />
      </div>
    </>
  );

  return (
    <div ref={cardRef} className="bidi-token-card-wrap">
      {onPress ? (
        <button
          type="button"
          className="bidi-token-card"
          style={{ background: gradient }}
          onClick={onPress}
          aria-label={`Open token ${tokenCode}`}
        >
          {inner}
        </button>
      ) : (
        <div className="bidi-token-card" style={{ background: gradient }}>
          {inner}
        </div>
      )}
    </div>
  );
}
