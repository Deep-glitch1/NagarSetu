import React, { useEffect, useState } from 'react';

import {
  MapPin,
  CheckCircle,
  Clock,
  ArrowUpRight,
  Camera,
  Loader2,
  RefreshCw,
  Construction,
  Trash2,
  AlertCircle,
} from 'lucide-react';

import { apiFetch } from '../../api/client';


const STATUS_META = {
  received: {
    label: 'Received',
    className: '',
  },

  assigned: {
    label: 'Assigned',
    className: 'is-waiting',
  },

  in_progress: {
    label: 'In progress',
    className: 'is-waiting',
  },

  pending_verification: {
    label: 'Pending verification',
    className: 'is-waiting',
  },

  pending_citizen_response: {
    label: 'Action required',
    className: 'is-waiting',
  },

  verified: {
    label: 'Verified',
    className: 'is-done',
  },

  closed: {
    label: 'Resolved',
    className: 'is-done',
  },

  reopened: {
    label: 'Reopened',
    className: 'is-waiting',
  },

  rejected: {
    label: 'Rejected',
    className: '',
  },
};


const getCategoryLabel = (category) => {
  if (category === 'ROAD_DAMAGED') {
    return 'Road Damaged';
  }

  if (category === 'GARBAGE') {
    return 'Garbage';
  }

  return category || 'Complaint';
};


const getCategoryIcon = (category) => {
  if (category === 'ROAD_DAMAGED') {
    return Construction;
  }

  if (category === 'GARBAGE') {
    return Trash2;
  }

  return MapPin;
};


const formatDate = (value) => {
  if (!value) {
    return '—';
  }

  return new Date(value).toLocaleDateString(
    'en-IN',
    {
      day: 'numeric',
      month: 'short',
      year: 'numeric',
    }
  );
};


const CitizenDashboard = ({
  userData,
  onNavigate,
}) => {
  const [impact, setImpact] = useState(null);

  const [complaints, setComplaints] =
    useState([]);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');


  const loadDashboard = async () => {
    setLoading(true);
    setError('');

    try {
      const [impactData, complaintsData] =
        await Promise.all([
          apiFetch(
            '/citizen/complaints/impact'
          ),

          apiFetch(
            '/citizen/complaints'
          ),
        ]);

      setImpact(impactData);

      setComplaints(
        complaintsData?.complaints || []
      );

    } catch (err) {
      setError(
        err?.message ||
          'Unable to load dashboard.'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadDashboard();
  }, []);


  /* ========================================================
     LOADING
  ======================================================== */

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

          Loading your dashboard...
        </div>
      </div>
    );
  }


  /* ========================================================
     ERROR
  ======================================================== */

  if (error) {
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
            Could not load dashboard
          </h3>

          <p
            style={{
              color: '#667085',
              margin:
                '10px 0 20px',
            }}
          >
            {error}
          </p>

          <button
            type="button"
            onClick={loadDashboard}
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


  const stats = impact?.stats || {};

  const trustScore =
    impact?.trust_score;

  const recentComplaints =
    complaints.slice(0, 3);


  const dashboardStats = [
    {
      label: 'Issues reported',
      value: stats.total_reports ?? 0,
      icon: MapPin,
      tint: '#e8f0fd',
      accent: '#315c9d',
    },

    {
      label: 'Resolved',
      value: stats.closed_reports ?? 0,
      icon: CheckCircle,
      tint: '#e6f4eb',
      accent: '#397255',
    },

    {
      label: 'In progress',
      value: stats.active_reports ?? 0,
      icon: Clock,
      tint: '#fff0dc',
      accent: '#b86d20',
    },
  ];


  return (
    <div className="civic-dashboard">

      {/* ====================================================
          WELCOME
      ===================================================== */}

      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">
            Your civic dashboard
          </p>

          <h2>
            Welcome back,{' '}
            {userData?.name || 'Citizen'}.
          </h2>

          <p>
            Small reports create meaningful
            improvements in your neighbourhood.
          </p>
        </div>

        <button
          type="button"
          onClick={() =>
            onNavigate('report')
          }
          style={{
            display: 'inline-flex',
            alignItems: 'center',
            gap: '8px',
          }}
        >
          Report an issue

          <Camera size={17} />
        </button>
      </section>


      {/* ====================================================
          STATS
      ===================================================== */}

      <section className="civic-stat-grid civic-stat-grid-three">

        {dashboardStats.map((stat) => {
          const Icon = stat.icon;

          return (
            <article
              className="civic-stat"
              key={stat.label}
            >
              <span
                style={{
                  backgroundColor:
                    stat.tint,
                  color:
                    stat.accent,
                }}
              >
                <Icon size={20} />
              </span>

              <div>
                <small>
                  {stat.label}
                </small>

                <strong>
                  {stat.value}
                </strong>
              </div>
            </article>
          );
        })}

      </section>


      {/* ====================================================
          RECENT REPORTS + TRUST SCORE
      ===================================================== */}

      <section className="civic-content-grid">

        {/* RECENT REPORTS */}

        <article className="civic-panel">

          <div className="civic-panel-title">

            <div>
              <p className="civic-eyebrow">
                Latest updates
              </p>

              <h3>
                Your recent reports
              </h3>
            </div>

            <button
              type="button"
              className="civic-link"
              onClick={() =>
                onNavigate('complaints')
              }
            >
              View all

              <ArrowUpRight
                size={15}
              />
            </button>

          </div>


          {recentComplaints.length === 0 ? (

            <div
              style={{
                padding:
                  '30px 0 10px',
                textAlign: 'center',
                color: '#667085',
              }}
            >
              <MapPin
                size={30}
                style={{
                  marginBottom:
                    '8px',
                }}
              />

              <p>
                No complaints reported yet.
              </p>
            </div>

          ) : (

            <ul
              className="civic-list civic-report-list"
            >

              {recentComplaints.map(
                (complaint) => {

                  const status =
                    STATUS_META[
                      complaint.status
                    ] ||
                    STATUS_META.received;

                  const CategoryIcon =
                    getCategoryIcon(
                      complaint.category
                    );

                  return (
                    <li
                      key={
                        complaint.id
                      }
                      style={{
                        cursor:
                          'pointer',
                      }}
                      onClick={() =>
                        onNavigate(
                          'complaints'
                        )
                      }
                    >

                      <span
                        style={{
                          display:
                            'flex',
                          alignItems:
                            'center',
                          gap: '10px',
                        }}
                      >

                        <span
                          style={{
                            width: '34px',
                            height: '34px',
                            borderRadius:
                              '9px',
                            background:
                              '#f3f6fa',
                            color:
                              '#315c9d',
                            display:
                              'flex',
                            alignItems:
                              'center',
                            justifyContent:
                              'center',
                            flexShrink: 0,
                          }}
                        >
                          <CategoryIcon
                            size={17}
                          />
                        </span>

                        <span>
                          <strong>
                            {
                              complaint.title
                            }
                          </strong>

                          <small>
                            {
                              complaint
                                .complaint_number
                            }
                            {' · '}
                            {
                              formatDate(
                                complaint.created_at
                              )
                            }
                          </small>
                        </span>

                      </span>


                      <b
                        className={
                          status.className
                        }
                      >
                        {
                          status.label
                        }
                      </b>

                    </li>
                  );
                }
              )}

            </ul>

          )}

        </article>


        {/* TRUST SCORE */}

        <article
          className="civic-panel civic-impact"
        >

          <p className="civic-eyebrow">
            Community contribution
          </p>

          <div
            className="civic-score"
          >
            {trustScore !== null &&
            trustScore !== undefined
              ? trustScore
              : '—'}

            {trustScore !== null &&
              trustScore !== undefined && (
                <span>
                  %
                </span>
              )}
          </div>

          <h3>
            Your trust score
          </h3>

          <p>
            Your score reflects your
            reporting history on NagarSetu.
          </p>

          <button
            type="button"
            className="civic-link"
            onClick={() =>
              onNavigate('achievements')
            }
          >
            See your impact

            <ArrowUpRight
              size={15}
            />
          </button>

        </article>

      </section>

    </div>
  );
};


export default CitizenDashboard;