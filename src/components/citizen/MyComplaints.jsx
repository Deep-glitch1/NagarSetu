import React, { useEffect, useState } from 'react';

import {
  MapPin,
  CalendarDays,
  Clock3,
  CheckCircle2,
  AlertCircle,
  Loader2,
  RefreshCw,
} from 'lucide-react';

import { apiFetch } from '../../api/client';
import ComplaintDetails from './ComplaintDetails';

import {
  getCategoryIcon,
  getCategoryLabel,
} from '../../constants/categories';

import { STATUS_META } from '../../constants/statuses';

import {
  formatDate,
  getPhotoUrl,
} from '../../utils/format';
const MyComplaints = () => {
  const [complaints, setComplaints] = useState([]);

  const [loading, setLoading] = useState(true);

  const [error, setError] = useState('');

  const [selectedComplaintId, setSelectedComplaintId] =
    useState(null);


  const loadComplaints = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(
        '/citizen/complaints'
      );

      setComplaints(
        data?.complaints || []
      );
    } catch (err) {
      setError(
        err?.message ||
          'Unable to load your complaints.'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadComplaints();
  }, []);


  /* ========================================================
     COMPLAINT DETAILS
  ======================================================== */

  if (selectedComplaintId) {
    return (
      <ComplaintDetails
        complaintId={selectedComplaintId}
        onBack={() =>
          setSelectedComplaintId(null)
        }
      />
    );
  }


  /* ========================================================
     LOADING
  ======================================================== */

  if (loading) {
    return (
      <div
        className="civic-dashboard"
        style={{
          display: 'flex',
          justifyContent: 'center',
          alignItems: 'center',
          minHeight: '420px',
        }}
      >
        <div
          style={{
            display: 'flex',
            alignItems: 'center',
            gap: '10px',
            color: '#64748b',
          }}
        >
          <Loader2
            size={20}
            className="animate-spin"
          />

          <span>
            Loading your complaints...
          </span>
        </div>
      </div>
    );
  }


  /* ========================================================
     ERROR
  ======================================================== */

  if (error) {
    return (
      <div
        className="civic-dashboard"
        style={{
          maxWidth: '900px',
          margin: '0 auto',
        }}
      >
        <section
          className="civic-panel"
          style={{
            padding: '40px 32px',
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

          <h3
            style={{
              marginBottom: '8px',
            }}
          >
            Could not load complaints
          </h3>

          <p
            style={{
              color: '#64748b',
              marginBottom: '20px',
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={loadComplaints}
            style={{
              border:
                '1px solid #d7dee8',
              background: '#fff',
              borderRadius: '10px',
              padding: '10px 16px',
              cursor: 'pointer',
              display: 'inline-flex',
              alignItems: 'center',
              gap: '8px',
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


  /* ========================================================
     MAIN
  ======================================================== */

  return (
    <div className="civic-dashboard">

      {/* HEADER */}

      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">
            Your reports
          </p>

          <h2>
            My complaints
          </h2>

          <p>
            Track the civic issues you have
            reported through NagarSetu.
          </p>
        </div>

        <button
          type="button"
          onClick={loadComplaints}
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          <RefreshCw size={16} />

          Refresh
        </button>
      </section>


      {/* COMPLAINT LIST */}

      <section
        style={{
          marginTop: '24px',
          display: 'flex',
          flexDirection: 'column',
          gap: '14px',
        }}
      >

        {/* NO COMPLAINTS */}

        {complaints.length === 0 ? (
          <section
            className="civic-panel"
            style={{
              padding: '48px 28px',
              textAlign: 'center',
            }}
          >
            <MapPin
              size={42}
              style={{
                color: '#8a94a6',
                marginBottom: '14px',
              }}
            />

            <h3
              style={{
                marginBottom: '8px',
              }}
            >
              No complaints yet
            </h3>

            <p
              style={{
                color: '#64748b',
              }}
            >
              Your submitted reports will
              appear here.
            </p>
          </section>
        ) : (

          complaints.map((complaint) => {

            const status =
              STATUS_META[
                complaint.status
              ] ||
              STATUS_META.received;

            const StatusIcon =
              status.icon;

            const CategoryIcon =
              getCategoryIcon(
                complaint.category
              );

            const photoUrl =
              getPhotoUrl(
                complaint.photo_url
              );


            return (
              <article
                key={complaint.id}
                className="civic-panel"
                onClick={() =>
                  setSelectedComplaintId(
                    complaint.id
                  )
                }
                style={{
                  padding: '18px',
                  display: 'flex',
                  gap: '18px',
                  alignItems: 'stretch',
                  cursor: 'pointer',
                }}
              >

                {/* =================================================
                    PHOTO / CATEGORY ICON
                ================================================== */}

                <div
                  style={{
                    position: 'relative',
                    width: '150px',
                    height: '120px',
                    flexShrink: 0,
                  }}
                >

                  {photoUrl ? (

                    <img
                      src={photoUrl}
                      alt={
                        complaint.title
                      }
                      style={{
                        width: '100%',
                        height: '100%',
                        objectFit: 'cover',
                        borderRadius:
                          '12px',
                        display: 'block',
                        background:
                          '#eef1f5',
                      }}
                    />

                  ) : (

                    <div
                      style={{
                        width: '100%',
                        height: '100%',
                        borderRadius:
                          '12px',
                        background:
                          '#f2f4f7',
                        display: 'flex',
                        alignItems:
                          'center',
                        justifyContent:
                          'center',
                        color: '#98a2b3',
                      }}
                    >
                      <CategoryIcon
                        size={38}
                      />
                    </div>

                  )}


                  {/* CATEGORY ICON BADGE */}

                  <span
                    style={{
                      position:
                        'absolute',
                      top: '8px',
                      left: '8px',
                      width: '34px',
                      height: '34px',
                      borderRadius: '9px',
                      background:
                        'rgba(255,255,255,0.94)',
                      display: 'flex',
                      alignItems:
                        'center',
                      justifyContent:
                        'center',
                      boxShadow:
                        '0 2px 8px rgba(0,0,0,0.10)',
                    }}
                  >
                    <CategoryIcon
                      size={18}
                    />
                  </span>

                </div>


                {/* =================================================
                    COMPLAINT CONTENT
                ================================================== */}

                <div
                  style={{
                    flex: 1,
                    minWidth: 0,
                  }}
                >

                  {/* TITLE + STATUS */}

                  <div
                    style={{
                      display: 'flex',
                      justifyContent:
                        'space-between',
                      gap: '16px',
                      alignItems:
                        'flex-start',
                    }}
                  >

                    <div
                      style={{
                        minWidth: 0,
                      }}
                    >

                      <p
                        className="civic-eyebrow"
                        style={{
                          marginBottom:
                            '4px',
                        }}
                      >
                        {
                          complaint.complaint_number
                        }
                      </p>

                      <h3
                        style={{
                          margin: 0,
                          fontSize: '18px',
                        }}
                      >
                        {
                          complaint.title
                        }
                      </h3>

                    </div>


                    {/* STATUS BADGE */}

                    <span
                      style={{
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                        gap: '6px',
                        padding:
                          '7px 10px',
                        borderRadius:
                          '999px',
                        background:
                          status.bg,
                        color:
                          status.color,
                        fontSize:
                          '13px',
                        fontWeight: 700,
                        whiteSpace:
                          'nowrap',
                        flexShrink: 0,
                      }}
                    >
                      <StatusIcon
                        size={14}
                      />

                      {
                        status.label
                      }
                    </span>

                  </div>


                  {/* META */}

                  <div
                    style={{
                      display: 'flex',
                      flexWrap:
                        'wrap',
                      gap: '18px',
                      marginTop:
                        '14px',
                      color: '#667085',
                      fontSize:
                        '14px',
                    }}
                  >

                    {/* CATEGORY */}

                    <span
                      style={{
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                        gap: '6px',
                      }}
                    >
                      <CategoryIcon
                        size={15}
                      />
                    {getCategoryLabel(complaint.category)}
                    </span>


                    {/* DATE */}

                    <span
                      style={{
                        display:
                          'inline-flex',
                        alignItems:
                          'center',
                        gap: '6px',
                      }}
                    >
                      <CalendarDays
                        size={15}
                      />

                      {formatDate(
                        complaint.created_at
                      )}
                    </span>


                    {/* PRIORITY */}

                    <span>
                      Priority:{' '}
                      {
                        complaint.priority
                      }
                    </span>

                  </div>


                  {/* DESCRIPTION */}

                  {complaint.description && (
                    <p
                      style={{
                        margin:
                          '12px 0 0',
                        color:
                          '#667085',
                        lineHeight: 1.5,
                      }}
                    >
                      {
                        complaint.description
                      }
                    </p>
                  )}

                </div>

              </article>
            );
          })
        )}

      </section>

    </div>
  );
};


export default MyComplaints;