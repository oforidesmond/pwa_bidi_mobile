import type { FundingProvider } from '@/types';
import { fundingProviderLabel } from '@/constants/funding';

type Props = {
  provider: FundingProvider | null;
  label?: string | null;
  size?: number;
  mutedColor?: string;
};

const LOGOS: Record<FundingProvider, string> = {
  MTN_MOMO: '/momo/mtn_logo.png',
  VODAFONE_CASH: '/momo/telecel_logo.png',
  AIRTELTIGO_MONEY: '/momo/at_logo.png',
};

export function MomoProviderBadge({
  provider,
  label,
  size = 22,
  mutedColor = '#9CA3AF',
}: Props) {
  if (!provider) {
    return (
      <div
        className="bidi-momo-badge bidi-momo-badge--unknown"
        style={{ width: size, height: size, borderColor: mutedColor }}
        aria-label="Network not detected yet"
      >
        <span style={{ color: mutedColor, fontSize: size * 0.55, fontWeight: 700 }}>?</span>
      </div>
    );
  }

  const full = label ?? fundingProviderLabel(provider);

  return (
    <div className="bidi-momo-badge" style={{ height: size }} aria-label={full}>
      <img
        src={LOGOS[provider]}
        alt=""
        width={size}
        height={size}
        className="bidi-momo-badge__logo"
        style={{ width: size, height: size }}
      />
      {label ? (
        <span className="bidi-momo-badge__label" style={{ marginLeft: 6 }}>
          {label}
        </span>
      ) : null}
    </div>
  );
}
