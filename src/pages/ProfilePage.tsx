import { logout as logoutAPI } from '@/api/auth';
import { AuthLegalFooter } from '@/components/AuthLegalFooter';
import { PaymentTrustFooter } from '@/components/PaymentTrustFooter';
import { CrossPlatformHint } from '@/components/CrossPlatformHint';
import { useAuth, type RoleName } from '@/context/AuthContext';
import { useDialog } from '@/context/DialogContext';
import { useSetupBanner } from '@/context/SetupBannerContext';
import { useBidiTheme, type AppearancePreference } from '@/context/ThemeContext';
import { useFeedback } from '@/context/FeedbackContext';
import { hapticLight } from '@/utils/haptics';
import { useState } from 'react';
import { useNavigate } from 'react-router-dom';

function toTitleCase(s: string): string {
  return s.replace(/\w\S*/g, (txt) => txt.charAt(0).toUpperCase() + txt.slice(1).toLowerCase());
}

function formatRoleLabel(role: RoleName): string | null {
  if (!role) return null;
  return toTitleCase(role.replace(/_/g, ' '));
}

export default function ProfilePage() {
  const { user, role, logout } = useAuth();
  const navigate = useNavigate();
  const { tokens, preference, setPreference } = useBidiTheme();
  const { showConfirm } = useDialog();
  const { showMessage } = useFeedback();
  const { dismissed: bannerDismissed, dismiss: dismissBanner } = useSetupBanner();

  const getInitials = (name: string) =>
    name
      .split(' ')
      .map((n) => n[0])
      .join('')
      .toUpperCase()
      .slice(0, 2);

  const handleLogout = () => {
    showConfirm({
      title: 'Logout',
      message: 'Are you sure you want to log out?',
      confirmLabel: 'Logout',
      cancelLabel: 'Cancel',
      destructive: true,
      onConfirm: async () => {
        try {
          await logoutAPI();
        } catch {
          // continue locally
        }
        await logout();
        showMessage('Logged out successfully');
        setTimeout(() => navigate('/login', { replace: true }), 300);
      },
    });
  };

  const isDriver = user?.ownerType === 'DRIVER';
  const displayName =
    [user?.firstName, user?.lastName].filter(Boolean).join(' ') || user?.email || 'User';
  const roleLabel = formatRoleLabel(role);
  const headerSubtitle = isDriver ? user?.phone || null : roleLabel;

  return (
    <div className="bidi-scroll-page" style={{ backgroundColor: tokens.surfaceBg }}>
      <div className="bidi-scroll-inner">
        {isDriver ? (
          <CrossPlatformHint
            needsPin={user?.needsPin}
            needsProfile={user?.needsProfile}
            visible={!bannerDismissed}
            onDismiss={dismissBanner}
          />
        ) : null}

        <section className="bidi-card bidi-profile-hero" style={{ backgroundColor: tokens.surfaceElevated }}>
          <div className="bidi-avatar" style={{ background: 'var(--avatar-grad)' }}>
            {getInitials(displayName)}
          </div>
          <h1 className="bidi-profile-name" style={{ color: tokens.textPrimary }}>
            {displayName}
          </h1>
          {headerSubtitle ? (
            <p className="bidi-profile-sub" style={{ color: tokens.textSecondary }}>
              {headerSubtitle}
            </p>
          ) : null}
        </section>

        <div className="bidi-profile-split">
          <section className="bidi-card bidi-mt-3" style={{ backgroundColor: tokens.surfaceElevated }}>
            <h2 className="bidi-section-title" style={{ color: tokens.textPrimary }}>
              Appearance
            </h2>
            <p className="bidi-hint" style={{ color: tokens.textSecondary }}>
              Defaults to your device setting. Override anytime.
            </p>
            <div className="bidi-segmented bidi-mt-2" role="group" aria-label="Appearance">
              {(
                [
                  { v: 'system' as const, label: 'System' },
                  { v: 'light' as const, label: 'Light' },
                  { v: 'dark' as const, label: 'Dark' },
                ] as const
              ).map(({ v, label }) => (
                <button
                  key={v}
                  type="button"
                  className={`bidi-segmented__btn${preference === v ? ' bidi-segmented__btn--active' : ''}`}
                  style={{
                    backgroundColor: preference === v ? tokens.accentTint : 'transparent',
                    color: preference === v ? tokens.brand.accent600 : tokens.textSecondary,
                  }}
                  onClick={() => {
                    void hapticLight();
                    setPreference(v as AppearancePreference);
                  }}
                >
                  {label}
                </button>
              ))}
            </div>
          </section>

          <section className="bidi-card bidi-mt-3" style={{ backgroundColor: tokens.surfaceElevated }}>
            <h2 className="bidi-section-title" style={{ color: tokens.textPrimary }}>
              Account Details
            </h2>
            <ul className="bidi-account-list">
              <li>
                <span className="material-symbols-outlined" style={{ color: tokens.brand.accent500 }}>
                  mail
                </span>
                <div>
                  <div className="bidi-account-label" style={{ color: tokens.textTertiary }}>
                    Email
                  </div>
                  <div style={{ color: tokens.textPrimary }}>{user?.email || 'Not provided'}</div>
                </div>
              </li>
              <li>
                <span className="material-symbols-outlined" style={{ color: tokens.brand.accent500 }}>
                  phone
                </span>
                <div>
                  <div className="bidi-account-label" style={{ color: tokens.textTertiary }}>
                    Phone
                  </div>
                  <div style={{ color: tokens.textPrimary }}>{user?.phone || 'Not provided'}</div>
                </div>
              </li>
              {!isDriver ? (
                <>
                  <li>
                    <span className="material-symbols-outlined" style={{ color: tokens.brand.accent500 }}>
                      badge
                    </span>
                    <div>
                      <div className="bidi-account-label" style={{ color: tokens.textTertiary }}>
                        Role
                      </div>
                      <div style={{ color: tokens.textPrimary }}>{roleLabel || 'N/A'}</div>
                    </div>
                  </li>
                  <li>
                    <span className="material-symbols-outlined" style={{ color: tokens.brand.accent500 }}>
                      tag
                    </span>
                    <div>
                      <div className="bidi-account-label" style={{ color: tokens.textTertiary }}>
                        User ID
                      </div>
                      <code className="bidi-token-mono" style={{ color: tokens.textPrimary, fontSize: 12 }}>
                        {user?.id || 'N/A'}
                      </code>
                    </div>
                  </li>
                </>
              ) : null}
            </ul>
          </section>
        </div>

        <button
          type="button"
          className="bidi-btn bidi-btn--danger bidi-mt-4"
          onClick={handleLogout}
        >
          Logout
        </button>

        {isDriver ? <PaymentTrustFooter /> : <AuthLegalFooter />}
      </div>
    </div>
  );
}
