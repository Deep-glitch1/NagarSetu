import React from 'react';
import { Shield, Mail, UserRound, BriefcaseBusiness } from 'lucide-react';

const roleLabel = (value) =>
  String(value || 'employee')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const EmployeeSettings = ({ userData }) => {
  return (
    <div>
      <section className="civic-page-header">
        <div>
          <p className="civic-eyebrow">Account</p>
          <h2>Settings</h2>
          <p>Your employee account information.</p>
        </div>
      </section>

      <section className="civic-content-grid">
        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Profile</p>
              <h3>Account details</h3>
            </div>
          </div>

          <div className="employee-settings-list">
            <div>
              <UserRound size={18} />
              <span>
                <small>Name</small>
                <strong>{userData?.name || '—'}</strong>
              </span>
            </div>

            <div>
              <Mail size={18} />
              <span>
                <small>Email</small>
                <strong>{userData?.email || '—'}</strong>
              </span>
            </div>
          </div>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">Authorization</p>
              <h3>Role</h3>
            </div>
          </div>

          <div className="employee-settings-list">
            <div>
              <BriefcaseBusiness size={18} />
              <span>
                <small>Application role</small>
                <strong>{roleLabel(userData?.employee_role)}</strong>
              </span>
            </div>

            <div>
              <Shield size={18} />
              <span>
                <small>Account type</small>
                <strong>Employee</strong>
              </span>
            </div>
          </div>
        </article>
      </section>
    </div>
  );
};

export default EmployeeSettings;
