import React from 'react';
import {
  MapPin,
  Clock,
  CheckCircle,
  AlertTriangle,
  TrendingUp,
  Award,
  Calendar,
  ArrowUpRight,
  Camera,
} from 'lucide-react';

const fraunces = { fontFamily: "'Fraunces', ui-serif, Georgia, serif" };

const UserDashboard = ({ userData }) => {
  const stats = [
    { label: 'Total Complaints', value: '12', icon: MapPin, accent: '#2E5AA6', tint: '#EAF0FA' },
    { label: 'Resolved', value: '8', icon: CheckCircle, accent: '#3F7D58', tint: '#EAF4EE' },
    { label: 'In Progress', value: '3', icon: Clock, accent: '#C9862A', tint: '#FBF1E1' },
    { label: 'Overdue', value: '1', icon: AlertTriangle, accent: '#C4573F', tint: '#FBECE8' },
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

  const statusStyle = {
    Resolved: 'bg-[#EAF4EE] text-[#2E6944]',
    'In Progress': 'bg-[#FBF1E1] text-[#9A6B1E]',
    Pending: 'bg-[#EAF0FA] text-[#2E5AA6]',
  };

  const priorityStyle = {
    High: 'bg-[#FBECE8] text-[#B34A34]',
    Medium: 'bg-[#FBF1E1] text-[#9A6B1E]',
  };

  return (
    <div className="space-y-6">
      {/* Welcome Banner */}
      <div
        className="relative overflow-hidden rounded-3xl p-5 sm:p-7 text-white"
        style={{ background: 'linear-gradient(135deg, #0B1E3D 0%, #1B3A6B 100%)' }}
      >
        <div
          className="absolute -top-16 -right-16 w-56 h-56 rounded-full blur-3xl"
          style={{ background: 'rgba(227,164,56,0.18)' }}
        />
        <div className="relative flex items-start sm:items-center justify-between flex-wrap gap-4">
          <div>
            <h2 className="text-xl sm:text-2xl font-semibold leading-tight" style={fraunces}>
              Welcome back, {userData?.name || 'Citizen'}
            </h2>
            <p className="text-slate-300 mt-1.5 text-sm">
              Here&rsquo;s what&rsquo;s happening with your civic issues today.
            </p>
          </div>
          <div className="w-full sm:w-auto bg-white/10 border border-white/10 px-4 py-2.5 rounded-xl flex items-center gap-2 text-sm">
            <Calendar className="w-4 h-4 text-[#E3A438]" />
            <span>
              {new Date().toLocaleDateString('en-IN', {
                weekday: 'long',
                day: 'numeric',
                month: 'long',
                year: 'numeric',
              })}
            </span>
          </div>
        </div>
      </div>

      {/* Stats Grid */}
      <div className="grid grid-cols-2 md:grid-cols-4 gap-4">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <div
              key={stat.label}
              className="min-h-32 bg-white rounded-2xl p-4 sm:p-5 border border-[#E4E7EC] hover:border-[#D9DEE7] hover:shadow-sm transition-all"
            >
              <div className="flex items-center justify-between gap-2">
                <div
                  className="w-10 h-10 rounded-xl flex items-center justify-center"
                  style={{ backgroundColor: stat.tint }}
                >
                  <Icon className="w-5 h-5" style={{ color: stat.accent }} strokeWidth={1.75} />
                </div>
                <span className="text-2xl font-semibold text-[#14213D] tabular-nums" style={fraunces}>
                  {stat.value}
                </span>
              </div>
              <p className="text-sm leading-snug text-slate-500 mt-2.5">{stat.label}</p>
            </div>
          );
        })}
      </div>

      {/* Quick Actions */}
      <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC]">
        <h3 className="font-semibold text-[#14213D] mb-4">Quick Actions</h3>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <button className="group bg-[#0B1E3D] hover:bg-[#12294F] text-white p-5 rounded-2xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium flex items-center gap-2">
                <Camera className="w-4 h-4 text-[#E3A438]" />
                Report New Issue
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#E3A438] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <p className="text-sm text-slate-300 mt-1.5">Take a photo, get AI classification</p>
          </button>
          <button className="group bg-[#EAF0FA] hover:bg-[#DEE8F7] p-5 rounded-2xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#1F3E75] flex items-center gap-2">
                <MapPin className="w-4 h-4" />
                Track Complaints
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#1F3E75] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <p className="text-sm text-slate-500 mt-1.5">Check the status of your reports</p>
          </button>
          <button className="group bg-[#EAF4EE] hover:bg-[#DCEEE2] p-5 rounded-2xl text-left transition-colors">
            <div className="flex items-center justify-between">
              <span className="font-medium text-[#2E6944] flex items-center gap-2">
                <Award className="w-4 h-4" />
                View Impact
              </span>
              <ArrowUpRight className="w-4 h-4 text-[#2E6944] group-hover:translate-x-0.5 group-hover:-translate-y-0.5 transition-transform" />
            </div>
            <p className="text-sm text-slate-500 mt-1.5">See how you&rsquo;ve helped</p>
          </button>
        </div>
      </div>

      {/* Recent Complaints */}
      <div className="bg-white rounded-2xl border border-[#E4E7EC] overflow-hidden">
        <div className="px-4 sm:px-6 py-5 border-b border-[#E4E7EC] flex items-center justify-between gap-4">
          <h3 className="font-semibold text-[#14213D]">Recent Complaints</h3>
          <button className="text-sm font-medium text-[#C9862A] hover:text-[#B37320] transition-colors">
            View All
          </button>
        </div>
        <div className="divide-y divide-[#EEF0F3]">
          {recentComplaints.map((complaint) => (
            <div
              key={complaint.id}
              className="px-4 sm:px-6 py-4 hover:bg-[#FAFAFA] transition-colors cursor-pointer"
            >
              <div className="flex flex-col items-start sm:flex-row sm:items-center sm:justify-between gap-3 sm:gap-4">
                <div className="min-w-0">
                  <p className="font-medium text-[#14213D] truncate">{complaint.title}</p>
                  <div className="flex flex-wrap items-center gap-x-3 gap-y-1 mt-1.5 text-xs text-slate-500">
                    <span className="font-mono break-all">{complaint.id}</span>
                    <span>{complaint.date}</span>
                    <span className={`px-2 py-0.5 rounded-full font-medium ${priorityStyle[complaint.priority]}`}>
                      {complaint.priority}
                    </span>
                  </div>
                </div>
                <span
                  className={`shrink-0 px-3 py-1 rounded-full text-xs font-medium ${statusStyle[complaint.status]}`}
                >
                  {complaint.status}
                </span>
              </div>
            </div>
          ))}
        </div>
      </div>

      {/* Achievements & Trust Score */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
        <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC]">
          <h3 className="font-semibold text-[#14213D] mb-4">Your Impact</h3>
          <div className="flex items-center gap-4">
            <div className="w-16 h-16 rounded-full bg-[#FBF1E1] flex items-center justify-center">
              <span className="text-xl font-semibold text-[#C9862A]" style={fraunces}>
                94%
              </span>
            </div>
            <div>
              <p className="font-medium text-[#14213D]">Trust Score</p>
              <p className="text-sm text-slate-500">Based on verified complaints</p>
            </div>
          </div>
        </div>
        <div className="bg-white rounded-2xl p-6 border border-[#E4E7EC]">
          <h3 className="font-semibold text-[#14213D] mb-4">Achievements</h3>
          <div className="flex flex-col sm:flex-row gap-3 sm:gap-4">
            {achievements.map((ach) => {
              const Icon = ach.icon;
              return (
                <div key={ach.label} className="flex-1 bg-[#FAFAFA] rounded-xl p-4 text-center">
                  <Icon className="w-6 h-6 mx-auto text-[#C9862A] mb-2" strokeWidth={1.75} />
                  <p className="text-sm font-medium text-[#14213D]">{ach.label}</p>
                  <p className="text-xs text-slate-500 mt-0.5">{ach.desc}</p>
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
