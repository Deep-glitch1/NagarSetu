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
              style={{
                color: 'var(--muted)',
              }}
            >
              {selectedComplaint.title}
            </p>

            {officersLoading ? (
              <div
                style={{
                  textAlign: 'center',
                  padding: '30px',
                }}
              >
                <Loader2
                  size={26}
                  className="animate-spin"
                />
              </div>
            ) : officersError ? (
              <p
                style={{
                  color: '#a94435',
                }}
              >
                {officersError}
              </p>
            ) : (
              <>
                {officers.length === 0 ? (
                  <div
                    style={{
                      marginTop: '15px',
                      padding: '14px',
                      border:
                        '1px solid var(--line)',
                      borderRadius: '10px',
                      color: 'var(--muted)',
                    }}
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
                            style={{
                              display: 'block',
                              color:
                                'var(--muted)',
                            }}
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
                style={{
                  color: '#a94435',
                }}
              >
                {assignError}
              </p>
            )}

            {assignSuccess && (
              <p
                style={{
                  color: '#397255',
                }}
              >
                {assignSuccess}
              </p>
            )}

            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: '10px',
                marginTop: '20px',
              }}
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
                style={{
                  padding: '50px 10px',
                  textAlign: 'center',
                }}
              >
                <Loader2
                  size={30}
                  className="animate-spin"
                />

                <p
                  style={{
                    color: 'var(--muted)',
                  }}
                >
                  Loading complaint report...
                </p>
              </div>
            ) : reportError ? (
              <div
                style={{
                  padding: '16px',
                  border:
                    '1px solid #ecc7c2',
                  borderRadius: '12px',
                  color: '#a94435',
                  background: '#fff8f7',
                }}
              >
                {reportError}
              </div>
            ) : reportComplaint ? (
              <div className="admin-report-content">
                <div
                  style={{
                    display: 'flex',
                    gap: '8px',
                    flexWrap: 'wrap',
                    alignItems: 'center',
                  }}
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
                  style={{
                    display: 'grid',
                    gap: '6px',
                  }}
                >
                  <p className="civic-eyebrow">
                    Complaint
                  </p>

                  <h2 style={{ margin: 0 }}>
                    {reportComplaint.title ||
                      'Untitled complaint'}
                  </h2>

                  <p
                    style={{
                      margin: 0,
                      color: 'var(--muted)',
                      lineHeight: 1.6,
                    }}
                  >
                    {reportComplaint.description ||
                      'No description provided.'}
                  </p>
                </section>

                <div
                  style={{
                    display: 'grid',
                    gridTemplateColumns:
                      'repeat(auto-fit, minmax(180px, 1fr))',
                    gap: '10px',
                  }}
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
                      style={{
                        padding: '12px',
                        border:
                          '1px solid var(--line)',
                        borderRadius: '12px',
                      }}
                    >
                      <small
                        style={{
                          display: 'block',
                          color: 'var(--muted)',
                          marginBottom: '4px',
                        }}
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
                        style={{
                          margin: 0,
                        }}
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
                      style={{
                        margin: 0,
                        color: 'var(--muted)',
                      }}
                    >
                      Latitude:{' '}
                      {reportComplaint.latitude}
                      {' · '}
                      Longitude:{' '}
                      {reportComplaint.longitude}
                    </p>
                  ) : (
                    <p
                      style={{
                        margin: 0,
                        color: 'var(--muted)',
                      }}
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
                        style={{
                          margin: 0,
                        }}
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
                                  style={{
                                    width: '100%',
                                    height: '180px',
                                    objectFit:
                                      'cover',
                                    display:
                                      'block',
                                  }}
                                />
                              ) : (
                                <div
                                  style={{
                                    height:
                                      '180px',
                                    display:
                                      'grid',
                                    placeItems:
                                      'center',
                                    color:
                                      'var(--muted)',
                                  }}
                                >
                                  <ImageOff
                                    size={28}
                                  />
                                </div>
                              )}

                              <div
                                style={{
                                  padding:
                                    '0 10px 10px',
                                  display:
                                    'flex',
                                  alignItems:
                                    'center',
                                  justifyContent:
                                    'space-between',
                                  gap: '8px',
                                }}
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
                      style={{
                        color: 'var(--muted)',
                      }}
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

                      <h4 style={{ margin: 0 }}>
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
                        style={{
                          margin: 0,
                        }}
                      >
                        Complaint timeline
                      </h4>
                    </div>
                  </div>

                  {reportComplaint.status_history
                    ?.length ? (
                    <div
                      style={{
                        display: 'grid',
                        gap: '10px',
                      }}
                    >
                      {reportComplaint.status_history.map(
                        (item) => (
                          <div
                            key={item.id}
                            style={{
                              padding: '12px',
                              border:
                                '1px solid var(--line)',
                              borderRadius:
                                '12px',
                            }}
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
                              style={{
                                margin:
                                  '5px 0 0',
                                color:
                                  'var(--muted)',
                                fontSize:
                                  '13px',
                              }}
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
                                style={{
                                  color:
                                    'var(--muted)',
                                }}
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
                      style={{
                        color: 'var(--muted)',
                      }}
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
                        style={{
                          margin: 0,
                        }}
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
                    style={{
                      margin: 0,
                      color: 'var(--muted)',
                    }}
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
                  style={{
                    display: 'flex',
                    justifyContent:
                      'flex-end',
                    gap: '10px',
                    flexWrap: 'wrap',
                  }}
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
