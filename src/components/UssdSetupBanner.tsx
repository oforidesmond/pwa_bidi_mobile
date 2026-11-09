import { useBidiTheme } from '@/context/ThemeContext';

const USSD_CODE = import.meta.env.VITE_USSD_CODE as string | undefined;

type Props = {
  needsPin?: boolean;
  needsProfile?: boolean;
  visible?: boolean;
  onDismiss?: () => void;
};

export function ussdSetupMessage(needsPin?: boolean, needsProfile?: boolean): string | null {
  if (!needsPin && !needsProfile) return null;
  const code = (USSD_CODE && String(USSD_CODE).trim()) || '*928*198#';
  if (needsPin && needsProfile) {
    return `Finish setting up your account. Dial ${code} to set a PIN and complete your profile.`;
  }
  if (needsPin) {
    return `Finish setting up your account. Dial ${code} to set a PIN.`;
  }
  return `Finish setting up your account. Dial ${code} to complete your profile.`;
}

export function UssdSetupBanner({ needsPin, needsProfile, visible = true, onDismiss }: Props) {
  const { tokens } = useBidiTheme();
  const message = ussdSetupMessage(needsPin, needsProfile);
  if (!message || !visible) return null;

  return (
    <div
      className="bidi-banner"
      style={{ backgroundColor: tokens.accentTint }}
      role="status"
    >
      <span className="material-symbols-outlined bidi-banner__icon" aria-hidden>
        perm_phone_msg
      </span>
      <p className="bidi-banner__text" style={{ color: tokens.textPrimary }}>
        {message}
      </p>
      {onDismiss ? (
        <button type="button" className="bidi-banner__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}
