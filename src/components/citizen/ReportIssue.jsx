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
      <div
        style={{
          maxWidth: '1000px',
          width: '100%',
        }}
      >
        <p className="civic-eyebrow">
          NAGARSETU • CIVIC REPORTING
        </p>

        <h1
          style={{
            margin: '6px 0 8px',
            fontFamily:
              'Fraunces, Georgia, serif',
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
          {/* ROAD */}
          <button
            type="button"
            onClick={() => setReportType('road')}
            className="report-card"
          >
            <div className="report-card-icon report-card-icon-road">
              <Construction size={28} />
            </div>

            <div style={{ flex: 1 }}>
              <div className="report-card-label report-card-label-road">
                ROAD & INFRASTRUCTURE
              </div>

              <h3 className="report-card-title">
                Report Road Issue
              </h3>

              <p className="report-card-description">
                Report potholes, damaged roads and
                other road-related problems.
              </p>

              <span className="report-card-action report-card-action-road">
                Start report
                <ArrowRight size={16} />
              </span>
            </div>
          </button>

          {/* GARBAGE */}
          <button
            type="button"
            onClick={() => setReportType('garbage')}
            className="report-card"
          >
            <div className="report-card-icon report-card-icon-garbage">
              <Trash2 size={28} />
            </div>

            <div style={{ flex: 1 }}>
              <div className="report-card-label report-card-label-garbage">
                WASTE MANAGEMENT
              </div>

              <h3 className="report-card-title">
                Report Garbage
              </h3>

              <p className="report-card-description">
                Report garbage accumulation and
                improper waste disposal.
              </p>

              <span className="report-card-action report-card-action-garbage">
                Start report
                <ArrowRight size={16} />
              </span>
            </div>
          </button>
        </div>
      </div>
    </div>
  );
};

export default ReportIssue;