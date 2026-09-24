import React, { useEffect, useState } from 'react';
import {
  X,
  Eye,
  EyeOff,
  Mail,
  Lock,
  User,
  Phone,
  CheckCircle,
} from 'lucide-react';

import { apiFetch } from '../api/client';

const INITIAL_FORM_DATA = {
  name: '',
  email: '',
  phone: '',
  password: '',
  confirmPassword: '',
  acceptTerms: false,
};

const RegisterPanel = ({
  isOpen,
  onClose,
  onRegister,
  title,
  subtitle,
  loginAction,
}) => {
  const [formData, setFormData] =
    useState(INITIAL_FORM_DATA);

  const [showPassword, setShowPassword] =
    useState(false);

  const [showConfirmPassword, setShowConfirmPassword] =
    useState(false);

  const [isLoading, setIsLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [step, setStep] =
    useState(1);

  // OTP state
  const [verificationCode, setVerificationCode] =
    useState('');

  const [verificationLoading, setVerificationLoading] =
    useState(false);

  const [resendLoading, setResendLoading] =
    useState(false);

  const [resendCooldown, setResendCooldown] =
    useState(0);

  /*
   * Reset the registration state explicitly.
   *
   * IMPORTANT:
   * Do not call this when the panel opens.
   * The user may close and reopen the panel while waiting
   * for email verification, and the OTP flow must be preserved.
   */
  const resetRegistration = () => {
    setFormData(INITIAL_FORM_DATA);
    setShowPassword(false);
    setShowConfirmPassword(false);
    setIsLoading(false);
    setError('');
    setStep(1);

    setVerificationCode('');
    setVerificationLoading(false);
    setResendLoading(false);
    setResendCooldown(0);
  };

  /*
   * Clear transient errors when the panel opens.
   * Do not reset the registration flow here.
   */
  useEffect(() => {
    if (isOpen) {
      setError('');
    }
  }, [isOpen]);

  /*
   * Resend OTP cooldown timer.
   */
  useEffect(() => {
    if (resendCooldown <= 0) {
      return;
    }

    const timer = setInterval(() => {
      setResendCooldown((prev) =>
        prev > 0 ? prev - 1 : 0
      );
    }, 1000);

    return () => clearInterval(timer);
  }, [resendCooldown]);

  /*
   * Handle normal form inputs.
   */
  const handleChange = (e) => {
    const {
      name,
      value,
      type,
      checked,
    } = e.target;

    setFormData((prev) => ({
      ...prev,
      [name]:
        type === 'checkbox'
          ? checked
          : value,
    }));

    if (error) {
      setError('');
    }
  };

  /*
   * Validate current registration step.
   */
  const validateStep = () => {
    if (step === 1) {
      if (!formData.name.trim()) {
        setError(
          'Please enter your full name.'
        );
        return false;
      }

      if (formData.name.trim().length < 2) {
        setError(
          'Name must be at least 2 characters.'
        );
        return false;
      }

      if (!formData.email.trim()) {
        setError(
          'Please enter your email address.'
        );
        return false;
      }

      const emailRegex =
        /^[^\s@]+@[^\s@]+\.[^\s@]+$/;

      if (
        !emailRegex.test(
          formData.email.trim()
        )
      ) {
        setError(
          'Please enter a valid email address.'
        );
        return false;
      }

      if (formData.phone.trim()) {
        const phoneRegex =
          /^[+]?[\d\s-]{10,15}$/;

        if (
          !phoneRegex.test(
            formData.phone.trim()
          )
        ) {
          setError(
            'Please enter a valid phone number or leave it empty.'
          );
          return false;
        }
      }

      return true;
    }

    if (step === 2) {
      if (!formData.password) {
        setError(
          'Please create a password.'
        );
        return false;
      }

      if (formData.password.length < 6) {
        setError(
          'Password must be at least 6 characters.'
        );
        return false;
      }

      if (!formData.confirmPassword) {
        setError(
          'Please confirm your password.'
        );
        return false;
      }

      if (
        formData.password !==
        formData.confirmPassword
      ) {
        setError(
          'Passwords do not match.'
        );
        return false;
      }

      return true;
    }

    return true;
  };

  /*
   * Move from step 1 -> 2 -> 3.
   */
  const handleNextStep = () => {
    setError('');

    if (!validateStep()) {
      return;
    }

    setStep((prev) => prev + 1);
  };

  /*
   * Go back one registration step.
   */
  const handleBack = () => {
    setError('');
    setStep((prev) => prev - 1);
  };

  /*
   * Create citizen account.
   *
   * IMPORTANT:
   * Registration does NOT authenticate the user anymore.
   * Backend sends an OTP instead.
   */
  const handleSubmit = async (e) => {
    e.preventDefault();

    setError('');

    if (!formData.acceptTerms) {
      setError(
        'Please accept the terms and conditions.'
      );
      return;
    }

    if (!validateStep()) {
      return;
    }

    setIsLoading(true);

    try {
      await apiFetch('/auth/citizen/register', {
        method: 'POST',
        body: JSON.stringify({
          name: formData.name.trim(),
          email: formData.email.trim().toLowerCase(),
          phone: formData.phone.trim() || null,
          password: formData.password,
        }),
      });
      /*
       * Registration succeeded.
       *
       * Backend has already sent the OTP.
       * Move to verification screen.
       */
      setVerificationCode('');
      setError('');
      setResendCooldown(25);
      setStep(4);
    } catch (err) {
      console.error(
        'Citizen registration error:',
        err
      );

      setError(
        err.message ||
          'Something went wrong. Please try again.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  /*
   * Verify the 6-digit email OTP.
   */
 const handleVerifyEmail = async (e) => {
  e.preventDefault();

  setError('');

  if (!/^\d{6}$/.test(verificationCode)) {
    setError(
      'Please enter the 6-digit verification code.'
    );
    return;
  }

  setVerificationLoading(true);

  try {
    const data = await apiFetch(
        '/auth/citizen/verify-email',
        {
          method: 'POST',
          body: JSON.stringify({
            email: formData.email
              .trim()
              .toLowerCase(),
            code: verificationCode,
          }),
        }
      );

      if (!data?.user) {
        throw new Error(
          'Email verified, but user information was not returned.'
        );
      }

    resetRegistration();
    onRegister(data.user);
    onClose(); 
  } catch (err) {
    console.error(
      'Email verification error:',
      err
    );

    setError(
      err.message ||
        'Unable to verify your email. Please try again.'
    );
  } finally {
    setVerificationLoading(false);
  }
};
  /*
   * Resend verification OTP.
   */
  const handleResendVerification =
  async () => {
    if (
      resendCooldown > 0 ||
      resendLoading
    ) {
      return;
    }

    setError('');
    setResendLoading(true);

    try {
      await apiFetch('/auth/citizen/resend-verification', {
        method: 'POST',
        body: JSON.stringify({
          email: formData.email.trim().toLowerCase(),
        }),
      });

      setVerificationCode('');
      setResendCooldown(25);
      setError('');
    } catch (err) {
      console.error(
        'Resend verification error:',
        err
      );

      setError(
        err.message ||
          'Unable to resend the verification code.'
      );
    } finally {
      setResendLoading(false);
    }
  };

if (!isOpen) {
  return null;
}

  return (
    <div
      className="panel-container auth-overlay"
      onMouseDown={(event) => {
        if (
          event.target ===
          event.currentTarget
        ) {
          onClose();
        }
      }}
    >
      <section
        className="auth-card register-auth-card"
        aria-modal="true"
        role="dialog"
      >
        {/* LEFT VISUAL PANEL */}
        <div className="auth-art register-art">
          <div className="auth-art-mark">
            <User size={24} />
          </div>

          <p>Citizen portal</p>

          <h2>
            Your voice can make your neighbourhood better.
          </h2>

          <span>
            Create your NagarSetu account to
            report civic issues, follow progress,
            and stay connected with your
            community.
          </span>

          <div className="register-art-points">
            <div>
              <CheckCircle size={17} />
              <span>
                Report local issues
              </span>
            </div>

            <div>
              <CheckCircle size={17} />
              <span>
                Track complaint progress
              </span>
            </div>

            <div>
              <CheckCircle size={17} />
              <span>
                Stay connected with your city
              </span>
            </div>
          </div>
        </div>

        {/* FORM PANEL */}
        <div className="auth-form register-form">
          <button
            type="button"
            className="auth-close"
            onClick={onClose}
            aria-label="Close"
          >
            <X size={20} />
          </button>

          <p className="auth-kicker">
            Join NagarSetu
          </p>

          <h1>{title}</h1>

          <p className="auth-subtitle">
            {subtitle}
          </p>

          {/* STEP INDICATOR */}
          {step < 4 && (
            <>
              <div className="register-steps">
                {[1, 2, 3].map(
                  (s) => (
                    <React.Fragment
                      key={s}
                    >
                      <div
                        className={`register-step ${
                          s <= step
                            ? 'active'
                            : ''
                        } ${
                          s < step
                            ? 'completed'
                            : ''
                        }`}
                      >
                        {s < step ? (
                          <CheckCircle
                            size={15}
                          />
                        ) : (
                          s
                        )}
                      </div>

                      {s < 3 && (
                        <div
                          className={`register-step-line ${
                            s < step
                              ? 'active'
                              : ''
                          }`}
                        />
                      )}
                    </React.Fragment>
                  )
                )}
              </div>

              <div className="register-step-label">
                <span>
                  {step === 1 &&
                    'About you'}

                  {step === 2 &&
                    'Security'}

                  {step === 3 &&
                    'Confirm details'}
                </span>

                <span>
                  Step {step} of 3
                </span>
              </div>
            </>
          )}

          <form
            onSubmit={
              step === 4
                ? handleVerifyEmail
                : handleSubmit
            }
            className="register-form-body"
          >
            {/* ERROR */}
            {error && (
              <div className="auth-error register-error">
                {error}
              </div>
            )}

            {/* STEP 1 */}
            {step === 1 && (
              <div className="register-fields">
                <label>
                  Full name

                  <span className="auth-input">
                    <User size={17} />

                    <input
                      type="text"
                      name="name"
                      value={
                        formData.name
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Enter your full name"
                      required
                    />
                  </span>
                </label>

                <label>
                  Email address

                  <span className="auth-input">
                    <Mail size={17} />

                    <input
                      type="email"
                      name="email"
                      value={
                        formData.email
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="you@example.com"
                      required
                    />
                  </span>
                </label>

                <label>
                  Phone number

                  <span className="register-optional">
                    Optional
                  </span>

                  <span className="auth-input">
                    <Phone size={17} />

                    <input
                      type="tel"
                      name="phone"
                      value={
                        formData.phone
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="+91 98765 43210"
                    />
                  </span>
                </label>
              </div>
            )}

            {/* STEP 2 */}
            {step === 2 && (
              <div className="register-fields">
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
                      name="password"
                      value={
                        formData.password
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Create a password"
                      minLength="6"
                      required
                    />

                    <button
                      type="button"
                      className="auth-input-action"
                      onClick={() =>
                        setShowPassword(
                          !showPassword
                        )
                      }
                      aria-label={
                        showPassword
                          ? 'Hide password'
                          : 'Show password'
                      }
                    >
                      {showPassword ? (
                        <EyeOff
                          size={17}
                        />
                      ) : (
                        <Eye
                          size={17}
                        />
                      )}
                    </button>
                  </span>
                </label>

                <label>
                  Confirm password

                  <span className="auth-input">
                    <Lock size={17} />

                    <input
                      type={
                        showConfirmPassword
                          ? 'text'
                          : 'password'
                      }
                      name="confirmPassword"
                      value={
                        formData.confirmPassword
                      }
                      onChange={
                        handleChange
                      }
                      placeholder="Re-enter your password"
                      required
                    />

                    <button
                      type="button"
                      className="auth-input-action"
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
                        <EyeOff
                          size={17}
                        />
                      ) : (
                        <Eye
                          size={17}
                        />
                      )}
                    </button>
                  </span>
                </label>

                <div className="register-security-note">
                  <Lock size={16} />

                  <div>
                    <strong>
                      Your account is protected
                    </strong>

                    <span>
                      Use at least 6
                      characters for
                      your password.
                    </span>
                  </div>
                </div>
              </div>
            )}

            {/* STEP 3 */}
            {step === 3 && (
              <div className="register-confirm">
                <div className="register-success-icon">
                  <CheckCircle
                    size={27}
                  />
                </div>

                <h3>
                  Almost there
                </h3>

                <p>
                  Check your details
                  before creating your
                  NagarSetu account.
                </p>

                <div className="register-summary">
                  <div>
                    <span>
                      Name
                    </span>

                    <strong>
                      {formData.name}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Email
                    </span>

                    <strong>
                      {formData.email}
                    </strong>
                  </div>

                  <div>
                    <span>
                      Phone
                    </span>

                    <strong>
                      {formData.phone ||
                        'Not provided'}
                    </strong>
                  </div>
                </div>

                <label className="register-terms">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={
                      formData.acceptTerms
                    }
                    onChange={
                      handleChange
                    }
                    required
                  />

                  <span>
                    I agree to the{' '}
                    <button
                      type="button"
                    >
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button
                      type="button"
                    >
                      Privacy Policy
                    </button>
                    .
                  </span>
                </label>
              </div>
            )}

            {/* STEP 4 - EMAIL VERIFICATION */}
            {step === 4 && (
              <div className="register-confirm">
                <div className="register-success-icon">
                  <Mail size={27} />
                </div>

                <h3>
                  Verify your email
                </h3>

                <p>
                  We sent a 6-digit
                  verification code to
                </p>

                <strong
                  style={{
                    display: 'block',
                    marginTop: '6px',
                    color: '#1E3247',
                    wordBreak:
                      'break-word',
                  }}
                >
                  {formData.email}
                </strong>

                <div
                  style={{
                    marginTop: '22px',
                  }}
                >
                  <label>
                    Verification code

                    <span className="auth-input">
                      <Mail
                        size={17}
                      />

                      <input
                        type="text"
                        inputMode="numeric"
                        autoComplete="one-time-code"
                        maxLength={6}
                        value={
                          verificationCode
                        }
                        onChange={(e) => {
                          const value =
                            e.target.value.replace(
                              /\D/g,
                              ''
                            );

                          setVerificationCode(
                            value
                          );

                          if (error) {
                            setError('');
                          }
                        }}
                        placeholder="Enter 6-digit code"
                        autoFocus
                      />
                    </span>
                  </label>
                </div>

                <p
                  style={{
                    marginTop: '14px',
                    fontSize: '13px',
                    color: '#7A858A',
                  }}
                >
                  The code expires
                  after 60 seconds.
                </p>

                <button
                  type="button"
                  className="auth-secondary"
                  onClick={
                    handleResendVerification
                  }
                  disabled={
                    resendCooldown >
                      0 ||
                    resendLoading ||
                    verificationLoading
                  }
                  style={{
                    marginTop: '10px',
                    width: '100%',
                  }}
                >
                  {resendLoading
                    ? 'Sending…'
                    : resendCooldown >
                      0
                    ? `Resend code in ${resendCooldown}s`
                    : 'Resend verification code'}
                </button>
              </div>
            )}

            {/* ACTIONS FOR STEPS 1-3 */}
            {step < 4 && (
              <div className="register-actions">
                {step > 1 && (
                  <button
                    type="button"
                    className="auth-secondary"
                    onClick={
                      handleBack
                    }
                    disabled={
                      isLoading
                    }
                  >
                    Back
                  </button>
                )}

                {step < 3 ? (
                  <button
                    type="button"
                    className="auth-submit"
                    onClick={
                      handleNextStep
                    }
                    disabled={
                      isLoading
                    }
                  >
                    Continue
                    <span>→</span>
                  </button>
                ) : (
                  <button
                    type="submit"
                    className="auth-submit"
                    disabled={
                      isLoading
                    }
                  >
                    {isLoading ? (
                      <>
                        <span className="register-spinner" />
                        Creating account…
                      </>
                    ) : (
                      <>
                        Create account
                        <CheckCircle
                          size={17}
                        />
                      </>
                    )}
                  </button>
                )}
              </div>
            )}

            {/* ACTIONS FOR OTP */}
            {step === 4 && (
              <div className="register-actions">
                <button
                  type="submit"
                  className="auth-submit"
                  disabled={
                    verificationLoading ||
                    verificationCode.length !==
                      6
                  }
                >
                  {verificationLoading ? (
                    <>
                      <span className="register-spinner" />
                      Verifying…
                    </>
                  ) : (
                    <>
                      Verify email
                      <CheckCircle
                        size={17}
                      />
                    </>
                  )}
                </button>
              </div>
            )}
          </form>

          {/* LOGIN LINK */}
          {loginAction &&
            step < 4 && (
              <p className="register-login">
                Already have an account?{' '}

                <button
                  type="button"
                  onClick={loginAction}
                >
                  Sign in
                </button>
              </p>
            )}
        </div>
      </section>
    </div>
  );
};

export default RegisterPanel;