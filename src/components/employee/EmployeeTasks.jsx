import React from 'react';
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Clock3,
  ArrowRight,
} from 'lucide-react';

const statusLabel = (status) => {
  return String(status || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

const priorityClass = (priority) => {
  const value = String(priority || 'low').toLowerCase();
  return `priority-${value}`;
};

const formatAssignedAt = (value) => {
  if (!value) return 'Assignment time unavailable';

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return 'Assignment time unavailable';
  }

  return `Assigned ${date.toLocaleString()}`;
};

const EmployeeTasks = ({
  tasks,
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
            aria-label="Refresh assigned tasks"
            title="Refresh assigned tasks"
          >
            <RefreshCw
              size={16}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>

        {loading ? (
          <div className="civic-empty">
            <RefreshCw
              size={28}
              className="animate-spin"
            />
            <p>Loading your assigned tasks...</p>
          </div>
        ) : error ? (
          <div className="civic-empty">
            <AlertTriangle size={28} />
            <h2>Unable to load tasks</h2>
            <p>{error}</p>
            <button
              type="button"
              onClick={onRefresh}
            >
              Try again
            </button>
          </div>
        ) : tasks.length === 0 ? (
          <div className="civic-empty">
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
                className="civic-panel employee-task-card"
                key={task.assignment_id}
              >
                <div className="civic-panel-title">
                  <div>
                    <p className="civic-eyebrow">
                      {task.complaint_number ||
                        `Complaint #${task.id}`}
                    </p>

                    <h3>
                      {task.title || 'Civic complaint'}
                    </h3>
                  </div>

                  <span
                    className={priorityClass(task.priority)}
                  >
                    {String(task.priority || 'low').toUpperCase()}
                  </span>
                </div>

                <p>
                  {task.description ||
                    'No description provided.'}
                </p>

                <div className="employee-task-meta">
                  <span>
                    <MapPin size={16} />
                    {task.department_name || 'Department'}
                  </span>

                  <span>
                    {task.category_name || task.category}
                  </span>

                  <span>
                    {statusLabel(task.status)}
                  </span>

                  <span>
                    <Clock3 size={15} />
                    {formatAssignedAt(task.assigned_at)}
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
