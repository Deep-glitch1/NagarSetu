import React from 'react';

import {
  ClipboardList,
  Clock,
  CheckCircle,
  AlertTriangle,
} from 'lucide-react';


const getGreeting = () => {

  const hour =
    new Date().getHours();

  if (hour < 12) {
    return 'Good morning';
  }

  if (hour < 17) {
    return 'Good afternoon';
  }

  return 'Good evening';
};


const AdminDashboard = ({
  userData,
  onNavigate,
}) => {

  const stats = [
    {
      label: 'Total complaints',
      value: '—',
      icon: ClipboardList,
      accent: '#315c9d',
      tint: '#e8f0fd',
    },

    {
      label: 'Awaiting action',
      value: '—',
      icon: Clock,
      accent: '#b86d20',
      tint: '#fff0dc',
    },

    {
      label: 'Resolved',
      value: '—',
      icon: CheckCircle,
      accent: '#397255',
      tint: '#e6f4eb',
    },

    {
      label: 'Outside SLA',
      value: '—',
      icon: AlertTriangle,
      accent: '#bd553f',
      tint: '#fbeae5',
    },
  ];


  return (
    <div className="civic-dashboard">

      <section className="civic-welcome">

        <div>

          <p className="civic-eyebrow">
            Operations overview
          </p>

          <h2>
            {getGreeting()},
            {' '}
            {userData?.name || 'Administrator'}.
          </h2>

          <p>
            Review complaints and keep
            every civic case moving.
          </p>

        </div>


        <button
          type="button"
          onClick={() =>
            onNavigate('complaints')
          }
        >
          Open queue
          <ClipboardList size={17} />
        </button>

      </section>


      <section className="civic-stat-grid">

        {stats.map((stat) => {

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


      <section className="civic-content-grid">

        <article className="civic-panel">

          <div className="civic-panel-title">

            <div>

              <p className="civic-eyebrow">
                Workflow
              </p>

              <h3>
                Complaint operations
              </h3>

            </div>

          </div>


          <p
            style={{
              color: 'var(--muted)',
              lineHeight: 1.7,
            }}
          >
            Complaints are classified,
            checked for duplicates, routed
            to departments, prioritised and
            then assigned to field officers.
          </p>


          <button
            type="button"
            className="civic-link"
            onClick={() =>
              onNavigate('complaints')
            }
          >
            Open Complaints Queue
            <ClipboardList size={15} />
          </button>

        </article>


        <article className="civic-panel">

          <div className="civic-panel-title">

            <div>

              <p className="civic-eyebrow">
                Next modules
              </p>

              <h3>
                Operations
              </h3>

            </div>

          </div>


          <ul className="civic-list">

            <li>
              <span>
                Officer assignment
              </span>

              <b>
                Active
              </b>
            </li>

            <li>
              <span>
                Resolution verification
              </span>

              <b>
                Upcoming
              </b>
            </li>

            <li>
              <span>
                SLA monitoring
              </span>

              <b>
                Upcoming
              </b>
            </li>

          </ul>

        </article>

      </section>

    </div>
  );
};


export default AdminDashboard;