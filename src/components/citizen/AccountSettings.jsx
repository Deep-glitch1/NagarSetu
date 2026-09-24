import React, { useState } from 'react';

import {
  Lock,
  Eye,
  EyeOff,
  ShieldCheck,
} from 'lucide-react';

import { apiFetch } from '../../api/client';

const AccountSettings = () => {
  const [currentPassword, setCurrentPassword] =
    useState('');

  const [newPassword, setNewPassword] =
    useState('');

  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showCurrentPassword, setShowCurrentPassword] =
    useState(false);

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [passwordLoading, setPasswordLoading] =
    useState(false);

  const [passwordError, setPasswordError] =
    useState('');

  const [passwordSuccess, setPasswordSuccess] =
    useState('');

  const handleChangePassword = async (event) => {
    event.preventDefault();

    setPasswordError('');
    setPasswordSuccess('');

    if (newPassword.length < 6) {
      setPasswordError(
        'New password must be at least 6 characters.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setPasswordError(
        'New passwords do not match.'
      );
      return;
    }

    if (currentPassword === newPassword) {
      setPasswordError(
        'New password must be different from your current password.'
      );
      return;
    }

    setPasswordLoading(true);

    try {
      await apiFetch('/auth/change-password', {
        method: 'POST',

        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setPasswordSuccess(
        'Password changed successfully.'
      );

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
    } catch (error) {
      console.error(
        'Change password error:',
        error
      );

      setPasswordError(
        error.message ||
          'Unable to change password.'
      );
    } finally {
      setPasswordLoading(false);
    }
  };

  return (
    <div className="civic-dashboard">
      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">
              Account security
            </p>

            <h3>
              Change your password
            </h3>
          </div>

          <ShieldCheck size={22} />
        </div>

        <p
          style={{
            color: '#6b7780',
            marginBottom: '24px',
            lineHeight: 1.6,
          }}
        >
          Update your NagarSetu password
          using your current password.
        </p>

        <form
          onSubmit={handleChangePassword}
          style={{
            maxWidth: '520px',
          }}
        >
          {passwordError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                marginBottom: '16px',
                background: '#fbeae5',
                color: '#a43f2d',
                fontSize: '14px',
              }}
            >
              {passwordError}
            </div>
          )}

          {passwordSuccess && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                marginBottom: '16px',
                background: '#e6f4eb',
                color: '#397255',
                fontSize: '14px',
              }}
            >
              {passwordSuccess}
            </div>
          )}

          {/* CURRENT PASSWORD */}
          <label
            style={{
              display: 'block',
              marginBottom: '18px',
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#34495a',
              }}
            >
              Current password
            </span>

            <span className="auth-input">
              <Lock size={17} />

              <input
                type={
                  showCurrentPassword
                    ? 'text'
                    : 'password'
                }
                value={currentPassword}
                onChange={(event) =>
                  setCurrentPassword(
                    event.target.value
                  )
                }
                placeholder="Enter current password"
                required
                autoComplete="current-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowCurrentPassword(
                    (previous) => !previous
                  )
                }
                aria-label={
                  showCurrentPassword
                    ? 'Hide current password'
                    : 'Show current password'
                }
              >
                {showCurrentPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </span>
          </label>

          {/* NEW PASSWORD */}
          <label
            style={{
              display: 'block',
              marginBottom: '18px',
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#34495a',
              }}
            >
              New password
            </span>

            <span className="auth-input">
              <Lock size={17} />

              <input
                type={
                  showNewPassword
                    ? 'text'
                    : 'password'
                }
                value={newPassword}
                onChange={(event) =>
                  setNewPassword(
                    event.target.value
                  )
                }
                placeholder="Minimum 6 characters"
                minLength={6}
                required
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowNewPassword(
                    (previous) => !previous
                  )
                }
                aria-label={
                  showNewPassword
                    ? 'Hide new password'
                    : 'Show new password'
                }
              >
                {showNewPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </span>
          </label>

          {/* CONFIRM PASSWORD */}
          <label
            style={{
              display: 'block',
              marginBottom: '22px',
            }}
          >
            <span
              style={{
                display: 'block',
                marginBottom: '8px',
                fontSize: '13px',
                fontWeight: 600,
                color: '#34495a',
              }}
            >
              Confirm new password
            </span>

            <span className="auth-input">
              <Lock size={17} />

              <input
                type={
                  showConfirmPassword
                    ? 'text'
                    : 'password'
                }
                value={confirmPassword}
                onChange={(event) =>
                  setConfirmPassword(
                    event.target.value
                  )
                }
                placeholder="Confirm new password"
                minLength={6}
                required
                autoComplete="new-password"
              />

              <button
                type="button"
                onClick={() =>
                  setShowConfirmPassword(
                    (previous) => !previous
                  )
                }
                aria-label={
                  showConfirmPassword
                    ? 'Hide confirm password'
                    : 'Show confirm password'
                }
              >
                {showConfirmPassword ? (
                  <EyeOff size={17} />
                ) : (
                  <Eye size={17} />
                )}
              </button>
            </span>
          </label>

          <button
            type="submit"
            disabled={passwordLoading}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '11px 18px',
              border: 0,
              borderRadius: '10px',
              background: '#315e63',
              color: '#fff',
              fontWeight: 600,
              cursor: passwordLoading
                ? 'not-allowed'
                : 'pointer',
              opacity: passwordLoading
                ? 0.7
                : 1,
            }}
          >
            <Lock size={16} />

            {passwordLoading
              ? 'Changing password…'
              : 'Change password'}
          </button>
        </form>
      </section>
    </div>
  );
};

export default AccountSettings;