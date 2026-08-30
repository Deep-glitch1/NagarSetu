import React from 'react';
import { Home, MapPin, Award, Settings, Camera, CheckCircle, Clock, ArrowUpRight } from 'lucide-react';
import CivicShell from './CivicShell';

const UserPortal = ({ userData, onLogout }) => {
  const menuItems = [{ id:'dashboard', label:'My dashboard', icon:Home }, { id:'report', label:'Report an issue', icon:Camera }, { id:'complaints', label:'My complaints', icon:MapPin }, { id:'achievements', label:'My impact', icon:Award }, { id:'settings', label:'Settings', icon:Settings }];
  const stats = [{label:'Issues reported', value:'12', icon:MapPin, tint:'#e8f0fd', accent:'#315c9d'}, {label:'Resolved', value:'8', icon:CheckCircle, tint:'#e6f4eb', accent:'#397255'}, {label:'In progress', value:'3', icon:Clock, tint:'#fff0dc', accent:'#b86d20'}];
  return <CivicShell userData={userData} onLogout={onLogout} menuItems={menuItems} searchPlaceholder="Search your reports">
    {(activeTab, activeItem) => activeTab === 'dashboard' ? <div className="civic-dashboard">
      <section className="civic-welcome"><div><p className="civic-eyebrow">Your civic dashboard</p><h2>Welcome back, {userData?.name || 'Citizen'}.</h2><p>Small reports create meaningful improvements in your neighbourhood.</p></div><button>Report an issue <Camera size={17}/></button></section>
      <section className="civic-stat-grid civic-stat-grid-three">{stats.map((stat) => { const Icon = stat.icon; return <article className="civic-stat" key={stat.label}><span style={{backgroundColor:stat.tint,color:stat.accent}}><Icon size={20}/></span><div><small>{stat.label}</small><strong>{stat.value}</strong></div></article>; })}</section>
      <section className="civic-content-grid"><article className="civic-panel"><div className="civic-panel-title"><div><p className="civic-eyebrow">Latest updates</p><h3>Your recent reports</h3></div><button className="civic-link">View all <ArrowUpRight size={15}/></button></div><ul className="civic-list civic-report-list"><li><span><strong>Pothole on Main Road</strong><small>NGS-20260101-0001 · 2 days ago</small></span><b className="is-done">Resolved</b></li><li><span><strong>Street light not working</strong><small>NGS-20260105-0004 · Yesterday</small></span><b className="is-waiting">In progress</b></li><li><span><strong>Garbage collection missed</strong><small>NGS-20260103-0003 · 3 days ago</small></span><b>Pending</b></li></ul></article><article className="civic-panel civic-impact"><p className="civic-eyebrow">Community contribution</p><div className="civic-score">94<span>%</span></div><h3>Your trust score</h3><p>Thanks for sharing clear reports that help teams take faster action.</p><button className="civic-link">See your impact <ArrowUpRight size={15}/></button></article></section>
    </div> : <div className="civic-empty"><activeItem.icon size={30}/><h2>{activeItem.label}</h2><p>This workspace is ready for your next feature.</p></div>}
  </CivicShell>;
};

export default UserPortal;
