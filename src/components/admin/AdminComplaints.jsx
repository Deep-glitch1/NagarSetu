import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
  UserRound,
  Loader2,
  RefreshCw,
  CheckCircle,
  ClipboardList,
  Eye,
} from 'lucide-react';

import { apiFetch } from '../../api/client';
import { verifyComplaint } from '../../api/employee';

import {
  priorityClass,
  statusLabel,
} from '../../utils/format';

import AdminComplaintModals from './AdminComplaintModals';
import './AdminComplaints.css';

const statusClass = (status) =>
  `admin-status-badge admin-status-${String(
    status || 'unknown'
  ).replace(/_/g, '-')}`;

const AdminComplaints = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [officersLoading, setOfficersLoading] = useState(false);
  const [officersError, setOfficersError] = useState('');
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const [verifyingComplaintId, setVerifyingComplaintId] = useState(null);
  const [verifyError, setVerifyError] = useState('');

  const [reportComplaint, setReportComplaint] = useState(null);
  const [reportLoading, setReportLoading] = useState(false);
  const [reportError, setReportError] = useState('');

  const loadComplaints = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/employee/complaints');

      setComplaints(
        Array.isArray(data?.complaints)
          ? data.complaints
          : []
      );
    } catch (err) {
      console.error('Complaint queue load failed:', err);

      setError(
        err.message ||
        'Unable to load complaints.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadComplaints();
  }, []);

  const filteredComplaints = useMemo(() => {
    const query = search.trim().toLowerCase();

    return complaints.filter((complaint) => {
      const matchesSearch =
        !query ||
        String(
          complaint.complaint_number || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          complaint.title || ''
        )
          .toLowerCase()
          .includes(query) ||
        String(
          complaint.category_name ||
          complaint.category ||
          ''
        )
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === 'all' ||
        complaint.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' ||
        complaint.priority === priorityFilter;

      return (
        matchesSearch &&
        matchesStatus &&
        matchesPriority
      );
    });
  }, [
    complaints,
    search,
    statusFilter,
    priorityFilter,
  ]);

  const statusCounts = useMemo(
    () => ({
      total: complaints.length,
      pendingVerification: complaints.filter(
        (item) => item.status === 'pending_verification'
      ).length,
      reopened: complaints.filter(
        (item) => item.status === 'reopened'
      ).length,
      closed: complaints.filter(
        (item) => item.status === 'closed'
      ).length,
    }),
    [complaints]
  );

  const openAssignment = async (complaint) => {
    setSelectedComplaint(complaint);
    setOfficers([]);
    setSelectedOfficer('');
    setOfficersError('');
    setAssignError('');
    setAssignSuccess('');
    setOfficersLoading(true);

    try {
      const data = await apiFetch(
        `/employee/complaints/${complaint.id}/officers`
      );

      console.log('OFFICER API RESPONSE:', data);

      const officerList = Array.isArray(data)
        ? data
        : Array.isArray(data?.officers)
          ? data.officers
          : Array.isArray(data?.employees)
            ? data.employees
            : Array.isArray(data?.data)
              ? data.data
              : Array.isArray(data?.data?.officers)
                ? data.data.officers
                : [];

      setOfficers(officerList);
      console.log('OFFICERS SET:', officerList);
    } catch (err) {
      console.error('Officer list load failed:', err);

      setOfficersError(
        err.message ||
        'Unable to load officers.'
      );
    } finally {
      setOfficersLoading(false);
    }
  };

  const closeAssignment = () => {
    if (assigning) {
      return;
    }

    setSelectedComplaint(null);
    setOfficers([]);
    setSelectedOfficer('');
    setOfficersError('');
    setAssignError('');
    setAssignSuccess('');
  };

  const handleAssign = async () => {
    if (
      !selectedComplaint ||
      !selectedOfficer
    ) {
      setAssignError('Please select an officer.');
      return;
    }

    setAssigning(true);
    setAssignError('');
    setAssignSuccess('');

    try {
      const formData = new FormData();

      formData.append(
        'officer_id',
        selectedOfficer
      );

      const data = await apiFetch(
        `/employee/complaints/${selectedComplaint.id}/assign`,
        {
          method: 'POST',
          body: formData,
        }
      );

      const assignment = data?.assignment;

      setComplaints((current) =>
        current.map((item) =>
          item.id === selectedComplaint.id
            ? {
                ...item,
                status:
                  data?.complaint?.status ||
                  'assigned',
                assignment:
                  assignment
                    ? {
                        officer_id:
                          assignment.officer_id,
                        employee_id:
                          assignment.employee_id,
                        name:
                          assignment.officer_name,
                      }
                    : item.assignment,
              }
            : item
        )
      );

      setAssignSuccess(
        data?.message ||
        'Complaint assigned successfully.'
      );
    } catch (err) {
      console.error(
        'Complaint assignment failed:',
        err
      );

      setAssignError(
        err.message ||
        'Unable to assign complaint.'
      );
    } finally {
      setAssigning(false);
    }
  };

  const openReport = async (complaintId) => {
    if (!complaintId || reportLoading) {
      return;
    }

    setReportComplaint(null);
    setReportError('');
    setReportLoading(true);

    try {
      const data = await apiFetch(
        `/employee/complaints/${complaintId}/report`
      );

      setReportComplaint(
        data?.report || null
      );
    } catch (err) {
      console.error(
        'Complaint report load failed:',
        err
      );

      setReportError(
        err.message ||
        'Unable to load complaint report.'
      );
    } finally {
      setReportLoading(false);
    }
  };

  const closeReport = () => {
    if (reportLoading) {
      return;
    }

    setReportComplaint(null);
    setReportError('');
  };

  const handleVerify = async (complaintId) => {
    if (
      !complaintId ||
      verifyingComplaintId
    ) {
      return;
    }

    setVerifyingComplaintId(complaintId);
    setVerifyError('');

    try {
      await verifyComplaint(complaintId);

      await loadComplaints();

      if (reportComplaint?.id === complaintId) {
        await openReport(complaintId);
      }
    } catch (err) {
      console.error(
        'Complaint verification failed:',
        err
      );

      setVerifyError(
        err.message ||
        'Unable to verify complaint resolution.'
      );
    } finally {
      setVerifyingComplaintId(null);
    }
  };

  return (
    <div className="civic-dashboard admin-complaints-page">
      {/* HEADER */}
      <section className="civic-welcome admin-complaints-header">
        <div>
          <p className="civic-eyebrow">
            Complaint management
          </p>

          <h2>
            Complaints Queue
          </h2>

          <p>
            Review routed complaints and assign them to officers.
          </p>
        </div>

        <button
          className="admin-refresh-btn"
          type="button"
          onClick={loadComplaints}
          disabled={loading}
        >
          {loading ? (
            <Loader2
              size={17}
              className="animate-spin"
            />
          ) : (
            <RefreshCw size={17} />
          )}
          Refresh
        </button>
      </section>

      {/* FILTERS */}
      <div className="civic-panel admin-filters-panel">
        <div className="admin-filters-grid">
          <label className="admin-search-field">
            <Search
              className="admin-search-icon"
              size={17}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              className="admin-search-input"
              placeholder="Search complaints..."
            />
          </label>

          <select
            className="admin-filter-select"
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">All statuses</option>
            <option value="received">Received</option>
            <option value="assigned">Assigned</option>
            <option value="in_progress">In progress</option>
            <option value="reopened">Reopened</option>
            <option value="pending_verification">
              Pending verification
            </option>
            <option value="verified">Verified</option>
            <option value="closed">Closed</option>
            <option value="rejected">Rejected</option>
          </select>

          <select
            className="admin-filter-select"
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value)
            }
          >
            <option value="all">All priorities</option>
            <option value="critical">Critical</option>
            <option value="high">High</option>
            <option value="medium">Medium</option>
            <option value="low">Low</option>
          </select>
        </div>
      </div>

      {/* SUMMARY */}
      <div className="admin-summary-strip">
        <div className="admin-summary-card">
          <span>Total complaints</span>
          <strong>{statusCounts.total}</strong>
        </div>

        <div className="admin-summary-card admin-summary-warning">
          <span>Awaiting verification</span>
          <strong>
            {statusCounts.pendingVerification}
          </strong>
        </div>

        <div className="admin-summary-card admin-summary-reopened">
          <span>Reopened</span>
          <strong>{statusCounts.reopened}</strong>
        </div>

        <div className="admin-summary-card admin-summary-closed">
          <span>Closed</span>
          <strong>{statusCounts.closed}</strong>
        </div>
      </div>

      {/* ERROR */}
      {error && (
        <div className="civic-panel admin-error-panel">
          {error}
        </div>
      )}

      {verifyError && (
        <div className="civic-panel admin-error-panel admin-inline-error">
          {verifyError}
        </div>
      )}

      {/* QUEUE */}
      <div className="civic-panel">
        <div className="civic-panel-title admin-queue-header">
          <div>
            <p className="civic-eyebrow">
              {filteredComplaints.length} shown
            </p>

            <h3>
              Complaints
            </h3>
          </div>

          <span>
            {complaints.length} total
          </span>
        </div>

        {loading ? (
          <div className="admin-empty-state">
            <Loader2
              size={28}
              className="animate-spin"
            />

            <p style={{ color: 'var(--muted)' }}>
              Loading complaints...
            </p>
          </div>
        ) : filteredComplaints.length === 0 ? (
          <div className="admin-empty-state">
            <ClipboardList size={30} />

            <p style={{ color: 'var(--muted)' }}>
              No complaints found.
            </p>
          </div>
        ) : (
          <div className="admin-complaint-list">
            {filteredComplaints.map((complaint) => (
              <article
                key={complaint.id}
                className={`admin-complaint-card ${
                  complaint.status === 'closed' ||
                  complaint.status === 'verified'
                    ? 'admin-complaint-card-final'
                    : ''
                }`}
              >
                <div>
                  <div className="admin-complaint-meta">
                    <strong>
                      {complaint.complaint_number}
                    </strong>

                    <span
                      className={
                        priorityClass(
                          complaint.priority
                        )
                      }
                    >
                      {String(
                        complaint.priority ||
                        'low'
                      ).toUpperCase()}
                    </span>

                    <span
                      className={
                        statusClass(
                          complaint.status
                        )
                      }
                    >
                      {statusLabel(
                        complaint.status
                      )}
                    </span>
                  </div>

                  <h4 className="admin-complaint-title">
                    {complaint.title ||
                      'Untitled complaint'}
                  </h4>

                  <p className="admin-complaint-subtitle">
                    {complaint.category_name ||
                      complaint.category ||
                      'Unknown'}
                    {' · '}
                    {complaint.department_name ||
                      'Department'}
                  </p>

                  <p className="admin-complaint-assignment">
                    {complaint.assignment
                      ? `Officer: ${complaint.assignment.name}`
                      : 'Officer: Not assigned'}
                  </p>
                </div>

                <div className="admin-complaint-actions">
                  <button
                    className="admin-action-btn admin-view-btn"
                    type="button"
                    onClick={() =>
                      openReport(
                        complaint.id
                      )
                    }
                    disabled={reportLoading}
                  >
                    <Eye size={16} />
                    View Report
                  </button>

                  {complaint.status ===
                    'pending_verification' && (
                    <button
                      className="admin-action-btn admin-verify-btn"
                      type="button"
                      onClick={() =>
                        handleVerify(
                          complaint.id
                        )
                      }
                      disabled={
                        verifyingComplaintId ===
                        complaint.id
                      }
                    >
                      {verifyingComplaintId ===
                      complaint.id ? (
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

                  {[
                    'received',
                    'reopened',
                  ].includes(
                    complaint.status
                  ) && (
                    <button
                      className="admin-action-btn admin-assign-btn"
                      type="button"
                      onClick={() =>
                        openAssignment(
                          complaint
                        )
                      }
                      disabled={assigning}
                    >
                      <UserRound size={16} />
                      {complaint.assignment
                        ? 'Reassign'
                        : 'Assign officer'}
                    </button>
                  )}
                </div>
              </article>
            ))}
          </div>
        )}
      </div>

      <AdminComplaintModals
        selectedComplaint={selectedComplaint}
        officers={officers}
        officersLoading={officersLoading}
        officersError={officersError}
        selectedOfficer={selectedOfficer}
        assigning={assigning}
        assignError={assignError}
        assignSuccess={assignSuccess}
        reportComplaint={reportComplaint}
        reportLoading={reportLoading}
        reportError={reportError}
        verifyingComplaintId={
          verifyingComplaintId
        }
        onSelectOfficer={setSelectedOfficer}
        onCloseAssignment={closeAssignment}
        onAssign={handleAssign}
        onCloseReport={closeReport}
        onVerify={handleVerify}
      />
    </div>
  );
};

export default AdminComplaints;
