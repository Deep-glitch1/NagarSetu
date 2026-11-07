import React from 'react';

import {
  X,
  Loader2,
  CheckCircle,
  MapPin,
  ExternalLink,
  ImageOff,
} from 'lucide-react';

import { API_BASE_URL } from '../../config';

import {
  priorityClass,
  statusLabel,
} from '../../utils/format';

const formatDate = (value) => {
  if (!value) return 'Not available';

  const date = new Date(value);

  return Number.isNaN(date.getTime())
    ? 'Not available'
    : date.toLocaleString();
};

const getPhotoUrl = (value) => {
  if (!value) return '';

  if (
    /^(https?:|data:|blob:)/i.test(value)
  ) {
    return value;
  }

  return `${String(API_BASE_URL).replace(
    /\/$/,
    ''
  )}/${String(value).replace(/^\//, '')}`;
};

const statusClass = (status) =>
  `admin-status-badge admin-status-${String(
    status || 'unknown'
  ).replace(/_/g, '-')}`;

const AdminComplaintModals = ({
  selectedComplaint,
  officers,
  officersLoading,
  officersError,
  selectedOfficer,
  assigning,
  assignError,
  assignSuccess,
  reportComplaint,
  reportLoading,
  reportError,
  verifyingComplaintId,
  onSelectOfficer,
  onCloseAssignment,
  onAssign,
  onCloseReport,
  onVerify,
}) => {
  return (
    <>
      {/* ASSIGNMENT MODAL */}
      {selectedComplaint && (
        <div
          className="admin-modal-backdrop admin-assignment-modal"
          onMouseDown={onCloseAssignment}
        >
          <div
            className="civic-panel admin-modal-panel admin-assignment-panel"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="civic-panel-title admin-modal-title">
              <div>
                <p className="civic-eyebrow">
                  Assign complaint
                </p>

                <h3>
                  {
                    selectedComplaint.complaint_number
                  }
                </h3>
              </div>

              <button
                className="admin-icon-btn"
                type="button"
                onClick={onCloseAssignment}
                disabled={assigning}
              >
                <X size={18} />
              </button>
            </div>

            <p
              className="admin-modal-muted"
            >
              {selectedComplaint.title}
            </p>

            {officersLoading ? (
              <div
                className="admin-modal-loading"
              >
                <Loader2
                  size={26}
                  className="animate-spin"
                />
              </div>
            ) : officersError ? (
              <p
                className="admin-modal-error-text"
              >
                {officersError}
              </p>
            ) : (
              <>
                {officers.length === 0 ? (
                  <div
                    className="admin-modal-empty"
                  >
                    No officers available for
                    this department.
                  </div>
                ) : (
                  <div className="admin-officer-list">
                    {officers.map((officer) => (
                      <button
                        className={`admin-officer-option ${
                          selectedOfficer ===
                          String(officer.id)
                            ? 'selected'
                            : ''
                        }`}
                        type="button"
                        key={officer.id}
                        onClick={() =>
                          onSelectOfficer(
                            String(officer.id)
                          )
                        }
                        disabled={assigning}
                      >
                        <span>
                          <strong>
                            {officer.name}
                          </strong>

                          <small
                            className="admin-officer-id"
                          >
                            {officer.employee_id}
                          </small>
                        </span>

                        <small>
                          {officer.active_assignments ??
                            0}{' '}
                          active
                        </small>
                      </button>
                    ))}
                  </div>
                )}
              </>
            )}

            {assignError && (
              <p
                className="admin-modal-error-text"
              >
                {assignError}
              </p>
            )}

            {assignSuccess && (
              <p
                className="admin-modal-success-text"
              >
                {assignSuccess}
              </p>
            )}

            <div
              className="admin-modal-actions"
            >
              <button
                className="admin-secondary-btn"
                type="button"
                onClick={onCloseAssignment}
                disabled={assigning}
              >
                Close
              </button>

              <button
                className="admin-primary-btn"
                type="button"
                onClick={onAssign}
                disabled={
                  assigning ||
                  !selectedOfficer ||
                  officers.length === 0
                }
              >
                {assigning && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {assigning
                  ? 'Assigning...'
                  : 'Assign officer'}
              </button>
            </div>
          </div>
        </div>
      )}

      {/* COMPLAINT REPORT MODAL */}
      {(reportLoading ||
        reportError ||
        reportComplaint) && (
        <div
          className="admin-modal-backdrop admin-report-modal"
          onMouseDown={onCloseReport}
        >
          <div
            className="civic-panel admin-modal-panel admin-report-panel"
            onMouseDown={(event) =>
              event.stopPropagation()
            }
          >
            <div className="civic-panel-title admin-modal-title">
              <div>
                <p className="civic-eyebrow">
                  Complaint report
                </p>

                <h3>
                  {reportComplaint?.complaint_number ||
                    'Complaint details'}
                </h3>
              </div>

              <button
                className="admin-icon-btn"
                type="button"
                onClick={onCloseReport}
                disabled={reportLoading}
              >
                <X size={18} />
              </button>
            </div>

            {reportLoading ? (
              <div
                className="admin-report-loading"
              >
                <Loader2
                  size={30}
                  className="animate-spin"
                />

                <p
                  className="admin-modal-muted"
                >
                  Loading complaint report...
                </p>
              </div>
            ) : reportError ? (
              <div
                className="admin-report-error"
              >
                {reportError}
              </div>
            ) : reportComplaint ? (
              <div className="admin-report-content">
                <div
                  className="admin-report-badges"
                >
                  <span
                    className={statusClass(
                      reportComplaint.status
                    )}
                  >
                    {statusLabel(
                      reportComplaint.status
                    )}
                  </span>

                  <span
                    className={priorityClass(
                      reportComplaint.priority
                    )}
                  >
                    {String(
                      reportComplaint.priority ||
                      'low'
                    ).toUpperCase()}
                  </span>

                  {reportComplaint.is_duplicate && (
                    <span>
                      Duplicate complaint
                    </span>
                  )}
                </div>

                <section
                  className="admin-report-intro"
                >
                  <p className="civic-eyebrow">
                    Complaint
                  </p>

                  <h2 className="admin-report-title">
                    {reportComplaint.title ||
                      'Untitled complaint'}
                  </h2>

                  <p
                    className="admin-report-description"
                  >
                    {reportComplaint.description ||
                      'No description provided.'}
                  </p>
                </section>

                <div
                  className="admin-report-meta-grid"
                >
                  {[
                    [
                      'Category',
                      reportComplaint.category_name ||
                        reportComplaint.category,
                    ],
                    [
                      'Department',
                      reportComplaint.department_name,
                    ],
                    [
                      'Officer',
                      reportComplaint.assignment
                        ?.officer_name ||
                        'Not assigned',
                    ],
                    [
                      'Created',
                      formatDate(
                        reportComplaint.created_at
                      ),
                    ],
                    [
                      'Updated',
                      formatDate(
                        reportComplaint.updated_at
                      ),
                    ],
                    [
                      'Assigned',
                      formatDate(
                        reportComplaint.assignment
                          ?.assigned_at
                      ),
                    ],
                  ].map(([label, value]) => (
                    <div
                      key={label}
                      className="admin-report-meta-card"
                    >
                      <small
                        className="admin-report-meta-label"
                      >
                        {label}
                      </small>

                      <strong>
                        {value ||
                          'Not available'}
                      </strong>
                    </div>
                  ))}
                </div>

                <section className="admin-report-section">
                  <div className="civic-panel-title">
                    <div>
                      <p className="civic-eyebrow">
                        Location
                      </p>

                      <h4
                        className="admin-report-location-title"
                      >
                        Complaint location
                      </h4>
                    </div>

                    <MapPin size={20} />
                  </div>

                  {reportComplaint.latitude !==
                    null &&
                  reportComplaint.latitude !==
                    undefined &&
                  reportComplaint.longitude !==
                    null &&
                  reportComplaint.longitude !==
                    undefined ? (
                    <p
                      className="admin-report-location-note"
                    >
                      Latitude:{' '}
                      {reportComplaint.latitude}
                      {' · '}
                      Longitude:{' '}
                      {reportComplaint.longitude}
                    </p>
                  ) : (
                    <p
                      className="admin-report-location-note"
                    >
                      Location not available.
                    </p>
                  )}
                </section>

                <section>
                  <div className="civic-panel-title">
                    <div>
                      <p className="civic-eyebrow">
                        Evidence
                      </p>

                      <h4
                        className="admin-report-section-title"
                      >
                        Complaint and resolution
                        photos
                      </h4>
                    </div>
                  </div>

                  {reportComplaint.photos?.length ? (
                    <div className="admin-photo-grid">
                      {reportComplaint.photos.map(
                        (photo) => {
                          const src =
                            getPhotoUrl(
                              photo.photo_url
                            );

                          return (
                            <a
                              className="admin-photo-card"
                              key={photo.id}
                              href={src || '#'}
                              target="_blank"
                              rel="noreferrer"
                              onClick={(
                                event
                              ) => {
                                if (!src) {
                                  event.preventDefault();
                                }
                              }}
                            >
                              {src ? (
                                <img
                                  src={src}
                                  alt={`${photo.photo_type || 'Evidence'} complaint`}
                                  className="admin-report-photo"
                                />
                              ) : (
                                <div
                                  className="admin-report-photo-empty"
                                >
                                  <ImageOff
                                    size={28}
                                  />
                                </div>
                              )}

                              <div
                                className="admin-report-photo-caption"
                              >
                                <span>
                                  {statusLabel(
                                    photo.photo_type ||
                                      'evidence'
                                  )}
                                </span>

                                <ExternalLink
                                  size={15}
                                />
                              </div>
                            </a>
                          );
                        }
                      )}
                    </div>
                  ) : (
                    <p
                      className="admin-modal-muted"
                    >
                      No photos available.
                    </p>
                  )}
                </section>

                <section className="admin-citizen-response-section">
                  <div className="civic-panel-title">
                    <div>
                      <p className="civic-eyebrow">
                        Citizen response
                      </p>

                      <h4 className="admin-report-response-title">
                        Resolution feedback
                      </h4>
                    </div>
                  </div>

                  {reportComplaint.citizen_response ? (
                    <div className="admin-citizen-response-card">
                      <div className="admin-citizen-response-row">
                        <span className="admin-response-label">
                          Response
                        </span>

                        <span
                          className={
                            reportComplaint.citizen_response.response === 'satisfied'
                              ? 'admin-response-badge admin-response-satisfied'
                              : 'admin-response-badge admin-response-reopen'
                          }
                        >
                          {reportComplaint.citizen_response.response === 'satisfied'
                            ? 'Satisfied'
                            : 'Requested Reopen'}
                        </span>
                      </div>

                      <div className="admin-citizen-response-row">
                        <span className="admin-response-label">
                          Rating
                        </span>

                        <span className="admin-rating">
                          {reportComplaint.citizen_response.rating != null
                            ? <>
                                {'★'.repeat(reportComplaint.citizen_response.rating)}
                                <span className="admin-rating-empty">
                                  {'★'.repeat(5 - reportComplaint.citizen_response.rating)}
                                </span>
                              </>
                            : 'Not provided'}
                        </span>
                      </div>

                      <div className="admin-citizen-review">
                        <span className="admin-response-label">
                          Review
                        </span>
                        <p>
                          {reportComplaint.citizen_response.review ||
                            'No written review provided.'}
                        </p>
                      </div>

                      <small className="admin-response-time">
                        Responded: {formatDate(
                          reportComplaint.citizen_response.responded_at
                        )}
                      </small>
                    </div>
                  ) : (
                    <div className="admin-citizen-response-empty">
                      Citizen has not submitted a response yet.
                    </div>
                  )}
                </section>


                <section>
                  <div className="civic-panel-title">
                    <div>
                      <p className="civic-eyebrow">
                        Status history
                      </p>

                      <h4
                        className="admin-report-timeline-title"
                      >
                        Complaint timeline
                      </h4>
                    </div>
                  </div>

                  {reportComplaint.status_history
                    ?.length ? (
                    <div
                      className="admin-report-history-list"
                    >
                      {reportComplaint.status_history.map(
                        (item) => (
                          <div
                            key={item.id}
                            className="admin-report-history-item"
                          >
                            <strong>
                              {statusLabel(
                                item.old_status
                              )}
                              {' → '}
                              {statusLabel(
                                item.new_status
                              )}
                            </strong>

                            <p
                              className="admin-report-history-meta"
                            >
                              {item.remarks ||
                                'No remarks'}
                              {' · '}
                              {formatDate(
                                item.changed_at
                              )}
                            </p>

                            {item.changed_by_name && (
                              <small
                                className="admin-report-history-by"
                              >
                                By{' '}
                                {
                                  item.changed_by_name
                                }
                              </small>
                            )}
                          </div>
                        )
                      )}
                    </div>
                  ) : (
                    <p
                      className="admin-modal-muted"
                    >
                      No status history available.
                    </p>
                  )}
                </section>

                <section className="admin-sla-card">
                  <div className="civic-panel-title">
                    <div>
                      <p className="civic-eyebrow">
                        SLA
                      </p>

                      <h4
                        className="admin-report-sla-title"
                      >
                        Service level
                      </h4>
                    </div>

                    <strong>
                      {reportComplaint.sla
                        ?.state
                        ? statusLabel(
                            reportComplaint.sla
                              .state
                          )
                        : 'Not available'}
                    </strong>
                  </div>

                  <p
                    className="admin-report-sla-note"
                  >
                    Target:{' '}
                    {reportComplaint.sla
                      ?.target_hours ??
                      'Not available'}{' '}
                    hours
                    {' · '}
                    Elapsed:{' '}
                    {reportComplaint.sla
                      ?.elapsed_hours
                      ?.toFixed?.(1) ??
                      'Not available'}{' '}
                    hours
                  </p>
                </section>

                <div
                  className="admin-report-actions"
                >
                  {reportComplaint.status ===
                    'pending_verification' && (
                    <button
                      className="admin-action-btn admin-verify-btn"
                      type="button"
                      onClick={() =>
                        onVerify(
                          reportComplaint.id
                        )
                      }
                      disabled={
                        verifyingComplaintId ===
                          reportComplaint.id ||
                        reportLoading
                      }
                    >
                      {verifyingComplaintId ===
                      reportComplaint.id ? (
                        <>
                          <Loader2
                            size={16}
                            className="animate-spin"
                          />
                          Verifying...
                        </>
                      ) : (
                        <>
                          <CheckCircle size={16} />
                          Verify Resolution
                        </>
                      )}
                    </button>
                  )}

                  <button
                    className="admin-secondary-btn"
                    type="button"
                    onClick={onCloseReport}
                    disabled={reportLoading}
                  >
                    Close report
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        </div>
      )}
    </>
  );
};

export default AdminComplaintModals;
