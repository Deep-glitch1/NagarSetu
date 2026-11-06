import React, { useCallback, useEffect, useMemo, useState } from 'react';
import {
  Activity,
  AlertTriangle,
  BarChart3,
  CheckCircle2,
  Clock3,
  RefreshCw,
  ShieldAlert,
  TrendingUp,
} from 'lucide-react';

import { apiFetch } from '../../api/client';
import './AdminAnalytics.css';

const STATUS_LABELS = {
  received: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  pending_verification: 'Pending verification',
  pending_citizen_response: 'Pending citizen response',
  verified: 'Verified',
  closed: 'Closed',
  reopened: 'Reopened',
  rejected: 'Rejected',
};

const numberFormat = new Intl.NumberFormat('en-IN');

const formatNumber = (value) => numberFormat.format(Number(value || 0));

const formatPercent = (value) => `${Number(value || 0).toFixed(1)}%`;

const maxValue = (items, key) =>
  Math.max(1, ...(items || []).map((item) => Number(item[key] || 0)));

const statusLabel = (value) => STATUS_LABELS[value] || String(value || 'Unknown');

const AdminAnalytics = () => {
  const [days, setDays] = useState(30);
  const [data, setData] = useState(null);
  const [loading, setLoading] = useState(true);
  const [refreshing, setRefreshing] = useState(false);
  const [error, setError] = useState('');

  const loadAnalytics = useCallback(async (refresh = false) => {
    if (refresh) setRefreshing(true);
    else setLoading(true);
    setError('');

    try {
      const response = await apiFetch(`/admin/analytics?days=${days}`);
      setData(response || null);
    } catch (requestError) {
      console.error('Admin analytics load failed:', requestError);
      setError(requestError.message || 'Unable to load analytics.');
    } finally {
      setLoading(false);
      setRefreshing(false);
    }
  }, [days]);

  useEffect(() => {
    loadAnalytics();
  }, [loadAnalytics]);

  const overview = data?.overview || {};
  const departments = data?.departments || [];
  const categories = data?.categories || [];
  const trend = data?.trend || [];
  const statusBreakdown = data?.status_breakdown || [];
  const priorityBreakdown = data?.priority_breakdown || [];
  const escalations = data?.escalations || [];

  const trendMax = useMemo(
    () => Math.max(1, ...trend.flatMap((item) => [item.incoming, item.resolved, item.overdue])),
    [trend]
  );

  const categoryMax = useMemo(() => maxValue(categories, 'total'), [categories]);
  const departmentMax = useMemo(() => maxValue(departments, 'total'), [departments]);
  const priorityMax = useMemo(() => maxValue(priorityBreakdown, 'count'), [priorityBreakdown]);
  const escalationMax = useMemo(() => maxValue(escalations, 'count'), [escalations]);

  const trendLabels = useMemo(() => {
    if (!trend.length) return [];
    const step = Math.max(1, Math.ceil(trend.length / 6));
    return trend.filter((_, index) => index % step === 0 || index === trend.length - 1);
  }, [trend]);

  return (
    <div className="civic-dashboard admin-analytics-page">
      <section className="civic-welcome admin-analytics-header">
        <div>
          <p className="civic-eyebrow">Operations intelligence</p>
          <h2>Complaint Analytics</h2>
          <p>Monitor volume, SLA performance, resolution speed and escalation pressure.</p>
        </div>

        <div className="admin-analytics-toolbar">
          <select
            className="admin-analytics-window"
            value={days}
            onChange={(event) => setDays(Number(event.target.value))}
          >
            <option value={7}>Last 7 days</option>
            <option value={30}>Last 30 days</option>
            <option value={90}>Last 90 days</option>
          </select>

          <button
            className="admin-refresh-btn"
            type="button"
            onClick={() => loadAnalytics(true)}
            disabled={loading || refreshing}
          >
            <RefreshCw size={17} className={refreshing ? 'animate-spin' : ''} />
            Refresh
          </button>
        </div>
      </section>

      {error && <div className="civic-panel admin-analytics-error">{error}</div>}

      {loading ? (
        <div className="civic-panel admin-analytics-loading">
          <Activity size={28} className="animate-spin" />
          <p>Loading analytics...</p>
        </div>
      ) : (
        <>
          <section className="admin-kpi-grid">
            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><BarChart3 size={20} /></div>
              <span>Total complaints</span>
              <strong>{formatNumber(overview.total_complaints)}</strong>
              <small>{formatNumber(overview.active_complaints)} currently active</small>
            </article>

            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><CheckCircle2 size={20} /></div>
              <span>Resolved</span>
              <strong>{formatNumber(overview.resolved_complaints)}</strong>
              <small>{formatNumber(overview.reopened_complaints)} reopened</small>
            </article>

            <article className="admin-kpi-card admin-kpi-warning">
              <div className="admin-kpi-icon"><AlertTriangle size={20} /></div>
              <span>Overdue</span>
              <strong>{formatNumber(overview.overdue_complaints)}</strong>
              <small>{formatNumber(overview.critical_backlog)} critical active</small>
            </article>

            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><ShieldAlert size={20} /></div>
              <span>SLA compliance</span>
              <strong>{formatPercent(overview.sla_compliance_percentage)}</strong>
              <small>{formatNumber(overview.escalation_count)} escalations in window</small>
            </article>

            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><Clock3 size={20} /></div>
              <span>Avg. resolution</span>
              <strong>{Number(overview.avg_resolution_hours || 0).toFixed(1)}h</strong>
              <small>Across resolved complaints</small>
            </article>

            <article className="admin-kpi-card">
              <div className="admin-kpi-icon"><TrendingUp size={20} /></div>
              <span>Pending verification</span>
              <strong>{formatNumber(overview.pending_verification)}</strong>
              <small>{formatNumber(overview.rejected_complaints)} rejected</small>
            </article>
          </section>

          <section className="admin-analytics-grid admin-analytics-grid-wide">
            <div className="civic-panel admin-analytics-panel">
              <div className="civic-panel-title">
                <div>
                  <p className="civic-eyebrow">Daily flow</p>
                  <h3>Incoming vs resolved</h3>
                </div>
              </div>

              <div className="admin-trend-chart">
                {trend.map((item) => (
                  <div className="admin-trend-column" key={item.date} title={`${item.date}: ${item.incoming} incoming, ${item.resolved} resolved`}>
                    <div className="admin-trend-bars">
                      <span className="admin-trend-bar admin-trend-incoming" style={{ height: `${(item.incoming / trendMax) * 100}%` }} />
                      <span className="admin-trend-bar admin-trend-resolved" style={{ height: `${(item.resolved / trendMax) * 100}%` }} />
                    </div>
                  </div>
                ))}
              </div>

              <div className="admin-trend-axis">
                {trendLabels.map((item) => (
                  <span key={item.date}>{item.date.slice(5)}</span>
                ))}
              </div>
              <div className="admin-chart-legend">
                <span><i className="admin-legend-dot admin-dot-incoming" /> Incoming</span>
                <span><i className="admin-legend-dot admin-dot-resolved" /> Resolved</span>
              </div>
            </div>

            <div className="civic-panel admin-analytics-panel">
              <div className="civic-panel-title">
                <div>
                  <p className="civic-eyebrow">Current backlog</p>
                  <h3>Status distribution</h3>
                </div>
              </div>

              <div className="admin-horizontal-bars">
                {statusBreakdown.map((item) => {
                  const max = Math.max(1, ...statusBreakdown.map((row) => Number(row.count || 0)));
                  return (
                    <div className="admin-horizontal-row" key={item.status}>
                      <div className="admin-horizontal-label">
                        <span>{statusLabel(item.status)}</span>
                        <strong>{formatNumber(item.count)}</strong>
                      </div>
                      <div className="admin-horizontal-track">
                        <span style={{ width: `${(Number(item.count || 0) / max) * 100}%` }} />
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="admin-analytics-grid">
            <div className="civic-panel admin-analytics-panel">
              <div className="civic-panel-title">
                <div>
                  <p className="civic-eyebrow">Workload</p>
                  <h3>Department performance</h3>
                </div>
              </div>

              {departments.length === 0 ? (
                <p className="admin-analytics-empty">No department data available.</p>
              ) : (
                <div className="admin-department-list">
                  {departments.map((department) => (
                    <div className="admin-department-row" key={department.id}>
                      <div className="admin-department-main">
                        <strong>{department.name}</strong>
                        <span>{formatNumber(department.total)} complaints · {formatNumber(department.overdue)} overdue</span>
                      </div>
                      <div className="admin-department-progress">
                        <div className="admin-horizontal-track">
                          <span style={{ width: `${(Number(department.total || 0) / departmentMax) * 100}%` }} />
                        </div>
                        <strong>{formatPercent(department.resolution_rate)}</strong>
                      </div>
                    </div>
                  ))}
                </div>
              )}
            </div>

            <div className="civic-panel admin-analytics-panel">
              <div className="civic-panel-title">
                <div>
                  <p className="civic-eyebrow">Complaint mix</p>
                  <h3>Priority distribution</h3>
                </div>
              </div>

              <div className="admin-priority-list">
                {priorityBreakdown.map((item) => (
                  <div className="admin-priority-row" key={item.priority}>
                    <span className={`admin-priority-pill ${item.priority}`}>{String(item.priority).toUpperCase()}</span>
                    <div className="admin-horizontal-track">
                      <span style={{ width: `${(Number(item.count || 0) / priorityMax) * 100}%` }} />
                    </div>
                    <strong>{formatNumber(item.count)}</strong>
                  </div>
                ))}
              </div>
            </div>

            <div className="civic-panel admin-analytics-panel">
              <div className="civic-panel-title">
                <div>
                  <p className="civic-eyebrow">SLA pressure</p>
                  <h3>Escalations</h3>
                </div>
              </div>

              <div className="admin-escalation-list">
                {[1, 2, 3].map((level) => {
                  const count = escalations.find((item) => item.level === level)?.count || 0;
                  return (
                    <div className="admin-escalation-row" key={level}>
                      <div>
                        <strong>Level {level}</strong>
                        <span>{level === 1 ? 'Supervisor' : level === 2 ? 'Department head' : 'Municipal administration'}</span>
                      </div>
                      <div className="admin-escalation-meter">
                        <span style={{ width: `${(Number(count) / escalationMax) * 100}%` }} />
                      </div>
                      <strong>{formatNumber(count)}</strong>
                    </div>
                  );
                })}
              </div>
            </div>
          </section>

          <section className="civic-panel admin-analytics-panel">
            <div className="civic-panel-title">
              <div>
                <p className="civic-eyebrow">Demand profile</p>
                <h3>Complaint categories</h3>
              </div>
            </div>

            <div className="admin-category-grid">
              {categories.map((category) => (
                <div className="admin-category-card" key={category.code}>
                  <div>
                    <strong>{category.name}</strong>
                    <span>{formatNumber(category.total)} total</span>
                  </div>
                  <div className="admin-category-track">
                    <span style={{ width: `${(Number(category.total || 0) / categoryMax) * 100}%` }} />
                  </div>
                  <div className="admin-category-meta">
                    <span>{formatNumber(category.resolved)} resolved</span>
                    <span>{formatNumber(category.overdue)} overdue</span>
                  </div>
                </div>
              ))}
            </div>
          </section>

          <section className="civic-panel admin-analytics-panel">
            <div className="civic-panel-title">
              <div>
                <p className="civic-eyebrow">Geographic workload</p>
                <h3>Top administrative areas</h3>
              </div>
            </div>

            {data?.areas?.length ? (
              <div className="admin-table-wrap">
                <table className="admin-analytics-table">
                  <thead>
                    <tr>
                      <th>Area</th>
                      <th>Type</th>
                      <th>Total</th>
                      <th>Resolved</th>
                      <th>Overdue</th>
                      <th>Resolution rate</th>
                    </tr>
                  </thead>
                  <tbody>
                    {data.areas.map((area) => (
                      <tr key={area.id}>
                        <td>{area.name}</td>
                        <td>{String(area.unit_type || '').replaceAll('_', ' ')}</td>
                        <td>{formatNumber(area.total)}</td>
                        <td>{formatNumber(area.resolved)}</td>
                        <td>{formatNumber(area.overdue)}</td>
                        <td>{formatPercent(area.total ? (area.resolved / area.total) * 100 : 0)}</td>
                      </tr>
                    ))}
                  </tbody>
                </table>
              </div>
            ) : (
              <p className="admin-analytics-empty">No area data available.</p>
            )}
          </section>
        </>
      )}
    </div>
  );
};

export default AdminAnalytics;
