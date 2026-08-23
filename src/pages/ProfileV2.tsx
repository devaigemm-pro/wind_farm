import { useState, useEffect, useMemo } from 'react';
import { Key, User as UserIcon } from 'lucide-react';
import { cn } from '@/lib/utils';
import { useProfile } from '@/hooks/useProfile';
import { useToast } from '@/store/toastStore';
import { useLanguage } from '@/components/design-system';
import { supabase } from '@/lib/supabase';

export function ProfileV2() {
  const { data: profileData, isLoading } = useProfile();
  const toast = useToast();
  const { t } = useLanguage();

  const [showPasswordForm, setShowPasswordForm] = useState(false);
  const [existingPassword, setExistingPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [passwordUpdating, setPasswordUpdating] = useState(false);

  const passwordRules = useMemo(() => [
    { label: 'At least 8 characters', valid: newPassword.length >= 8 },
    { label: 'One lowercase letter', valid: /[a-z]/.test(newPassword) },
    { label: 'One uppercase letter', valid: /[A-Z]/.test(newPassword) },
    { label: 'One number or special char', valid: /[0-9!@#$%^&*]/.test(newPassword) },
  ], [newPassword]);

  const passwordsMatch = newPassword.length > 0 && confirmPassword.length > 0 && newPassword === confirmPassword;
  const allRulesPass = passwordRules.every(r => r.valid);

  const handlePasswordSubmit = async () => {
    if (!allRulesPass || !passwordsMatch) return;
    setPasswordUpdating(true);
    try {
      // Verify existing password
      const { error: signInErr } = await supabase.auth.signInWithPassword({
        email: profileData?.email || '',
        password: existingPassword,
      });
      if (signInErr) { toast.error('Current password is incorrect'); setPasswordUpdating(false); return; }

      // Update password
      const { error } = await supabase.auth.updateUser({ password: newPassword });
      if (error) throw error;
      toast.success('Password updated successfully');
      setShowPasswordForm(false);
      setExistingPassword(''); setNewPassword(''); setConfirmPassword('');
    } catch (e: any) {
      toast.error(e.message || 'Failed to update password');
    } finally {
      setPasswordUpdating(false);
    }
  };

  if (isLoading) {
    return <div className="animate-pulse"><div className="h-48 bg-gray-100 rounded-xl" /></div>;
  }

  return (
    <div className="max-w-2xl">
      <h1 className="text-xl font-semibold text-gray-900 mb-6">Profile</h1>

      {/* User info card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6 mb-4">
        <div className="flex items-center gap-4 mb-6">
          <div className="w-14 h-14 rounded-full bg-[#5A8F5A] flex items-center justify-center">
            <span className="text-white text-lg font-semibold">
              {profileData?.firstName?.charAt(0)}{profileData?.lastName?.charAt(0)}
            </span>
          </div>
          <div>
            <h2 className="text-lg font-semibold text-gray-900">{profileData?.firstName} {profileData?.lastName}</h2>
            <p className="text-sm text-gray-500">{profileData?.email}</p>
          </div>
        </div>

        <div className="grid grid-cols-2 gap-4">
          <div>
            <label className="text-xs text-gray-500">Role</label>
            <p className="text-sm font-medium text-gray-900 capitalize">{profileData?.role || '—'}</p>
          </div>
          <div>
            <label className="text-xs text-gray-500">Wind Farms</label>
            <p className="text-sm font-medium text-gray-900">{profileData?.windFarms?.length ?? 0} assigned</p>
          </div>
        </div>
      </div>

      {/* Password card */}
      <div className="bg-white rounded-xl border border-gray-100 shadow-sm p-6">
        <div className="flex items-center justify-between mb-4">
          <div className="flex items-center gap-2">
            <Key size={16} className="text-gray-400" />
            <h3 className="text-sm font-medium text-gray-900">Password</h3>
          </div>
          {!showPasswordForm && (
            <button
              onClick={() => setShowPasswordForm(true)}
              className="text-xs text-[#5A8F5A] font-medium hover:underline"
            >
              Change password
            </button>
          )}
        </div>

        {showPasswordForm && (
          <div className="space-y-4">
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Current password</label>
              <input
                type="password"
                value={existingPassword}
                onChange={e => setExistingPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A]"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">New password</label>
              <input
                type="password"
                value={newPassword}
                onChange={e => setNewPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A]"
              />
              <div className="mt-2 space-y-1">
                {passwordRules.map((rule, i) => (
                  <p key={i} className={cn('text-[10px]', rule.valid ? 'text-green-600' : 'text-gray-400')}>
                    {rule.valid ? '✓' : '○'} {rule.label}
                  </p>
                ))}
              </div>
            </div>
            <div>
              <label className="block text-xs font-medium text-gray-700 mb-1">Confirm new password</label>
              <input
                type="password"
                value={confirmPassword}
                onChange={e => setConfirmPassword(e.target.value)}
                className="w-full px-3 py-2 text-sm border border-gray-200 rounded-lg focus:outline-none focus:ring-2 focus:ring-[#5A8F5A]/20 focus:border-[#5A8F5A]"
              />
              {confirmPassword && !passwordsMatch && (
                <p className="text-[10px] text-red-500 mt-1">Passwords don't match</p>
              )}
            </div>
            <div className="flex gap-3">
              <button
                onClick={() => { setShowPasswordForm(false); setExistingPassword(''); setNewPassword(''); setConfirmPassword(''); }}
                className="px-4 py-2 text-xs font-medium border border-gray-200 rounded-lg text-gray-600 hover:bg-gray-50"
              >
                Cancel
              </button>
              <button
                onClick={handlePasswordSubmit}
                disabled={!allRulesPass || !passwordsMatch || !existingPassword || passwordUpdating}
                className="px-4 py-2 text-xs font-medium bg-[#5A8F5A] text-white rounded-lg hover:bg-[#4a7a4a] disabled:opacity-50 disabled:cursor-not-allowed"
              >
                {passwordUpdating ? 'Updating...' : 'Update Password'}
              </button>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
