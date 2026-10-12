import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  Clock3,
  CircleCheck,
  AlertTriangle,
  ArrowRight,
  RefreshCw,
} from 'lucide-react';

import { getMyTasks } from '../../api/employee';

const statusLabel = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const EmployeeDashboard = ({ userData, onNavigate, onOpenTask }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTasks = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getMyTasks();
      setTasks(Array.isArray(data?.complaints) ? data.complaints : []);
    } catch (err) {
      console.error('Employee dashboard load failed:', err);
      setError(err.message || 'Unable to load your tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const stats = useMemo(() => {
    const inProgress = tasks.filter(
      (item) => item.status === 'in_progress'
    ).length;

    const pendingVerification = tasks.filter(
      (item) => item.status === 'pending_verification'
    ).length;

    const highPriority = tasks.filter((item) =>
      ['high', 'critical'].includes(
        String(item.priority || '').toLowerCase()
      )
    ).length;

    return [
      {
        label: 'My tasks',
        value: tasks.length,
        icon: ClipboardList,
      },
      {
        label: 'In progress',
        value: inProgress,
        icon: Clock3,
      },
      {
        label: 'Pending verification',
        value: pendingVerification,
        icon: CircleCheck,
      },
      {
        label: 'High priority',
        value: highPriority,
        icon: AlertTriangle,
      },
    ];
  }, [tasks]);

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

        <button
          type="button"
          onClick={() => onNavigate('tasks')}
        >
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
            onClick={loadTasks}
            disabled={loading}
            title="Refresh"
          >
            <RefreshCw
              size={17}
              className={loading ? 'animate-spin' : ''}
            />
          </button>
        </div>

        {loading ? (
          <div className="civic-empty">
            <RefreshCw size={24} className="animate-spin" />
            <p>Loading your tasks...</p>
          </div>
        ) : error ? (
          <div className="civic-empty">
            <AlertTriangle size={24} />
            <h3>Unable to load tasks</h3>
            <p>{error}</p>
            <button type="button" onClick={loadTasks}>
              Try again
            </button>
          </div>
        ) : recentTasks.length === 0 ? (
          <div className="civic-empty">
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
                onClick={() => onOpenTask(task.id)}
              >
                <div>
                  <strong>{task.complaint_number}</strong>
                  <span>{task.title || task.category_name}</span>
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
