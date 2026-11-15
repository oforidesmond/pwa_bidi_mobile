import {
  normalizePhone,
  requestStaffPasswordReset,
  resetStaffPassword,
  verifyStaffPasswordReset,
} from '@/api/auth';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';
import { useDialog } from '@/context/DialogContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { formatApiMessage } from '@/utils/apiMessage';
import { getBidiLogo } from '@/utils/bidi-logo';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** Cooldown after each successful send before the next is allowed. After the last, resend stops. */
const RESEND_COOLDOWNS_SEC = [30, 60] as const;
/** 1 initial send + RESEND_COOLDOWNS_SEC.length resends, then exhausted. */
const MAX_OTP_SENDS = RESEND_COOLDOWNS_SEC.length + 1;
const MIN_PASSWORD_LEN = 8;

type Step = 'phone' | 'otp' | 'password';

function maskPhone(digits: string): string {
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.min(digits.length - 4, 6))}${digits.slice(-4)}`;
}

export default function StaffForgotPasswordPage() {
  const [step, setStep] = useState<Step>('phone');
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [password, setPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [resetToken, setResetToken] = useState<string | null>(null);
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);

  const { showAlert } = useDialog();
  const { scheme, tokens } = useBidiTheme();
  const navigate = useNavigate();

  const digits = normalizePhone(phone);
  const phoneOk = digits.length >= 9;
  const codeOk = /^\d{6}$/.test(code.trim());
  const passwordOk = password.length >= MIN_PASSWORD_LEN;
  const confirmOk = passwordOk && password === confirmPassword;
  const resendExhausted = otpSendCount >= MAX_OTP_SENDS;

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  const resetOtpCounters = () => {
    setCode('');
    setDebugCode(null);
    setResendCooldown(0);
    setOtpSendCount(0);
    setFormError('');
  };

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
    setFormError('');
    try {
      const res = await requestStaffPasswordReset(phone);
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

  const handleVerifyOtp = async () => {
    if (!phoneOk || !codeOk) return;
    setSubmitLoading(true);
    setFormError('');
    try {
      const res = await verifyStaffPasswordReset(phone, code);
      setResetToken(res.resetToken);
      setPassword('');
      setConfirmPassword('');
      setStep('password');
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Invalid or expired code. Request a new code if needed.',
      );
      setFormError(msg);
      showAlert({ title: 'Verification failed', message: msg });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleResetPassword = async () => {
    if (!resetToken || !confirmOk) return;
    setSubmitLoading(true);
    setFormError('');
    try {
      const res = await resetStaffPassword({
        resetToken,
        password,
      });
      showAlert({
        title: 'Password updated',
        message: res.message ?? 'Password updated. Please log in.',
      });
      navigate('/login-staff', { replace: true });
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Could not update password. Request a new code and try again.',
      );
      setFormError(msg);
      showAlert({ title: 'Reset failed', message: msg });
    } finally {
      setSubmitLoading(false);
    }
  };

  const title =
    step === 'phone'
      ? 'Forgot password'
      : step === 'otp'
        ? 'Enter reset code'
        : 'Choose a new password';

  const subtitle =
    step === 'phone'
      ? 'We will text a code to your phone'
      : step === 'otp'
        ? `Code sent to ${maskPhone(digits)}`
        : 'Use at least 8 characters';

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
            {title}
          </h1>
          <p className="bidi-auth-subtitle" style={{ color: tokens.textSecondary }}>
            {subtitle}
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
                  />
                </div>
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
          ) : null}

          {step === 'otp' ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Reset code
                </span>
                <input
                  className="bidi-input tabular-nums"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  inputMode="numeric"
                  autoComplete="one-time-code"
                  value={code}
                  onChange={(e) => setCode(e.target.value.replace(/\D/g, '').slice(0, 6))}
                  maxLength={6}
                />
              </label>
              {formError ? <p className="bidi-field__error">{formError}</p> : null}
              {import.meta.env.DEV && debugCode ? (
                <p className="bidi-debug-code" style={{ color: tokens.textTertiary }}>
                  Debug code: {debugCode}
                </p>
              ) : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleVerifyOtp()}
                disabled={submitLoading || !codeOk}
              >
                {submitLoading ? 'Verifying…' : 'Continue'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => {
                    resetOtpCounters();
                    setResetToken(null);
                    setStep('phone');
                  }}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Change number
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
            </>
          ) : null}

          {step === 'password' ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  New password
                </span>
                <div className="bidi-field__row">
                  <span className="material-symbols-outlined bidi-field__prefix" aria-hidden>
                    lock
                  </span>
                  <input
                    className="bidi-input"
                    style={{ backgroundColor: tokens.surfaceElevated }}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    aria-invalid={password.length > 0 && !passwordOk}
                  />
                  <button
                    type="button"
                    className="bidi-icon-btn"
                    onClick={() => setShowPassword((v) => !v)}
                    aria-label={showPassword ? 'Hide password' : 'Show password'}
                  >
                    <span className="material-symbols-outlined" aria-hidden>
                      {showPassword ? 'visibility_off' : 'visibility'}
                    </span>
                  </button>
                </div>
                {password.length > 0 && !passwordOk ? (
                  <span className="bidi-field__error">
                    Password must be at least {MIN_PASSWORD_LEN} characters
                  </span>
                ) : null}
              </label>
              <label className="bidi-field bidi-mt-3">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  Confirm password
                </span>
                <div className="bidi-field__row">
                  <span className="material-symbols-outlined bidi-field__prefix" aria-hidden>
                    lock
                  </span>
                  <input
                    className="bidi-input"
                    style={{ backgroundColor: tokens.surfaceElevated }}
                    type={showPassword ? 'text' : 'password'}
                    autoComplete="new-password"
                    value={confirmPassword}
                    onChange={(e) => setConfirmPassword(e.target.value)}
                    aria-invalid={confirmPassword.length > 0 && !confirmOk}
                  />
                </div>
                {confirmPassword.length > 0 && password !== confirmPassword ? (
                  <span className="bidi-field__error">Passwords do not match</span>
                ) : null}
              </label>
              {formError ? <p className="bidi-field__error">{formError}</p> : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleResetPassword()}
                disabled={submitLoading || !confirmOk || !resetToken}
              >
                {submitLoading ? 'Updating…' : 'Update password'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => {
                    setResetToken(null);
                    setPassword('');
                    setConfirmPassword('');
                    setFormError('');
                    setStep('otp');
                  }}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Back
                </button>
              </div>
            </>
          ) : null}
        </div>

        <Link to="/login-staff" className="bidi-link-driver">
          Back to sign in
        </Link>

        <AuthLegalFooter />
      </div>
    </div>
  );
}
