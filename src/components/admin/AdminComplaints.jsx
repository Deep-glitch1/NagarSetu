import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Search,
  X,
  UserRound,
  UserCheck,
  Loader2,
  RefreshCw,
  ClipboardList,
} from 'lucide-react';

import { apiFetch } from '../../api/client';


const priorityClass = (priority) => {
  return `priority-${
    String(priority || 'low').toLowerCase()
  }`;
};


const statusLabel = (status) => {
  return String(status || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) =>
      char.toUpperCase()
    );
};


const AdminComplaints = () => {

  const [complaints, setComplaints] =
    useState([]);

  const [loading, setLoading] =
    useState(false);

  const [error, setError] =
    useState('');

  const [search, setSearch] =
    useState('');

  const [statusFilter, setStatusFilter] =
    useState('all');

  const [priorityFilter, setPriorityFilter] =
    useState('all');

  const [selectedComplaint, setSelectedComplaint] =
    useState(null);

  const [officers, setOfficers] =
    useState([]);

  const [officersLoading, setOfficersLoading] =
    useState(false);

  const [officersError, setOfficersError] =
    useState('');

  const [selectedOfficer, setSelectedOfficer] =
    useState('');

  const [assigning, setAssigning] =
    useState(false);

  const [assignError, setAssignError] =
    useState('');

  const [assignSuccess, setAssignSuccess] =
    useState('');


  const loadComplaints = async () => {

    setLoading(true);
    setError('');

    try {

      const data = await apiFetch(
        '/employee/complaints'
      );

      setComplaints(
        Array.isArray(data?.complaints)
          ? data.complaints
          : []
      );

    } catch (err) {

      console.error(
        'Complaint queue load failed:',
        err
      );

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


  const filteredComplaints =
    useMemo(() => {

      const query =
        search.trim().toLowerCase();

      return complaints.filter(
        (complaint) => {

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
            complaint.status ===
              statusFilter;


          const matchesPriority =
            priorityFilter === 'all' ||
            complaint.priority ===
              priorityFilter;


          return (
            matchesSearch &&
            matchesStatus &&
            matchesPriority
          );
        }
      );

    }, [
      complaints,
      search,
      statusFilter,
      priorityFilter,
    ]);


  const openAssignment = async (
    complaint
  ) => {

    setSelectedComplaint(
      complaint
    );

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

      setOfficers(
        Array.isArray(data?.officers)
          ? data.officers
          : []
      );

    } catch (err) {

      console.error(
        'Officer list load failed:',
        err
      );

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

      setAssignError(
        'Please select an officer.'
      );

      return;
    }


    setAssigning(true);

    setAssignError('');
    setAssignSuccess('');


    try {

      const formData =
        new FormData();

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


      const assignment =
        data?.assignment;


      setComplaints((current) =>
        current.map((item) =>
          item.id ===
          selectedComplaint.id

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


  return (
    <div className="civic-dashboard">

      {/* HEADER */}
      <section className="civic-welcome">

        <div>

          <p className="civic-eyebrow">
            Complaint management
          </p>

          <h2>
            Complaints Queue
          </h2>

          <p>
            Review routed complaints and
            assign them to officers.
          </p>

        </div>


        <button
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
      <div
        className="civic-panel"
        style={{
          marginBottom: '18px',
        }}
      >

        <div
          style={{
            display: 'grid',
            gridTemplateColumns:
              'minmax(220px, 1fr) 180px 180px',
            gap: '12px',
          }}
        >

          <label
            style={{
              position: 'relative',
            }}
          >

            <Search
              size={17}
              style={{
                position: 'absolute',
                left: '12px',
                top: '50%',
                transform:
                  'translateY(-50%)',
                color:
                  'var(--muted)',
              }}
            />

            <input
              value={search}
              onChange={(e) =>
                setSearch(e.target.value)
              }
              placeholder=
                "Search complaints..."
              style={{
                width: '100%',
                paddingLeft: '38px',
              }}
            />

          </label>


          <select
            value={statusFilter}
            onChange={(e) =>
              setStatusFilter(e.target.value)
            }
          >
            <option value="all">
              All statuses
            </option>

            <option value="received">
              Received
            </option>

            <option value="assigned">
              Assigned
            </option>

            <option value="in_progress">
              In progress
            </option>

            <option value="reopened">
              Reopened
            </option>

            <option value="pending_verification">
              Pending verification
            </option>

            <option value="verified">
              Verified
            </option>

            <option value="closed">
              Closed
            </option>

            <option value="rejected">
              Rejected
            </option>
          </select>


          <select
            value={priorityFilter}
            onChange={(e) =>
              setPriorityFilter(e.target.value)
            }
          >
            <option value="all">
              All priorities
            </option>

            <option value="critical">
              Critical
            </option>

            <option value="high">
              High
            </option>

            <option value="medium">
              Medium
            </option>

            <option value="low">
              Low
            </option>
          </select>

        </div>

      </div>


      {/* ERROR */}
      {error && (
        <div
          className="civic-panel"
          style={{
            marginBottom: '18px',
            color: '#a94435',
          }}
        >
          {error}
        </div>
      )}


      {/* QUEUE */}
      <div className="civic-panel">

        <div className="civic-panel-title">

          <div>

            <p className="civic-eyebrow">
              {filteredComplaints.length}
              {' '}
              shown
            </p>

            <h3>
              Complaints
            </h3>

          </div>

          <span>
            {complaints.length}
            {' '}
            total
          </span>

        </div>


        {loading ? (

          <div
            style={{
              padding: '50px 10px',
              textAlign: 'center',
            }}
          >

            <Loader2
              size={28}
              className="animate-spin"
            />

            <p
              style={{
                color:
                  'var(--muted)',
              }}
            >
              Loading complaints...
            </p>

          </div>

        ) : filteredComplaints.length === 0 ? (

          <div
            style={{
              padding: '50px 10px',
              textAlign: 'center',
            }}
          >

            <ClipboardList
              size={30}
            />

            <p
              style={{
                color:
                  'var(--muted)',
              }}
            >
              No complaints found.
            </p>

          </div>

        ) : (

          <div
            style={{
              display: 'grid',
              gap: '10px',
            }}
          >

            {filteredComplaints.map(
              (complaint) => (

                <article
                  key={complaint.id}
                  style={{
                    border:
                      '1px solid var(--line)',
                    borderRadius:
                      '14px',
                    padding: '16px',
                    display: 'grid',
                    gridTemplateColumns:
                      '1fr auto',
                    gap: '16px',
                    alignItems:
                      'center',
                  }}
                >

                  <div>

                    <div
                      style={{
                        display: 'flex',
                        flexWrap: 'wrap',
                        gap: '8px',
                        alignItems:
                          'center',
                      }}
                    >

                      <strong>
                        {
                          complaint
                            .complaint_number
                        }
                      </strong>


                      <span
                        className={
                          priorityClass(
                            complaint.priority
                          )
                        }
                      >
                        {
                          String(
                            complaint.priority ||
                            'low'
                          ).toUpperCase()
                        }
                      </span>


                      <span>
                        {
                          statusLabel(
                            complaint.status
                          )
                        }
                      </span>

                    </div>


                    <h4
                      style={{
                        margin:
                          '8px 0 5px',
                      }}
                    >
                      {
                        complaint.title ||
                        'Untitled complaint'
                      }
                    </h4>


                    <p
                      style={{
                        margin: 0,
                        color:
                          'var(--muted)',
                        fontSize:
                          '13px',
                      }}
                    >
                      {
                        complaint.category_name ||
                        complaint.category ||
                        'Unknown'
                      }

                      {' · '}

                      {
                        complaint.department_name ||
                        'Department'
                      }
                    </p>


                    <p
                      style={{
                        margin:
                          '6px 0 0',
                        color:
                          'var(--muted)',
                        fontSize:
                          '12px',
                      }}
                    >

                      {
                        complaint.assignment
                          ? `Officer: ${complaint.assignment.name}`
                          : 'Officer: Not assigned'
                      }

                    </p>

                  </div>


                  <button
                    type="button"
                    onClick={() =>
                      openAssignment(
                        complaint
                      )
                    }
                    disabled={
                      ![
                        'received',
                        'reopened',
                      ].includes(
                        complaint.status
                      )
                    }
                  >

                    <UserRound
                      size={16}
                    />

                    {
                      complaint.assignment
                        ? 'Reassign'
                        : 'Assign officer'
                    }

                  </button>

                </article>

              )
            )}

          </div>

        )}

      </div>


      {/* ASSIGNMENT MODAL */}
      {selectedComplaint && (

        <div
          style={{
            position: 'fixed',
            inset: 0,
            background:
              'rgba(24,27,23,.42)',
            display: 'grid',
            placeItems: 'center',
            padding: '20px',
            zIndex: 1000,
          }}
          onMouseDown={
            closeAssignment
          }
        >

          <div
            className="civic-panel"
            style={{
              width:
                'min(560px, 100%)',
              maxHeight: '90vh',
              overflowY: 'auto',
            }}
            onMouseDown={(e) =>
              e.stopPropagation()
            }
          >

            <div
              className="civic-panel-title"
            >

              <div>

                <p className="civic-eyebrow">
                  Assign complaint
                </p>

                <h3>
                  {
                    selectedComplaint
                      .complaint_number
                  }
                </h3>

              </div>


              <button
                type="button"
                onClick={
                  closeAssignment
                }
                disabled={
                  assigning
                }
              >
                <X size={18} />
              </button>

            </div>


            <p
              style={{
                color:
                  'var(--muted)',
              }}
            >
              {
                selectedComplaint.title
              }
            </p>


            {officersLoading ? (

              <div
                style={{
                  textAlign: 'center',
                  padding: '30px',
                }}
              >
                <Loader2
                  size={26}
                  className="animate-spin"
                />
              </div>

            ) : officersError ? (

              <p
                style={{
                  color: '#a94435',
                }}
              >
                {officersError}
              </p>

            ) : (

              <>

                <label>
                  Select officer
                </label>


                <select
                  value={
                    selectedOfficer
                  }
                  onChange={(e) =>
                    setSelectedOfficer(
                      e.target.value
                    )
                  }
                  disabled={
                    assigning
                  }
                  style={{
                    width: '100%',
                    marginTop: '8px',
                  }}
                >

                  <option value="">
                    Choose an officer
                  </option>

                  {officers.map(
                    (officer) => (

                      <option
                        key={officer.id}
                        value={officer.id}
                      >

                        {
                          officer.name
                        }

                        {' · '}

                        {
                          officer.employee_id
                        }

                        {' · '}

                        {
                          officer.active_assignments
                        }

                        {' active'}

                      </option>

                    )
                  )}

                </select>


                <div
                  style={{
                    marginTop: '15px',
                    display: 'grid',
                    gap: '8px',
                  }}
                >

                  {officers.map(
                    (officer) => (

                      <button
                        type="button"
                        key={officer.id}
                        onClick={() =>
                          setSelectedOfficer(
                            String(
                              officer.id
                            )
                          )
                        }
                        disabled={
                          assigning
                        }
                        style={{
                          display: 'flex',
                          justifyContent:
                            'space-between',
                          padding: '11px',
                          border:
                            '1px solid var(--line)',
                          borderRadius:
                            '10px',
                        }}
                      >

                        <span>

                          <strong>
                            {
                              officer.name
                            }
                          </strong>

                          <small
                            style={{
                              display:
                                'block',
                              color:
                                'var(--muted)',
                            }}
                          >
                            {
                              officer.employee_id
                            }
                          </small>

                        </span>


                        <small>
                          {
                            officer.active_assignments
                          }
                          {' active'}
                        </small>

                      </button>

                    )
                  )}

                </div>

              </>
            )}


            {assignError && (
              <p
                style={{
                  color: '#a94435',
                }}
              >
                {assignError}
              </p>
            )}


            {assignSuccess && (
              <p
                style={{
                  color: '#397255',
                }}
              >
                {assignSuccess}
              </p>
            )}


            <div
              style={{
                display: 'flex',
                justifyContent:
                  'flex-end',
                gap: '10px',
                marginTop: '20px',
              }}
            >

              <button
                type="button"
                onClick={
                  closeAssignment
                }
                disabled={
                  assigning
                }
              >
                Close
              </button>


              <button
                type="button"
                onClick={
                  handleAssign
                }
                disabled={
                  assigning ||
                  !selectedOfficer ||
                  officers.length === 0
                }
              >

                {assigning && (
                  <Loader2
                    size={16}
                    className="animate-spin"
                  />
                )}

                {
                  assigning
                    ? 'Assigning...'
                    : 'Assign officer'
                }

              </button>

            </div>

          </div>

        </div>

      )}

    </div>
  );
};


export default AdminComplaints;