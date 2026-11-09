import { useBidiTheme } from '@/context/ThemeContext';
import type { ReactNode } from 'react';

type Props = {
  title: string;
  subtitle?: string;
  actionLabel?: string;
  onAction?: () => void;
  illustration?: ReactNode;
};

function DefaultIllustration() {
  const { tokens } = useBidiTheme();
  return (
    <svg width={140} height={120} viewBox="0 0 140 120" aria-hidden>
      <circle cx={70} cy={58} r={42} fill={tokens.brand.accent50} />
      <circle cx={70} cy={58} r={28} fill={tokens.brand.accent100} />
      <rect x={48} y={40} width={44} height={40} rx={8} fill={tokens.brand.eucalyptus} />
      <path d="M58 52h24v4H58zm0 10h18v4H58z" fill={tokens.brand.peaGreen} />
      <circle cx={98} cy={36} r={10} fill={tokens.brand.chartreuse} opacity={0.85} />
      <path
        d="M70 88c-14 0-26 6-30 14h60c-4-8-16-14-30-14z"
        fill={tokens.brand.peaGreen}
        opacity={0.35}
      />
    </svg>
  );
}

export function EmptyState({ title, subtitle, actionLabel, onAction, illustration }: Props) {
  const { tokens } = useBidiTheme();

  return (
    <div
      className="bidi-empty-state"
      style={{ backgroundColor: tokens.surfaceElevated }}
    >
      {illustration ?? <DefaultIllustration />}
      <h3 className="bidi-empty-state__title" style={{ color: tokens.textPrimary }}>
        {title}
      </h3>
      {subtitle ? (
        <p className="bidi-empty-state__subtitle" style={{ color: tokens.textSecondary }}>
          {subtitle}
        </p>
      ) : null}
      {actionLabel && onAction ? (
        <button type="button" className="bidi-btn bidi-btn--primary bidi-mt-4" onClick={onAction}>
          {actionLabel}
        </button>
      ) : null}
    </div>
  );
}
