/**
 * Bidi Design Language tokens for the PWA.
 * Source: BiDi_MOBILE_DESIGN_LANGUAGE.md (ported from mobile constants/bidi-theme.ts)
 */

/** Brand core — never redefine these hex values outside this file. */
export const BrandCore = {
  chartreuse: '#C1F80A',
  peaGreen: '#39B54A',
  eucalyptus: '#003A1D',
  black: '#000000',

  accent50: '#EAF8ED',
  accent100: '#D3F0D8',
  accent500: '#39B54A',
  accent600: '#2E9A3D',
  accent700: '#1F7A2C',

  success: '#10B981',
  warning: '#F59E0B',
  error: '#EF4444',
} as const;

/** Signal Palette — categorization only (chips, badges). Never buttons/nav/body text. */
export const SignalPalette = {
  topup: '#0A84FF',
  purchase: '#F59E0B',
  redemption: '#EF4444',
  loyalty: '#AF52DE',
  fuelSale: '#39B54A',
} as const;

export type SignalCategory = keyof typeof SignalPalette;

/** Card & gradient system — stop colors only. */
export const CardGradients = {
  wallet: ['#003A1D', '#0E6B34', '#39B54A'] as const,
  token: ['#1F7A2C', '#39B54A'] as const,
  shine: ['rgba(255,255,255,0.14)', 'rgba(255,255,255,0)'] as const,
  avatar: ['#003A1D', '#39B54A'] as const,
  shadowColor: 'rgba(0,58,29,0.35)',
  shadowColorSecondary: 'rgba(0,0,0,0.25)',
} as const;

export type SurfaceScheme = {
  surfaceBg: string;
  surfaceElevated: string;
  surfaceSunken: string;
  textPrimary: string;
  textSecondary: string;
  textTertiary: string;
  divider: string;
  accentTint: string;
  onGradient: string;
  onGradientMuted: string;
  onGradientSubtle: string;
  onGradientOverlay: string;
  scrim: string;
  scrimHeavy: string;
};

export const LightSurfaces: SurfaceScheme = {
  surfaceBg: '#F7F9F8',
  surfaceElevated: '#FFFFFF',
  surfaceSunken: '#EFF4F1',
  textPrimary: '#0F1F16',
  textSecondary: 'rgba(15,31,22,0.62)',
  textTertiary: 'rgba(15,31,22,0.38)',
  divider: 'rgba(15,31,22,0.08)',
  accentTint: BrandCore.accent50,
  onGradient: '#FFFFFF',
  onGradientMuted: 'rgba(255,255,255,0.72)',
  onGradientSubtle: 'rgba(255,255,255,0.65)',
  onGradientOverlay: 'rgba(255,255,255,0.2)',
  scrim: 'rgba(0,0,0,0.5)',
  scrimHeavy: 'rgba(0,0,0,0.8)',
};

export const DarkSurfaces: SurfaceScheme = {
  surfaceBg: '#0A0F0C',
  surfaceElevated: '#14201A',
  surfaceSunken: '#1C2A22',
  textPrimary: '#F2F7F4',
  textSecondary: 'rgba(242,247,244,0.64)',
  textTertiary: 'rgba(242,247,244,0.40)',
  divider: 'rgba(242,247,244,0.08)',
  accentTint: 'rgba(57,181,74,0.16)',
  onGradient: '#FFFFFF',
  onGradientMuted: 'rgba(255,255,255,0.72)',
  onGradientSubtle: 'rgba(255,255,255,0.65)',
  onGradientOverlay: 'rgba(255,255,255,0.2)',
  scrim: 'rgba(0,0,0,0.5)',
  scrimHeavy: 'rgba(0,0,0,0.8)',
};

export type BidiSemanticTokens = SurfaceScheme & {
  brand: typeof BrandCore;
  signal: typeof SignalPalette;
  card: typeof CardGradients;
  scheme: 'light' | 'dark';
};

export function getSemanticTokens(scheme: 'light' | 'dark'): BidiSemanticTokens {
  const surfaces = scheme === 'light' ? LightSurfaces : DarkSurfaces;
  return {
    ...surfaces,
    brand: BrandCore,
    signal: SignalPalette,
    card: CardGradients,
    scheme,
  };
}

/** Apply CSS custom properties on :root / documentElement. */
export function applyThemeCssVars(scheme: 'light' | 'dark') {
  const t = getSemanticTokens(scheme);
  const root = document.documentElement;
  root.dataset.theme = scheme;
  root.style.setProperty('--surface-bg', t.surfaceBg);
  root.style.setProperty('--surface-elevated', t.surfaceElevated);
  root.style.setProperty('--surface-sunken', t.surfaceSunken);
  root.style.setProperty('--text-primary', t.textPrimary);
  root.style.setProperty('--text-secondary', t.textSecondary);
  root.style.setProperty('--text-tertiary', t.textTertiary);
  root.style.setProperty('--divider', t.divider);
  root.style.setProperty('--accent-tint', t.accentTint);
  root.style.setProperty('--scrim', t.scrim);
  root.style.setProperty('--brand-accent', BrandCore.accent500);
  root.style.setProperty('--brand-accent-600', BrandCore.accent600);
  root.style.setProperty('--brand-accent-700', BrandCore.accent700);
  root.style.setProperty('--brand-eucalyptus', BrandCore.eucalyptus);
  root.style.setProperty('--brand-chartreuse', BrandCore.chartreuse);
  root.style.setProperty('--color-error', BrandCore.error);
  root.style.setProperty('--color-success', BrandCore.success);
  root.style.setProperty('--color-warning', BrandCore.warning);
  root.style.setProperty('--radius', '12px');
  root.style.setProperty('--wallet-grad', `linear-gradient(135deg, ${CardGradients.wallet.join(', ')})`);
  root.style.setProperty('--token-grad', `linear-gradient(135deg, ${CardGradients.token.join(', ')})`);
  root.style.setProperty('--avatar-grad', `linear-gradient(135deg, ${CardGradients.avatar.join(', ')})`);
}
