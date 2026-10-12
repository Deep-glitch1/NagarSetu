import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  MapPin,
  RefreshCw,
  ClipboardList,
  AlertTriangle,
  CalendarDays,
  UserRound,
} from 'lucide-react';

import { getTaskDetails } from '../../api/employee';

const statusLabel = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return String(value);
  return date.toLocaleString();
};

const EmployeeTaskDetails = ({ taskId, onBack }) => {
  const [task, setTask] = useState(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const loadTask = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getTaskDetails(taskId);
        setTask(data?.task || null);
    } catch (err) {
      console.error('Task detail load failed:', err);
      setError(err.message || 'Unable to load this task.');
      setTask(null);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTask();
  }, [taskId]);

  if (loading) {
    return (
      <div className="civic-empty">
        <RefreshCw size={28} className="animate-spin" />
        <p>Loading task details...</p>
      </div>
    );
  }

  if (error || !task) {
    return (
      <div className="civic-empty">
        <AlertTriangle size={28} />
        <h3>Unable to load task</h3>
        <p>{error || 'Task not found.'}</p>
        <button type="button" onClick={onBack}>
          Back to my tasks
        </button>
      </div>
    );
  }

  return (
    <div>
      <section className="civic-page-header">
        <div>
          <button type="button" onClick={onBack}>
            <ArrowLeft size={17} />
            Back to my tasks
          </button>
          <p className="civic-eyebrow">Task details</p>
          <h2>{task.complaint_number}</h2>
          <p>{task.title || 'Complaint'}</p>
        </div>

        <button type="button" onClick={loadTask}>
          <RefreshCw size={17} />
          Refresh
        </button>
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Complaint</p>
              <h3>Overview</h3>
            </div>
          </div>

          <dl className="employee-detail-list">
            <div>
              <dt>Category</dt>
              <dd>{task.category_name || task.category || '—'}</dd>
            </div>
            <div>
              <dt>Status</dt>
              <dd>{statusLabel(task.status)}</dd>
            </div>
            <div>
              <dt>Priority</dt>
              <dd>{String(task.priority || 'low').toUpperCase()}</dd>
            </div>
            <div>
              <dt>Department</dt>
              <dd>{task.department_name || '—'}</dd>
            </div>
            <div>
              <dt>Created</dt>
              <dd>{formatDate(task.created_at)}</dd>
            </div>
            <div>
              <dt>Updated</dt>
              <dd>{formatDate(task.updated_at)}</dd>
            </div>
          </dl>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Assignment</p>
              <h3>Current assignee</h3>
            </div>
          </div>

          <div className="employee-assignee-box">
            <UserRound size={20} />
            <div>
              <strong>
                {task.assignment?.name || 'Assigned to you'}
              </strong>
              <span>
                {task.assignment?.employee_id || 'Current employee'}
              </span>
            </div>
          </div>
        </article>
      </section> 
    {task.is_duplicate && (
      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Duplicate</p>
            <h3>Related complaint</h3>
          </div>
        </div>

        <p>
          Master complaint ID:{' '}
          {task.master_complaint_id || '—'}
        </p>
      </section>
    )}

      <section className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Description</p>
              <h3>Issue reported</h3>
            </div>
          </div>
      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Service level</p>
            <h3>SLA status</h3>
          </div>
        </div>

      <dl className="employee-detail-list">
        <div>
          <dt>Target</dt>
          <dd>
            {task.sla?.target_hours ?? '—'} hours
          </dd>
        </div>

        <div>
          <dt>Elapsed</dt>
          <dd>
            {task.sla?.elapsed_hours ?? '—'} hours
          </dd>
        </div>

        <div>
          <dt>Progress</dt>
          <dd>
            {task.sla?.elapsed_percentage ?? 0}%
          </dd>
          </div>

          <div>
            <dt>State</dt>
            <dd>
              {statusLabel(task.sla?.state) || '—'}
            </dd>
          </div>
        </dl>
      </section>
        <p className="employee-description">
          {task.description || 'No description provided.'}
        </p>
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Location</p>
              <h3>Complaint location</h3>
            </div>
          </div>

          <div className="employee-location-box">
            <MapPin size={21} />
            <div>
              <strong>GPS location</strong>
              <span>
                {task.latitude ?? '—'}, {task.longitude ?? '—'}
              </span>
            </div>
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Timeline</p>
              <h3>Status history</h3>
            </div>
          </div>

          {Array.isArray(task.status_history) &&
          task.status_history.length > 0 ? (
            <div className="employee-history-list">
              {task.status_history.map((item) => (
                <div className="employee-history-row" key={item.id}>
                  <CalendarDays size={16} />
                  <div>
                    <strong>{statusLabel(item.new_status)}</strong>
                    <span>{formatDate(item.changed_at)}</span>
                    {item.remarks && <p>{item.remarks}</p>}
                  </div>
                </div>
              ))}
            </div>
          ) : (
            <p>No status history available.</p>
          )}
        </article>
      </section>

      {Array.isArray(task.photos) && task.photos.length > 0 && (
        <section className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Evidence</p>
              <h3>Complaint photos</h3>
            </div>
          </div>

          <div className="employee-photo-grid">
            {task.photos.map((photo) => (
              <figure key={photo.id}>
                <img
                  src={photo.photo_url}
                  alt={`${photo.photo_type} evidence`}
                />
                <figcaption>
                  {photo.photo_type} · {formatDate(photo.uploaded_at)}
                </figcaption>
              </figure>
            ))}
          </div>
        </section>
      )}
    </div>
  );
};

export default EmployeeTaskDetails;
