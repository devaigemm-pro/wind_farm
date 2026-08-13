import { useState, useEffect, useMemo } from 'react';
import { Building, Key, Wind, Sun } from 'lucide-react';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import { CampaignMap } from '@/components/organisms/CampaignMap';
import { Skeleton } from '@/components/atoms';
import { supabase } from '@/lib/supabase';

export function Profile() {
  const { data: profileData, isLoading } = useProfile();
  const toast = useToast();
  const { t } = useLanguage();

  const [firstName, setFirstName] = useState('');
  const [lastName, setLastName] = useState('');
  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [existingPassword, setExistingPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  useEffect(() => {
    if (profileData) {
      setFirstName(profileData.firstName);
      setLastName(profileData.lastName);
    }
  }, [profileData]);

  const handleChangePassword = () => {
    setShowPasswordForm(true);
  };

  const handleCancelPassword = () => {
    setShowPasswordForm(false);
    setExistingPassword('');
    setNewPassword('');
    setConfirmPassword('');
  };

  // Password validation rules
  const passwordRules = useMemo(() => [
    { label: t('profile.passwordMinChars'), valid: newPassword.length >= 8 },
    { label: t('profile.passwordLowercase'), valid: /[a-z]/.test(newPassword) },
    { label: t('profile.passwordUppercase'), valid: /[A-Z]/.test(newPassword) },
    { label: t('profile.passwordNumberSpecial'), valid: /[0-9!@#$%^&*()_+\-=[\]{};':"\\|,.<>/?]/.test(newPassword) },
  ], [newPassword, t]);

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const showMismatch = confirmPassword.length > 0 && newPassword !== confirmPassword;

  const allPasswordValid = passwordRules.every((r) => r.valid) && existingPassword.length > 0 && passwordsMatch;

  const handleUpdatePassword = async () => {
    if (!allPasswordValid) return;
    setPasswordUpdating(true);
    try {
      // First verify existing password by signing in
      const { error: signInError } = await supabase.auth.signInWithPassword({
        email: profileData?.email ?? '',
        password: existingPassword,
      });
      if (signInError) {
        toast.error(t('toast.passwordIncorrect'));
        setPasswordUpdating(false);
        return;
      }
      // Update to new password
      const { error: updateError } = await supabase.auth.updateUser({ password: newPassword });
      if (updateError) {
        toast.error(t('toast.passwordUpdateFailed'));
      } else {
        toast.success(t('toast.passwordUpdated'));
        handleCancelPassword();
      }
    } catch {
      toast.error(t('toast.passwordUpdateFailed'));
    }
    setPasswordUpdating(false);
  };

  if (isLoading) {
    return (
      <div style={pageStyle}>
        <div style={headerStyle}>
          <Skeleton variant="text" width="160px" height="28px" />
        </div>
        <div style={contentGrid} className="cards-grid">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
            <Skeleton variant="rect" width="100%" height="320px" />
            <Skeleton variant="rect" width="100%" height="120px" />
          </div>
          <Skeleton variant="rect" width="100%" height="460px" />
        </div>
      </div>
    );
  }

  const companyName = profileData?.windFarms?.[0]?.name ?? '—';

  return (
    <div style={pageStyle}>
      {/* Header */}
      <div style={headerStyle}>
        <h1 style={titleStyle}>{t('page.profile')}</h1>
      </div>

      {/* Content - 2 columns */}
      <div style={contentGrid} className="cards-grid">
        {/* Left column */}
        <div style={{ display: 'flex', flexDirection: 'column', gap: 'var(--space-4)' }}>
          {/* Card 1: Account information */}
          <div style={cardStyle}>
            <div style={cardHeaderStyle}>
              <h2 style={cardTitleStyle}>{t('profile.accountInfo')}</h2>
            </div>

            <div style={cardBodyStyle}>
              {/* Company info */}
              <div style={{ display: 'flex', alignItems: 'center', gap: 'var(--space-3)' }}>
                <div style={companyIconWrap}>
                  <Building size={24} color="var(--color-neutral-500, #64748b)" />
                </div>
                <span style={companyNameStyle}>{companyName}</span>
              </div>

              {/* Form fields */}
              <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('profile.firstName')}</label>
                  <input
                    type="text"
                    value={firstName}
                    onChange={(e) => setFirstName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
                <div style={{ flex: 1 }}>
                  <label style={labelStyle}>{t('profile.lastName')}</label>
                  <input
                    type="text"
                    value={lastName}
                    onChange={(e) => setLastName(e.target.value)}
                    style={inputStyle}
                    required
                  />
                </div>
              </div>

              {/* Email */}
              <div>
                <label style={labelStyle}>{t('profile.email')}</label>
                <input
                  type="email"
                  value={profileData?.email ?? ''}
                  disabled
                  style={inputDisabledStyle}
                />
              </div>

              {/* Actions / Password Form */}
              {!showPasswordForm ? (
                <div style={{ display: 'flex', gap: 'var(--space-3)', marginTop: 'var(--space-2)' }}>
                  <button
                    onClick={handleChangePassword}
                    style={outlinedBtnStyle}
                  >
                    <Key size={14} />
                    {t('button.changePassword')}
                  </button>
                </div>
              ) : (
                <div style={passwordFormStyle}>
                  <div>
                    <label style={labelStyle}>{t('profile.existingPassword')}</label>
                    <input
                      type="password"
                      value={existingPassword}
                      onChange={(e) => setExistingPassword(e.target.value)}
                      autoComplete="current-password"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('profile.newPassword')}</label>
                    <input
                      type="password"
                      value={newPassword}
                      onChange={(e) => setNewPassword(e.target.value)}
                      autoComplete="new-password"
                      style={inputStyle}
                      required
                    />
                  </div>
                  <div>
                    <label style={labelStyle}>{t('profile.confirmPassword')}</label>
                    <input
                      type="password"
                      value={confirmPassword}
                      onChange={(e) => setConfirmPassword(e.target.value)}
                      autoComplete="new-password"
                      style={showMismatch ? inputErrorStyle : inputStyle}
                      required
                    />
                    {showMismatch && (
                      <span style={mismatchText}>{t('profile.passwordsNoMatch')}</span>
                    )}
                  </div>

                  {/* Validation rules */}
                  <div style={rulesContainer}>
                    {passwordRules.map((rule, i) => (
                      <div key={i} style={ruleRow}>
                        <span style={rule.valid ? ruleIconValid : ruleIconInvalid}>·</span>
                        <span style={ruleText}>{rule.label}</span>
                      </div>
                    ))}
                  </div>

                  {/* Buttons */}
                  <div style={{ display: 'flex', gap: 'var(--space-3)' }}>
                    <button
                      type="button"
                      onClick={handleCancelPassword}
                      style={cancelBtnStyle}
                    >
                      {t('button.cancel')}
                    </button>
                    <button
                      type="button"
                      onClick={handleUpdatePassword}
                      disabled={!allPasswordValid || passwordUpdating}
                      style={{
                        ...updatePasswordBtnStyle,
                        opacity: allPasswordValid && !passwordUpdating ? 1 : 0.5,
                        cursor: allPasswordValid && !passwordUpdating ? 'pointer' : 'not-allowed',
                      }}
                    >
                      {t('button.updatePassword')}
                    </button>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Card 2: Asset Summary */}
          <div style={{ display: 'grid', gridTemplateColumns: '1fr 1fr', gap: 'var(--space-3)' }}>
            {/* Wind card */}
            <div style={assetCardStyle}>
              <div style={assetIconWrap}>
                <Wind size={20} color="var(--color-primary-500, #1B4B7A)" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={assetTitleStyle}>{t('profile.wind')}</h3>
                <p style={assetStatStyle}>
                  {profileData?.windFarms?.length ?? 0} {(profileData?.windFarms?.length ?? 0) !== 1 ? t('profile.assets') : t('profile.asset')}
                </p>
                <p style={assetStatStyle}>
                  {(profileData?.totalPowerKw ?? 0).toLocaleString()} {t('profile.totalPower')}
                </p>
              </div>
            </div>

            {/* Solar card */}
            <div style={assetCardStyle}>
              <div style={{ ...assetIconWrap, background: 'rgba(245, 158, 11, 0.08)' }}>
                <Sun size={20} color="#f59e0b" />
              </div>
              <div style={{ flex: 1 }}>
                <h3 style={assetTitleStyle}>{t('profile.solar')}</h3>
                <p style={assetStatStyle}>{t('profile.noAssets')}</p>
              </div>
            </div>
          </div>
        </div>

        {/* Right column - Map */}
        <div style={mapContainerStyle}>
          <CampaignMap />
        </div>
      </div>
    </div>
  );
}

// ─── Styles (matching project design system) ────────────────────────────────

const pageStyle: React.CSSProperties = {
  height: '100%',
  display: 'flex',
  flexDirection: 'column',
  background: 'var(--color-neutral-50, #f8fafc)',
  overflow: 'hidden',
};

const headerStyle: React.CSSProperties = {
  padding: 'var(--space-5, 1.25rem) var(--space-6, 1.5rem)',
};

const titleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-xl, 1.25rem)',
  fontWeight: 700,
  color: 'var(--color-neutral-900, #0f172a)',
  letterSpacing: '-0.02em',
};

const contentGrid: React.CSSProperties = {
  display: 'grid',
  gridTemplateColumns: '1fr 1fr',
  gap: 'var(--space-5, 1.25rem)',
  padding: '0 var(--space-6, 1.5rem) var(--space-6, 1.5rem)',
  flex: 1,
  minHeight: 0,
  overflow: 'auto',
};

const cardStyle: React.CSSProperties = {
  background: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-xl, 16px)',
  overflow: 'hidden',
  boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05))',
};

const cardHeaderStyle: React.CSSProperties = {
  padding: 'var(--space-4, 1rem) var(--space-5, 1.25rem)',
  borderBottom: '1px solid var(--color-neutral-100, #f1f5f9)',
};

const cardTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm, 0.875rem)',
  fontWeight: 600,
  color: 'var(--color-neutral-800, #1e293b)',
};

const cardBodyStyle: React.CSSProperties = {
  padding: 'var(--space-5, 1.25rem)',
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-4, 1rem)',
};

const companyIconWrap: React.CSSProperties = {
  width: 48,
  height: 48,
  borderRadius: 'var(--radius-lg, 12px)',
  background: 'var(--color-neutral-100, #f1f5f9)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const companyNameStyle: React.CSSProperties = {
  fontSize: 'var(--text-base, 1rem)',
  fontWeight: 600,
  color: 'var(--color-neutral-900, #0f172a)',
};

const labelStyle: React.CSSProperties = {
  display: 'block',
  fontSize: '0.75rem',
  fontWeight: 500,
  color: 'var(--color-neutral-500, #64748b)',
  marginBottom: 6,
};

const inputStyle: React.CSSProperties = {
  width: '100%',
  padding: '10px 12px',
  background: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-md, 8px)',
  color: 'var(--color-neutral-800, #1e293b)',
  fontSize: 'var(--text-sm, 0.875rem)',
  outline: 'none',
  boxSizing: 'border-box',
  transition: 'border-color 200ms ease, box-shadow 200ms ease',
};

const inputDisabledStyle: React.CSSProperties = {
  ...inputStyle,
  background: 'var(--color-neutral-100, #f1f5f9)',
  color: 'var(--color-neutral-400, #94a3b8)',
  cursor: 'not-allowed',
};

const outlinedBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 14px',
  background: 'transparent',
  border: '1px solid var(--color-neutral-300, #cbd5e1)',
  borderRadius: 'var(--radius-md, 8px)',
  color: 'var(--color-neutral-700, #334155)',
  fontSize: 'var(--text-sm, 0.875rem)',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'border-color 200ms ease, background 200ms ease',
};

const primaryBtnStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
  padding: '8px 20px',
  background: 'var(--color-primary-500, #1B4B7A)',
  border: 'none',
  borderRadius: 'var(--radius-md, 8px)',
  color: '#ffffff',
  fontSize: 'var(--text-sm, 0.875rem)',
  fontWeight: 500,
  cursor: 'pointer',
  transition: 'background 200ms ease',
};

const assetCardStyle: React.CSSProperties = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: 'var(--space-3, 0.75rem)',
  background: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-xl, 16px)',
  padding: 'var(--space-4, 1rem)',
  boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05))',
  transition: 'box-shadow 200ms ease, transform 200ms ease',
};

const assetIconWrap: React.CSSProperties = {
  width: 40,
  height: 40,
  borderRadius: 'var(--radius-lg, 12px)',
  background: 'rgba(27, 75, 122, 0.08)',
  display: 'flex',
  alignItems: 'center',
  justifyContent: 'center',
  flexShrink: 0,
};

const assetTitleStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-base, 1rem)',
  fontWeight: 600,
  color: 'var(--color-neutral-800, #1e293b)',
  marginBottom: 4,
};

const assetStatStyle: React.CSSProperties = {
  margin: 0,
  fontSize: 'var(--text-sm, 0.875rem)',
  color: 'var(--color-neutral-500, #64748b)',
  lineHeight: 1.5,
};

const mapContainerStyle: React.CSSProperties = {
  background: 'var(--color-neutral-0, #ffffff)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
  borderRadius: 'var(--radius-xl, 16px)',
  overflow: 'hidden',
  minHeight: 500,
  height: '100%',
  boxShadow: 'var(--shadow-xs, 0 1px 2px rgba(0, 0, 0, 0.05))',
};

// ─── Password Form Styles ───────────────────────────────────────────────────

const passwordFormStyle: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 'var(--space-3, 0.75rem)',
  padding: 'var(--space-4, 1rem)',
  background: 'var(--color-neutral-50, #f8fafc)',
  borderRadius: 'var(--radius-lg, 12px)',
  border: '1px solid var(--color-neutral-200, #e2e8f0)',
};

const rulesContainer: React.CSSProperties = {
  display: 'flex',
  flexDirection: 'column',
  gap: 4,
};

const ruleRow: React.CSSProperties = {
  display: 'flex',
  alignItems: 'center',
  gap: 6,
};

const ruleIconValid: React.CSSProperties = {
  fontSize: '1.5rem',
  lineHeight: 1,
  color: 'var(--color-success-500, #22c55e)',
  fontWeight: 700,
};

const ruleIconInvalid: React.CSSProperties = {
  fontSize: '1.5rem',
  lineHeight: 1,
  color: 'var(--color-neutral-400, #94a3b8)',
  fontWeight: 700,
};

const ruleText: React.CSSProperties = {
  fontSize: '0.75rem',
  color: 'var(--color-neutral-600, #475569)',
};

const cancelBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--color-neutral-200, #e5e7eb)',
  border: 'none',
  borderRadius: 'var(--radius-md, 8px)',
  color: 'var(--color-neutral-700, #334155)',
  fontSize: 'var(--text-sm, 0.875rem)',
  fontWeight: 500,
  cursor: 'pointer',
};

const updatePasswordBtnStyle: React.CSSProperties = {
  padding: '8px 16px',
  background: 'var(--color-primary-500, #4CAF50)',
  border: 'none',
  borderRadius: 'var(--radius-md, 8px)',
  color: '#ffffff',
  fontSize: 'var(--text-sm, 0.875rem)',
  fontWeight: 500,
  cursor: 'pointer',
};

const inputErrorStyle: React.CSSProperties = {
  ...inputStyle,
  borderColor: 'var(--color-danger-500, #ef4444)',
};

const mismatchText: React.CSSProperties = {
  display: 'block',
  marginTop: 4,
  fontSize: '0.72rem',
  color: 'var(--color-danger-500, #ef4444)',
};
