import { useState, useEffect, type FormEvent } from 'react';
import { useNavigate, useLocation } from 'react-router-dom';
import { useAuth } from '@/hooks/useAuth';
import { useLanguage } from '@/components/design-system';
import { loginSchema, type LoginFormData } from '@/utils/validation';

export default function LoginV2() {
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

  useEffect(() => {
    if (isAuthenticated) {
      void navigate(from, { replace: true });
    }
  }, [isAuthenticated, navigate, from]);

  const handleSubmit = async (e: FormEvent) => {
    e.preventDefault();
    setFieldErrors({});
    setSubmitError('');

    const result = loginSchema.safeParse({ email, password });
    if (!result.success) {
      const errors: Partial<Record<keyof LoginFormData, string>> = {};
      for (const issue of result.error.issues) {
        const field = issue.path[0] as keyof LoginFormData;
        if (!errors[field]) errors[field] = issue.message;
      }
      setFieldErrors(errors);
      return;
    }

    setIsSubmitting(true);
    try {
      await login(result.data.email, result.data.password);
      void navigate(from, { replace: true });
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : t('login.invalidCredentials');
      setSubmitError(message);
    } finally {
      setIsSubmitting(false);
    }
  };

  return (
    <div className="min-h-screen flex">
      {/* Left panel: branding */}
      <div className="hidden lg:flex lg:w-1/2 bg-[#1E1E1E] flex-col justify-between p-12 relative overflow-hidden">
        {/* Animated turbine SVG background */}
        <div className="absolute inset-0 flex items-center justify-center opacity-10">
          <svg width="400" height="400" viewBox="0 0 100 100">
            <g className="animate-[spin_8s_linear_infinite] origin-center">
              <path d="M50 50 L50 10 Q55 10 55 15 L52 48 Z" fill="#5A8F5A" opacity="0.8" />
              <path d="M50 50 L84 68 Q82 73 78 71 L53 52 Z" fill="#5A8F5A" opacity="0.8" />
              <path d="M50 50 L16 68 Q18 73 22 71 L47 52 Z" fill="#5A8F5A" opacity="0.8" />
            </g>
            <circle cx="50" cy="50" r="4" fill="#5A8F5A" />
          </svg>
        </div>

        {/* Logo */}
        <div className="relative z-10">
          <div className="flex items-center gap-3">
            <img src="/core-insight-eye.svg" width="32" height="32" alt="CORE Insight" />
            <span className="text-white font-semibold text-lg">CORE | Insight</span>
          </div>
        </div>

        {/* Tagline */}
        <div className="relative z-10">
          <h1 className="text-4xl font-light text-white leading-tight mb-4">
            Wind Farm<br />Intelligence<br />Platform
          </h1>
          <p className="text-gray-400 text-sm">Inspection management, defect tracking, and predictive maintenance for wind energy assets.</p>
        </div>

        {/* Version */}
        <div className="relative z-10">
          <p className="text-gray-500 text-xs">v2.0.0</p>
        </div>
      </div>

      {/* Right panel: form */}
      <div className="flex-1 flex items-center justify-center p-8 bg-white">
        <div className="w-full max-w-sm">
          <h2 className="text-2xl font-semibold text-gray-900 mb-2">Sign in</h2>
          <p className="text-sm text-gray-500 mb-8">Welcome back to your workspace</p>

          {submitError && (
            <div className="mb-4 p-3 bg-red-50 border border-red-200 rounded-lg text-red-600 text-sm text-center">
              {submitError}
            </div>
          )}

          <form onSubmit={handleSubmit} className="space-y-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Email</label>
              <input
                type="email"
                value={email}
                onChange={(e) => setEmail(e.target.value)}
                placeholder="you@company.com"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A] transition"
              />
              {fieldErrors.email && <p className="mt-1 text-xs text-red-500">{fieldErrors.email}</p>}
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1.5">Password</label>
              <input
                type="password"
                value={password}
                onChange={(e) => setPassword(e.target.value)}
                placeholder="••••••••"
                className="w-full px-3 py-2.5 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A] transition"
              />
              {fieldErrors.password && <p className="mt-1 text-xs text-red-500">{fieldErrors.password}</p>}
            </div>

            <button
              type="submit"
              disabled={isSubmitting}
              className="w-full py-2.5 bg-[#5A8F5A] text-white rounded-lg text-sm font-medium hover:bg-[#4a7a4a] transition flex items-center justify-center gap-2 disabled:opacity-60 disabled:cursor-not-allowed"
            >
              {isSubmitting ? 'Signing in...' : 'Continue'}
              {!isSubmitting && (
                <svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2"><path d="M5 12h14m-7-7l7 7-7 7" /></svg>
              )}
            </button>
          </form>

          <p className="text-center text-xs text-gray-400 mt-6">
            <a href="#" className="hover:text-[#5A8F5A] transition">Forgot password?</a>
          </p>
        </div>
      </div>
    </div>
  );
}
