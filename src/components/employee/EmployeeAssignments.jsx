import React, { useEffect, useMemo, useState } from 'react';
import {
  ClipboardList,
  RefreshCw,
  Search,
  UserCheck,
  X,
  AlertTriangle,
} from 'lucide-react';

import {
  getEmployeeQueue,
  getComplaintOfficers,
  assignComplaint,
} from '../../api/employee';

const statusLabel = (value) =>
  String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const EmployeeAssignments = () => {
  const [complaints, setComplaints] = useState([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState('');
  const [search, setSearch] = useState('');

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
      if (!query) return true;

      return [
        item.complaint_number,
        item.title,
        item.description,
        item.category_name,
        item.department_name,
        item.assignment?.name,
      ]
        .filter(Boolean)
        .join(' ')
        .toLowerCase()
        .includes(query);
    });
  }, [complaints, search]);

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
      await assignComplaint(
        selectedComplaint.id,
        selectedOfficer
      );

      setAssignSuccess('Complaint assigned successfully.');
      await loadQueue();
    } catch (err) {
      console.error('Complaint assignment failed:', err);
      setAssignError(err.message || 'Unable to assign complaint.');
    } finally {
      setAssigning(false);
    }
  };

  return (
    <div>
      <section className="civic-page-header">
        <div>
          <p className="civic-eyebrow">Supervisor workspace</p>
          <h2>Assignments</h2>
          <p>Assign complaints to active departmental officers.</p>
        </div>

        <button type="button" onClick={loadQueue} disabled={loading}>
          <RefreshCw
            size={17}
            className={loading ? 'animate-spin' : ''}
          />
          Refresh
        </button>
      </section>

      <section className="civic-panel employee-task-controls">
        <label>
          <Search size={17} />
          <input
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search complaints"
          />
        </label>
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
          <p>No complaints match your search.</p>
        </div>
      ) : (
        <section className="civic-panel">
          <div className="employee-assignment-table">
            <div className="employee-assignment-row employee-assignment-head">
              <span>Complaint</span>
              <span>Department</span>
              <span>Status</span>
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
                  <span>{complaint.title}</span>
                </div>
                <span>{complaint.department_name || '—'}</span>
                <span>{statusLabel(complaint.status)}</span>
                <span>{complaint.assignment?.name || 'Unassigned'}</span>
                <button
                  type="button"
                  onClick={() => openAssignment(complaint)}
                >
                  <UserCheck size={16} />
                  Assign
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
            aria-label="Assign complaint"
          >
            <div className="employee-modal-header">
              <div>
                <p className="civic-eyebrow">Assign complaint</p>
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

            <p>
              {selectedComplaint.title || 'Complaint'}
            </p>

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
                <span>Select officer</span>
                <select
                  value={selectedOfficer}
                  onChange={(event) =>
                    setSelectedOfficer(event.target.value)
                  }
                  disabled={assigning}
                >
                  <option value="">Select an officer</option>
                  {officers.map((officer) => (
                    <option
                      key={officer.id}
                      value={officer.id}
                    >
                      {officer.name} ({officer.employee_id})
                    </option>
                  ))}
                </select>
              </label>
            )}

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
                disabled={assigning || !selectedOfficer}
              >
                {assigning ? 'Assigning...' : 'Assign complaint'}
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  );
};

export default EmployeeAssignments;
