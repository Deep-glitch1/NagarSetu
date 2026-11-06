import React, { useEffect, useState } from 'react';
import {
  BriefcaseBusiness,
  Building2,
  CheckCircle2,
  Mail,
  MapPin,
  Phone,
  Save,
  Shield,
  UserRound,
} from 'lucide-react';
import { apiFetch } from '../../api/client';

const roleLabel = (value) =>
  String(value || 'employee')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());

const EmployeeSettings = ({ userData }) => {
  const [profile, setProfile] = useState(null);
  const [form, setForm] = useState({
    name: userData?.name || '',
    phone: userData?.phone || '',
  });
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  const loadProfile = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/admin/management/settings/profile');
      setProfile(data || {});
      setForm({
        name: data?.name || userData?.name || '',
        phone: data?.phone || userData?.phone || '',
      });
    } catch (requestError) {
      setError(requestError.message || 'Unable to load employee profile.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadProfile();
  }, []);

  const handleSave = async (event) => {
    event.preventDefault();

    const name = form.name.trim();
    const phone = form.phone.trim();

    if (name.length < 2) {
      setError('Name must contain at least 2 characters.');
      return;
    }

    setSaving(true);
    setError('');
    setNotice('');

    try {
      const data = await apiFetch('/admin/management/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({
          name,
          phone: phone || null,
        }),
      });

      setProfile((current) => ({ ...current, ...(data || {}) }));
      setForm({
        name: data?.name || name,
        phone: data?.phone || phone,
      });
      setNotice('Profile updated successfully.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to update profile.');
    } finally {
      setSaving(false);
    }
  };

  const currentProfile = profile || userData || {};
  const role = currentProfile.roles || currentProfile.employee_role || userData?.employee_role;

  return (
    <div>
      <section className="civic-page-header">
        <div>
          <p className="civic-eyebrow">Account</p>
          <h2>Settings</h2>
          <p>Manage your employee profile and view account information.</p>
        </div>
      </section>

      {error && (
        <div className="admin-management-message is-error" role="alert">
          {error}
        </div>
      )}

      {notice && (
        <div className="admin-management-message is-success" role="status">
          {notice}
        </div>
      )}

      {loading ? (
        <section className="civic-panel">
          <p className="admin-management-muted">Loading profile…</p>
        </section>
      ) : (
        <section className="civic-content-grid">
          <article className="civic-panel">
            <div className="civic-panel-title">
              <div>
                <p className="civic-eyebrow">Profile</p>
                <h3>Account details</h3>
              </div>
              <UserRound size={22} />
            </div>

            <form className="admin-management-form" onSubmit={handleSave}>
              <label>
                Name
                <input
                  value={form.name}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, name: event.target.value }))
                  }
                  maxLength={150}
                  required
                />
              </label>

              <label>
                Phone
                <input
                  type="tel"
                  value={form.phone}
                  onChange={(event) =>
                    setForm((current) => ({ ...current, phone: event.target.value }))
                  }
                  maxLength={15}
                  placeholder="Optional"
                />
              </label>

              <label>
                Email
                <input value={currentProfile.email || '—'} readOnly />
              </label>

              <label>
                Employee ID
                <input value={currentProfile.employee_id || '—'} readOnly />
              </label>

              <div className="admin-management-form-actions span-2">
                <button type="submit" disabled={saving}>
                  <Save size={16} />
                  {saving ? 'Saving…' : 'Save changes'}
                </button>
              </div>
            </form>
          </article>

          <article className="civic-panel">
            <div className="civic-panel-title">
              <div>
                <p className="civic-eyebrow">Authorization</p>
                <h3>Employment information</h3>
              </div>
              <Shield size={22} />
            </div>

            <div className="employee-settings-list">
              <div>
                <BriefcaseBusiness size={18} />
                <span>
                  <small>Application role</small>
                  <strong>{roleLabel(role)}</strong>
                </span>
              </div>

              <div>
                <Building2 size={18} />
                <span>
                  <small>Department</small>
                  <strong>{currentProfile.department_name || '—'}</strong>
                </span>
              </div>

              <div>
                <MapPin size={18} />
                <span>
                  <small>Administrative area</small>
                  <strong>{currentProfile.area_name || '—'}</strong>
                </span>
              </div>

              <div>
                <Mail size={18} />
                <span>
                  <small>Account email</small>
                  <strong>{currentProfile.email || '—'}</strong>
                </span>
              </div>

              <div>
                <Phone size={18} />
                <span>
                  <small>Phone</small>
                  <strong>{currentProfile.phone || 'Not provided'}</strong>
                </span>
              </div>

              <div>
                <CheckCircle2 size={18} />
                <span>
                  <small>Account status</small>
                  <strong>{currentProfile.is_active ? 'Active' : 'Inactive'}</strong>
                </span>
              </div>
            </div>
          </article>
        </section>
      )}
    </div>
  );
};

export default EmployeeSettings;
