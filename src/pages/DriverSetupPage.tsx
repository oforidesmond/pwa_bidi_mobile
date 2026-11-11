import {
  completeDriverProfile,
  setDriverPin,
} from '@/api/auth';
import api from '@/api/index';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { setTrustedDriverPhone } from '@/lib/driverDeviceTrust';
import { applyDriverFlags } from '@/utils/driverUser';
import { formatApiMessage } from '@/utils/apiMessage';
import { useState } from 'react';
import { Navigate, useNavigate } from 'react-router-dom';

function isPin4(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

/** In-app residual setup when needsPin / needsProfile after an earlier session. */
export default function DriverSetupPage() {
  const { user, token, setAuth } = useAuth();
  const { tokens } = useBidiTheme();
  const { showAlert } = useDialog();
  const navigate = useNavigate();

  const needsPin = !!user?.needsPin;
  const needsProfile = !!user?.needsProfile;

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  if (!user || user.ownerType !== 'DRIVER') {
    return <Navigate to="/app" replace />;
  }
  if (!needsPin && !needsProfile) {
    return <Navigate to="/app/driver" replace />;
  }

  const pinOk = isPin4(pin);
  const confirmOk = isPin4(confirmPin) && pin.trim() === confirmPin.trim();
  const namesOk = firstName.trim().length > 0 && lastName.trim().length > 0;

  const handleSave = async () => {
    if (needsPin && (!pinOk || !confirmOk)) {
      setError('Enter a 4-digit PIN and confirm it matches');
      return;
    }
    if (needsProfile && !namesOk) {
      setError('Enter your first and last name');
      return;
    }
    if (!token) {
      setError('Session expired. Sign in again.');
      return;
    }

    setLoading(true);
    setError('');
    try {
      api.defaults.headers.Authorization = `Bearer ${token}`;
      if (needsPin) {
        const res = await setDriverPin({
          pin,
          confirmPin,
          ...(needsProfile
            ? { firstName: firstName.trim(), lastName: lastName.trim() }
            : {}),
        });
        await setAuth({
          user: applyDriverFlags(user, res.driver),
          token,
        });
        await setTrustedDriverPhone(res.driver.phone ?? user.phone ?? '');
      } else {
        const res = await completeDriverProfile(firstName, lastName);
        await setAuth({
          user: applyDriverFlags(user, res.driver),
          token,
        });
        await setTrustedDriverPhone(res.driver.phone ?? user.phone ?? '');
      }
      navigate('/app/driver', { replace: true });
    } catch (err: unknown) {
      const ax = err as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(ax?.response?.data?.message, 'Setup failed');
      setError(msg);
      showAlert({ title: 'Setup failed', message: msg });
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        <h1 className="bidi-page-title" style={{ color: tokens.textPrimary }}>
          Finish setup
        </h1>
        <p className="bidi-page-subtitle" style={{ color: tokens.textSecondary }}>
          {needsPin && needsProfile
            ? 'Add your name and create a PIN used on this app and USSD.'
            : needsPin
              ? 'Create a 4-digit PIN used on this app and USSD.'
              : 'Add your name to finish your profile.'}
        </p>

        <div className="bidi-card" style={{ backgroundColor: tokens.surfaceElevated }}>
          {needsProfile ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  First name
                </span>
                <input
                  className="bidi-input"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  autoComplete="given-name"
                  value={firstName}
                  onChange={(e) => setFirstName(e.target.value)}
                />
              </label>
              <label className="bidi-field bidi-mt-3">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Last name
                </span>
                <input
                  className="bidi-input"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  autoComplete="family-name"
                  value={lastName}
                  onChange={(e) => setLastName(e.target.value)}
                />
              </label>
            </>
          ) : null}

          {needsPin ? (
            <>
              <label className={`bidi-field${needsProfile ? ' bidi-mt-3' : ''}`}>
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Create PIN
                </span>
                <input
                  className="bidi-input tabular-nums"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                />
              </label>
              <label className="bidi-field bidi-mt-3">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Confirm PIN
                </span>
                <input
                  className="bidi-input tabular-nums"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="new-password"
                  value={confirmPin}
                  onChange={(e) =>
                    setConfirmPin(e.target.value.replace(/\D/g, '').slice(0, 4))
                  }
                  maxLength={4}
                />
              </label>
            </>
          ) : null}

          <p className="bidi-hint bidi-mt-3" style={{ color: tokens.textSecondary }}>
            Your wallet and PIN stay in sync with USSD.
          </p>
          {error ? <p className="bidi-field__error">{error}</p> : null}
          <button
            type="button"
            className="bidi-btn bidi-btn--primary bidi-mt-4"
            onClick={() => void handleSave()}
            disabled={
              loading ||
              (needsPin && (!pinOk || !confirmOk)) ||
              (needsProfile && !namesOk)
            }
          >
            {loading ? 'Saving…' : 'Save and continue'}
          </button>
        </div>
      </div>
    </div>
  );
}
