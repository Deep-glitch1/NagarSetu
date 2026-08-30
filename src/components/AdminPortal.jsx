import React from 'react';
import { Home, Users, BarChart3, Settings, Building2, ClipboardList, Clock, CheckCircle, AlertTriangle } from 'lucide-react';
import CivicShell from './CivicShell';

const AdminPortal = ({ userData, onLogout }) => {
  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home }, { id: 'complaints', label: 'Complaints Queue', icon: ClipboardList },
    { id: 'analytics', label: 'Analytics', icon: BarChart3 }, { id: 'departments', label: 'Departments', icon: Building2 },
    { id: 'users', label: 'Users', icon: Users }, { id: 'settings', label: 'Settings', icon: Settings },
  ];
  const stats = [
    { label: 'Total complaints', value: '1,284', icon: ClipboardList, accent: '#315c9d', tint: '#e8f0fd' }, { label: 'Awaiting action', value: '342', icon: Clock, accent: '#b86d20', tint: '#fff0dc' },
    { label: 'Resolved this month', value: '892', icon: CheckCircle, accent: '#397255', tint: '#e6f4eb' }, { label: 'Outside SLA', value: '50', icon: AlertTriangle, accent: '#bd553f', tint: '#fbeae5' },
  ];
  return <CivicShell userData={userData} onLogout={onLogout} menuItems={menuItems} searchPlaceholder="Search complaints">
    {(activeTab, activeItem) => activeTab === 'dashboard' ? <div className="civic-dashboard">
      <section className="civic-welcome"><div><p className="civic-eyebrow">Operations overview</p><h2>Good morning, {userData?.name || 'Administrator'}.</h2><p>See what needs attention and keep every complaint moving.</p></div><button>Open queue <ClipboardList size={17}/></button></section>
      <section className="civic-stat-grid">{stats.map((stat) => { const Icon = stat.icon; return <article className="civic-stat" key={stat.label}><span style={{ backgroundColor: stat.tint, color: stat.accent }}><Icon size={20}/></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div></article>; })}</section>
      <section className="civic-content-grid"><article className="civic-panel civic-analytics"><div className="civic-panel-title"><div><p className="civic-eyebrow">Weekly activity</p><h3>Complaint resolution trend</h3></div><span>Last 7 days</span></div><div className="civic-chart"><i style={{height:'38%'}}/><i style={{height:'55%'}}/><i style={{height:'45%'}}/><i style={{height:'72%'}}/><i style={{height:'61%'}}/><i style={{height:'88%'}}/><i style={{height:'76%'}}/></div><div className="civic-chart-labels"><span>Mon</span><span>Tue</span><span>Wed</span><span>Thu</span><span>Fri</span><span>Sat</span><span>Sun</span></div></article><article className="civic-panel"><div className="civic-panel-title"><div><p className="civic-eyebrow">Needs attention</p><h3>Priority queue</h3></div><span className="civic-count">50 overdue</span></div><ul className="civic-list"><li><span>Road repair · Ward 12</span><b>High</b></li><li><span>Street lights · Ward 6</span><b>Medium</b></li><li><span>Waste collection · Ward 8</span><b>High</b></li></ul></article></section>
    </div> : <div className="civic-empty"><activeItem.icon size={30}/><h2>{activeItem.label}</h2><p>This workspace is ready for your next feature.</p></div>}
  </CivicShell>;
};

export default AdminPortal;
