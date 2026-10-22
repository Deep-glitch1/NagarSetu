import React, { useEffect, useState } from 'react';

import {
  Award,
  CheckCircle2,
  Clock3,
  Construction,
  Loader2,
  RefreshCw,
  Trash2,
  XCircle,
  BarChart3,
} from 'lucide-react';

import { apiFetch } from '../../api/client';


const MyImpact = () => {
  const [impact, setImpact] = useState(null);

  const [loading, setLoading] =
    useState(true);

  const [error, setError] =
    useState('');


  const loadImpact = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(
        '/citizen/complaints/impact'
      );

      setImpact(data);
    } catch (err) {
      setError(
        err?.message ||
          'Unable to load your impact.'
      );
    } finally {
      setLoading(false);
    }
  };


  useEffect(() => {
    loadImpact();
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
           className="animate-spin"
          />

          Loading your impact...
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
          <XCircle
            size={38}
            style={{
              color: '#b94a48',
              marginBottom: '14px',
            }}
          />

          <h3>
            Could not load your impact
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
            onClick={loadImpact}
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


  const stats =
    impact?.stats || {};

  const categories =
    impact?.categories || {};


  const trustScore =
    impact?.trust_score;


  return (
    <div className="civic-dashboard">

      {/* ====================================================
          HEADER
      ===================================================== */}

      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">
            Community contribution
          </p>

          <h2>
            My impact
          </h2>

          <p>
            See how your reports are
            contributing to your community.
          </p>
        </div>

        <button
          type="button"
          onClick={loadImpact}
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


      {/* ====================================================
          TRUST SCORE
      ===================================================== */}

      <section
        className="civic-panel"
        style={{
          marginTop: '24px',
          padding: '30px',
          display: 'flex',
          alignItems: 'center',
          gap: '24px',
        }}
      >

        <div
          style={{
            width: '72px',
            height: '72px',
            borderRadius: '18px',
            background: '#eef4ff',
            color: '#315c9d',
            display: 'flex',
            alignItems: 'center',
            justifyContent: 'center',
            flexShrink: 0,
          }}
        >
          <Award size={34} />
        </div>


        <div>
          <p
            className="civic-eyebrow"
            style={{
              marginBottom: '3px',
            }}
          >
            Trust score
          </p>

          <div
            style={{
              display: 'flex',
              alignItems: 'baseline',
              gap: '5px',
            }}
          >
            <strong
              style={{
                fontSize: '42px',
                lineHeight: 1,
              }}
            >
              {trustScore !== null &&
              trustScore !== undefined
                ? trustScore
                : '—'}
            </strong>

            {trustScore !== null &&
              trustScore !== undefined && (
                <span
                  style={{
                    fontSize: '18px',
                    color: '#667085',
                    fontWeight: 600,
                  }}
                >
                  / 100
                </span>
              )}
          </div>

          <p
            style={{
              margin:
                '8px 0 0',
              color: '#667085',
            }}
          >
            Your current NagarSetu
            reputation score.
          </p>
        </div>

      </section>


      {/* ====================================================
          STATS
      ===================================================== */}

      <section
        className="civic-stat-grid civic-stat-grid-three"
        style={{
          marginTop: '20px',
        }}
      >

        <ImpactStat
          icon={<BarChart3 size={20} />}
          label="Reports submitted"
          value={
            stats.total_reports ?? 0
          }
          tint="#e8f0fd"
          accent="#315c9d"
        />

        <ImpactStat
          icon={<CheckCircle2 size={20} />}
          label="Closed"
          value={
            stats.closed_reports ?? 0
          }
          tint="#e6f4eb"
          accent="#397255"
        />

        <ImpactStat
          icon={<Clock3 size={20} />}
          label="Active"
          value={
            stats.active_reports ?? 0
          }
          tint="#fff0dc"
          accent="#b86d20"
        />

      </section>


      {/* ====================================================
          REPORT BREAKDOWN
      ===================================================== */}

      <section
        className="civic-content-grid"
        style={{
          marginTop: '20px',
        }}
      >

        {/* CATEGORY BREAKDOWN */}

        <article
          className="civic-panel"
          style={{
            padding: '24px',
          }}
        >
          <p className="civic-eyebrow">
            Your reporting
          </p>

          <h3>
            Issue breakdown
          </h3>


          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '16px',
              marginTop: '22px',
            }}
          >

            <CategoryRow
              icon={
                <Construction size={18} />
              }
              label="Road damaged"
              value={
                categories.road_damaged ??
                0
              }
            />

            <CategoryRow
              icon={
                <Trash2 size={18} />
              }
              label="Garbage"
              value={
                categories.garbage ??
                0
              }
            />

          </div>
        </article>


        {/* STATUS SUMMARY */}

        <article
          className="civic-panel"
          style={{
            padding: '24px',
          }}
        >
          <p className="civic-eyebrow">
            Report outcomes
          </p>

          <h3>
            Complaint status
          </h3>


          <div
            style={{
              display: 'flex',
              flexDirection:
                'column',
              gap: '14px',
              marginTop: '22px',
            }}
          >

            <SummaryRow
              label="Verified"
              value={
                stats.verified_reports ??
                0
              }
            />

            <SummaryRow
              label="Closed"
              value={
                stats.closed_reports ??
                0
              }
            />

            <SummaryRow
              label="Rejected"
              value={
                stats.rejected_reports ??
                0
              }
              danger
            />

          </div>
        </article>

      </section>

    </div>
  );
};


/* ============================================================
   IMPACT STAT
============================================================ */

const ImpactStat = ({
  icon,
  label,
  value,
  tint,
  accent,
}) => {
  return (
    <article className="civic-stat">

      <span
        style={{
          backgroundColor:
            tint,
          color: accent,
        }}
      >
        {icon}
      </span>

      <div>
        <small>
          {label}
        </small>

        <strong>
          {value}
        </strong>
      </div>

    </article>
  );
};


/* ============================================================
   CATEGORY ROW
============================================================ */

const CategoryRow = ({
  icon,
  label,
  value,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          'space-between',
        gap: '12px',
        padding:
          '12px 0',
        borderBottom:
          '1px solid #edf0f4',
      }}
    >

      <div
        style={{
          display: 'flex',
          alignItems:
            'center',
          gap: '10px',
          color: '#475467',
        }}
      >
        <span
          style={{
            width: '34px',
            height: '34px',
            borderRadius: '9px',
            background:
              '#f3f6fa',
            color: '#315c9d',
            display: 'flex',
            alignItems:
              'center',
            justifyContent:
              'center',
          }}
        >
          {icon}
        </span>

        <span>
          {label}
        </span>
      </div>

      <strong>
        {value}
      </strong>

    </div>
  );
};


/* ============================================================
   SUMMARY ROW
============================================================ */

const SummaryRow = ({
  label,
  value,
  danger = false,
}) => {
  return (
    <div
      style={{
        display: 'flex',
        alignItems: 'center',
        justifyContent:
          'space-between',
        padding:
          '10px 0',
        borderBottom:
          '1px solid #edf0f4',
      }}
    >
      <span
        style={{
          color: danger
            ? '#b94a48'
            : '#475467',
        }}
      >
        {label}
      </span>

      <strong
        style={{
          color: danger
            ? '#b94a48'
            : '#101828',
        }}
      >
        {value}
      </strong>
    </div>
  );
};


export default MyImpact;