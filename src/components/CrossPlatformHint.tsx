import { useBidiTheme } from '@/context/ThemeContext';
import { Link } from 'react-router-dom';

const USSD_CODE = import.meta.env.VITE_USSD_CODE as string | undefined;

function ussdCode(): string {
  const fallback = '*928*198#';
  const raw = (USSD_CODE && String(USSD_CODE).trim()) || fallback;
  // dotenv strips an unquoted trailing # as a comment — restore if missing
  if (/^\*\d+(\*\d+)*$/.test(raw)) return `${raw}#`;
  return raw;
}

type Props = {
  needsPin?: boolean;
  needsProfile?: boolean;
  visible?: boolean;
  onDismiss?: () => void;
};

/** Finish-setup CTA when flags remain; otherwise a subtle USSD/app continuity tip. */
export function CrossPlatformHint({
  needsPin,
  needsProfile,
  visible = true,
  onDismiss,
}: Props) {
  const { tokens } = useBidiTheme();
  if (!visible) return null;

  const needsSetup = !!(needsPin || needsProfile);
  const code = ussdCode();

  if (needsSetup) {
    const detail =
      needsPin && needsProfile
        ? 'Add your name and create a PIN to finish setup.'
        : needsPin
          ? 'Create a 4-digit PIN to finish setup.'
          : 'Add your name to finish your profile.';

    return (
      <div
        className="bidi-banner"
        style={{ backgroundColor: tokens.accentTint }}
        role="status"
      >
        <span className="material-symbols-outlined bidi-banner__icon" aria-hidden>
          lock_reset
        </span>
        <p className="bidi-banner__text" style={{ color: tokens.textPrimary }}>
          {detail}{' '}
          <Link to="/app/setup" style={{ color: tokens.brand.accent500 }}>
            Continue setup
          </Link>
        </p>
        {onDismiss ? (
          <button type="button" className="bidi-banner__dismiss" onClick={onDismiss}>
            Dismiss
          </button>
        ) : null}
      </div>
    );
  }

  return (
    <div
      className="bidi-banner bidi-banner--subtle"
      style={{ backgroundColor: tokens.surfaceElevated }}
      role="note"
    >
      <span className="material-symbols-outlined bidi-banner__icon" aria-hidden>
        perm_phone_msg
      </span>
      <p className="bidi-banner__text" style={{ color: tokens.textSecondary }}>
        You can also buy tokens and top up by dialing {code}. Same wallet and PIN
        everywhere.
      </p>
      {onDismiss ? (
        <button type="button" className="bidi-banner__dismiss" onClick={onDismiss}>
          Dismiss
        </button>
      ) : null}
    </div>
  );
}

/** @deprecated Use CrossPlatformHint — kept for any residual imports during migrate. */
export function ussdSetupMessage(
  needsPin?: boolean,
  needsProfile?: boolean,
): string | null {
  if (!needsPin && !needsProfile) return null;
  if (needsPin && needsProfile) {
    return 'Add your name and create a PIN to finish setup.';
  }
  if (needsPin) return 'Create a 4-digit PIN to finish setup.';
  return 'Add your name to finish your profile.';
}
