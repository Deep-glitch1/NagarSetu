import React, { useEffect, useMemo, useState } from 'react';
import {
  AlertTriangle,
  ClipboardList,
  RefreshCw,
  Search,
  UserCheck,
  X,
} from 'lucide-react';

import {
  getEmployeeQueue,
  getComplaintOfficers,
  assignComplaint,
} from '../../api/employee';

import { statusLabel } from '../../utils/format';

const STATUS_OPTIONS = [
  'received',
  'assigned',
  'in_progress',
  'pending_verification',
  'pending_citizen_response',
  'verified',
  'closed',
  'reopened',
  'rejected',
];

const PRIORITY_OPTIONS = ['critical', 'high', 'medium', 'low'];
const SLA_OPTIONS = [
  'on_track',
  'warning',
  'supervisor_escalation',
  'overdue',
  'critical',
];

const slaLabel = (state) => {
  if (!state) return '—';

  const labels = {
    on_track: 'On track',
    warning: 'Warning',
    supervisor_escalation: 'Escalated',
    overdue: 'Overdue',
    critical: 'Critical',
  };

  return labels[state] || statusLabel(state);
};

const slaClass = (state) =>
  `employee-sla-${String(state || 'unknown').toLowerCase()}`;

const priorityClass = (priority) =>
  `priority-${String(priority || 'low').toLowerCase()}`;

const formatDate = (value) => {
  if (!value) return '—';
  const date = new Date(value);
  return Number.isNaN(date.getTime()) ? '—' : date.toLocaleString();
};

const formatSlaPercentage = (value) => {
  if (value === null || value === undefined) return '—';
  const number = Number(value);
  if (!Number.isFinite(number)) return '—';
  return `${number.toFixed(0)}%`;
};

const EmployeeAssignments = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');

  const [search, setSearch] = useState('');
  const [statusFilter, setStatusFilter] = useState('all');
  const [priorityFilter, setPriorityFilter] = useState('all');
  const [slaFilter, setSlaFilter] = useState('all');

  const [selectedComplaint, setSelectedComplaint] = useState(null);
  const [officers, setOfficers] = useState([]);
  const [selectedOfficer, setSelectedOfficer] = useState('');
  const [officersLoading, setOfficersLoading] = useState(false);
  const [assigning, setAssigning] = useState(false);
  const [assignError, setAssignError] = useState('');
  const [assignSuccess, setAssignSuccess] = useState('');

  const loadQueue = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await getEmployeeQueue();
      setComplaints(Array.isArray(data?.complaints) ? data.complaints : []);
    } catch (err) {
      console.error('Assignment queue load failed:', err);
      setError(err.message || 'Unable to load assignments.');
      setComplaints([]);
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadQueue();
  }, []);

  const filtered = useMemo(() => {
    const query = search.trim().toLowerCase();

    return complaints.filter((item) => {
      const matchesSearch =
        !query ||
        [
          item.complaint_number,
          item.title,
          item.description,
          item.category_name,
          item.department_name,
          item.assignment?.name,
          item.assignment?.employee_id,
        ]
          .filter(Boolean)
          .join(' ')
          .toLowerCase()
          .includes(query);

      const matchesStatus =
        statusFilter === 'all' || item.status === statusFilter;

      const matchesPriority =
        priorityFilter === 'all' || item.priority === priorityFilter;

      const matchesSla =
        slaFilter === 'all' || item.sla?.state === slaFilter;

      return matchesSearch && matchesStatus && matchesPriority && matchesSla;
    });
  }, [complaints, search, statusFilter, priorityFilter, slaFilter]);

  const openAssignment = async (complaint) => {
    setSelectedComplaint(complaint);
    setSelectedOfficer('');
    setOfficers([]);
    setAssignError('');
    setAssignSuccess('');
    setOfficersLoading(true);

    try {
      const data = await getComplaintOfficers(complaint.id);
      setOfficers(Array.isArray(data?.officers) ? data.officers : []);
    } catch (err) {
      console.error('Officer list load failed:', err);
      setAssignError(err.message || 'Unable to load officers.');
    } finally {
      setOfficersLoading(false);
    }
  };

  const closeModal = () => {
    if (assigning) return;

    setSelectedComplaint(null);
    setSelectedOfficer('');
    setOfficers([]);
    setAssignError('');
    setAssignSuccess('');
  };

  const handleAssign = async () => {
    if (!selectedComplaint || !selectedOfficer) {
      setAssignError('Please select an officer.');
      return;
    }

    setAssigning(true);
    setAssignError('');
    setAssignSuccess('');

    try {
      const data = await assignComplaint(
        selectedComplaint.id,
        selectedOfficer,
      );

      const updatedComplaint = data?.complaint;
      const updatedAssignment = data?.assignment;

      const nextAssignment = updatedAssignment
        ? {
            officer_id: updatedAssignment.officer_id,
            employee_id: updatedAssignment.employee_id,
            name: updatedAssignment.officer_name,
            assigned_at: updatedAssignment.assigned_at,
          }
        : selectedComplaint.assignment;

      const updateItem = (item) =>
        item.id === selectedComplaint.id
          ? {
              ...item,
              status: updatedComplaint?.status || 'assigned',
              assignment: nextAssignment,
            }
          : item;

      setComplaints((current) => current.map(updateItem));
      setSelectedComplaint((current) =>
        current
          ? {
              ...current,
              status: updatedComplaint?.status || 'assigned',
              assignment: nextAssignment,
            }
          : current,
      );

      setAssignSuccess(
        data?.message || 'Complaint assigned successfully.',
      );

      await loadQueue();
    } catch (err) {
      console.error('Complaint assignment failed:', err);
      setAssignError(err.message || 'Unable to assign complaint.');
    } finally {
      setAssigning(false);
    }
  };

  const clearFilters = () => {
    setSearch('');
    setStatusFilter('all');
    setPriorityFilter('all');
    setSlaFilter('all');
  };

  const activeFilterCount = [
    statusFilter !== 'all',
    priorityFilter !== 'all',
    slaFilter !== 'all',
  ].filter(Boolean).length;

  return (
    <div className="civic-dashboard">
      <section className="civic-page-header">
        <div>
          <p className="civic-eyebrow">Supervisor workspace</p>
          <h2>Assignments</h2>
          <p>
            Assign and reassign complaints to active officers in your permitted scope.
          </p>
        </div>

        <button type="button" onClick={loadQueue} disabled={loading}>
          <RefreshCw
            size={17}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </section>

      <section className="civic-stat-grid">
        <article className="civic-stat">
          <span><ClipboardList size={20} /></span>
          <div>
            <small>Visible complaints</small>
            <strong>{complaints.length}</strong>
          </div>
        </article>

        <article className="civic-stat">
          <span><UserCheck size={20} /></span>
          <div>
            <small>Unassigned</small>
            <strong>{complaints.filter((item) => !item.assignment).length}</strong>
          </div>
        </article>

        <article className="civic-stat">
          <span><AlertTriangle size={20} /></span>
          <div>
            <small>SLA warnings</small>
            <strong>
              {complaints.filter((item) =>
                ['warning', 'supervisor_escalation', 'overdue', 'critical'].includes(
                  item.sla?.state,
                ),
              ).length}
            </strong>
          </div>
        </article>

        <article className="civic-stat">
          <span><RefreshCw size={20} /></span>
          <div>
            <small>Filtered results</small>
            <strong>{filtered.length}</strong>
          </div>
        </article>
      </section>

      <section className="civic-panel employee-task-controls">
        <div style={{ display: 'grid', gap: '12px', width: '100%' }}>
          <label>
            <Search size={17} />
            <input
              value={search}
              onChange={(event) => setSearch(event.target.value)}
              placeholder="Search complaint, category, officer..."
            />
          </label>

          <div
            style={{
              display: 'grid',
              gridTemplateColumns: 'repeat(3, minmax(0, 1fr)) auto',
              gap: '10px',
            }}
          >
            <label>
              <span>Status</span>
              <select
                value={statusFilter}
                onChange={(event) => setStatusFilter(event.target.value)}
              >
                <option value="all">All statuses</option>
                {STATUS_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>Priority</span>
              <select
                value={priorityFilter}
                onChange={(event) => setPriorityFilter(event.target.value)}
              >
                <option value="all">All priorities</option>
                {PRIORITY_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {statusLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <label>
              <span>SLA</span>
              <select
                value={slaFilter}
                onChange={(event) => setSlaFilter(event.target.value)}
              >
                <option value="all">All SLA states</option>
                {SLA_OPTIONS.map((value) => (
                  <option key={value} value={value}>
                    {slaLabel(value)}
                  </option>
                ))}
              </select>
            </label>

            <button
              type="button"
              onClick={clearFilters}
              disabled={
                !search &&
                statusFilter === 'all' &&
                priorityFilter === 'all' &&
                slaFilter === 'all'
              }
            >
              Clear{activeFilterCount ? ` (${activeFilterCount})` : ''}
            </button>
          </div>
        </div>
      </section>

      {loading ? (
        <div className="civic-empty">
          <RefreshCw size={28} className="animate-spin" />
          <p>Loading assignment queue...</p>
        </div>
      ) : error ? (
        <div className="civic-empty">
          <AlertTriangle size={28} />
          <h3>Unable to load assignments</h3>
          <p>{error}</p>
          <button type="button" onClick={loadQueue}>
            Try again
          </button>
        </div>
      ) : filtered.length === 0 ? (
        <div className="civic-empty">
          <ClipboardList size={30} />
          <h3>No complaints</h3>
          <p>No complaints match the current search and filters.</p>
          <button type="button" onClick={clearFilters}>
            Clear filters
          </button>
        </div>
      ) : (
        <section className="civic-panel">
          <div className="employee-assignment-table">
            <div className="employee-assignment-row employee-assignment-head">
              <span>Complaint</span>
              <span>Department</span>
              <span>Priority</span>
              <span>Status</span>
              <span>SLA</span>
              <span>Officer</span>
              <span>Action</span>
            </div>

            {filtered.map((complaint) => (
              <div
                className="employee-assignment-row"
                key={complaint.id}
              >
                <div>
                  <strong>{complaint.complaint_number}</strong>
                  <span>{complaint.title || 'Civic complaint'}</span>
                  <small>{complaint.category_name || complaint.category || '—'}</small>
                </div>

                <span>{complaint.department_name || '—'}</span>

                <span>
                  <span className={priorityClass(complaint.priority)}>
                    {String(complaint.priority || 'low').toUpperCase()}
                  </span>
                </span>

                <span>{statusLabel(complaint.status)}</span>

                <span className={slaClass(complaint.sla?.state)}>
                  <strong>{slaLabel(complaint.sla?.state)}</strong>
                  <small>{formatSlaPercentage(complaint.sla?.elapsed_percentage)}</small>
                </span>

                <span>
                  {complaint.assignment?.name || 'Unassigned'}
                  {complaint.assignment?.employee_id && (
                    <small>{complaint.assignment.employee_id}</small>
                  )}
                </span>

                <button
                  type="button"
                  onClick={() => openAssignment(complaint)}
                >
                  <UserCheck size={16} />
                  {complaint.assignment ? 'Reassign' : 'Assign'}
                </button>
              </div>
            ))}
          </div>
        </section>
      )}

      {selectedComplaint && (
        <div className="employee-modal-backdrop" role="presentation">
          <div
            className="employee-modal"
            role="dialog"
            aria-modal="true"
            aria-label={`${selectedComplaint.assignment ? 'Reassign' : 'Assign'} complaint`}
          >
            <div className="employee-modal-header">
              <div>
                <p className="civic-eyebrow">
                  {selectedComplaint.assignment ? 'Reassign complaint' : 'Assign complaint'}
                </p>
                <h3>{selectedComplaint.complaint_number}</h3>
              </div>

              <button
                type="button"
                onClick={closeModal}
                disabled={assigning}
                aria-label="Close"
              >
                <X size={19} />
              </button>
            </div>

            <div style={{ display: 'grid', gap: '12px' }}>
              <div>
                <strong>{selectedComplaint.title || 'Civic complaint'}</strong>
                <p>{selectedComplaint.description || 'No description provided.'}</p>
              </div>

              <div
                style={{
                  display: 'grid',
                  gridTemplateColumns: 'repeat(2, minmax(0, 1fr))',
                  gap: '10px',
                }}
              >
                <div>
                  <small>Category</small>
                  <p>{selectedComplaint.category_name || selectedComplaint.category || '—'}</p>
                </div>
                <div>
                  <small>Department</small>
                  <p>{selectedComplaint.department_name || '—'}</p>
                </div>
                <div>
                  <small>Priority</small>
                  <p>{statusLabel(selectedComplaint.priority)}</p>
                </div>
                <div>
                  <small>Status</small>
                  <p>{statusLabel(selectedComplaint.status)}</p>
                </div>
                <div>
                  <small>SLA</small>
                  <p>
                    {slaLabel(selectedComplaint.sla?.state)} ·{' '}
                    {formatSlaPercentage(selectedComplaint.sla?.elapsed_percentage)}
                  </p>
                </div>
                <div>
                  <small>Created</small>
                  <p>{formatDate(selectedComplaint.created_at)}</p>
                </div>
                <div>
                  <small>Current officer</small>
                  <p>{selectedComplaint.assignment?.name || 'Unassigned'}</p>
                </div>
                <div>
                  <small>Location</small>
                  <p>
                    {selectedComplaint.latitude != null && selectedComplaint.longitude != null
                      ? `${selectedComplaint.latitude}, ${selectedComplaint.longitude}`
                      : 'Not available'}
                  </p>
                </div>
              </div>

              {officersLoading ? (
                <div className="civic-empty">
                  <RefreshCw size={24} className="animate-spin" />
                  <p>Loading officers...</p>
                </div>
              ) : officers.length === 0 ? (
                <div className="civic-empty">
                  <AlertTriangle size={24} />
                  <p>No active officers are available for this department.</p>
                </div>
              ) : (
                <label className="employee-modal-field">
                  <span>
                    {selectedComplaint.assignment ? 'Select replacement officer' : 'Select officer'}
                  </span>
                  <select
                    value={selectedOfficer}
                    onChange={(event) => setSelectedOfficer(event.target.value)}
                    disabled={assigning}
                  >
                    <option value="">Select an officer</option>
                    {officers.map((officer) => (
                      <option key={officer.id} value={officer.id}>
                        {officer.name} ({officer.employee_id}) — {officer.active_assignments} active
                      </option>
                    ))}
                  </select>
                </label>
              )}
            </div>

            {assignError && (
              <p className="employee-form-error">{assignError}</p>
            )}

            {assignSuccess && (
              <p className="employee-form-success">{assignSuccess}</p>
            )}

            <div className="employee-modal-actions">
              <button
                type="button"
                onClick={closeModal}
                disabled={assigning}
              >
                Close
              </button>

              <button
                type="button"
                onClick={handleAssign}
                disabled={
                  assigning ||
                  officersLoading ||
                  !selectedOfficer ||
                  officers.length === 0
                }
              >
                {assigning
                  ? 'Saving...'
                  : selectedComplaint.assignment
                    ? 'Reassign complaint'
                    : 'Assign complaint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssignments;
