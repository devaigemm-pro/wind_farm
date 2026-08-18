import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { loginSchema, type LoginFormData } from '@/utils/validation';

const styles = {
  wrapper: {
    minHeight: '100vh',
    display: 'flex',
    alignItems: 'center',
    justifyContent: 'center',
    padding: '1rem',
    background: 'linear-gradient(135deg, #2C2C2C 0%, #3A3A3A 50%, #2C2C2C 100%)',
  } as React.CSSProperties,
  card: {
    width: '100%',
    maxWidth: '400px',
    background: 'var(--color-neutral-0)',
    borderRadius: '12px',
    boxShadow: '0 20px 60px rgba(0, 0, 0, 0.3)',
    padding: '2.5rem 2rem',
  } as React.CSSProperties,
  header: {
    textAlign: 'center' as const,
    marginBottom: '2rem',
  } as React.CSSProperties,
  logo: {
    fontSize: '2rem',
    marginBottom: '0.5rem',
  } as React.CSSProperties,
  title: {
    fontSize: '1.25rem',
    fontWeight: 600,
    color: '#0B2545',
    margin: 0,
  } as React.CSSProperties,
  subtitle: {
    fontSize: '0.875rem',
    color: '#6b7280',
    marginTop: '0.25rem',
  } as React.CSSProperties,
  form: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '1.25rem',
  } as React.CSSProperties,
  fieldGroup: {
    display: 'flex',
    flexDirection: 'column' as const,
    gap: '0.375rem',
  } as React.CSSProperties,
  label: {
    fontSize: '0.875rem',
    fontWeight: 500,
    color: '#374151',
  } as React.CSSProperties,
  input: {
    width: '100%',
    padding: '0.625rem 0.75rem',
    border: '1px solid #d1d5db',
    borderRadius: '8px',
    fontSize: '0.9375rem',
    outline: 'none',
    transition: 'border-color 0.2s, box-shadow 0.2s',
    boxSizing: 'border-box' as const,
  } as React.CSSProperties,
  inputError: {
    borderColor: '#ef4444',
  } as React.CSSProperties,
  fieldError: {
    fontSize: '0.75rem',
    color: '#ef4444',
    margin: 0,
  } as React.CSSProperties,
  button: {
    width: '100%',
    padding: '0.75rem 1rem',
    background: '#5A8F5A',
    color: '#ffffff',
    border: 'none',
    borderRadius: '8px',
    fontSize: '0.9375rem',
    fontWeight: 600,
    cursor: 'pointer',
    transition: 'background-color 0.2s, opacity 0.2s',
    marginTop: '0.5rem',
  } as React.CSSProperties,
  buttonDisabled: {
    opacity: 0.6,
    cursor: 'not-allowed',
  } as React.CSSProperties,
  errorBanner: {
    padding: '0.75rem 1rem',
    background: '#fef2f2',
    border: '1px solid #fecaca',
    borderRadius: '8px',
    color: '#dc2626',
    fontSize: '0.875rem',
    textAlign: 'center' as const,
  } as React.CSSProperties,
};

export default function Login() {
  const navigate = useNavigate();
  const location = useLocation();
  const { login, isAuthenticated } = useAuth();
  const { t } = useLanguage();

  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [fieldErrors, setFieldErrors] = useState<Partial<Record<keyof LoginFormData, string>>>({});
  const [submitError, setSubmitError] = useState('');
  const [isSubmitting, setIsSubmitting] = useState(false);

  const from = (location.state as { from?: string } | null)?.from ?? '/dashboard';

  // Redirect if already authenticated
  useEffect(() => {
    if (isAuthenticated) {
      void navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError('');

    // Client-side validation with Zod
    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Partial<Record<keyof LoginFormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginFormData;
        if (!errors[field]) {
          errors[field] = issue.message;
        }
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(result.data.email, result.data.password);
      void navigate(from, { replace: true });
    } catch (err: unknown) {
      const message =
        err instanceof Error ? err.message : t('login.invalidCredentials');
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div style={styles.wrapper}>
      <div style={styles.card}>
        <div style={styles.header}>
          <div style={styles.logo} aria-hidden="true">
            <img src="/core-insight-logo.png" height="50" alt="CORE Insight" />
          </div>
          <h1 style={styles.title}>CORE Insight</h1>
          <p style={styles.subtitle}>Inicia sesión</p>
        </div>

        <form onSubmit={(e) => void handleSubmit(e)} style={styles.form} noValidate>
          {submitError && (
            <div style={styles.errorBanner} role="alert">
              {submitError}
            </div>
          )}

          <div style={styles.fieldGroup}>
            <label htmlFor="email" style={styles.label}>
              {t('login.email')}
            </label>
            <input
              id="email"
              type="email"
              autoComplete="email"
              placeholder={t('login.emailPlaceholder')}
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              style={{
                ...styles.input,
                ...(fieldErrors.email ? styles.inputError : {}),
              }}
              disabled={isSubmitting}
              aria-invalid={!!fieldErrors.email}
              aria-describedby={fieldErrors.email ? 'email-error' : undefined}
            />
            {fieldErrors.email && (
              <p id="email-error" style={styles.fieldError}>
                {fieldErrors.email}
              </p>
            )}
          </div>

          <div style={styles.fieldGroup}>
            <label htmlFor="password" style={styles.label}>
              {t('login.password')}
            </label>
            <input
              id="password"
              type="password"
              autoComplete="current-password"
              placeholder={t('login.passwordPlaceholder')}
              value={password}
              onChange={(e) => setPassword(e.target.value)}
              style={{
                ...styles.input,
                ...(fieldErrors.password ? styles.inputError : {}),
              }}
              disabled={isSubmitting}
              aria-invalid={!!fieldErrors.password}
              aria-describedby={fieldErrors.password ? 'password-error' : undefined}
            />
            {fieldErrors.password && (
              <p id="password-error" style={styles.fieldError}>
                {fieldErrors.password}
              </p>
            )}
          </div>

          <button
            type="submit"
            style={{
              ...styles.button,
              ...(isSubmitting ? styles.buttonDisabled : {}),
            }}
            disabled={isSubmitting}
          >
            {isSubmitting ? t('button.signingIn') : t('button.signIn')}
          </button>
        </form>
      </div>
    </div>
  );
}
