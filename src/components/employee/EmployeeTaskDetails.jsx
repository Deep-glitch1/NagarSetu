import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';
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

import {
  getTaskDetails,
  startTask,
  uploadResolution,
} from '../../api/employee';

import {
  statusLabel,
  priorityClass,
  formatDate,
  formatNumber,
  getPhotoUrl,
} from '../../utils/format';

const slaStateClass = (state) =>
  `employee-sla-${String(
    state || 'on_track'
  ).toLowerCase()}`;

const PhotoCard = ({ photo }) => {
  const [failed, setFailed] = useState(false);

  const src = getPhotoUrl(
    photo.photo_url
  );

  return (
    <a
      className="employee-photo-card"
      href={src || '#'}
      target="_blank"
      rel="noreferrer"
      onClick={(event) => {
        if (!src) {
          event.preventDefault();
        }
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
          <span>
            Image unavailable
          </span>
        </div>
      )}

      <div className="employee-photo-caption">
        <span>
          {statusLabel(
            photo.photo_type || 'evidence'
          )}
        </span>

        <small>
          {formatDate(photo.uploaded_at)}
        </small>
      </div>
    </a>
  );
};

const EmployeeTaskDetails = ({
  taskId,
  onBack,
  onRefreshTasks,
}) => {
  const [details, setDetails] = useState(null);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const [actionLoading, setActionLoading] =
    useState(false);
  const [actionError, setActionError] =
    useState('');

  const [resolutionFile, setResolutionFile] =
    useState(null);
  const [resolutionUploading, setResolutionUploading] =
    useState(false);

  const loadDetails = async () => {
    if (!taskId) {
      setDetails(null);
      return;
    }

    setLoading(true);
    setError('');

    try {
      const data =
        await getTaskDetails(taskId);

      setDetails(
        data?.task || null
      );
    } catch (requestError) {
      console.error(
        'Task details load failed:',
        requestError
      );

      setDetails(null);

      setError(
        requestError.message ||
          'Unable to load task details.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadDetails();
  }, [taskId]);

  const handleStartWork = async () => {
    if (
        !taskId ||
        !['assigned', 'reopened'].includes(details?.status) ||
        actionLoading
      ) {
        return;
      }

    setActionLoading(true);
    setActionError('');

    try {
      await startTask(taskId);

      await loadDetails();

      onRefreshTasks?.();
    } catch (requestError) {
      console.error(
        'Start work failed:',
        requestError
      );

      setActionError(
        requestError.message ||
          'Unable to start work on this complaint.'
      );
    } finally {
      setActionLoading(false);
    }
  };

  const handleResolutionUpload = async () => {
    if (
      !taskId ||
      details?.status !== 'in_progress' ||
      !resolutionFile ||
      resolutionUploading
    ) {
      return;
    }

    setResolutionUploading(true);
    setActionError('');

    try {
      await uploadResolution(
        taskId,
        resolutionFile
      );

      setResolutionFile(null);

      await loadDetails();

      onRefreshTasks?.();
    } catch (requestError) {
      console.error(
        'Resolution upload failed:',
        requestError
      );

      setActionError(
        requestError.message ||
          'Unable to upload resolution photo.'
      );
    } finally {
      setResolutionUploading(false);
    }
  };

  const slaProgress = useMemo(() => {
    const percentage = Number(
      details?.sla?.elapsed_percentage
    );

    if (!Number.isFinite(percentage)) {
      return 0;
    }

    return Math.min(
      Math.max(percentage, 0),
      100
    );
  }, [details]);

  if (!taskId) {
    return (
      <div className="civic-empty">
        <AlertTriangle size={30} />

        <h2>
          Task not selected
        </h2>

        <p>
          Select a complaint from My Tasks.
        </p>

        <button
          type="button"
          onClick={onBack}
        >
          Back to My Tasks
        </button>
      </div>
    );
  }

  if (loading) {
    return (
      <div className="civic-empty">
        <RefreshCw
          size={30}
          className="animate-spin"
        />

        <h2>
          Loading task details
        </h2>

        <p>
          Please wait...
        </p>
      </div>
    );
  }

  if (error) {
    return (
      <div className="civic-empty">
        <AlertTriangle size={30} />

        <h2>
          Unable to load task
        </h2>

        <p>
          {error}
        </p>

        <div className="employee-detail-actions">
          <button
            type="button"
            onClick={loadDetails}
          >
            Try again
          </button>

          <button
            type="button"
            onClick={onBack}
          >
            Back
          </button>
        </div>
      </div>
    );
  }

  if (!details) {
    return null;
  }

  const initialPhotos =
    (details.photos || []).filter(
      (photo) =>
        photo.photo_type === 'initial'
    );

  const otherPhotos =
    (details.photos || []).filter(
      (photo) =>
        photo.photo_type !== 'initial'
    );

  const hasLocation =
    details.latitude !== null &&
    details.latitude !== undefined &&
    details.longitude !== null &&
    details.longitude !== undefined;

  const slaState =
    details.sla?.state || 'on_track';

  const slaLabel =
    statusLabel(slaState);

  return (
    <div className="civic-dashboard">

      {/* =====================================================
          HEADER
          ===================================================== */}

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

          <p className="civic-eyebrow">
            Task details
          </p>

          <h2>
            {details.complaint_number ||
              `Complaint #${details.id}`}
          </h2>

          <p>
            {details.title ||
              'Civic complaint'}
          </p>
        </div>

        <span
          className={`employee-priority ${priorityClass(
            details.priority
          )}`}
        >
          {String(
            details.priority || 'low'
          ).toUpperCase()}
        </span>
      </section>

      {/* =====================================================
          SUMMARY
          ===================================================== */}

      <section className="civic-stat-grid">
        <article className="civic-stat">
          <span>
            <Clock3 size={20} />
          </span>

          <div>
            <small>
              Status
            </small>

            <strong>
              {statusLabel(
                details.status
              )}
            </strong>
          </div>
        </article>

        <article className="civic-stat">
          <span>
            <FileImage size={20} />
          </span>

          <div>
            <small>
              Category
            </small>

            <strong>
              {details.category_name ||
                details.category ||
                'Unknown'}
            </strong>
          </div>
        </article>

        <article className="civic-stat">
          <span>
            <MapPin size={20} />
          </span>

          <div>
            <small>
              Department
            </small>

            <strong>
              {details.department_name ||
                'Not assigned'}
            </strong>
          </div>
        </article>

        <article className="civic-stat">
          <span>
            <CheckCircle2 size={20} />
          </span>

          <div>
            <small>
              Assigned
            </small>

            <strong>
              {formatDate(
                details.assignment
                  ?.assigned_at
              )}
            </strong>
          </div>
        </article>
      </section>

      {/* =====================================================
          COMPLAINT + LOCATION
          ===================================================== */}

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Complaint
              </p>

              <h3>
                Issue information
              </h3>
            </div>
          </div>

          <div className="employee-detail-grid">
            <div>
              <small>
                Title
              </small>

              <p>
                {details.title ||
                  'Not provided'}
              </p>
            </div>

            <div>
              <small>
                Category
              </small>

              <p>
                {details.category_name ||
                  details.category ||
                  'Unknown'}
              </p>
            </div>

            <div>
              <small>
                Created
              </small>

              <p>
                {formatDate(
                  details.created_at
                )}
              </p>
            </div>

            <div>
              <small>
                Last updated
              </small>

              <p>
                {formatDate(
                  details.updated_at
                )}
              </p>
            </div>
          </div>

          <div className="employee-description-block">
            <small>
              Description
            </small>

            <p>
              {details.description ||
                'No description was provided.'}
            </p>
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Location
              </p>

              <h3>
                Complaint location
              </h3>
            </div>
          </div>

          {hasLocation ? (
            <div className="employee-location-block">
              <div className="employee-coordinate">
                <MapPin size={17} />

                <span>
                  {Number(
                    details.latitude
                  ).toFixed(6)}
                  ,{' '}
                  {Number(
                    details.longitude
                  ).toFixed(6)}
                </span>
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
            <p>
              Location is not available.
            </p>
          )}
        </article>
      </section>

      {/* =====================================================
          PHOTOS + SLA
          ===================================================== */}

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Evidence
              </p>

              <h3>
                Complaint photos
              </h3>
            </div>

            <span>
              {details.photos?.length || 0}
            </span>
          </div>

          {initialPhotos.length === 0 &&
          otherPhotos.length === 0 ? (
            <div className="employee-empty-block">
              No complaint photos are
              available.
            </div>
          ) : (
            <>
              {initialPhotos.length > 0 && (
                <div className="employee-photo-grid">
                  {initialPhotos.map(
                    (photo) => (
                      <PhotoCard
                        key={photo.id}
                        photo={photo}
                      />
                    )
                  )}
                </div>
              )}

              {otherPhotos.length > 0 && (
                <>
                  <p className="civic-eyebrow employee-subheading">
                    Additional evidence
                  </p>

                  <div className="employee-photo-grid">
                    {otherPhotos.map(
                      (photo) => (
                        <PhotoCard
                          key={photo.id}
                          photo={photo}
                        />
                      )
                    )}
                  </div>
                </>
              )}
            </>
          )}
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Service level
              </p>

              <h3>
                SLA status
              </h3>
            </div>

            <span
              className={`employee-sla-badge ${slaStateClass(
                slaState
              )}`}
            >
              {slaLabel}
            </span>
          </div>

          <div
            className={`employee-sla-wrap ${slaStateClass(
              slaState
            )}`}
          >
            <div className="employee-sla-track">
              <div
                style={{
                  width: `${slaProgress}%`,
                }}
              />
            </div>

            <div className="employee-sla-summary">
              <strong>
                {formatNumber(
                  details.sla
                    ?.elapsed_percentage
                )}
                %
              </strong>

              <span>
                of target elapsed
              </span>
            </div>
          </div>

          <div className="employee-detail-grid employee-sla-grid">
            <div>
              <small>
                Target
              </small>

              <p>
                {details.sla
                  ?.target_hours != null
                  ? `${formatNumber(
                      details.sla
                        .target_hours
                    )} hours`
                  : 'Not available'}
              </p>
            </div>

            <div>
              <small>
                Elapsed
              </small>

              <p>
                {details.sla
                  ?.elapsed_hours != null
                  ? `${formatNumber(
                      details.sla
                        .elapsed_hours
                    )} hours`
                  : 'Not available'}
              </p>
            </div>

            <div>
              <small>
                Progress
              </small>

              <p>
                {details.sla
                  ?.elapsed_percentage != null
                  ? `${formatNumber(
                      details.sla
                        .elapsed_percentage
                    )}%`
                  : 'Not available'}
              </p>
            </div>
          </div>
        </article>
      </section>

      {/* =====================================================
          ASSIGNMENT
          ===================================================== */}

      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">
              Assignment
            </p>

            <h3>
              Current assignment
            </h3>
          </div>
        </div>

        <div className="employee-detail-grid">
          <div>
            <small>
              Officer
            </small>

            <p>
              {details.assignment
                ?.officer_name ||
                'Not available'}
            </p>
          </div>

          <div>
            <small>
              Employee ID
            </small>

            <p>
              {details.assignment
                ?.employee_id ||
                'Not available'}
            </p>
          </div>

          <div>
            <small>
              Assigned by
            </small>

            <p>
              {details.assignment
                ?.assigned_by_name ||
                'Not available'}
            </p>
          </div>

          <div>
            <small>
              Assigned at
            </small>

            <p>
              {formatDate(
                details.assignment
                  ?.assigned_at
              )}
            </p>
          </div>
        </div>
      </section>

      {/* =====================================================
          STATUS HISTORY
          ===================================================== */}

      <section className="civic-panel">
        <div className="civic-panel-title">
          <div>
            <p className="civic-eyebrow">
              Timeline
            </p>

            <h3>
              Status history
            </h3>
          </div>
        </div>

        {details.status_history?.length ? (
          <div className="employee-status-history">
            {details.status_history.map(
              (item) => (
                <div
                  className="employee-history-item"
                  key={item.id}
                >
                  <span>
                    <CheckCircle2
                      size={17}
                    />
                  </span>

                  <div>
                    <strong>
                      {statusLabel(
                        item.new_status
                      )}
                    </strong>

                    <p>
                      {item.old_status
                        ? `${statusLabel(
                            item.old_status
                          )} → `
                        : ''}
                      {statusLabel(
                        item.new_status
                      )}
                    </p>

                    {item.remarks && (
                      <p>
                        {item.remarks}
                      </p>
                    )}

                    <small>
                      {item.changed_by_name ||
                        'System'}
                      {' · '}
                      {formatDate(
                        item.changed_at
                      )}
                    </small>
                  </div>
                </div>
              )
            )}
          </div>
        ) : (
          <p>
            No status history is available.
          </p>
        )}
      </section>

      {/* =====================================================
          RESOLUTION UPLOAD
          ===================================================== */}

      {details.status === 'in_progress' && (
        <section className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Resolution
              </p>

              <h3>
                Upload resolution photo
              </h3>
            </div>
          </div>

          <div className="employee-resolution-upload">
            <input
            className="employee-resolution-file"
              type="file"
              accept="image/*"
              capture="environment"
              onChange={(event) => {
                setResolutionFile(
                  event.target.files?.[0] ||
                    null
                );
              }}
              disabled={resolutionUploading}
            />

            <button
              type="button"
              onClick={handleResolutionUpload}
              disabled={
                !resolutionFile ||
                resolutionUploading ||
                loading
              }
            >
              {resolutionUploading ? (
                <>
                  <RefreshCw
                    size={16}
                    className="animate-spin"
                  />
                  Uploading...
                </>
              ) : (
                <>
                  <FileImage size={16} />
                  Upload Resolution
                </>
              )}
            </button>
          </div>

          {resolutionFile && (
            <p>
              Selected:{' '}
              {resolutionFile.name}
            </p>
          )}
        </section>
      )}

      {/* =====================================================
          ACTIONS
          ===================================================== */}

      <div className="employee-detail-actions">
        {['assigned', 'reopened'].includes(details.status) && (
          <button
            type="button"
            onClick={handleStartWork}
            disabled={
              actionLoading ||
              loading ||
              resolutionUploading
            }
          >
            {actionLoading ? (
              <RefreshCw
                size={16}
                className="animate-spin"
              />
            ) : (
              <CheckCircle2 size={16} />
            )}

            {actionLoading
              ? 'Starting...'
              : 'Start Work'}
          </button>
        )}

        <button
          type="button"
          onClick={loadDetails}
          disabled={
            loading ||
            actionLoading ||
            resolutionUploading
          }
        >
          <RefreshCw
            size={16}
            className={
              loading
                ? 'animate-spin'
                : ''
            }
          />

          Refresh details
        </button>

        <button
          type="button"
          onClick={() => {
            onRefreshTasks?.();
            onBack();
          }}
          disabled={
            actionLoading ||
            resolutionUploading
          }
        >
          Back to My Tasks
        </button>
      </div>

      {actionError && (
        <p className="employee-form-error">
          {actionError}
        </p>
      )}
    </div>
  );
};

export default EmployeeTaskDetails;