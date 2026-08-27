import React, { useState } from 'react';
import { 
  Building2, 
  User, 
  Shield, 
  ArrowRight,
  MapPin,
  Clock,
  Star,
  CheckCircle,
  Sparkles
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
    <div className="min-h-screen bg-[#0A2463] flex items-center justify-center p-4">
      {/* Main Container */}
      <div className="w-full max-w-6xl">
        {/* Header */}
        <div className="text-center mb-10">
          <div className="flex items-center justify-center gap-3 mb-3">
            <Building2 className="w-12 h-12 text-yellow-400" />
            <h1 className="text-5xl font-bold text-white">
              Nagar<span className="text-yellow-400">Setu</span>
            </h1>
          </div>
          <p className="text-blue-200 text-lg">
            An AI-Powered Bridge Between Citizens and Government
          </p>
          <div className="flex items-center justify-center gap-2 mt-2 text-sm text-blue-300">
            <span>🏛️ Haldwani-Kathgodam Municipal Corporation</span>
            <span className="w-1 h-1 bg-blue-400 rounded-full"></span>
            <span>📍 Uttarakhand, India</span>
          </div>
        </div>

        {/* Stats */}
        <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-10">
          {stats.map((stat, idx) => (
            <div 
              key={idx} 
              className="bg-white/10 backdrop-blur-sm rounded-xl p-4 text-center border border-white/10"
            >
              <stat.icon className={`w-6 h-6 ${stat.color} mx-auto mb-1`} />
              <div className="text-2xl font-bold text-white">{stat.value}</div>
              <div className="text-xs text-blue-300">{stat.label}</div>
            </div>
          ))}
        </div>

        {/* Action Cards */}
        <div className="grid md:grid-cols-2 gap-6 mb-10">
          {/* Citizen Card */}
          <button
            onClick={handleUserLoginClick}
            className="group bg-blue-600 hover:bg-blue-700 rounded-2xl p-8 text-white transition-all hover:scale-105 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <User className="w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="text-2xl font-semibold">Citizen</div>
                  <div className="text-blue-200 text-sm">Report & Track Issues</div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>

          {/* Admin Card */}
          <button
            onClick={handleAdminLoginClick}
            className="group bg-yellow-500 hover:bg-yellow-600 rounded-2xl p-8 text-white transition-all hover:scale-105 shadow-xl"
          >
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="w-14 h-14 rounded-full bg-white/20 flex items-center justify-center">
                  <Shield className="w-8 h-8" />
                </div>
                <div className="text-left">
                  <div className="text-2xl font-semibold">Administrator</div>
                  <div className="text-yellow-100 text-sm">Manage & Resolve Issues</div>
                </div>
              </div>
              <ArrowRight className="w-6 h-6 opacity-0 group-hover:opacity-100 transition-opacity" />
            </div>
          </button>
        </div>

        {/* Features */}
        <div className="bg-white/5 backdrop-blur-sm rounded-2xl p-6 border border-white/10">
          <div className="flex items-center gap-2 text-white font-semibold mb-4">
            <Sparkles className="w-5 h-5 text-yellow-400" />
            <span>Key Features</span>
          </div>
          <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
            {features.map((feature, idx) => (
              <div key={idx} className="flex items-center gap-2 text-sm text-blue-200">
                <CheckCircle className="w-4 h-4 text-yellow-400 shrink-0" />
                <span>{feature}</span>
              </div>
            ))}
          </div>
        </div>

        {/* Footer */}
        <div className="text-center text-xs text-blue-400/60 mt-8">
          <p>© 2026 NagarSetu · An AI-Powered Civic Complaint Management Platform</p>
          <p className="mt-1">Built for Haldwani-Kathgodam Municipal Corporation, Uttarakhand</p>
        </div>
      </div>

      {/* Slide Panels */}
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
  );
};

export default PortalEntry;