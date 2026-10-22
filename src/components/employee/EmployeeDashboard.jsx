import React from 'react';
import {
  ClipboardList,
  Clock3,
  CircleCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

import { statusLabel } from '../../utils/format';

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

        <button type="button" onClick={() => onNavigate('tasks')}>
          View my tasks
          <ArrowRight size={17} />
        </button>
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
            <RefreshCw size={17} className={loading ? 'animate-spin' : ''} />
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
            <button type="button" onClick={onRefresh}>Try again</button>
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
                  <span>{task.title || task.category_name || 'Complaint'}</span>
                </div>
                <div>
                  <span>{statusLabel(task.status)}</span>
                  <b>{String(task.priority || 'low').toUpperCase()}</b>
                </div>
              </button>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default EmployeeDashboard;
