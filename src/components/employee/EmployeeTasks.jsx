import React, { useMemo, useState } from 'react';
import {
  ClipboardList,
  RefreshCw,
  AlertTriangle,
  MapPin,
  Clock3,
  ArrowRight,
  Search,
  SlidersHorizontal,
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

const normalize = (value) => String(value || '').trim().toLowerCase();

const EmployeeTasks = ({
  tasks = [],
  loading,
  error,
  onRefresh,
  onOpenTask,
}) => {
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const filteredTasks = useMemo(() => {
    const query = normalize(search);

    return tasks.filter((task) => {
      const matchesSearch =
        !query ||
        [
          task.complaint_number,
          task.title,
          task.description,
          task.category_name,
          task.category,
          task.department_name,
          task.priority,
          task.status,
        ].some((value) => normalize(value).includes(query));

      const matchesStatus =
        statusFilter === 'all' || normalize(task.status) === normalize(statusFilter);

      const matchesPriority =
        priorityFilter === 'all' || normalize(task.priority) === normalize(priorityFilter);

      return matchesSearch && matchesStatus && matchesPriority;
    });
  }, [tasks, search, statusFilter, priorityFilter]);

  const statusCounts = useMemo(() => {
    const counts = {
      all: tasks.length,
      assigned: 0,
      in_progress: 0,
      reopened: 0,
      pending_verification: 0,
    };

    tasks.forEach((task) => {
      const key = normalize(task.status);
      if (key in counts && key !== 'all') {
        counts[key] += 1;
      }
    });

    return counts;
  }, [tasks]);

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
  };

  const hasFilters =
    search.trim() || statusFilter !== 'all' || priorityFilter !== 'all';

  return (
    <div className="civic-dashboard">
      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Work queue</p>
            <h3>My tasks</h3>
            <p>
              Active complaints currently assigned to you.
            </p>
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

        {!loading && !error && tasks.length > 0 && (
          <>
            <div className="employee-task-filters">
              <label className="employee-task-search">
                <Search size={16} />
                <input
                  type="search"
                  value={search}
                  onChange={(event) => setSearch(event.target.value)}
                  placeholder="Search complaint, title, category..."
                />
              </label>

              <label>
                <span>Status</span>
                <select
                  value={statusFilter}
                  onChange={(event) => setStatusFilter(event.target.value)}
                >
                  <option value="all">All statuses</option>
                  <option value="assigned">Assigned</option>
                  <option value="in_progress">In progress</option>
                  <option value="reopened">Reopened</option>
                  <option value="pending_verification">Pending verification</option>
                </select>
              </label>

              <label>
                <span>Priority</span>
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
              </label>

              <div className="employee-task-filter-icon" title="Task filters">
                <SlidersHorizontal size={17} />
              </div>
            </div>

            <div className="employee-task-summary">
              <button
                type="button"
                className={statusFilter === 'all' ? 'is-active' : ''}
                onClick={() => setStatusFilter('all')}
              >
                All <strong>{statusCounts.all}</strong>
              </button>
              <button
                type="button"
                className={statusFilter === 'assigned' ? 'is-active' : ''}
                onClick={() => setStatusFilter('assigned')}
              >
                Assigned <strong>{statusCounts.assigned}</strong>
              </button>
              <button
                type="button"
                className={statusFilter === 'in_progress' ? 'is-active' : ''}
                onClick={() => setStatusFilter('in_progress')}
              >
                In progress <strong>{statusCounts.in_progress}</strong>
              </button>
              <button
                type="button"
                className={statusFilter === 'reopened' ? 'is-active' : ''}
                onClick={() => setStatusFilter('reopened')}
              >
                Reopened <strong>{statusCounts.reopened}</strong>
              </button>
              <button
                type="button"
                className={statusFilter === 'pending_verification' ? 'is-active' : ''}
                onClick={() => setStatusFilter('pending_verification')}
              >
                Verification <strong>{statusCounts.pending_verification}</strong>
              </button>
            </div>
          </>
        )}

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
        ) : filteredTasks.length === 0 ? (
          <div className="civic-empty employee-inline-empty">
            <Search size={30} />
            <h2>No matching tasks</h2>
            <p>
              No active task matches the current search and filters.
            </p>
            {hasFilters && (
              <button type="button" onClick={clearFilters}>
                Clear filters
              </button>
            )}
          </div>
        ) : (
          <div className="employee-task-list">
            {filteredTasks.map((task) => (
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

                  {(task.latitude != null && task.longitude != null) && (
                    <span>
                      <MapPin size={15} />
                      Location available
                    </span>
                  )}
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
