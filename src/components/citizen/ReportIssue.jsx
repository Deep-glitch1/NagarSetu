import React, { useState } from 'react';
import {
  Construction,
  Trash2,
  ArrowRight,
} from 'lucide-react';
import ReportCamera from './ReportCamera';

const ReportIssue = () => {
  const [reportType, setReportType] = useState(null);

  if (reportType) {
    return (
      <ReportCamera
        reportType={reportType}
        onBack={() => setReportType(null)}
      />
    );
  }

  return (
    <div className="civic-dashboard">
      <div style={{ maxWidth: '1000px', width: '100%' }}>
        <p className="civic-eyebrow">
          NAGARSETU • CIVIC REPORTING
        </p>

        <h1
          style={{
            margin: '6px 0 8px',
            fontFamily: 'Fraunces, Georgia, serif',
            fontSize: '32px',
          }}
        >
          Report an issue
        </h1>

        <p
          style={{
            margin: 0,
            color: 'var(--muted)',
            fontSize: '14px',
          }}
        >
          Select the type of civic issue you want to
          report.
        </p>

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'repeat(auto-fit, minmax(300px, 1fr))',
            gap: '20px',
            marginTop: '28px',
          }}
        >
          <button
            type="button"
            onClick={() => setReportType('road')}
            style={cardStyle}
          >
            <div
              style={{
                ...iconStyle,
                color: '#a94d38',
                background: '#f9e9e4',
              }}
            >
              <Construction size={28} />
            </div>

            <div style={{ flex: 1 }}>
              <div style={labelStyle}>
                ROAD & INFRASTRUCTURE
              </div>

              <h3 style={titleStyle}>
                Report Road Issue
              </h3>

              <p style={descriptionStyle}>
                Report potholes, damaged roads and
                other road-related problems.
              </p>

              <span style={actionStyle}>
                Start report <ArrowRight size={16} />
              </span>
            </div>
          </button>

          <button
            type="button"
            onClick={() => setReportType('garbage')}
            style={cardStyle}
          >
            <div
              style={{
                ...iconStyle,
                color: '#397255',
                background: '#e8f3eb',
              }}
            >
              <Trash2 size={28} />
            </div>

            <div style={{ flex: 1 }}>
              <div
                style={{
                  ...labelStyle,
                  color: '#397255',
                }}
              >
                WASTE MANAGEMENT
              </div>

              <h3 style={titleStyle}>
                Report Garbage
              </h3>

              <p style={descriptionStyle}>
                Report garbage accumulation and
                improper waste disposal.
              </p>

              <span
                style={{
                  ...actionStyle,
                  color: '#397255',
                }}
              >
                Start report <ArrowRight size={16} />
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

const cardStyle = {
  display: 'flex',
  alignItems: 'flex-start',
  gap: '18px',
  padding: '26px',
  border: '1px solid var(--line)',
  borderRadius: '16px',
  background: '#fffdf9',
  color: 'var(--ink)',
  textAlign: 'left',
  cursor: 'pointer',
};

const iconStyle = {
  display: 'grid',
  placeItems: 'center',
  width: '56px',
  height: '56px',
  flexShrink: 0,
  borderRadius: '14px',
};

const labelStyle = {
  fontSize: '10px',
  fontWeight: 800,
  letterSpacing: '1px',
  color: '#a94d38',
};

const titleStyle = {
  margin: '7px 0',
  fontFamily: 'Fraunces, Georgia, serif',
  fontSize: '22px',
};

const descriptionStyle = {
  margin: 0,
  color: 'var(--muted)',
  fontSize: '13px',
  lineHeight: 1.6,
};

const actionStyle = {
  display: 'inline-flex',
  alignItems: 'center',
  gap: '6px',
  marginTop: '18px',
  color: '#a94d38',
  fontSize: '13px',
  fontWeight: 700,
};

export default ReportIssue;