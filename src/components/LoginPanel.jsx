import React, { useEffect, useRef, useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Shield,
  ArrowRight,
  KeyRound,
} from 'lucide-react';

import { apiFetch } from '../api/client';

const LoginPanel = ({
  isOpen,
  onClose,
  onLogin,
  title,
  subtitle,
  type,
  registerAction,
  forgotPasswordAction,
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');

  const panelRef = useRef(null);

  const citizen = type === 'citizen';

  useEffect(() => {
    if (isOpen) {
      setError('');
      setPassword('');

      setTimeout(() => {
        panelRef.current?.querySelector('input')?.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const close = (event) => {
      if (event.key === 'Escape') {
        onClose();
      }
    };

    document.addEventListener('keydown', close);

    return () => {
      document.removeEventListener('keydown', close);
    };
  }, [onClose]);

  if (!isOpen) return null;

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setIsLoading(true);

    try {
      const endpoint = citizen
        ? '/auth/citizen/login'
        : '/auth/employee/login';

      const data = await apiFetch(endpoint, {
        method: 'POST',
        body: JSON.stringify({
          email,
          password,
        }),
      });

      // Authentication is handled by the HttpOnly
      // Redis-session cookie set by the backend.
      //
      // Do NOT store access_token in localStorage.
      //
      // The user object is only passed to React state.
      if (!data?.user) {
        throw new Error(
          'Login succeeded, but user information was not returned.'
        );
      }

      onLogin(data.user);
      onClose();
    } catch (err) {
      setError(
        err.message ||
          'Unable to sign in. Please try again.'
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
      <section
        className="auth-card"
        ref={panelRef}
        aria-modal="true"
        role="dialog"
        aria-label={title}
      >
        {/* LEFT SIDE */}
        <div className="auth-art">
          <div className="auth-art-mark">
            {citizen ? (
              <User size={24} />
            ) : (
              <Shield size={24} />
            )}
          </div>

          <p>
            {citizen
              ? 'Citizen portal'
              : 'Department portal'}
          </p>

          <h2>
            {citizen
              ? 'Better neighbourhoods start with a clear report.'
              : 'Turn every issue into a visible resolution.'}
          </h2>

          <span>
            NagarSetu connects people, departments,
            and practical civic action.
          </span>
        </div>

        {/* RIGHT SIDE */}
        <div className="auth-form">
          <button
            className="auth-close"
            onClick={onClose}
            aria-label="Close"
            type="button"
          >
            <X size={20} />
          </button>

          <p className="auth-kicker">
            Welcome back
          </p>

          <h1>{title}</h1>

          <p className="auth-subtitle">
            {subtitle}
          </p>

          <form onSubmit={handleSubmit}>
            {error && (
              <p className="auth-error">
                {error}
              </p>
            )}

            {/* EMAIL */}
            <label>
              Email address

              <span className="auth-input">
                <Mail size={17} />

                <input
                  type="email"
                  value={email}
                  onChange={(event) =>
                    setEmail(event.target.value)
                  }
                  placeholder="you@example.com"
                  required
                  autoComplete="email"
                />
              </span>
            </label>

            {/* PASSWORD */}
            <label>
              Password

              <span className="auth-input">
                <Lock size={17} />

                <input
                  type={
                    showPassword
                      ? 'text'
                      : 'password'
                  }
                  value={password}
                  onChange={(event) =>
                    setPassword(event.target.value)
                  }
                  placeholder="Enter your password"
                  required
                  autoComplete="current-password"
                />

                <button
                  type="button"
                  onClick={() =>
                    setShowPassword(!showPassword)
                  }
                  aria-label={
                    showPassword
                      ? 'Hide password'
                      : 'Show password'
                  }
                >
                  {showPassword ? (
                    <EyeOff size={17} />
                  ) : (
                    <Eye size={17} />
                  )}
                </button>
              </span>
            </label>

            {/* FORGOT PASSWORD */}
            {forgotPasswordAction && (
              <button
                type="button"
                className="auth-forgot"
                onClick={forgotPasswordAction}
              >
                <KeyRound size={14} />
                Forgot password?
              </button>
            )}

            {/* LOGIN */}
            <button
              className="auth-submit"
              type="submit"
              disabled={isLoading}
            >
              {isLoading ? (
                'Signing in…'
              ) : (
                <>
                  Sign in
                  <ArrowRight size={17} />
                </>
              )}
            </button>
          </form>

          {/* REGISTER */}
          {citizen && registerAction && (
            <button
              className="auth-register"
              onClick={registerAction}
              type="button"
            >
              New to NagarSetu?{' '}
              <b>Create an account</b>
            </button>
          )}
        </div>
      </section>
    </div>
  );
};

export default LoginPanel;