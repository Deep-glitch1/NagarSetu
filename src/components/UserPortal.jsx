import React, { useState, useEffect } from 'react';
import { 
  Building2, 
  User, 
  Shield, 
  ArrowRight,
  MapPin,
  Clock,
  Star,
  CheckCircle
} from 'lucide-react';
import LoginPanel from './LoginPanel';
import RegisterPanel from './RegisterPanel';

const PortalEntry = ({ onUserLogin, onAdminLogin }) => {
  const [showUserLogin, setShowUserLogin] = useState(false);
  const [showUserRegister, setShowUserRegister] = useState(false);
  const [showAdminLogin, setShowAdminLogin] = useState(false);

  const stats = [
    { icon: CheckCircle, label: 'Complaints Resolved', value: '24,891', color: 'text-green-400' },
    { icon: Clock, label: 'Avg. Response Time', value: '4.2 hrs', color: 'text-blue-400' },
    { icon: Star, label: 'Citizen Satisfaction', value: '94%', color: 'text-yellow-400' },
    { icon: MapPin, label: 'Wards Covered', value: '60', color: 'text-purple-400' },
  ];

  const features = [
    'AI-Powered Complaint Classification',
    'Real-Time Status Tracking',
    'Automatic Department Routing',
    'Independent Resolution Verification',
    'SLA-Based Escalation',
    'Multi-Language Support',
  ];

  useEffect(() => {
    const handleClickOutside = (e) => {
      if (e.target.closest('.panel-container') === null && 
          e.target.closest('.trigger-btn') === null) {
        setShowUserLogin(false);
        setShowUserRegister(false);
        setShowAdminLogin(false);
      }
    };
    document.addEventListener('click', handleClickOutside);
    return () => document.removeEventListener('click', handleClickOutside);
  }, []);

  const handleUserLoginClick = () => {
    setShowUserLogin(true);
    setShowUserRegister(false);
    setShowAdminLogin(false);
  };

  const handleUserRegisterClick = () => {
    setShowUserRegister(true);
    setShowUserLogin(false);
    setShowAdminLogin(false);
  };

  const handleAdminLoginClick = () => {
    setShowAdminLogin(true);
    setShowUserLogin(false);
    setShowUserRegister(false);
  };

  const closeAllPanels = () => {
    setShowUserLogin(false);
    setShowUserRegister(false);
    setShowAdminLogin(false);
  };

  return (
    <div className="min-h-screen relative overflow-hidden" style={{ 
      background: 'linear-gradient(135deg, #0A2463 0%, #1a3a7a 50%, #1A1A2E 100%)'
    }}>
      {/* Animated Background */}
      <div className="absolute inset-0 overflow-hidden">
        <div className="absolute -top-40 -right-40 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ 
          background: 'rgba(212, 160, 43, 0.2)'
        }}></div>
        <div className="absolute -bottom-40 -left-40 w-96 h-96 rounded-full blur-3xl animate-pulse" style={{ 
          background: 'rgba(59, 130, 246, 0.2)',
          animationDelay: '2s'
        }}></div>
        <div className="absolute inset-0" style={{
          backgroundImage: `radial-gradient(circle at 1px 1px, rgba(255,255,255,0.05) 1px, transparent 0)`,
          backgroundSize: '40px 40px'
        }}></div>
      </div>

      {/* Main Content */}
      <div className="relative z-10 container mx-auto px-4 min-h-screen flex flex-col items-center justify-center">
        {/* Header */}
        <div className="text-center mb-12 animate-fade-in">
          <div className="flex items-center justify-center gap-3 mb-4">
            <Building2 className="w-12 h-12" style={{ color: '#D4A02B' }} />
            <h1 className="text-5xl md:text-6xl font-extrabold">
              <span className="text-white">Nagar</span>
              <span className="gradient-text">Setu</span>
            </h1>
          </div>
          <p className="text-xl text-blue-200 max-w-2xl mx-auto">
            An AI-Powered Bridge Between Citizens and Government
          </p>
          <div className="flex items-center justify-center gap-2 mt-3 text-sm text-blue-300">
            <span>🏛️ Haldwani-Kathgodam Municipal Corporation</span>
            <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
            <span>📍 Uttarakhand, India</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-12 w-full max-w-3xl">
          {stats.map((stat, idx) => (
            <div key={idx} className="glass rounded-xl p-4 text-center backdrop-blur-sm">
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-1`} />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-blue-300">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Entry Buttons */}
        <div className="flex flex-col sm:flex-row gap-6 w-full max-w-lg">
          {/* Citizen Button */}
          <div className="relative flex-1 trigger-btn">
            <button
              onClick={handleUserLoginClick}
              className="w-full group relative overflow-hidden rounded-2xl p-8 text-white transition-all duration-300 transform hover:scale-105 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #2563eb 0%, #1d4ed8 50%, #1e40af 100%)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <User className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-semibold">Citizen</div>
                    <div className="text-sm text-blue-200">Report & Track Issues</div>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </button>
          </div>

          {/* Admin Button */}
          <div className="relative flex-1 trigger-btn">
            <button
              onClick={handleAdminLoginClick}
              className="w-full group relative overflow-hidden rounded-2xl p-8 text-white transition-all duration-300 transform hover:scale-105 shadow-2xl"
              style={{
                background: 'linear-gradient(135deg, #D4A02B 0%, #ca8a04 50%, #a16207 100%)'
              }}
            >
              <div className="absolute inset-0 bg-gradient-to-r from-transparent via-white/10 to-transparent -translate-x-full group-hover:translate-x-full transition-transform duration-1000"></div>
              <div className="relative flex items-center justify-between">
                <div className="flex items-center gap-4">
                  <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                    <Shield className="w-8 h-8" />
                  </div>
                  <div className="text-left">
                    <div className="text-xl font-semibold">Administrator</div>
                    <div className="text-sm text-yellow-200">Manage & Resolve Issues</div>
                  </div>
                </div>
                <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity duration-300" />
              </div>
            </button>
          </div>
        </div>

        {/* Features */}
        <div className="mt-12 w-full max-w-2xl">
          <div className="glass rounded-2xl p-6">
            <h3 className="text-white font-semibold text-center mb-4">✨ Key Features</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-2">
              {features.map((feature, idx) => (
                <div key={idx} className="flex items-center gap-2 text-sm text-blue-200">
                  <CheckCircle className="w-4 h-4 flex-shrink-0" style={{ color: '#D4A02B' }} />
                  <span>{feature}</span>
                </div>
              ))}
            </div>
          </div>
        </div>

        {/* Footer */}
        <div className="mt-8 text-center text-xs text-blue-400/60">
          <p>© 2026 NagarSetu · An AI-Powered Civic Complaint Management Platform</p>
          <p className="mt-1">Built for Haldwani-Kathgodam Municipal Corporation, Uttarakhand</p>
        </div>
      </div>

      {/* Slide Panels */}
      <div className="fixed inset-0 pointer-events-none">
        <LoginPanel
          isOpen={showUserLogin}
          onClose={closeAllPanels}
          onLogin={onUserLogin}
          title="Citizen Login"
          subtitle="Access your dashboard to report and track civic issues"
          type="citizen"
          registerAction={handleUserRegisterClick}
        />

        <RegisterPanel
          isOpen={showUserRegister}
          onClose={closeAllPanels}
          onRegister={() => {
            closeAllPanels();
            handleUserLoginClick();
          }}
          title="Create Citizen Account"
          subtitle="Join NagarSetu to report civic issues in your area"
          type="citizen"
          loginAction={handleUserLoginClick}
        />

        <LoginPanel
          isOpen={showAdminLogin}
          onClose={closeAllPanels}
          onLogin={onAdminLogin}
          title="Administrator Login"
          subtitle="Access the department dashboard to manage complaints"
          type="admin"
          registerAction={() => {
            alert('Administrator accounts are created by system administrators only.');
          }}
        />
      </div>
    </div>
  );
};

export default PortalEntry;