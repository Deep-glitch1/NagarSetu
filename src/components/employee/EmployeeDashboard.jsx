import React, { useMemo } from 'react';
import {
  ClipboardList,
  Clock3,
  CircleCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
  RotateCcw,
  Activity,
} from 'lucide-react';

import {
  statusLabel,
  priorityClass,
} from '../../utils/format';

const EmployeeDashboard = ({
  userData,
  tasks = [],
  stats = [],
  loading,
  error,
  onRefresh,
  onNavigate,
  onOpenTask,
}) => {
  const recentTasks = tasks.slice(0, 5);

  const summary = useMemo(() => {
    const inProgress = tasks.filter(
      (task) => task.status === 'in_progress'
    ).length;

    const pendingVerification = tasks.filter(
      (task) => task.status === 'pending_verification'
    ).length;

    const reopened = tasks.filter(
      (task) => task.status === 'reopened'
    ).length;

    const critical = tasks.filter(
      (task) => String(task.priority || '').toLowerCase() === 'critical'
    ).length;

    const high = tasks.filter(
      (task) => String(task.priority || '').toLowerCase() === 'high'
    ).length;

    return {
      total: tasks.length,
      inProgress,
      pendingVerification,
      reopened,
      urgent: critical + high,
      critical,
    };
  }, [tasks]);

  const roleLabel = String(
    userData?.employee_role || 'employee'
  )
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">Employee workspace</p>
          <h2>Welcome, {userData?.name || 'Employee'}.</h2>
          <p>
            Keep your assigned complaints moving from intake to resolution.
          </p>
        </div>

        <div className="employee-dashboard-actions">
          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
          >
            <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
            Refresh
          </button>

          <button type="button" onClick={() => onNavigate('tasks')}>
            View my tasks
            <ArrowRight size={17} />
          </button>
        </div>
      </section>

      <section className="civic-stat-grid">
        {stats.map((stat) => {
          const Icon = stat.icon;
          return (
            <article className="civic-stat" key={stat.label}>
              <span>
                <Icon size={20} />
              </span>
              <div>
                <small>{stat.label}</small>
                <strong>{stat.value}</strong>
              </div>
            </article>
          );
        })}
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Work snapshot</p>
              <h3>Current workload</h3>
            </div>
            <Activity size={21} />
          </div>

          <div className="employee-dashboard-metrics">
            <div>
              <span><ClipboardList size={17} /></span>
              <div>
                <small>Total active</small>
                <strong>{summary.total}</strong>
              </div>
            </div>

            <div>
              <span><Clock3 size={17} /></span>
              <div>
                <small>In progress</small>
                <strong>{summary.inProgress}</strong>
              </div>
            </div>

            <div>
              <span><CircleCheck size={17} /></span>
              <div>
                <small>Awaiting verification</small>
                <strong>{summary.pendingVerification}</strong>
              </div>
            </div>

            <div>
              <span><RotateCcw size={17} /></span>
              <div>
                <small>Reopened</small>
                <strong>{summary.reopened}</strong>
              </div>
            </div>

            <div>
              <span><AlertTriangle size={17} /></span>
              <div>
                <small>High / critical</small>
                <strong>{summary.urgent}</strong>
              </div>
            </div>
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Account</p>
              <h3>Employee profile</h3>
            </div>
          </div>

          <div className="employee-dashboard-profile">
            <div>
              <small>Role</small>
              <strong>{roleLabel}</strong>
            </div>

            <div>
              <small>Department</small>
              <strong>
                {userData?.department_name || 'Not assigned'}
              </strong>
            </div>

            <div>
              <small>Employee ID</small>
              <strong>
                {userData?.employee_id || 'Not available'}
              </strong>
            </div>
          </div>
        </article>
      </section>

      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Assigned work</p>
            <h3>Recent tasks</h3>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="employee-icon-button"
            title="Refresh tasks"
            aria-label="Refresh tasks"
          >
            <RefreshCw
              size={17}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>

        {loading ? (
          <div className="civic-empty employee-inline-empty">
            <RefreshCw size={24} className="animate-spin" />
            <p>Loading your tasks...</p>
          </div>
        ) : error ? (
          <div className="civic-empty employee-inline-empty">
            <AlertTriangle size={24} />
            <h3>Unable to load tasks</h3>
            <p>{error}</p>
            <button type="button" onClick={onRefresh}>
              Try again
            </button>
          </div>
        ) : recentTasks.length === 0 ? (
          <div className="civic-empty employee-inline-empty">
            <ClipboardList size={30} />
            <h3>No active tasks</h3>
            <p>Assigned complaints will appear here.</p>
          </div>
        ) : (
          <div className="employee-task-list">
            {recentTasks.map((task) => (
              <button
                type="button"
                className="employee-task-row"
                key={task.id}
                onClick={() => onOpenTask(task)}
              >
                <div>
                  <strong>
                    {task.complaint_number || `Complaint #${task.id}`}
                  </strong>
                  <span>
                    {task.title || task.category_name || 'Complaint'}
                  </span>
                </div>

                <div className="employee-dashboard-task-status">
                  <span>
                    {statusLabel(task.status)}
                  </span>
                  <b className={`employee-priority ${priorityClass(task.priority)}`}>
                    {String(task.priority || 'low').toUpperCase()}
                  </b>
                </div>

                <ArrowRight size={17} />
              </button>
            ))}
          </div>
        )}

        {recentTasks.length > 0 && !loading && !error && (
          <div className="employee-dashboard-footer-action">
            <button
              type="button"
              onClick={() => onNavigate('tasks')}
            >
              Open full task queue
              <ArrowRight size={16} />
            </button>
          </div>
        )}
      </section>
    </div>
  );
};

export default EmployeeDashboard;
