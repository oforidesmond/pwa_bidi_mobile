import { useBidiTheme } from '@/context/ThemeContext';

const PARTNER_LOGOS = [
  { key: 'mtn', src: '/momo/mtn_logo.png', label: 'MTN MoMo' },
  { key: 'telecel', src: '/momo/telecel_logo.png', label: 'Telecel Cash' },
  { key: 'at', src: '/momo/at_logo.png', label: 'AT Money' },
] as const;

type Props = {
  compact?: boolean;
};

export function MomoTrustFooter({ compact = false }: Props) {
  const { tokens } = useBidiTheme();
  const logoHeight = compact ? 22 : 26;
  const logoWidth = compact ? 40 : 48;

  return (
    <div
      className={compact ? 'bidi-momo-trust bidi-momo-trust--compact' : 'bidi-momo-trust'}
      role="text"
      aria-label="Encrypted and secured Mobile Money. Supported on MTN, Telecel, and AT."
    >
      <div className="bidi-momo-trust__row">
        <span className="material-symbols-outlined" style={{ fontSize: compact ? 14 : 16 }}>
          lock_outline
        </span>
        <span className="bidi-momo-trust__line" style={{ color: tokens.textSecondary }}>
          Encrypted & secured Mobile Money
        </span>
      </div>
      <div
        className={
          compact ? 'bidi-momo-trust__logos bidi-momo-trust__logos--compact' : 'bidi-momo-trust__logos'
        }
      >
        {PARTNER_LOGOS.map((logo) => (
          <img
            key={logo.key}
            src={logo.src}
            alt={logo.label}
            width={logoWidth}
            height={logoHeight}
            className="bidi-momo-trust__logo"
            style={{ width: logoWidth, height: logoHeight }}
          />
        ))}
      </div>
      <p className="bidi-momo-trust__nets" style={{ color: tokens.textTertiary }}>
        Supported on MTN, Telecel & AT
      </p>
    </div>
  );
}
