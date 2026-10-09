import React, { useEffect, useState } from 'react';

import {
  ArrowLeft,
  CalendarDays,
  CheckCircle2,
  Clock3,
  Construction,
  ExternalLink,
  Loader2,
  MapPin,
  RefreshCw,
  Trash2,
  AlertCircle,
} from 'lucide-react';

import { apiFetch } from '../../api/client';
import { API_BASE_URL } from '../../config';


const CATEGORY_META = {
  ROAD_DAMAGED: {
    label: 'Road Damaged',
    icon: Construction,
  },

  GARBAGE: {
    label: 'Garbage',
    icon: Trash2,
  },
};


const STATUS_META = {
  received: {
    label: 'Received',
    icon: Clock3,
    bg: '#eef4ff',
    color: '#315c9d',
  },

  assigned: {
    label: 'Assigned',
    icon: CheckCircle2,
    bg: '#eef7f1',
    color: '#397255',
  },

  in_progress: {
    label: 'In progress',
    icon: Clock3,
    bg: '#fff4e5',
    color: '#b86d20',
  },

  pending_verification: {
    label: 'Pending verification',
    icon: Clock3,
    bg: '#f4f0ff',
    color: '#7654a6',
  },

  pending_citizen_response: {
    label: 'Action required',
    icon: AlertCircle,
    bg: '#fff4e5',
    color: '#b86d20',
  },

  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    bg: '#eaf7ef',
    color: '#397255',
  },

  closed: {
    label: 'Closed',
    icon: CheckCircle2,
    bg: '#eaf7ef',
    color: '#397255',
  },

  reopened: {
    label: 'Reopened',
    icon: RefreshCw,
    bg: '#fff0f0',
    color: '#b94a48',
  },

  rejected: {
    label: 'Rejected',
    icon: AlertCircle,
    bg: '#fff0f0',
    color: '#b94a48',
  },
};


const STATUS_LABELS = {
  received: 'Received',
  assigned: 'Assigned',
  in_progress: 'In progress',
  pending_verification: 'Pending verification',
  pending_citizen_response: 'Action required',
  verified: 'Verified',
  closed: 'Closed',
  reopened: 'Reopened',
  rejected: 'Rejected',
};


const formatDate = (value) => {
  if (!value) return '—';

  return new Date(value).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
};


const formatDateTime = (value) => {
  if (!value) return '—';

  return new Date(value).toLocaleString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
      hour: 'numeric',
      minute: '2-digit',
    }
  );
};


const getPhotoUrl = (photoUrl) => {
  if (!photoUrl) return null;

  if (
    photoUrl.startsWith('http://') ||
    photoUrl.startsWith('https://')
  ) {
    return photoUrl;
  }

  return `${API_BASE_URL}${photoUrl}`;
};


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


  const loadComplaint = async () => {
    setLoading(true);
    setError('');

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
            style={{
              animation:
                'spin 1s linear infinite',
            }}
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


  const categoryMeta =
    CATEGORY_META[
      complaint.category
    ] || {
      label: complaint.category,
      icon: MapPin,
    };

  const CategoryIcon =
    categoryMeta.icon;

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
                            STATUS_LABELS[
                              item.new_status
                            ] ||
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
                            STATUS_LABELS[
                              item.old_status
                            ] ||
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