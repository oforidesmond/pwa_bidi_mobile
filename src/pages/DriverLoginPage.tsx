import {
  completeDriverProfile,
  confirmDriverPinReset,
  loginWithDriverPin,
  normalizePhone,
  requestDriverOtp,
  requestDriverPinReset,
  setDriverPin,
  verifyDriverOtp,
  type DriverAuthDriver,
} from '@/api/auth';
import api from '@/api/index';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';
import { useAuth } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useBidiTheme } from '@/context/ThemeContext';
import {
  clearTrustedDriverPhone,
  getTrustedDriverPhone,
  setTrustedDriverPhone,
} from '@/lib/driverDeviceTrust';
import { applyDriverFlags, driverToUser } from '@/utils/driverUser';
import { formatApiMessage } from '@/utils/apiMessage';
import { getBidiLogo } from '@/utils/bidi-logo';
import { useEffect, useState } from 'react';
import { Link, useNavigate } from 'react-router-dom';

/** Cooldown after each successful send before the next is allowed. After the last, resend stops. */
const RESEND_COOLDOWNS_SEC = [30, 60] as const;
/** 1 initial send + RESEND_COOLDOWNS_SEC.length resends, then exhausted. */
const MAX_OTP_SENDS = RESEND_COOLDOWNS_SEC.length + 1;

type Step =
  | 'phone'
  | 'otp'
  | 'pin'
  | 'setup'
  | 'forgotOtp'
  | 'forgotPin';

function maskPhone(digits: string): string {
  if (digits.length <= 4) return digits;
  return `${'*'.repeat(Math.min(digits.length - 4, 6))}${digits.slice(-4)}`;
}

function isPin4(value: string): boolean {
  return /^\d{4}$/.test(value.trim());
}

export default function DriverLoginPage() {
  const [step, setStep] = useState<Step>('phone');
  const [bootstrapping, setBootstrapping] = useState(true);
  const [phone, setPhone] = useState('');
  const [code, setCode] = useState('');
  const [pin, setPin] = useState('');
  const [confirmPin, setConfirmPin] = useState('');
  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [debugCode, setDebugCode] = useState<string | null>(null);
  const [requestLoading, setRequestLoading] = useState(false);
  const [submitLoading, setSubmitLoading] = useState(false);
  const [formError, setFormError] = useState('');
  const [resendCooldown, setResendCooldown] = useState(0);
  const [otpSendCount, setOtpSendCount] = useState(0);
  const [needsPinSetup, setNeedsPinSetup] = useState(false);
  const [needsProfileSetup, setNeedsProfileSetup] = useState(false);

  const { setAuth, token: sessionToken, user: sessionUser } = useAuth();
  const { showAlert } = useDialog();
  const { scheme, tokens } = useBidiTheme();
  const navigate = useNavigate();

  const digits = normalizePhone(phone);
  const phoneOk = digits.length >= 9;
  const codeOk = code.trim().length >= 4;
  const pinOk = isPin4(pin);
  const confirmOk = isPin4(confirmPin) && pin.trim() === confirmPin.trim();
  const namesOk =
    firstName.trim().length > 0 && lastName.trim().length > 0;
  const resendExhausted = otpSendCount >= MAX_OTP_SENDS;

  useEffect(() => {
    let mounted = true;
    (async () => {
      const trusted = await getTrustedDriverPhone();
      if (!mounted) return;
      if (trusted) {
        setPhone(trusted);
        setStep('pin');
      }
      setBootstrapping(false);
    })();
    return () => {
      mounted = false;
    };
  }, []);

  useEffect(() => {
    if (resendCooldown <= 0) return;
    const id = window.setTimeout(() => setResendCooldown((s) => s - 1), 1000);
    return () => window.clearTimeout(id);
  }, [resendCooldown]);

  const enterApp = async (
    accessToken: string,
    driver: DriverAuthDriver,
    markTrusted: boolean,
  ) => {
    api.defaults.headers.Authorization = `Bearer ${accessToken}`;
    const user = driverToUser(driver, digits);
    await setAuth({ user, token: accessToken });
    if (markTrusted) {
      await setTrustedDriverPhone(driver.phone ?? digits);
    }

    if (user.needsPin || user.needsProfile) {
      setNeedsPinSetup(!!user.needsPin);
      setNeedsProfileSetup(!!user.needsProfile);
      setPin('');
      setConfirmPin('');
      setFirstName(user.needsProfile ? '' : user.firstName ?? '');
      setLastName(user.needsProfile ? '' : user.lastName ?? '');
      setFormError('');
      setStep('setup');
      return;
    }

    navigate('/app', { replace: true });
  };

  const handleRequestOtp = async (forForgot = false) => {
    if (!phoneOk) {
      showAlert({
        title: 'Error',
        message: 'Enter a valid phone number (at least 9 digits)',
      });
      return;
    }
    const onOtpStep = step === 'otp' || step === 'forgotOtp';
    if (onOtpStep && (resendExhausted || resendCooldown > 0)) return;

    setRequestLoading(true);
    setDebugCode(null);
    setFormError('');
    try {
      const res = forForgot
        ? await requestDriverPinReset(phone)
        : await requestDriverOtp(phone);
      if (res.debugCode) setDebugCode(String(res.debugCode));
      const nextCount = otpSendCount + 1;
      setOtpSendCount(nextCount);
      const cooldown = RESEND_COOLDOWNS_SEC[nextCount - 1];
      setResendCooldown(cooldown ?? 0);
      setStep(forForgot ? 'forgotOtp' : 'otp');
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

  const resetOtpCounters = () => {
    setCode('');
    setDebugCode(null);
    setResendCooldown(0);
    setOtpSendCount(0);
    setFormError('');
  };

  const handleUseDifferentNumber = async () => {
    await clearTrustedDriverPhone();
    setPhone('');
    setPin('');
    setConfirmPin('');
    resetOtpCounters();
    setStep('phone');
  };

  const handleVerifyOtp = async () => {
    if (!phoneOk || !codeOk) return;
    setSubmitLoading(true);
    setFormError('');
    try {
      const response = await verifyDriverOtp(phone, code);
      await enterApp(response.access_token, response.driver, true);
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Invalid or expired code. Request a new OTP if needed.',
      );
      setFormError(msg);
      showAlert({ title: 'Verification failed', message: msg });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handlePinLogin = async () => {
    if (!phoneOk || !pinOk) return;
    setSubmitLoading(true);
    setFormError('');
    try {
      const response = await loginWithDriverPin(phone, pin);
      await enterApp(response.access_token, response.driver, true);
    } catch (error: unknown) {
      const ax = error as {
        response?: { status?: number; data?: { message?: unknown } };
      };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Invalid PIN. Try again or reset your PIN.',
      );
      const lower = msg.toLowerCase();
      if (ax?.response?.status === 400 && lower.includes('pin not set')) {
        await clearTrustedDriverPhone();
        resetOtpCounters();
        setPin('');
        setStep('phone');
        showAlert({
          title: 'PIN not set',
          message: 'Sign in with a one-time code to finish setup on this device.',
        });
        return;
      }
      setFormError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleSetup = async () => {
    if (needsPinSetup && (!pinOk || !confirmOk)) {
      setFormError('Enter a 4-digit PIN and confirm it matches');
      return;
    }
    if (needsProfileSetup && !namesOk) {
      setFormError('Enter your first and last name');
      return;
    }

    setSubmitLoading(true);
    setFormError('');
    try {
      if (!api.defaults.headers.Authorization && sessionToken) {
        api.defaults.headers.Authorization = `Bearer ${sessionToken}`;
      }
      if (!sessionToken) {
        throw new Error('Session expired. Sign in again.');
      }

      if (needsPinSetup) {
        const res = await setDriverPin({
          pin,
          confirmPin,
          ...(needsProfileSetup
            ? { firstName: firstName.trim(), lastName: lastName.trim() }
            : {}),
        });
        const base = sessionUser ?? driverToUser(res.driver, digits);
        const updated = applyDriverFlags(base, res.driver);
        await setAuth({ user: updated, token: sessionToken });
        await setTrustedDriverPhone(res.driver.phone ?? digits);
        navigate('/app', { replace: true });
        return;
      }

      if (needsProfileSetup) {
        const res = await completeDriverProfile(firstName, lastName);
        const base = sessionUser ?? driverToUser(res.driver, digits);
        const updated = applyDriverFlags(base, res.driver);
        await setAuth({ user: updated, token: sessionToken });
        await setTrustedDriverPhone(res.driver.phone ?? digits);
        navigate('/app', { replace: true });
      }
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(ax?.response?.data?.message, 'Setup failed');
      setFormError(msg);
      showAlert({ title: 'Setup failed', message: msg });
    } finally {
      setSubmitLoading(false);
    }
  };

  const handleForgotConfirm = async () => {
    if (!phoneOk || !codeOk || !pinOk || !confirmOk) {
      setFormError('Enter the SMS code and a matching 4-digit PIN');
      return;
    }
    setSubmitLoading(true);
    setFormError('');
    try {
      await confirmDriverPinReset({
        phone,
        code,
        newPin: pin,
        confirmPin,
      });
      showAlert({
        title: 'PIN updated',
        message: 'Sign in with your new PIN.',
      });
      setCode('');
      setPin('');
      setConfirmPin('');
      setDebugCode(null);
      setStep('pin');
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      const msg = formatApiMessage(
        ax?.response?.data?.message,
        'Could not reset PIN',
      );
      setFormError(msg);
    } finally {
      setSubmitLoading(false);
    }
  };

  const title =
    step === 'phone'
      ? 'Welcome Back'
      : step === 'otp'
        ? 'Enter code'
        : step === 'pin'
          ? 'Enter PIN'
          : step === 'setup'
            ? 'Finish setup'
            : step === 'forgotOtp'
              ? 'Reset PIN'
              : 'Choose a new PIN';

  const subtitle =
    step === 'phone'
      ? 'Sign in with your phone'
      : step === 'otp'
        ? `We sent a code to ${maskPhone(digits)}`
        : step === 'pin'
          ? `Enter your 4-digit PIN for ${maskPhone(digits)}`
          : step === 'setup'
            ? needsProfileSetup && needsPinSetup
              ? 'Add your name and create a PIN used on this app and USSD'
              : needsPinSetup
                ? 'Create a 4-digit PIN used on this app and USSD'
                : 'Add your name to finish your profile'
            : step === 'forgotOtp'
              ? `We sent a reset code to ${maskPhone(digits)}`
              : 'Enter a new 4-digit PIN and confirm it';

  if (bootstrapping) {
    return (
      <div className="bidi-page bidi-page--auth" style={{ backgroundColor: tokens.surfaceBg }}>
        <div className="bidi-auth-card-wrap">
          <div className="bidi-spinner" style={{ borderTopColor: tokens.onGradient }} />
        </div>
      </div>
    );
  }

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
                onClick={() => void handleRequestOtp(false)}
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
                {submitLoading ? 'Verifying…' : 'Verify'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => {
                    resetOtpCounters();
                    setStep('phone');
                  }}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Wrong number
                </button>
                {resendExhausted ? null : (
                  <button
                    type="button"
                    className="bidi-link"
                    onClick={() => void handleRequestOtp(false)}
                    disabled={requestLoading || resendCooldown > 0}
                    style={{ color: tokens.brand.accent500 }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                )}
              </div>
            </>
          ) : null}

          {step === 'pin' ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  PIN
                </span>
                <input
                  className="bidi-input tabular-nums"
                  style={{ backgroundColor: tokens.surfaceElevated }}
                  type="password"
                  inputMode="numeric"
                  autoComplete="current-password"
                  value={pin}
                  onChange={(e) => setPin(e.target.value.replace(/\D/g, '').slice(0, 4))}
                  maxLength={4}
                />
              </label>
              {formError ? <p className="bidi-field__error">{formError}</p> : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handlePinLogin()}
                disabled={submitLoading || !pinOk}
              >
                {submitLoading ? 'Signing in…' : 'Sign in'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => void handleUseDifferentNumber()}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Use a different number
                </button>
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => {
                    resetOtpCounters();
                    setPin('');
                    setConfirmPin('');
                    void handleRequestOtp(true);
                  }}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Forgot PIN
                </button>
              </div>
            </>
          ) : null}

          {step === 'setup' ? (
            <>
              {needsProfileSetup ? (
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
              {needsPinSetup ? (
                <>
                  <label className={`bidi-field${needsProfileSetup ? ' bidi-mt-3' : ''}`}>
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
                This PIN also works on USSD. Your wallet stays the same across both.
              </p>
              {formError ? <p className="bidi-field__error">{formError}</p> : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleSetup()}
                disabled={
                  submitLoading ||
                  (needsPinSetup && (!pinOk || !confirmOk)) ||
                  (needsProfileSetup && !namesOk)
                }
              >
                {submitLoading ? 'Saving…' : 'Continue'}
              </button>
            </>
          ) : null}

          {step === 'forgotOtp' ? (
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
                  onChange={(e) => setCode(e.target.value)}
                  maxLength={8}
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
                onClick={() => {
                  if (!codeOk) return;
                  setFormError('');
                  setPin('');
                  setConfirmPin('');
                  setStep('forgotPin');
                }}
                disabled={!codeOk}
              >
                Continue
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => {
                    resetOtpCounters();
                    setStep('pin');
                  }}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Back to PIN
                </button>
                {resendExhausted ? null : (
                  <button
                    type="button"
                    className="bidi-link"
                    onClick={() => void handleRequestOtp(true)}
                    disabled={requestLoading || resendCooldown > 0}
                    style={{ color: tokens.brand.accent500 }}
                  >
                    {resendCooldown > 0 ? `Resend in ${resendCooldown}s` : 'Resend code'}
                  </button>
                )}
              </div>
            </>
          ) : null}

          {step === 'forgotPin' ? (
            <>
              <label className="bidi-field">
                <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
                  New PIN
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
                  Confirm new PIN
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
              {formError ? <p className="bidi-field__error">{formError}</p> : null}
              <button
                type="button"
                className="bidi-btn bidi-btn--primary bidi-mt-4"
                onClick={() => void handleForgotConfirm()}
                disabled={submitLoading || !pinOk || !confirmOk}
              >
                {submitLoading ? 'Saving…' : 'Update PIN'}
              </button>
              <div className="bidi-row-links">
                <button
                  type="button"
                  className="bidi-link"
                  onClick={() => setStep('forgotOtp')}
                  style={{ color: tokens.brand.accent500 }}
                >
                  Back
                </button>
              </div>
            </>
          ) : null}
        </div>

        <Link to="/login-staff" className="bidi-link-driver">
          Staff? Sign in
        </Link>

        <AuthLegalFooter />
      </div>
    </div>
  );
}
