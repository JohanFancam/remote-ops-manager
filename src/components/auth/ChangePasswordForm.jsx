import React, { useState } from 'react';
import { useAuth } from '@/lib/AuthContext';

const MIN_LENGTH = 8;

export default function ChangePasswordForm({
  requireCurrent = false,
  submitLabel = 'Save password',
  onSuccess,
  className = '',
  inputClassName = 'rom-input',
  buttonClassName = 'rom-btn-primary w-full',
  errorClassName = 'rounded-xl border border-red-800/80 bg-red-950/40 text-red-400 text-sm px-3 py-2',
}) {
  const { changePassword } = useAuth();
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [error, setError] = useState('');
  const [loading, setLoading] = useState(false);

  const onSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (newPassword.length < MIN_LENGTH) {
      setError(`Password must be at least ${MIN_LENGTH} characters`);
      return;
    }
    if (newPassword !== confirmPassword) {
      setError('New passwords do not match');
      return;
    }
    if (requireCurrent && !currentPassword) {
      setError('Current password required');
      return;
    }
    if (currentPassword && newPassword === currentPassword) {
      setError('Choose a different password from the one you signed in with');
      return;
    }

    setLoading(true);
    try {
      const updated = await changePassword({
        current_password: currentPassword,
        new_password: newPassword,
      });
      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      onSuccess?.(updated);
    } catch (err) {
      setError(err.message || 'Could not change password');
    } finally {
      setLoading(false);
    }
  };

  return (
    <form onSubmit={onSubmit} className={`space-y-4 ${className}`.trim()}>
      {requireCurrent && (
        <div>
          <label className="block text-xs font-medium text-slate-500 mb-1.5">Current password</label>
          <input
            type="password"
            autoComplete="current-password"
            required
            value={currentPassword}
            onChange={(e) => setCurrentPassword(e.target.value)}
            className={inputClassName}
          />
        </div>
      )}
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">New password</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={newPassword}
          onChange={(e) => setNewPassword(e.target.value)}
          className={inputClassName}
          placeholder={`At least ${MIN_LENGTH} characters`}
        />
      </div>
      <div>
        <label className="block text-xs font-medium text-slate-500 mb-1.5">Confirm new password</label>
        <input
          type="password"
          autoComplete="new-password"
          required
          minLength={MIN_LENGTH}
          value={confirmPassword}
          onChange={(e) => setConfirmPassword(e.target.value)}
          className={inputClassName}
        />
      </div>

      {error && <div className={errorClassName}>{error}</div>}

      <button type="submit" disabled={loading} className={buttonClassName}>
        {loading ? 'Saving…' : submitLabel}
      </button>
    </form>
  );
}
