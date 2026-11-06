import React, { useCallback, useEffect, useState } from 'react';
import {
  AlertTriangle,
  ArrowRight,
  BarChart3,
  CheckCircle2,
  ClipboardList,
  Clock3,
  RefreshCw,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import './AdminManagement.css';

const greeting = () => {
  const hour = new Date().getHours();
  if (hour < 12) return 'Good morning';
  if (hour < 17) return 'Good afternoon';
  return 'Good evening';
};

const statusLabel = (value) => String(value || '')
  .replaceAll('_', ' ')
  .replace(/\b\w/g, (char) => char.toUpperCase());

const dateLabel = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

export default function AdminDashboard({ userData, onNavigate }) {
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadDashboard = useCallback(async (refresh = false) => {
    refresh ? setRefreshing(true) : setLoading(true);
    setError('');

    try {
      setData(await apiFetch('/admin/management/dashboard'));
    } catch (requestError) {
      setError(requestError.message || 'Unable to load admin dashboard.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, []);

  useEffect(() => {
    loadDashboard();
  }, [loadDashboard]);

  if (loading) {
    return (
      <div className="admin-management-loading">
        <RefreshCw size={18} className="admin-management-spin" />
        Loading dashboard…
      </div>
    );
  }

  if (error) {
    return (
      <div className="civic-dashboard">
        <section className="civic-panel admin-management-error">
          <AlertTriangle size={20} />
          <div>
            <h3>Dashboard unavailable</h3>
            <p>{error}</p>
            <button type="button" onClick={() => loadDashboard(true)}>
              Try again
            </button>
          </div>
        </section>
      </div>
    );
  }

  const stats = data?.stats || {};

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">Operations overview</p>
          <h2>{greeting()}, {userData?.name || 'Administrator'}.</h2>
          <p>Live system totals from NagarSetu. No hard-coded dashboard numbers.</p>
        </div>
        <button type="button" onClick={() => loadDashboard(true)} disabled={refreshing}>
          <RefreshCw size={17} className={refreshing ? 'admin-management-spin' : ''} />
          Refresh
        </button>
      </section>

      <section className="civic-stat-grid">
        <article className="civic-stat">
          <span><ClipboardList size={20} /></span>
          <div><small>Total complaints</small><strong>{stats.total_complaints ?? 0}</strong></div>
        </article>
        <article className="civic-stat">
          <span><Clock3 size={20} /></span>
          <div><small>Active complaints</small><strong>{stats.active_complaints ?? 0}</strong></div>
        </article>
        <article className="civic-stat">
          <span><CheckCircle2 size={20} /></span>
          <div><small>Resolved this month</small><strong>{stats.resolved_this_month ?? 0}</strong></div>
        </article>
        <article className="civic-stat">
          <span><AlertTriangle size={20} /></span>
          <div><small>Outside SLA</small><strong>{stats.overdue_complaints ?? 0}</strong></div>
        </article>
      </section>

      <section className="admin-management-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Departments</p>
              <h3>Workload by department</h3>
            </div>
            <button type="button" onClick={() => onNavigate('departments')}>
              Manage <ArrowRight size={16} />
            </button>
          </div>

          <div className="admin-management-list">
            {(data?.departments || []).map((department) => (
              <div className="admin-management-row" key={department.id}>
                <div>
                  <strong>{department.name}</strong>
                  <small>{department.code}</small>
                </div>
                <div className="admin-management-row-metric">
                  <strong>{department.complaint_count}</strong>
                  <small>{department.resolved_count} resolved</small>
                </div>
              </div>
            ))}
            {!data?.departments?.length && <p className="admin-management-muted">No departments found.</p>}
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Latest activity</p>
              <h3>Recent complaints</h3>
            </div>
            <button type="button" onClick={() => onNavigate('complaints')}>
              Open queue <ArrowRight size={16} />
            </button>
          </div>

          <div className="admin-management-list">
            {(data?.recent_complaints || []).map((complaint) => (
              <div className="admin-management-row" key={complaint.id}>
                <div>
                  <strong>{complaint.complaint_number}</strong>
                  <small>{complaint.title || complaint.category_name || 'Complaint'}</small>
                </div>
                <div className="admin-management-row-metric">
                  <span className={`admin-management-status status-${complaint.status}`}>
                    {statusLabel(complaint.status)}
                  </span>
                  <small>{dateLabel(complaint.created_at)}</small>
                </div>
              </div>
            ))}
            {!data?.recent_complaints?.length && <p className="admin-management-muted">No complaints found.</p>}
          </div>
        </article>
      </section>

      <section className="civic-panel admin-management-quick-actions">
        <div>
          <p className="civic-eyebrow">Quick actions</p>
          <h3>Administration</h3>
        </div>
        <div className="admin-management-action-group">
          <button type="button" onClick={() => onNavigate('analytics')}><BarChart3 size={17} />Open analytics</button>
          <button type="button" onClick={() => onNavigate('employees')}><ClipboardList size={17} />Manage employees</button>
        </div>
      </section>
    </div>
  );
}
