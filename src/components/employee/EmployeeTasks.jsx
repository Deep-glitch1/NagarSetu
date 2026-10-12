import React, { useEffect, useMemo, useState } from 'react';
import {
  Search,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
} from 'lucide-react';

import { getMyTasks } from '../../api/employee';

const statusLabel = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const priorityClass = (value) =>
  `priority-${String(value || 'low').toLowerCase()}`;

const EmployeeTasks = ({ onOpenTask }) => {
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const loadTasks = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getMyTasks();
      setTasks(Array.isArray(data?.complaints) ? data.complaints : []);
    } catch (err) {
      console.error('My tasks load failed:', err);
      setError(err.message || 'Unable to load your tasks.');
      setTasks([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const filteredTasks = useMemo(() => {
    const query = search.trim().toLowerCase();

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        [
          task.complaint_number,
          task.title,
          task.description,
          task.category_name,
          task.department_name,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === 'all' || task.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || task.priority === priorityFilter;

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  return (
    <div>
      <section className="civic-page-header">
        <div>
          <p className="civic-eyebrow">Work queue</p>
          <h2>My Tasks</h2>
          <p>Complaints currently assigned to you.</p>
        </div>

        <button type="button" onClick={loadTasks} disabled={loading}>
          <RefreshCw
            size={17}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </section>

      <section className="civic-panel employee-task-controls">
        <label>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search your tasks"
          />
        </label>

        <select
          value={statusFilter}
          onChange={(event) => setStatusFilter(event.target.value)}
        >
          <option value="all">All statuses</option>
          <option value="assigned">Assigned</option>
          <option value="in_progress">In progress</option>
          <option value="pending_verification">
            Pending verification
          </option>
          <option value="reopened">Reopened</option>
        </select>

        <select
          value={priorityFilter}
          onChange={(event) => setPriorityFilter(event.target.value)}
        >
          <option value="all">All priorities</option>
          <option value="critical">Critical</option>
          <option value="high">High</option>
          <option value="medium">Medium</option>
          <option value="low">Low</option>
        </select>
      </section>

      {loading ? (
        <section className="civic-empty">
          <RefreshCw size={28} className="animate-spin" />
          <p>Loading your tasks...</p>
        </section>
      ) : error ? (
        <section className="civic-empty">
          <AlertTriangle size={28} />
          <h3>Unable to load tasks</h3>
          <p>{error}</p>
          <button type="button" onClick={loadTasks}>
            Try again
          </button>
        </section>
      ) : filteredTasks.length === 0 ? (
        <section className="civic-empty">
          <ClipboardList size={32} />
          <h3>No matching tasks</h3>
          <p>There are no assigned complaints matching these filters.</p>
        </section>
      ) : (
        <section className="employee-task-grid">
          {filteredTasks.map((task) => (
            <article className="civic-panel employee-task-card" key={task.id}>
              <div className="employee-task-card-top">
                <div>
                  <span className="civic-eyebrow">
                    {task.complaint_number}
                  </span>
                  <h3>{task.title || 'Complaint'}</h3>
                </div>

                <span className={priorityClass(task.priority)}>
                  {String(task.priority || 'low').toUpperCase()}
                </span>
              </div>

              <p>{task.description || 'No description provided.'}</p>

              <div className="employee-task-meta">
                <span>{task.category_name || task.category}</span>
                <span>{task.department_name || 'Department'}</span>
                <span>{statusLabel(task.status)}</span>
              </div>

              <button
                type="button"
                onClick={() => onOpenTask(task.id)}
              >
                Open task
              </button>
            </article>
          ))}
        </section>
      )}
    </div>
  );
};

export default EmployeeTasks;
