import React, { useState, useEffect } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, Phone, MapPin, CheckCircle } from 'lucide-react';

const fraunces = { fontFamily: "'Fraunces', ui-serif, Georgia, serif" };
const ACCENT = '#BC573E';

const RegisterPanel = ({ isOpen, onClose, onRegister, title, subtitle, type, loginAction }) => {
  const [formData, setFormData] = useState({
    name: '',
    email: '',
    phone: '',
    password: '',
    confirmPassword: '',
    ward: '',
    acceptTerms: false,
  });
  const [showPassword, setShowPassword] = useState(false);
  const [showConfirmPassword, setShowConfirmPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const [step, setStep] = useState(1);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setStep(1);
    }
  }, [isOpen]);

  const handleChange = (e) => {
    const { name, value, type, checked } = e.target;
    setFormData((prev) => ({
      ...prev,
      [name]: type === 'checkbox' ? checked : value,
    }));
  };

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');

    if (formData.password !== formData.confirmPassword) {
      setError('Passwords do not match');
      return;
    }
    if (formData.password.length < 6) {
      setError('Password must be at least 6 characters');
      return;
    }
    if (!formData.acceptTerms) {
      setError('Please accept the terms and conditions');
      return;
    }

    setIsLoading(true);
    await new Promise((resolve) => setTimeout(resolve, 1500));
    onRegister({
      name: formData.name,
      email: formData.email,
      phone: formData.phone,
      ward: formData.ward,
    });
    onClose();
    setIsLoading(false);
  };

  if (!isOpen) return null;

  const inputClass =
    'w-full pl-10 pr-4 py-3 bg-white/75 border border-[#DED7C8] rounded-xl text-[#1E3247] placeholder-[#8B969B] focus:outline-none focus:ring-2 focus:ring-[#BC573E]/40 focus:border-[#BC573E]/50 transition-all';

  const stepLabels = ['About you', 'Location & security', 'Confirm'];

  return (
    <div
      className="panel-container fixed inset-0 pointer-events-auto z-50 flex justify-start bg-[#1E3247]/45 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div
        className={`w-full max-w-md min-h-full border-r border-[#DED7C8] shadow-2xl transform transition-all duration-500 ease-out overflow-y-auto ${
          isOpen ? 'translate-x-0 opacity-100' : '-translate-x-full opacity-0'
        }`}
        style={{ background: 'linear-gradient(175deg, #FFFDF8 0%, #F4EEE2 60%)' }}
      >
        <div className="p-5 sm:p-8">
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="w-11 h-11 rounded-xl flex items-center justify-center mb-3 bg-[#BC573E]/10">
                <User className="w-5 h-5 text-[#BC573E]" />
              </div>
              <h2 className="text-2xl font-semibold text-[#1E3247]" style={fraunces}>
                {title}
              </h2>
              <p className="text-sm text-[#60717C] mt-1">{subtitle}</p>
            </div>
            <button
              onClick={onClose}
              aria-label="Close"
              className="p-2 -mr-2 -mt-1 hover:bg-[#1E3247]/5 rounded-lg transition-colors text-[#718087] hover:text-[#1E3247]"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Step indicator */}
          <div className="mb-8">
            <div className="flex items-center gap-2 mb-2">
              {[1, 2, 3].map((s) => (
                <div
                  key={s}
                  className="flex-1 h-1 rounded-full transition-all duration-300"
                  style={{ backgroundColor: s <= step ? ACCENT : 'rgba(255,255,255,0.1)' }}
                />
              ))}
            </div>
            <p className="text-xs text-[#718087]">
              Step {step} of 3 &middot; <span className="text-[#60717C]">{stepLabels[step - 1]}</span>
            </p>
          </div>

          <form onSubmit={handleSubmit} className="space-y-4">
            {error && (
              <div className="bg-red-500/10 border border-red-500/30 rounded-xl px-4 py-3 text-red-300 text-sm">
                {error}
              </div>
            )}

            {step === 1 && (
              <>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Full Name
                  </label>
                  <div className="relative">
                    <User className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="text"
                      name="name"
                      value={formData.name}
                      onChange={handleChange}
                      placeholder="Enter your full name"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Email Address
                  </label>
                  <div className="relative">
                    <Mail className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="email"
                      name="email"
                      value={formData.email}
                      onChange={handleChange}
                      placeholder="you@example.com"
                      className={inputClass}
                      required
                    />
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Phone Number
                  </label>
                  <div className="relative">
                    <Phone className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type="tel"
                      name="phone"
                      value={formData.phone}
                      onChange={handleChange}
                      placeholder="+91 98765 43210"
                      className={inputClass}
                    />
                  </div>
                </div>
              </>
            )}

            {step === 2 && (
              <>
                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Ward / Area
                  </label>
                  <div className="relative">
                    <MapPin className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500 z-10" />
                    <select
                      name="ward"
                      value={formData.ward}
                      onChange={handleChange}
                      className={`${inputClass} appearance-none`}
                      required
                    >
                      <option value="" className="bg-[#0B1E3D]">
                        Select your ward
                      </option>
                      {[...Array(60)].map((_, i) => (
                        <option key={i} value={`Ward-${i + 1}`} className="bg-[#0B1E3D]">
                          Ward {i + 1}
                        </option>
                      ))}
                    </select>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showPassword ? 'text' : 'password'}
                      name="password"
                      value={formData.password}
                      onChange={handleChange}
                      placeholder="Min 6 characters"
                      className={`${inputClass} pr-12`}
                      required
                      minLength="6"
                    />
                    <button
                      type="button"
                      onClick={() => setShowPassword(!showPassword)}
                      aria-label={showPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>

                <div>
                  <label className="block text-xs font-medium uppercase tracking-wide text-slate-400 mb-2">
                    Confirm Password
                  </label>
                  <div className="relative">
                    <Lock className="absolute left-3.5 top-1/2 -translate-y-1/2 w-4 h-4 text-slate-500" />
                    <input
                      type={showConfirmPassword ? 'text' : 'password'}
                      name="confirmPassword"
                      value={formData.confirmPassword}
                      onChange={handleChange}
                      placeholder="Confirm your password"
                      className={`${inputClass} pr-12`}
                      required
                    />
                    <button
                      type="button"
                      onClick={() => setShowConfirmPassword(!showConfirmPassword)}
                      aria-label={showConfirmPassword ? 'Hide password' : 'Show password'}
                      className="absolute right-3.5 top-1/2 -translate-y-1/2 text-slate-500 hover:text-slate-300 transition-colors"
                    >
                      {showConfirmPassword ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                    </button>
                  </div>
                </div>
              </>
            )}

            {step === 3 && (
              <div className="space-y-6">
                <div className="bg-white/65 rounded-2xl p-6 border border-[#DED7C8]">
                  <h3 className="text-[#1E3247] font-medium text-sm uppercase tracking-wide mb-4">
                    Verify your details
                  </h3>
                  <div className="space-y-3 text-sm">
                    {[
                      ['Name', formData.name],
                      ['Email', formData.email],
                      ['Phone', formData.phone || 'Not provided'],
                      ['Ward', formData.ward || 'Not selected'],
                    ].map(([label, value]) => (
                      <div key={label} className="flex flex-col gap-1 border-b border-white/5 pb-2 last:border-0 last:pb-0 sm:flex-row sm:items-start sm:justify-between sm:gap-4">
                        <span className="text-[#718087]">{label}</span>
                        <span className="text-[#1E3247] font-medium break-all sm:text-right">{value}</span>
                      </div>
                    ))}
                  </div>
                </div>

                <label className="flex items-start gap-3 cursor-pointer">
                  <input
                    type="checkbox"
                    name="acceptTerms"
                    checked={formData.acceptTerms}
                    onChange={handleChange}
                    className="mt-1 w-4 h-4 rounded border-slate-600 bg-transparent text-[#E3A438] focus:ring-[#E3A438] focus:ring-offset-0"
                    required
                  />
                  <span className="text-sm text-[#60717C] leading-relaxed">
                    I agree to the{' '}
                    <button type="button" className="text-[#E3A438] hover:underline">
                      Terms of Service
                    </button>{' '}
                    and{' '}
                    <button type="button" className="text-[#E3A438] hover:underline">
                      Privacy Policy
                    </button>
                  </span>
                </label>
              </div>
            )}

            <div className="flex gap-3 pt-4">
              {step > 1 && (
                <button
                  type="button"
                  onClick={() => setStep(step - 1)}
                  className="flex-1 py-3 border border-[#DED7C8] text-[#1E3247] rounded-xl hover:bg-white/70 transition-colors font-medium"
                >
                  Back
                </button>
              )}
              {step < 3 ? (
                <button
                  type="button"
                  onClick={() => setStep(step + 1)}
                  className="flex-1 py-3 text-white font-semibold rounded-xl transition-colors shadow-lg shadow-[#1E3247]/15"
                  style={{ backgroundColor: ACCENT }}
                >
                  Continue
                </button>
              ) : (
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 py-3 bg-[#3F7D58] text-white font-semibold rounded-xl hover:bg-[#356b4a] transition-all disabled:opacity-50 disabled:cursor-not-allowed"
                >
                  {isLoading ? (
                    <span className="flex items-center justify-center gap-2">
                      <span className="w-4 h-4 border-2 border-white/40 border-t-white rounded-full animate-spin" />
                      Creating account&hellip;
                    </span>
                  ) : (
                    <span className="flex items-center justify-center gap-2">
                      <CheckCircle className="w-4 h-4" />
                      Create Account
                    </span>
                  )}
                </button>
              )}
            </div>

            {loginAction && (
              <p className="text-center text-sm text-slate-400 mt-4">
                Already have an account?{' '}
                <button type="button" onClick={loginAction} className="text-[#E3A438] hover:underline font-medium">
                  Sign In
                </button>
              </p>
            )}
          </form>
        </div>
      </div>
    </div>
  );
};

export default RegisterPanel;
