import React, { useEffect, useMemo, useState } from 'react';
import {
  ArrowLeft,
  AlertTriangle,
  CheckCircle2,
  Clock3,
  ExternalLink,
  FileImage,
  ImageOff,
  MapPin,
  RefreshCw,
} from 'lucide-react';

import { API_BASE_URL } from '../../config';
import { getTaskDetails } from '../../api/employee';

const statusLabel = (status) =>
  String(status || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const priorityClass = (priority) =>
  `priority-${String(priority || 'low').toLowerCase()}`;

const slaStateClass = (state) =>
  `employee-sla-${String(state || 'on_track').toLowerCase()}`;

const formatDate = (value) => {
  if (!value) return 'Not available';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? 'Not available' : date.toLocaleString();
};

const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined) return 'Not available';
  const number = Number(value);
  return Number.isFinite(number) ? number.toFixed(digits) : 'Not available';
};

const getPhotoUrl = (value) => {
  if (!value) return '';
  if (/^(https?:|data:|blob:)/i.test(value)) return value;
  return `${String(API_BASE_URL).replace(/\/$/, '')}/${String(value).replace(/^\//, '')}`;
};

const PhotoCard = ({ photo }) => {
  const [failed, setFailed] = useState(false);
  const src = getPhotoUrl(photo.photo_url);

  return (
    <a
      className="employee-photo-card"
      href={src || '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!src) event.preventDefault();
      }}
    >
      {!failed && src ? (
        <img
          src={src}
          alt={`${photo.photo_type || 'Evidence'} complaint evidence`}
          loading="lazy"
          onError={() => setFailed(true)}
        />
      ) : (
        <div className="employee-photo-fallback">
          <ImageOff size={28} />
          <span>Image unavailable</span>
        </div>
      )}
      <div className="employee-photo-caption">
        <span>{statusLabel(photo.photo_type || 'evidence')}</span>
        <small>{formatDate(photo.uploaded_at)}</small>
      </div>
    </a>
  );
};

const EmployeeTaskDetails = ({ taskId, onBack, onRefreshTasks }) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const loadDetails = async () => {
    if (!taskId) {
      setDetails(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data = await getTaskDetails(taskId);
      setDetails(data?.task || null);
    } catch (requestError) {
      console.error('Task details load failed:', requestError);
      setDetails(null);
      setError(requestError.message || 'Unable to load task details.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [taskId]);

  const slaProgress = useMemo(() => {
    const percentage = Number(details?.sla?.elapsed_percentage);
    if (!Number.isFinite(percentage)) return 0;
    return Math.min(Math.max(percentage, 0), 100);
  }, [details]);

  if (!taskId) {
    return (
      <div className="civic-empty">
        <AlertTriangle size={30} />
        <h2>Task not selected</h2>
        <p>Select a complaint from My Tasks.</p>
        <button type="button" onClick={onBack}>Back to My Tasks</button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="civic-empty">
        <RefreshCw size={30} className="animate-spin" />
        <h2>Loading task details</h2>
        <p>Please wait...</p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="civic-empty">
        <AlertTriangle size={30} />
        <h2>Unable to load task</h2>
        <p>{error}</p>
        <div className="employee-detail-actions">
          <button type="button" onClick={loadDetails}>Try again</button>
          <button type="button" onClick={onBack}>Back</button>
        </div>
      </div>
    );
  }

  if (!details) return null;

  const initialPhotos = (details.photos || []).filter(
    (photo) => photo.photo_type === 'initial'
  );
  const otherPhotos = (details.photos || []).filter(
    (photo) => photo.photo_type !== 'initial'
  );

  const hasLocation =
    details.latitude !== null &&
    details.latitude !== undefined &&
    details.longitude !== null &&
    details.longitude !== undefined;

  const slaState = details.sla?.state || 'on_track';
  const slaLabel = statusLabel(slaState);

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome employee-detail-hero">
        <div>
          <button
            type="button"
            className="employee-back-button"
            onClick={onBack}
          >
            <ArrowLeft size={17} />
            Back to My Tasks
          </button>

          <p className="civic-eyebrow">Task details</p>
          <h2>{details.complaint_number || `Complaint #${details.id}`}</h2>
          <p>{details.title || 'Civic complaint'}</p>
        </div>

        <span className={`employee-priority ${priorityClass(details.priority)}`}>
          {String(details.priority || 'low').toUpperCase()}
        </span>
      </section>

      <section className="civic-stat-grid">
        <article className="civic-stat">
          <span><Clock3 size={20} /></span>
          <div><small>Status</small><strong>{statusLabel(details.status)}</strong></div>
        </article>
        <article className="civic-stat">
          <span><FileImage size={20} /></span>
          <div><small>Category</small><strong>{details.category_name || details.category || 'Unknown'}</strong></div>
        </article>
        <article className="civic-stat">
          <span><MapPin size={20} /></span>
          <div><small>Department</small><strong>{details.department_name || 'Not assigned'}</strong></div>
        </article>
        <article className="civic-stat">
          <span><CheckCircle2 size={20} /></span>
          <div><small>Assigned</small><strong>{formatDate(details.assignment?.assigned_at)}</strong></div>
        </article>
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Complaint</p>
              <h3>Issue information</h3>
            </div>
          </div>

          <div className="employee-detail-grid">
            <div><small>Title</small><p>{details.title || 'Not provided'}</p></div>
            <div><small>Category</small><p>{details.category_name || details.category || 'Unknown'}</p></div>
            <div><small>Created</small><p>{formatDate(details.created_at)}</p></div>
            <div><small>Last updated</small><p>{formatDate(details.updated_at)}</p></div>
          </div>

          <div className="employee-description-block">
            <small>Description</small>
            <p>{details.description || 'No description was provided.'}</p>
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Location</p>
              <h3>Complaint location</h3>
            </div>
          </div>

          {hasLocation ? (
            <div className="employee-location-block">
              <div className="employee-coordinate">
                <MapPin size={17} />
                <span>{Number(details.latitude).toFixed(6)}, {Number(details.longitude).toFixed(6)}</span>
              </div>
              <a
                className="employee-inline-link"
                href={`https://www.google.com/maps?q=${details.latitude},${details.longitude}`}
                target="_blank"
                rel="noreferrer"
              >
                Open in Maps
                <ExternalLink size={15} />
              </a>
            </div>
          ) : (
            <p>Location is not available.</p>
          )}
        </article>
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Evidence</p>
              <h3>Complaint photos</h3>
            </div>
            <span>{details.photos?.length || 0}</span>
          </div>

          {initialPhotos.length === 0 && otherPhotos.length === 0 ? (
            <div className="employee-empty-block">No complaint photos are available.</div>
          ) : (
            <>
              {initialPhotos.length > 0 && (
                <div className="employee-photo-grid">
                  {initialPhotos.map((photo) => <PhotoCard key={photo.id} photo={photo} />)}
                </div>
              )}

              {otherPhotos.length > 0 && (
                <>
                  <p className="civic-eyebrow employee-subheading">Additional evidence</p>
                  <div className="employee-photo-grid">
                    {otherPhotos.map((photo) => <PhotoCard key={photo.id} photo={photo} />)}
                  </div>
                </>
              )}
            </>
          )}
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Service level</p>
              <h3>SLA status</h3>
            </div>
            <span className={`employee-sla-badge ${slaStateClass(slaState)}`}>
              {slaLabel}
            </span>
          </div>

          <div className={`employee-sla-wrap ${slaStateClass(slaState)}`}>
            <div className="employee-sla-track">
              <div style={{ width: `${slaProgress}%` }} />
            </div>
            <div className="employee-sla-summary">
              <strong>{formatNumber(details.sla?.elapsed_percentage)}%</strong>
              <span>of target elapsed</span>
            </div>
          </div>

          <div className="employee-detail-grid employee-sla-grid">
            <div><small>Target</small><p>{details.sla?.target_hours != null ? `${formatNumber(details.sla.target_hours)} hours` : 'Not available'}</p></div>
            <div><small>Elapsed</small><p>{details.sla?.elapsed_hours != null ? `${formatNumber(details.sla.elapsed_hours)} hours` : 'Not available'}</p></div>
            <div><small>Progress</small><p>{details.sla?.elapsed_percentage != null ? `${formatNumber(details.sla.elapsed_percentage)}%` : 'Not available'}</p></div>
          </div>
        </article>
      </section>

      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Assignment</p>
            <h3>Current assignment</h3>
          </div>
        </div>

        <div className="employee-detail-grid">
          <div><small>Officer</small><p>{details.assignment?.officer_name || 'Not available'}</p></div>
          <div><small>Employee ID</small><p>{details.assignment?.employee_id || 'Not available'}</p></div>
          <div><small>Assigned by</small><p>{details.assignment?.assigned_by_name || 'Not available'}</p></div>
          <div><small>Assigned at</small><p>{formatDate(details.assignment?.assigned_at)}</p></div>
        </div>
      </section>

      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">Timeline</p>
            <h3>Status history</h3>
          </div>
        </div>

        {details.status_history?.length ? (
          <div className="employee-status-history">
            {details.status_history.map((item) => (
              <div className="employee-history-item" key={item.id}>
                <span><CheckCircle2 size={17} /></span>
                <div>
                  <strong>{statusLabel(item.new_status)}</strong>
                  <p>{item.old_status ? `${statusLabel(item.old_status)} → ` : ''}{statusLabel(item.new_status)}</p>
                  {item.remarks && <p>{item.remarks}</p>}
                  <small>{item.changed_by_name || 'System'} · {formatDate(item.changed_at)}</small>
                </div>
              </div>
            ))}
          </div>
        ) : (
          <p>No status history is available.</p>
        )}
      </section>

      <div className="employee-detail-actions">
        <button type="button" onClick={loadDetails} disabled={loading}>
          <RefreshCw size={16} className={loading ? 'animate-spin' : ''} />
          Refresh details
        </button>
        <button type="button" onClick={() => { onRefreshTasks?.(); onBack(); }}>
          Back to My Tasks
        </button>
      </div>
    </div>
  );
};

export default EmployeeTaskDetails;
