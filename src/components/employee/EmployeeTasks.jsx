import React from 'react';
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Clock3,
  ArrowRight,
} from 'lucide-react';

import {
  statusLabel,
  priorityClass,
} from '../../utils/format';

const statusClass = (status) =>
  `employee-status-${String(status || 'received').toLowerCase()}`;

const formatAssignedAt = (value) => {
  if (!value) return 'Assignment time unavailable';

  const date = new Date(value);
  if (Number.isNaN(date.getTime())) {
    return 'Assignment time unavailable';
  }

  return `Assigned ${date.toLocaleString()}`;
};

const EmployeeTasks = ({
  tasks = [],
  loading,
  error,
  onRefresh,
  onOpenTask,
}) => {
  return (
    <div className="civic-dashboard">
      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Work queue</p>
            <h3>My tasks</h3>
          </div>

          <button
            type="button"
            onClick={onRefresh}
            disabled={loading}
            className="employee-icon-button"
            aria-label="Refresh assigned tasks"
            title="Refresh assigned tasks"
          >
            <RefreshCw
              size={17}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>

        {loading ? (
          <div className="civic-empty employee-inline-empty">
            <RefreshCw size={28} className="animate-spin" />
            <p>Loading your assigned tasks...</p>
          </div>
        ) : error ? (
          <div className="civic-empty employee-inline-empty">
            <AlertTriangle size={28} />
            <h2>Unable to load tasks</h2>
            <p>{error}</p>
            <button type="button" onClick={onRefresh}>
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="civic-empty employee-inline-empty">
            <ClipboardList size={30} />
            <h2>No assigned tasks</h2>
            <p>
              You do not have any active complaints assigned right now.
            </p>
          </div>
        ) : (
          <div className="employee-task-list">
            {tasks.map((task) => (
              <article
                className="employee-task-card"
                key={task.id}
              >
                <div className="employee-task-card-head">
                  <div>
                    <p className="civic-eyebrow">
                      {task.complaint_number || `Complaint #${task.id}`}
                    </p>
                    <h3>{task.title || 'Civic complaint'}</h3>
                  </div>

                  <span className={`employee-priority ${priorityClass(task.priority)}`}>
                    {String(task.priority || 'low').toUpperCase()}
                  </span>
                </div>

                <p className="employee-task-description">
                  {task.description || 'No description provided.'}
                </p>

                <div className="employee-task-meta">
                  <span>
                    <MapPin size={15} />
                    {task.department_name || 'Department'}
                  </span>

                  <span className="employee-meta-chip">
                    {task.category_name || task.category || 'Category unavailable'}
                  </span>

                  <span className={`employee-meta-chip ${statusClass(task.status)}`}>
                    {statusLabel(task.status)}
                  </span>

                  <span>
                    <Clock3 size={15} />
                    {formatAssignedAt(
                      task.assignment?.assigned_at ?? task.assigned_at
                    )}
                  </span>
                </div>

                <div className="employee-task-actions">
                  <button
                    type="button"
                    onClick={() => onOpenTask(task)}
                  >
                    View task
                    <ArrowRight size={16} />
                  </button>
                </div>
              </article>
            ))}
          </div>
        )}
      </section>
    </div>
  );
};

export default EmployeeTasks;
