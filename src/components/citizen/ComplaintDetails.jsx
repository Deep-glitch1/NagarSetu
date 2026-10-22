import React, { useEffect, useState } from 'react';
import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  AlertCircle,
  Star,
  Send,
} from 'lucide-react';
import { apiFetch } from '../../api/client';
import { getCategoryMeta } from '../../constants/categories';
import { STATUS_META } from '../../constants/statuses';
import {
  formatDate,
  formatDateTime,
  getPhotoUrl,
} from '../../utils/format';
const ComplaintDetails = ({
  complaintId,
  onBack,
}) => {
  const [complaint, setComplaint] =
    useState(null);
  const [history, setHistory] =
    useState([]);
  const [loading, setLoading] =
    useState(true);
  const [error, setError] =
    useState('');

  const [responseChoice, setResponseChoice] =
    useState('');

  const [responseRating, setResponseRating] =
    useState(0);

  const [responseReview, setResponseReview] =
    useState('');

  const [responseSubmitting, setResponseSubmitting] =
    useState(false);

  const [responseError, setResponseError] =
    useState('');

  const [responseSuccess, setResponseSuccess] =
    useState('');
  const loadComplaint = async () => {
    setLoading(true);
    setError('');
    setResponseError('');
    setResponseSuccess('');
    try {
      const data = await apiFetch(
        `/citizen/complaints/${complaintId}`
      );
      setComplaint(
        data?.complaint || null
      );
      setHistory(
        data?.status_history || []
      );
    } catch (err) {
      setError(
        err?.message ||
          'Unable to load complaint details.'
      );
    } finally {
      setLoading(false);
    }
  };
  const handleSubmitResponse = async () => {
    if (!responseChoice) {
      setResponseError(
        'Please choose whether you are satisfied or want to reopen the complaint.'
      );
      return;
    }

    setResponseSubmitting(true);
    setResponseError('');
    setResponseSuccess('');

    try {
      const data = await apiFetch(
        `/citizen/complaints/${complaintId}/response`,
        {
          method: 'POST',
          body: JSON.stringify({
            response: responseChoice,
            rating:
              responseRating > 0
                ? responseRating
                : null,
            review:
              responseReview.trim() || null,
          }),
        }
      );

      setResponseSuccess(
        data?.message ||
          'Your response was submitted successfully.'
      );

      setResponseChoice('');
      setResponseRating(0);
      setResponseReview('');

      await loadComplaint();
    } catch (err) {
      setResponseError(
        err?.message ||
          'Unable to submit your response.'
      );
    } finally {
      setResponseSubmitting(false);
    }
  };

  useEffect(() => {
    loadComplaint();
  }, [complaintId]);
  if (loading) {
    return (
      <div
        className="civic-dashboard"
        style={{
          minHeight: '420px',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#667085',
          }}
        >
          <Loader2
            size={20}
            className="animate-spin"
          />
          Loading complaint...
        </div>
      </div>
    );
  }
  if (error || !complaint) {
    return (
      <div className="civic-dashboard">
        <section
          className="civic-panel"
          style={{
            padding: '40px',
            textAlign: 'center',
          }}
        >
          <AlertCircle
            size={38}
            style={{
              color: '#b94a48',
              marginBottom: '14px',
            }}
          />
          <h3>
            Could not load complaint
          </h3>
          <p
            style={{
              color: '#667085',
              margin: '10px 0 20px',
            }}
          >
            {error ||
              'Complaint details not found.'}
          </p>
          <button
            type="button"
            onClick={loadComplaint}
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 16px',
              borderRadius: '10px',
              border:
                '1px solid #d7dee8',
              background: '#fff',
              cursor: 'pointer',
              fontWeight: 600,
            }}
          >
            <RefreshCw size={16} />
            Try again
          </button>
        </section>
      </div>
    );
  }
  const categoryMeta = getCategoryMeta(complaint.category);
  const CategoryIcon =categoryMeta.icon;
  const currentStatus =
    STATUS_META[
      complaint.status
    ] || STATUS_META.received;
  const StatusIcon =
    currentStatus.icon;
  const initialPhoto =
    complaint.photos?.find(
      (photo) =>
        photo.photo_type === 'initial'
    ) || complaint.photos?.[0];
  const photoUrl =
    getPhotoUrl(
      initialPhoto?.photo_url
    );
  const mapsUrl =
    `https://www.google.com/maps?q=${complaint.latitude},${complaint.longitude}`;
  return (
    <div className="civic-dashboard">
      {/* =====================================================
          BACK
      ===================================================== */}
      <button
        type="button"
        onClick={onBack}
        style={{
          display: 'inline-flex',
          alignItems: 'center',
          gap: '8px',
          border: 'none',
          background: 'transparent',
          padding: '4px 0',
          marginBottom: '18px',
          color: '#315c9d',
          fontWeight: 700,
          cursor: 'pointer',
          fontSize: '14px',
        }}
      >
        <ArrowLeft size={17} />
        Back to My complaints
      </button>
      {/* =====================================================
          HEADER
      ===================================================== */}
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">
            Complaint details
          </p>
          <h2>
            {complaint.title}
          </h2>
          <p>
            {complaint.complaint_number}
          </p>
        </div>
        <span
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '7px',
            padding: '9px 13px',
            borderRadius: '999px',
            background:
              currentStatus.bg,
            color:
              currentStatus.color,
            fontSize: '14px',
            fontWeight: 700,
            whiteSpace: 'nowrap',
          }}
        >
          <StatusIcon size={16} />
          {currentStatus.label}
        </span>
      </section>
      {/* =====================================================
          PHOTO + BASIC INFO
      ===================================================== */}
      <section
        className="civic-content-grid"
        style={{
          marginTop: '24px',
        }}
      >
        {/* PHOTO */}
        <article className="civic-panel">
          {photoUrl ? (
            <img
              src={photoUrl}
              alt={complaint.title}
              style={{
                width: '100%',
                maxHeight: '380px',
                objectFit: 'cover',
                borderRadius: '12px',
                display: 'block',
              }}
            />
          ) : (
            <div
              style={{
                minHeight: '260px',
                borderRadius: '12px',
                background: '#f2f4f7',
                display: 'flex',
                alignItems: 'center',
                justifyContent: 'center',
                color: '#98a2b3',
              }}
            >
              <CategoryIcon size={54} />
            </div>
          )}
        </article>
        {/* SUMMARY */}
        <article
          className="civic-panel"
          style={{
            padding: '24px',
          }}
        >
          <p className="civic-eyebrow">
            Report summary
          </p>
          <h3
            style={{
              marginBottom: '20px',
            }}
          >
            Complaint information
          </h3>
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
              gap: '17px',
            }}
          >
            <InfoRow
              icon={<CategoryIcon size={17} />}
              label="Category"
              value={
                complaint.category_name ||
                categoryMeta.label
              }
            />
            <InfoRow
              icon={<StatusIcon size={17} />}
              label="Status"
              value={
                currentStatus.label
              }
            />
            <InfoRow
              icon={<Clock3 size={17} />}
              label="Priority"
              value={
                complaint.priority
              }
            />
            <InfoRow
              icon={<CalendarDays size={17} />}
              label="Reported"
              value={
                formatDate(
                  complaint.created_at
                )
              }
            />
          </div>
        </article>
      </section>
      {/* =====================================================
          DESCRIPTION
      ===================================================== */}
      {complaint.description && (
        <section
          className="civic-panel"
          style={{
            marginTop: '16px',
            padding: '24px',
          }}
        >
          <p className="civic-eyebrow">
            Description
          </p>
          <p
            style={{
              margin: 0,
              color: '#475467',
              lineHeight: 1.7,
            }}
          >
            {complaint.description}
          </p>
        </section>
      )}
      {/* =====================================================
          LOCATION
      ===================================================== */}
      <section
        className="civic-panel"
        style={{
          marginTop: '16px',
          padding: '24px',
        }}
      >
        <div
          style={{
            display: 'flex',
            justifyContent:
              'space-between',
            alignItems: 'center',
            gap: '16px',
          }}
        >
          <div>
            <p className="civic-eyebrow">
              Reported location
            </p>
            <h3>
              GPS location
            </h3>
            <p
              style={{
                marginTop: '8px',
                color: '#667085',
              }}
            >
              {complaint.latitude},{' '}
              {complaint.longitude}
            </p>
          </div>
          <a
            href={mapsUrl}
            target="_blank"
            rel="noreferrer"
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              padding: '10px 15px',
              borderRadius: '10px',
              background: '#f5f8fc',
              color: '#315c9d',
              textDecoration: 'none',
              fontWeight: 700,
              fontSize: '14px',
            }}
          >
            <MapPin size={16} />
            Open in Maps
            <ExternalLink size={14} />
          </a>
        </div>
      </section>
      {/* =====================================================
          CITIZEN RESPONSE
      ===================================================== */}
      {[
        'verified',
        'pending_citizen_response',
      ].includes(complaint.status) && (
        <section
          className="civic-panel"
          style={{
            marginTop: '16px',
            padding: '24px',
          }}
        >
          <p className="civic-eyebrow">
            Resolution feedback
          </p>

          <h3
            style={{
              marginBottom: '8px',
            }}
          >
            How was the resolution?
          </h3>

          <p
            style={{
              marginTop: 0,
              color: '#667085',
              lineHeight: 1.6,
            }}
          >
            Confirm whether the issue was resolved
            satisfactorily, or reopen the complaint if
            the problem still exists.
          </p>

          {responseError && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                marginTop: '16px',
                background: '#fbeae5',
                color: '#a43f2d',
                fontSize: '14px',
              }}
            >
              {responseError}
            </div>
          )}

          {responseSuccess && (
            <div
              style={{
                padding: '12px 14px',
                borderRadius: '10px',
                marginTop: '16px',
                background: '#e6f4eb',
                color: '#397255',
                fontSize: '14px',
              }}
            >
              {responseSuccess}
            </div>
          )}

          <div
            style={{
              display: 'grid',
              gridTemplateColumns:
                'repeat(2, minmax(0, 1fr))',
              gap: '12px',
              marginTop: '20px',
            }}
          >
            <button
              type="button"
              onClick={() =>
                setResponseChoice('satisfied')
              }
              disabled={responseSubmitting}
              style={{
                padding: '15px 16px',
                borderRadius: '12px',
                border:
                  responseChoice === 'satisfied'
                    ? '2px solid #397255'
                    : '1px solid #d7dee8',
                background:
                  responseChoice === 'satisfied'
                    ? '#eef8f1'
                    : '#fff',
                cursor: responseSubmitting
                  ? 'not-allowed'
                  : 'pointer',
                textAlign: 'left',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Resolution is satisfactory
              </strong>
              <span
                style={{
                  color: '#667085',
                  fontSize: '13px',
                }}
              >
                The issue has been fixed.
              </span>
            </button>

            <button
              type="button"
              onClick={() =>
                setResponseChoice('reopen')
              }
              disabled={responseSubmitting}
              style={{
                padding: '15px 16px',
                borderRadius: '12px',
                border:
                  responseChoice === 'reopen'
                    ? '2px solid #b94a48'
                    : '1px solid #d7dee8',
                background:
                  responseChoice === 'reopen'
                    ? '#fdf0ee'
                    : '#fff',
                cursor: responseSubmitting
                  ? 'not-allowed'
                  : 'pointer',
                textAlign: 'left',
              }}
            >
              <strong
                style={{
                  display: 'block',
                  marginBottom: '4px',
                }}
              >
                Reopen complaint
              </strong>
              <span
                style={{
                  color: '#667085',
                  fontSize: '13px',
                }}
              >
                The issue is not fully resolved.
              </span>
            </button>
          </div>

          {responseChoice === 'satisfied' && (
            <div
              style={{
                marginTop: '20px',
              }}
            >
              <label
                style={{
                  display: 'block',
                  fontWeight: 700,
                  marginBottom: '9px',
                }}
              >
                Rating
              </label>

              <div
                style={{
                  display: 'flex',
                  gap: '6px',
                  alignItems: 'center',
                }}
              >
                {[1, 2, 3, 4, 5].map(
                  (value) => (
                    <button
                      type="button"
                      key={value}
                      onClick={() =>
                        setResponseRating(value)
                      }
                      disabled={
                        responseSubmitting
                      }
                      aria-label={`Rate ${value} out of 5`}
                      style={{
                        border: 'none',
                        background:
                          'transparent',
                        padding: '2px',
                        cursor:
                          responseSubmitting
                            ? 'not-allowed'
                            : 'pointer',
                        color:
                          value <= responseRating
                            ? '#d9a441'
                            : '#c8ced8',
                      }}
                    >
                      <Star
                        size={28}
                        fill={
                          value <= responseRating
                            ? 'currentColor'
                            : 'none'
                        }
                      />
                    </button>
                  )
                )}
              </div>
            </div>
          )}

          <div
            style={{
              marginTop: '20px',
            }}
          >
            <label
              style={{
                display: 'block',
                fontWeight: 700,
                marginBottom: '9px',
              }}
            >
              Review
            </label>

            <textarea
              value={responseReview}
              onChange={(event) =>
                setResponseReview(
                  event.target.value
                )
              }
              disabled={responseSubmitting}
              placeholder={
                responseChoice === 'reopen'
                  ? 'Tell us what is still unresolved...'
                  : 'Share your feedback...'
              }
              rows={4}
              style={{
                width: '100%',
                resize: 'vertical',
              }}
            />
          </div>

          <button
            type="button"
            onClick={handleSubmitResponse}
            disabled={
              responseSubmitting ||
              !responseChoice
            }
            style={{
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
              marginTop: '18px',
              padding: '11px 16px',
              borderRadius: '10px',
              border: 'none',
              cursor:
                responseSubmitting ||
                !responseChoice
                  ? 'not-allowed'
                  : 'pointer',
              fontWeight: 700,
            }}
          >
            {responseSubmitting ? (
              <Loader2
                size={16}
                className="animate-spin"
              />
            ) : (
              <Send size={16} />
            )}

            {responseSubmitting
              ? 'Submitting...'
              : 'Submit response'}
          </button>
        </section>
      )}

      {/* =====================================================
          STATUS HISTORY
      ===================================================== */}
      <section
        className="civic-panel"
        style={{
          marginTop: '16px',
          padding: '24px',
        }}
      >
        <p className="civic-eyebrow">
          Progress
        </p>
        <h3
          style={{
            marginBottom: '24px',
          }}
        >
          Status history
        </h3>
        {history.length === 0 ? (
          <p
            style={{
              color: '#667085',
            }}
          >
            No status updates recorded yet.
          </p>
        ) : (
          <div
            style={{
              display: 'flex',
              flexDirection: 'column',
            }}
          >
            {history.map(
              (item, index) => {
                const isLast =
                  index ===
                  history.length - 1;
                const status =
                  STATUS_META[
                    item.new_status
                  ] ||
                  STATUS_META.received;
                const HistoryIcon =
                  status.icon;
                return (
                  <div
                    key={item.id}
                    style={{
                      display: 'flex',
                      gap: '15px',
                    }}
                  >
                    {/* TIMELINE */}
                    <div
                      style={{
                        display: 'flex',
                        flexDirection:
                          'column',
                        alignItems:
                          'center',
                        width: '28px',
                        flexShrink: 0,
                      }}
                    >
                      <span
                        style={{
                          width: '30px',
                          height: '30px',
                          borderRadius:
                            '50%',
                          display: 'flex',
                          alignItems:
                            'center',
                          justifyContent:
                            'center',
                          background:
                            status.bg,
                          color:
                            status.color,
                        }}
                      >
                        <HistoryIcon
                          size={15}
                        />
                      </span>
                      {!isLast && (
                        <span
                          style={{
                            width: '2px',
                            flex: 1,
                            minHeight:
                              '44px',
                            background:
                              '#e4e7ec',
                            margin:
                              '5px 0',
                          }}
                        />
                      )}
                    </div>
                    {/* EVENT */}
                    <div
                      style={{
                        paddingBottom:
                          isLast
                            ? '0'
                            : '24px',
                        flex: 1,
                      }}
                    >
                      <div
                        style={{
                          display:
                            'flex',
                          justifyContent:
                            'space-between',
                          gap: '12px',
                          alignItems:
                            'flex-start',
                        }}
                      >
                        <strong>
                          {
                            STATUS_META[status]?.label  ||
                            item.new_status
                          }
                        </strong>
                        <small
                          style={{
                            color:
                              '#98a2b3',
                            whiteSpace:
                              'nowrap',
                          }}
                        >
                          {formatDateTime(
                            item.changed_at
                          )}
                        </small>
                      </div>
                      {item.old_status && (
                        <p
                          style={{
                            margin:
                              '5px 0 0',
                            color:
                              '#667085',
                            fontSize:
                              '13px',
                          }}
                        >
                          From{' '}
                          {
                            STATUS_META[
                              item.old_status
                            ]?.label ||
                            item.old_status
                          }
                        </p>
                      )}
                      {item.remarks && (
                        <p
                          style={{
                            margin:
                              '7px 0 0',
                            color:
                              '#667085',
                            lineHeight:
                              1.5,
                          }}
                        >
                          {item.remarks}
                        </p>
                      )}
                    </div>
                  </div>
                );
              }
            )}
          </div>
        )}
      </section>
    </div>
  );
};
const InfoRow = ({
  icon,
  label,
  value,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        gap: '12px',
      }}
    >
      <span
        style={{
          width: '34px',
          height: '34px',
          borderRadius: '9px',
          background: '#f3f6fa',
          color: '#315c9d',
          display: 'flex',
          alignItems: 'center',
          justifyContent: 'center',
          flexShrink: 0,
        }}
      >
        {icon}
      </span>
      <div>
        <small
          style={{
            display: 'block',
            color: '#98a2b3',
            marginBottom: '2px',
          }}
        >
          {label}
        </small>
        <strong>
          {value}
        </strong>
      </div>
    </div>
  );
};
export default ComplaintDetails;
