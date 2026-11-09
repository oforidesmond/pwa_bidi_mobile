import { normalizePhone, requestDriverOtp, verifyDriverOtp } from '@/api/auth';
import api from '@/api/index';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';
import { ussdSetupMessage } from '@/components/UssdSetupBanner';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useBidiTheme } from '@/context/ThemeContext';
import type { User } from '@/types';
import { formatApiMessage } from '@/utils/apiMessage';
import { getBidiLogo } from '@/utils/bidi-logo';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** Cooldown after each successful send before the next is allowed. After the last, resend stops. */
const RESEND_COOLDOWNS_SEC = [30, 60] as const;
/** 1 initial send + RESEND_COOLDOWNS_SEC.length resends, then exhausted. */
const MAX_OTP_SENDS = RESEND_COOLDOWNS_SEC.length + 1;

function maskPhone(digits: string): string {
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.min(digits.length - 4, 6))}${digits.slice(-4)}`;
}

export default function DriverLoginPage() {
  const [step, setStep] = useState<'phone' | 'otp'>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [verifyLoading, setVerifyLoading] = useState(false);
  const [verifyError, setVerifyError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);

  const { setAuth } = useAuth();
  const { showAlert } = useDialog();
  const { scheme, tokens } = useBidiTheme();
  const navigate = useNavigate();

  const digits = normalizePhone(phone);
  const phoneOk = digits.length >= 9;
  const codeOk = code.trim().length >= 4;
  const resendExhausted = otpSendCount >= MAX_OTP_SENDS;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  const handleRequestOtp = async () => {
    if (!phoneOk) {
      showAlert({
        title: 'Error',
        message: 'Enter a valid phone number (at least 9 digits)',
      });
      return;
    }
    if (step === 'otp' && (resendExhausted || resendCooldown > 0)) return;

    setRequestLoading(true);
    setDebugCode(null);
    setVerifyError('');
    try {
      const res = await requestDriverOtp(phone);
      if (res.debugCode) setDebugCode(String(res.debugCode));
      const nextCount = otpSendCount + 1;
      setOtpSendCount(nextCount);
      const cooldown = RESEND_COOLDOWNS_SEC[nextCount - 1];
      setResendCooldown(cooldown ?? 0);
      setStep('otp');
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      showAlert({
        title: 'Failed',
        message: formatApiMessage(ax?.response?.data?.message),
      });
    } finally {
      setRequestLoading(false);
    }
  };

  const handleWrongNumber = () => {
    setStep('phone');
    setCode('');
    setVerifyError('');
    setDebugCode(null);
    setResendCooldown(0);
    setOtpSendCount(0);
  };

  const handleVerify = async () => {
    if (!phoneOk || !codeOk) return;
    setVerifyLoading(true);
    setVerifyError('');
    try {
      const response = (await verifyDriverOtp(phone, code)) as {
        access_token: string;
        driver: {
          id: string;
          phone?: string;
          firstName?: string | null;
          lastName?: string | null;
          ownerType?: 'DRIVER';
          needsPin?: boolean;
          needsProfile?: boolean;
        };
      };
      const token = response.access_token;
      const driver = response.driver;

      api.defaults.headers.Authorization = `Bearer ${token}`;

      const user: User = {
        id: driver.id,
        email: null,
        phone: driver.phone ?? digits,
        firstName: driver.firstName ?? null,
        lastName: driver.lastName ?? null,
        role: null,
        roles: [],
        ownerType: 'DRIVER',
        needsPin: !!driver.needsPin,
        needsProfile: !!driver.needsProfile,
      };

      await setAuth({ user, token });

      const setupMsg = ussdSetupMessage(user.needsPin, user.needsProfile);
      if (setupMsg) {
        showAlert({ title: 'Almost there', message: setupMsg });
      }
      navigate('/app', { replace: true });
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Invalid or expired code. Request a new OTP if needed.',
      );
      setVerifyError(msg);
      showAlert({ title: 'Verification failed', message: msg });
    } finally {
      setVerifyLoading(false);
    }
  };

  return (
    <div className="bidi-page bidi-page--auth" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-auth-card-wrap">
        <div className="bidi-auth-header">
          <img
            src={getBidiLogo(scheme, 'large')}
            alt="Bidi logo"
            width={200}
            height={106}
            className="bidi-auth-logo"
          />
          <h1 className="bidi-auth-title" style={{ color: tokens.textPrimary }}>
            {step === 'phone' ? 'Welcome Back' : 'Enter code'}
          </h1>
          <p className="bidi-auth-subtitle" style={{ color: tokens.textSecondary }}>
            {step === 'phone'
              ? 'Sign in with OTP'
              : `We sent a code to ${maskPhone(digits)}`}
          </p>
        </div>

        <div className="bidi-card" style={{ backgroundColor: tokens.surfaceElevated }}>
          {step === 'phone' ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Phone number
                </span>
                <div className="bidi-field__row">
                  <span className="material-symbols-outlined bidi-field__prefix" aria-hidden>
                    phone
                  </span>
                  <input
                    className="bidi-input"
                    style={{ backgroundColor: tokens.surfaceElevated }}
                    inputMode="tel"
                    autoComplete="tel"
                    value={phone}
                    onChange={(e) => setPhone(e.target.value)}
                    aria-invalid={phone.length > 0 && !phoneOk}
                  />
                </div>
                {phone.length > 0 && !phoneOk ? (
                  <span className="bidi-field__error">Enter at least 9 digits</span>
                ) : null}
              </label>
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleRequestOtp()}
                disabled={requestLoading || !phoneOk}
              >
                {requestLoading ? 'Sending…' : 'Send code'}
              </button>
            </>
          ) : (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  One-time code
                </span>
                <input
                  className="bidi-input tabular-nums"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={8}
                />
              </label>
              {verifyError ? <p className="bidi-field__error">{verifyError}</p> : null}
              {import.meta.env.DEV && debugCode ? (
                <p className="bidi-debug-code" style={{ color: tokens.textTertiary }}>
                  Debug code: {debugCode}
                </p>
              ) : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleVerify()}
                disabled={verifyLoading || !codeOk}
              >
                {verifyLoading ? 'Verifying…' : 'Verify'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={handleWrongNumber}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Wrong number
                </button>
                {resendExhausted ? null : (
                  <button
                    type="button"
                    className="bidi-link"
                    onClick={() => void handleRequestOtp()}
                    disabled={requestLoading || resendCooldown > 0}
                    style={{ color: tokens.brand.accent500 }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                )}
              </div>
              {resendExhausted ? (
                <p className="bidi-hint" style={{ color: tokens.textSecondary }}>
                  Still no code? Check the number and try again.
                </p>
              ) : null}
            </>
          )}
        </div>

        <Link to="/login-staff" className="bidi-link-driver">
          Staff? Sign in
        </Link>

        <AuthLegalFooter />
      </div>
    </div>
  );
}
