import React from 'react';
import { 
  MapPin, 
  Clock, 
  CheckCircle, 
  AlertTriangle,
  TrendingUp,
  Award,
  Calendar,
  ArrowUpRight
} from 'lucide-react';

const UserDashboard = ({ userData }) => {
  const stats = [
    { label: 'Total Complaints', value: '12', icon: MapPin, color: 'bg-blue-500' },
    { label: 'Resolved', value: '8', icon: CheckCircle, color: 'bg-green-500' },
    { label: 'In Progress', value: '3', icon: Clock, color: 'bg-yellow-500' },
    { label: 'Overdue', value: '1', icon: AlertTriangle, color: 'bg-red-500' },
  ];

  const recentComplaints = [
    { id: 'NGS-20260101-0001', title: 'Pothole on Main Road', status: 'Resolved', date: '2 days ago', priority: 'High' },
    { id: 'NGS-20260105-0004', title: 'Street Light Not Working', status: 'In Progress', date: '1 day ago', priority: 'Medium' },
    { id: 'NGS-20260103-0003', title: 'Garbage Collection Missed', status: 'Pending', date: '3 days ago', priority: 'High' },
  ];

  const achievements = [
    { label: 'Community Helper', icon: Award, desc: 'Reported 10+ issues' },
    { label: 'Quick Responder', icon: TrendingUp, desc: 'Avg. response time improved' },
  ];

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div className="bg-gradient-to-r from-[#0A2463] to-blue-700 rounded-2xl p-6 text-white">
        <div className="flex items-center justify-between">
          <div>
            <h2 className="text-2xl font-bold">Welcome back, {userData?.name || 'Citizen'}! 👋</h2>
            <p className="text-blue-200 mt-1">Here's what's happening with your civic issues today</p>
          </div>
          <div className="bg-white/20 backdrop-blur-sm px-4 py-2 rounded-xl hidden sm:block">
            <Calendar className="w-5 h-5 inline mr-2" />
            <span className="text-sm">{new Date().toLocaleDateString('en-IN', { 
              weekday: 'long', 
              day: 'numeric', 
              month: 'long', 
              year: 'numeric' 
            })}</span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div key={stat.label} className="bg-white rounded-xl p-4 shadow-sm border border-gray-100">
              <div className="flex items-center justify-between">
                <div className={`w-10 h-10 rounded-xl ${stat.color} bg-opacity-10 flex items-center justify-center`}>
                  <Icon className={`w-5 h-5 ${stat.color.replace('bg-', 'text-')}`} />
                </div>
                <span className="text-2xl font-bold text-gray-800">{stat.value}</span>
              </div>
              <p className="text-sm text-gray-500 mt-1">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Action */}
      <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
        <h3 className="font-semibold text-gray-800 mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="bg-[#D4A02B]/10 hover:bg-[#D4A02B]/20 text-[#1A1A2E] p-4 rounded-xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium">📸 Report New Issue</span>
              <ArrowUpRight className="w-4 h-4" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Take photo, get AI classification</p>
          </button>
          <button className="bg-blue-50 hover:bg-blue-100 p-4 rounded-xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium text-blue-700">📍 Track Complaints</span>
              <ArrowUpRight className="w-4 h-4 text-blue-700" />
            </div>
            <p className="text-sm text-gray-500 mt-1">Check status of your reports</p>
          </button>
          <button className="bg-green-50 hover:bg-green-100 p-4 rounded-xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium text-green-700">🏆 View Impact</span>
              <ArrowUpRight className="w-4 h-4 text-green-700" />
            </div>
            <p className="text-sm text-gray-500 mt-1">See how you've helped</p>
          </button>
        </div>
      </div>

      {/* Recent Complaints */}
      <div className="bg-white rounded-xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-6 border-b border-gray-100">
          <div className="flex items-center justify-between">
            <h3 className="font-semibold text-gray-800">Recent Complaints</h3>
            <button className="text-sm text-[#D4A02B] hover:underline">View All</button>
          </div>
        </div>
        <div className="divide-y divide-gray-100">
          {recentComplaints.map((complaint) => (
            <div key={complaint.id} className="p-4 hover:bg-gray-50 transition-colors cursor-pointer">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-gray-800">{complaint.title}</p>
                  <div className="flex items-center gap-4 mt-1 text-xs text-gray-500">
                    <span className="font-mono">{complaint.id}</span>
                    <span>{complaint.date}</span>
                    <span className={`px-2 py-0.5 rounded-full ${
                      complaint.priority === 'High' ? 'bg-red-100 text-red-700' : 'bg-yellow-100 text-yellow-700'
                    }`}>
                      {complaint.priority}
                    </span>
                  </div>
                </div>
                <span className={`px-3 py-1 rounded-full text-xs font-medium ${
                  complaint.status === 'Resolved' ? 'bg-green-100 text-green-700' :
                  complaint.status === 'In Progress' ? 'bg-yellow-100 text-yellow-700' :
                  'bg-blue-100 text-blue-700'
                }`}>
                  {complaint.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements & Trust Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">🏅 Your Impact</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#D4A02B]/20 flex items-center justify-center">
              <span className="text-2xl font-bold text-[#D4A02B]">94%</span>
            </div>
            <div>
              <p className="font-medium text-gray-800">Trust Score</p>
              <p className="text-sm text-gray-500">Based on verified complaints</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-xl p-6 shadow-sm border border-gray-100">
          <h3 className="font-semibold text-gray-800 mb-4">⭐ Achievements</h3>
          <div className="flex gap-4">
            {achievements.map((ach) => {
              const Icon = ach.icon;
              return (
                <div key={ach.label} className="flex-1 bg-gray-50 rounded-xl p-3 text-center">
                  <Icon className="w-8 h-8 mx-auto text-[#D4A02B] mb-1" />
                  <p className="text-sm font-medium text-gray-800">{ach.label}</p>
                  <p className="text-xs text-gray-500">{ach.desc}</p>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
};

export default UserDashboard;