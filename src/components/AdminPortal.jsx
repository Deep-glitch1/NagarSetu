import React, { useState } from 'react';
import { 
  LogOut, 
  Home, 
  Users, 
  BarChart3,
  Settings,
  Menu,
  X,
  Bell,
  Search,
  Building2,
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
  User
} from 'lucide-react';

const AdminPortal = ({ userData, onLogout }) => {
  const [sidebarOpen, setSidebarOpen] = useState(true);
  const [activeTab, setActiveTab] = useState('dashboard');

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'complaints', label: 'Complaints Queue', icon: ClipboardList },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 },
    { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users },
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  return (
    <div className="min-h-screen bg-gray-50 flex">
      {/* Sidebar */}
      <div className={`fixed inset-y-0 left-0 z-50 w-72 bg-[#1A1A2E] transform transition-all duration-300 ${
        sidebarOpen ? 'translate-x-0' : '-translate-x-full'
      }`}>
        <div className="flex flex-col h-full">
          <div className="p-6 border-b border-white/10">
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-2">
                <Building2 className="w-8 h-8 text-[#D4A02B]" />
                <span className="text-xl font-bold text-white">Nagar<span className="text-[#D4A02B]">Setu</span></span>
              </div>
              <button
                onClick={() => setSidebarOpen(false)}
                className="lg:hidden p-2 text-gray-400 hover:text-white transition-colors"
              >
                <X className="w-5 h-5" />
              </button>
            </div>
            <div className="mt-4 p-3 bg-white/5 rounded-xl">
              <div className="flex items-center gap-3">
                <div className="w-10 h-10 rounded-full bg-[#D4A02B]/20 flex items-center justify-center">
                  <User className="w-5 h-5 text-[#D4A02B]" />
                </div>
                <div>
                  <p className="text-white text-sm font-medium">{userData?.name || 'Administrator'}</p>
                  <p className="text-gray-400 text-xs">{userData?.email || 'admin@nagarsetu.in'}</p>
                </div>
              </div>
            </div>
          </div>

          <nav className="flex-1 p-4 space-y-1 overflow-y-auto">
            {menuItems.map((item) => {
              const Icon = item.icon;
              return (
                <button
                  key={item.id}
                  onClick={() => setActiveTab(item.id)}
                  className={`w-full flex items-center gap-3 px-4 py-3 rounded-xl transition-all ${
                    activeTab === item.id
                      ? 'bg-[#D4A02B]/20 text-[#D4A02B]'
                      : 'text-gray-400 hover:bg-white/5 hover:text-white'
                  }`}
                >
                  <Icon className="w-5 h-5" />
                  <span className="font-medium">{item.label}</span>
                </button>
              );
            })}
          </nav>

          <div className="p-4 border-t border-white/10">
            <button
              onClick={onLogout}
              className="w-full flex items-center gap-3 px-4 py-3 text-red-400 hover:bg-red-500/10 rounded-xl transition-colors"
            >
              <LogOut className="w-5 h-5" />
              <span className="font-medium">Logout</span>
            </button>
          </div>
        </div>
      </div>

      {/* Main Content */}
      <div className={`flex-1 transition-all duration-300 ${sidebarOpen ? 'lg:ml-72' : ''}`}>
        <header className="bg-white border-b border-gray-200 sticky top-0 z-40">
          <div className="flex items-center justify-between px-4 py-3">
            <div className="flex items-center gap-4">
              <button
                onClick={() => setSidebarOpen(true)}
                className="lg:hidden p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors"
              >
                <Menu className="w-5 h-5" />
              </button>
              <h1 className="text-lg font-semibold text-gray-800">
                {menuItems.find(item => item.id === activeTab)?.label || 'Dashboard'}
              </h1>
            </div>

            <div className="flex items-center gap-4">
              <div className="relative hidden md:block">
                <Search className="absolute left-3 top-1/2 -translate-y-1/2 w-4 h-4 text-gray-400" />
                <input
                  type="text"
                  placeholder="Search complaints..."
                  className="pl-10 pr-4 py-2 border border-gray-200 rounded-lg text-sm focus:outline-none focus:ring-2 focus:ring-[#D4A02B] focus:border-transparent w-64"
                />
              </div>
              <button className="relative p-2 text-gray-600 hover:bg-gray-100 rounded-lg transition-colors">
                <Bell className="w-5 h-5" />
                <span className="absolute top-1 right-1 w-2 h-2 bg-red-500 rounded-full"></span>
              </button>
            </div>
          </div>
        </header>

        <main className="p-6">
          {activeTab === 'dashboard' && (
            <div>
              <div className="grid grid-cols-2 md:grid-cols-4 gap-4 mb-6">
                {[
                  { label: 'Total Complaints', value: '1,284', icon: ClipboardList, color: 'text-blue-600' },
                  { label: 'Pending', value: '342', icon: Clock, color: 'text-yellow-600' },
                  { label: 'Resolved', value: '892', icon: CheckCircle, color: 'text-green-600' },
                  { label: 'Overdue', value: '50', icon: AlertTriangle, color: 'text-red-600' },
                ].map((stat) => {
                  const Icon = stat.icon;
                  return (
                    <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
                      <div className="flex items-center justify-between">
                        <div className={`${stat.color} p-2 bg-opacity-10 rounded-lg`}>
                          <Icon className={`w-5 h-5 ${stat.color}`} />
                        </div>
                        <span className="text-2xl font-bold text-gray-800">{stat.value}</span>
                      </div>
                      <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
                    </div>
                  );
                })}
              </div>

              <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
                <h3 className="font-semibold text-gray-800 mb-4">📊 Complaint Analytics</h3>
                <div className="text-center py-12 text-gray-400">
                  <BarChart3 className="w-12 h-12 mx-auto mb-3 text-gray-300" />
                  <p className="text-sm">Detailed analytics dashboard coming soon</p>
                  <p className="text-xs mt-1">Includes category breakdown, department performance, SLA compliance</p>
                </div>
              </div>
            </div>
          )}
          {activeTab !== 'dashboard' && (
            <div className="text-center py-20 text-gray-500">
              <div className="bg-white rounded-xl p-12 shadow-sm border border-gray-100">
                <h3 className="text-xl font-medium text-gray-700">
                  {menuItems.find(item => item.id === activeTab)?.label} Module
                </h3>
                <p className="text-sm mt-2">This module is under development</p>
              </div>
            </div>
          )}
        </main>
      </div>
    </div>
  );
};

export default AdminPortal;