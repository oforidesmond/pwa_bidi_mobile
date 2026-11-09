import { getProfile, login } from '@/api/auth';
import api from '@/api/index';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';
import { useDialog } from '@/context/DialogContext';
import { useAuth } from '@/context/AuthContext';
import { useBidiTheme } from '@/context/ThemeContext';
import { formatApiMessage } from '@/utils/apiMessage';
import { getBidiLogo } from '@/utils/bidi-logo';
import { Link, useNavigate } from 'react-router-dom';
import { useState } from 'react';
import type { User } from '@/types';

export default function LoginPage() {
  const [identifier, setIdentifier] = useState('');
  const [password, setPassword] = useState('');
  const [loading, setLoading] = useState(false);
  const [showPassword, setShowPassword] = useState(false);

  const { setAuth } = useAuth();
  const { showAlert } = useDialog();
  const { scheme, tokens } = useBidiTheme();
  const navigate = useNavigate();

  const trimmed = identifier.trim();
  const looksLikeEmail = trimmed.includes('@');
  const hasIdentifierError =
    trimmed.length > 0 && looksLikeEmail && !/\S+@\S+\.\S+/.test(trimmed);
  const hasPasswordError = password.length > 0 && password.length < 6;

  const handleLogin = async () => {
    if (!trimmed || !password) {
      showAlert({
        title: 'Error',
        message: 'Please enter email or phone and password',
      });
      return;
    }
    if (hasIdentifierError || hasPasswordError) return;

    setLoading(true);
    try {
      const response = (await login(trimmed, password)) as { access_token: string };
      const token = response.access_token;
      api.defaults.headers.Authorization = `Bearer ${token}`;
      const userProfile = (await getProfile()) as User;
      await setAuth({ user: userProfile, token });
      navigate('/app', { replace: true });
    } catch (error: unknown) {
      const ax = error as { response?: { data?: { message?: unknown } } };
      showAlert({
        title: 'Login Failed',
        message: formatApiMessage(ax?.response?.data?.message, 'Invalid credentials'),
      });
    } finally {
      setLoading(false);
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
            Welcome Back
          </h1>
          <p className="bidi-auth-subtitle" style={{ color: tokens.textSecondary }}>
            Sign in with email or phone
          </p>
        </div>

        <div className="bidi-card" style={{ backgroundColor: tokens.surfaceElevated }}>
          <label className="bidi-field">
            <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
              Email or phone
            </span>
            <div className="bidi-field__row">
              <span className="material-symbols-outlined bidi-field__prefix" aria-hidden>
                person
              </span>
              <input
                className="bidi-input"
                style={{ backgroundColor: tokens.surfaceElevated }}
                value={identifier}
                onChange={(e) => setIdentifier(e.target.value)}
                autoComplete="username"
                aria-invalid={hasIdentifierError}
              />
            </div>
            {hasIdentifierError ? (
              <span className="bidi-field__error">Enter a valid email address</span>
            ) : null}
          </label>

          <label className="bidi-field bidi-mt-3">
            <span className="bidi-field__label" style={{ color: tokens.textSecondary }}>
              Password
            </span>
            <div className="bidi-field__row">
              <span className="material-symbols-outlined bidi-field__prefix" aria-hidden>
                lock
              </span>
              <input
                className="bidi-input"
                style={{ backgroundColor: tokens.surfaceElevated }}
                type={showPassword ? 'text' : 'password'}
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                autoComplete="current-password"
                aria-invalid={hasPasswordError}
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
            {hasPasswordError ? (
              <span className="bidi-field__error">Password must be at least 6 characters</span>
            ) : null}
          </label>

          <button
            type="button"
            className="bidi-btn bidi-btn--primary bidi-mt-4"
            onClick={() => void handleLogin()}
            disabled={
              loading || !trimmed || !password || hasIdentifierError || hasPasswordError
            }
          >
            {loading ? 'Signing in...' : 'Sign In'}
          </button>
        </div>

        <Link to="/login" className="bidi-link-driver">
          Sign in with OTP
        </Link>

        <AuthLegalFooter />
      </div>
    </div>
  );
}
