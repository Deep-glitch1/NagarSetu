import React, { useEffect, useState } from 'react';

import {
  ArrowLeft,
  CheckCircle2,
  Eye,
  EyeOff,
  KeyRound,
  Lock,
  Mail,
  Shield,
  User,
  X,
} from 'lucide-react';

import { apiFetch } from '../api/client';

const PasswordResetPanel = ({
  isOpen = false,
  mode = 'forgot',
  accountType = 'citizen',
  token = '',
  onClose,
  onBackToLogin,
}) => {
  const [email, setEmail] = useState('');
  const [newPassword, setNewPassword] =
    useState('');
  const [confirmPassword, setConfirmPassword] =
    useState('');

  const [showNewPassword, setShowNewPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  const isReset = mode === 'reset';
  const citizen = accountType === 'citizen';

  /*
   * Clear old messages whenever the mode changes.
   */
  useEffect(() => {
    setError('');
    setSuccess('');
  }, [mode]);

  /*
   * Clear messages when the panel is opened again.
   */
  useEffect(() => {
    if (isOpen) {
      setError('');
      setSuccess('');
    }
  }, [isOpen]);

  /*
   * IMPORTANT:
   * Hooks must stay above this conditional return.
   *
   * When PortalEntry is at:
   * http://localhost:5173/
   *
   * isOpen = false, so this component renders nothing.
   *
   * When Forgot Password is clicked:
   * isOpen = true, so the panel appears.
   *
   * When the email reset URL is opened:
   * App.jsx passes isOpen = true and mode = "reset".
   */
  if (!isOpen) {
    return null;
  }

  const handleForgotPassword = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!email.trim()) {
      setError(
        'Please enter your email address.'
      );
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/auth/forgot-password', {
        method: 'POST',
        body: JSON.stringify({
          email: email.trim(),
          account_type: accountType,
        }),
      });

      setSuccess(
        'If an account exists with this email, a password reset link has been generated. Check your email .'
      );
    } catch (err) {
      setError(
        err.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  const handleResetPassword = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    if (!token) {
      setError(
        'Password reset token is missing or invalid.'
      );
      return;
    }

    if (newPassword.length < 6) {
      setError(
        'Password must be at least 6 characters.'
      );
      return;
    }

    if (newPassword !== confirmPassword) {
      setError(
        'Passwords do not match.'
      );
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/auth/reset-password', {
        method: 'POST',
        body: JSON.stringify({
          token,
          new_password: newPassword,
        }),
      });

      setSuccess(
        'Your password has been reset successfully.'
      );

      setNewPassword('');
      setConfirmPassword('');
    } catch (err) {
      setError(
        err.message ||
          'Reset link may have expired. Please request a new one.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  return (
    <div
      className="panel-container auth-overlay"
      onMouseDown={(event) => {
        if (event.target === event.currentTarget) {
          onClose();
        }
      }}
    >
      <section className="auth-card">

        {/* LEFT SIDE */}
        <div className="auth-art">
          <div className="auth-art-mark">
            {isReset ? (
              <KeyRound size={24} />
            ) : citizen ? (
              <User size={24} />
            ) : (
              <Shield size={24} />
            )}
          </div>

          <p>
            {isReset
              ? 'Password recovery'
              : 'Account recovery'}
          </p>

          <h2>
            {isReset
              ? 'Create a new password and get back to NagarSetu.'
              : 'Securely recover access to your NagarSetu account.'}
          </h2>

          <span>
            Your password is never sent in plain text
            to the password reset service.
          </span>
        </div>

        {/* RIGHT SIDE */}
        <div className="auth-form">

          {/* CLOSE */}
          <button
            className="auth-close"
            onClick={onClose}
            type="button"
            aria-label="Close"
          >
            <X size={20} />
          </button>

          {/* =====================================================
              RESET PASSWORD
              ===================================================== */}
          {isReset ? (
            <>
              <p className="auth-kicker">
                Password recovery
              </p>

              <h1>Reset password</h1>

              <p className="auth-subtitle">
                Choose a new password for your
                NagarSetu account.
              </p>

              {success ? (
                <>
                  {/* SUCCESS */}
                  <div className="auth-success">
                    <CheckCircle2 size={17} />
                    <span>{success}</span>
                  </div>

                  {/* GO TO LOGIN */}
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={onBackToLogin}
                  >
                    Go to sign in
                  </button>
                </>
              ) : (
                <>
                  <form
                    onSubmit={handleResetPassword}
                  >
                    {/* ERROR */}
                    {error && (
                      <p className="auth-error">
                        {error}
                      </p>
                    )}

                    {/* NEW PASSWORD */}
                    <label>
                      New password

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
                              !showNewPassword
                            )
                          }
                          aria-label={
                            showNewPassword
                              ? 'Hide password'
                              : 'Show password'
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
                    <label>
                      Confirm new password

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
                              !showConfirmPassword
                            )
                          }
                          aria-label={
                            showConfirmPassword
                              ? 'Hide password'
                              : 'Show password'
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

                    {/* SUBMIT */}
                    <button
                      className="auth-submit"
                      type="submit"
                      disabled={isLoading}
                    >
                      {isLoading
                        ? 'Resetting…'
                        : 'Reset password'}
                    </button>
                  </form>

                  {/* BACK */}
                  <button
                    type="button"
                    className="auth-back"
                    onClick={onBackToLogin}
                  >
                    <ArrowLeft size={15} />
                    Back to sign in
                  </button>
                </>
              )}
            </>
          ) : (

            /* =====================================================
               FORGOT PASSWORD
               ===================================================== */
            <>
              <p className="auth-kicker">
                Password recovery
              </p>

              <h1>Forgot password?</h1>

              <p className="auth-subtitle">
                Enter your registered email and
                we'll generate a secure reset link.
              </p>

              <form
                onSubmit={handleForgotPassword}
              >
                {/* ERROR */}
                {error && (
                  <p className="auth-error">
                    {error}
                  </p>
                )}

                {/* SUCCESS */}
                {success && (
                  <div className="auth-success">
                    <CheckCircle2 size={17} />
                    <span>{success}</span>
                  </div>
                )}

                {/* ACCOUNT TYPE */}
                <label>
                  Account type

                  <span className="auth-input">
                    {citizen ? (
                      <User size={17} />
                    ) : (
                      <Shield size={17} />
                    )}

                    <select
                      value={accountType}
                      onChange={() => {}}
                      disabled
                    >
                      <option value="citizen">
                        Citizen
                      </option>

                      <option value="employee">
                        Employee
                      </option>
                    </select>
                  </span>
                </label>

                {/* EMAIL */}
                <label>
                  Email address

                  <span className="auth-input">
                    <Mail size={17} />

                    <input
                      type="email"
                      value={email}
                      onChange={(event) =>
                        setEmail(
                          event.target.value
                        )
                      }
                      placeholder="you@example.com"
                      required
                      autoComplete="email"
                    />
                  </span>
                </label>

                {/* SUBMIT */}
                <button
                  className="auth-submit"
                  type="submit"
                  disabled={isLoading}
                >
                  {isLoading
                    ? 'Sending…'
                    : 'Send reset link'}
                </button>
              </form>

              {/* BACK */}
              <button
                type="button"
                className="auth-back"
                onClick={onBackToLogin}
              >
                <ArrowLeft size={15} />
                Back to sign in
              </button>
            </>
          )}
        </div>
      </section>
    </div>
  );
};

export default PasswordResetPanel;