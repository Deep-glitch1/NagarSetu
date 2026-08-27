import React, { useState, useEffect, useRef } from 'react';
import { X, Eye, EyeOff, Mail, Lock, User, Shield, Building2 } from 'lucide-react';

const LoginPanel = ({ 
  isOpen, 
  onClose, 
  onLogin, 
  title, 
  subtitle, 
  type,
  registerAction 
}) => {
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [showPassword, setShowPassword] = useState(false);
  const [isLoading, setIsLoading] = useState(false);
  const [error, setError] = useState('');
  const panelRef = useRef(null);

  useEffect(() => {
    if (isOpen) {
      setError('');
      setTimeout(() => {
        const input = panelRef.current?.querySelector('input');
        if (input) input.focus();
      }, 100);
    }
  }, [isOpen]);

  useEffect(() => {
    const handleEscape = (e) => {
      if (e.key === 'Escape' && isOpen) onClose();
    };
    document.addEventListener('keydown', handleEscape);
    return () => document.removeEventListener('keydown', handleEscape);
  }, [isOpen, onClose]);

  const handleSubmit = async (e) => {
    e.preventDefault();
    setError('');
    setIsLoading(true);

    await new Promise(resolve => setTimeout(resolve, 1000));

    if (type === 'citizen') {
      if (email === 'citizen@nagarsetu.in' && password === 'citizen123') {
        onLogin({ name: 'Citizen User', email, role: 'citizen' });
        onClose();
      } else {
        setError('Invalid credentials');
      }
    } else {
      if (email === 'admin@nagarsetu.in' && password === 'admin123') {
        onLogin({ name: 'Administrator', email, role: 'admin' });
        onClose();
      } else {
        setError('Invalid credentials');
      }
    }

    setIsLoading(false);
  };

  if (!isOpen) return null;

  return (
    <div 
      className="fixed inset-0 z-50 flex items-center justify-center bg-black/50 backdrop-blur-sm"
      onClick={(e) => {
        if (e.target === e.currentTarget) onClose();
      }}
    >
      <div 
        ref={panelRef}
        className="w-full max-w-md bg-[#1A1A2E] rounded-2xl shadow-2xl mx-4 transform transition-all duration-300"
      >
        <div className="p-8">
          {/* Header */}
          <div className="flex justify-between items-start mb-6">
            <div>
              <div className="flex items-center gap-2 mb-1">
                {type === 'citizen' ? (
                  <User className="w-6 h-6 text-blue-400" />
                ) : (
                  <Shield className="w-6 h-6 text-yellow-400" />
                )}
                <h2 className="text-2xl font-bold text-white">{title}</h2>
              </div>
              <p className="text-sm text-gray-400">{subtitle}</p>
            </div>
            <button 
              onClick={onClose}
              className="p-2 hover:bg-white/10 rounded-lg transition-colors text-gray-400 hover:text-white"
            >
              <X className="w-5 h-5" />
            </button>
          </div>

          {/* Form */}
          <form onSubmit={handleSubmit}>
            {error && (
              <div className="bg-red-500/20 border border-red-500/50 rounded-lg p-3 mb-4 text-red-300 text-sm">
                {error}
              </div>
            )}

            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Email Address</label>
                <div className="relative">
                  <Mail className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type="email"
                    value={email}
                    onChange={(e) => setEmail(e.target.value)}
                    placeholder="you@example.com"
                    className="w-full pl-10 pr-4 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-all"
                    required
                  />
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-300 mb-1.5">Password</label>
                <div className="relative">
                  <Lock className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-500" />
                  <input
                    type={showPassword ? 'text' : 'password'}
                    value={password}
                    onChange={(e) => setPassword(e.target.value)}
                    placeholder="••••••••"
                    className="w-full pl-10 pr-12 py-3 bg-white/5 border border-white/10 rounded-xl text-white placeholder-gray-500 focus:outline-none focus:border-yellow-400 transition-all"
                    required
                  />
                  <button
                    type="button"
                    onClick={() => setShowPassword(!showPassword)}
                    className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-500 hover:text-gray-300"
                  >
                    {showPassword ? <EyeOff className="w-5 h-5" /> : <Eye className="w-5 h-5" />}
                  </button>
                </div>
              </div>
            </div>

            <div className="mt-6 space-y-3">
              <button
                type="submit"
                disabled={isLoading}
                className="w-full py-3 bg-yellow-500 hover:bg-yellow-600 text-[#1A1A2E] font-semibold rounded-xl transition-all disabled:opacity-50"
              >
                {isLoading ? (
                  <span className="flex items-center justify-center gap-2">
                    <span className="w-5 h-5 border-2 border-[#1A1A2E] border-t-transparent rounded-full animate-spin"></span>
                    Logging in...
                  </span>
                ) : (
                  'Sign In'
                )}
              </button>

              {type === 'citizen' && registerAction && (
                <button
                  type="button"
                  onClick={registerAction}
                  className="w-full text-center text-sm text-gray-400 hover:text-white transition-colors"
                >
                  Don't have an account? <span className="text-yellow-400 hover:underline">Register here</span>
                </button>
              )}

              <div className="mt-4 p-3 bg-white/5 rounded-xl border border-white/5">
                <p className="text-xs text-gray-500 text-center">
                  <span className="text-gray-400">Demo:</span><br />
                  {type === 'citizen' ? (
                    <>Email: <span className="text-blue-300">citizen@nagarsetu.in</span> | Pass: <span className="text-blue-300">citizen123</span></>
                  ) : (
                    <>Email: <span className="text-yellow-300">admin@nagarsetu.in</span> | Pass: <span className="text-yellow-300">admin123</span></>
                  )}
                </p>
              </div>
            </div>
          </form>
        </div>
      </div>
    </div>
  );
};

export default LoginPanel;