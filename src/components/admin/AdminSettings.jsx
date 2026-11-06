import React, { useEffect, useState } from 'react';
import { Lock, Save, ShieldCheck, UserRound } from 'lucide-react';
import { apiFetch } from '../../api/client';
import './AdminManagement.css';

export default function AdminSettings({ userData, onProfileUpdate }) {
  const [profile, setProfile] = useState(null);
  const [name, setName] = useState(userData?.name || '');
  const [phone, setPhone] = useState('');
  const [currentPassword, setCurrentPassword] = useState('');
  const [newPassword, setNewPassword] = useState('');
  const [confirmPassword, setConfirmPassword] = useState('');
  const [loading, setLoading] = useState(true);
  const [savingProfile, setSavingProfile] = useState(false);
  const [savingPassword, setSavingPassword] = useState(false);
  const [error, setError] = useState('');
  const [notice, setNotice] = useState('');

  useEffect(() => {
    const load = async () => {
      try {
        const data = await apiFetch('/admin/management/settings/profile');
        setProfile(data);
        setName(data.name || '');
        setPhone(data.phone || '');
      } catch (requestError) {
        setError(requestError.message || 'Unable to load profile.');
      } finally {
        setLoading(false);
      }
    };
    load();
  }, []);

  const updateProfile = async (event) => {
    event.preventDefault();
    setSavingProfile(true);
    setError('');
    setNotice('');
    try {
      const data = await apiFetch('/admin/management/settings/profile', {
        method: 'PATCH',
        body: JSON.stringify({ name: name.trim(), phone: phone.trim() || null }),
      });
      setProfile((current) => ({ ...current, ...data }));
      onProfileUpdate?.({
        ...userData,
        name: data.name,
        email: data.email,
        phone: data.phone,

      });
      setNotice('Profile updated successfully.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to update profile.');
    } finally {
      setSavingProfile(false);
    }
  };

  const updatePassword = async (event) => {
    event.preventDefault();
    setSavingPassword(true);
    setError('');
    setNotice('');

    try {
      if (newPassword.length < 6) throw new Error('New password must be at least 6 characters.');
      if (newPassword !== confirmPassword) throw new Error('New passwords do not match.');
      if (newPassword === currentPassword) throw new Error('New password must be different from the current password.');

      await apiFetch('/auth/change-password', {
        method: 'POST',
        body: JSON.stringify({
          current_password: currentPassword,
          new_password: newPassword,
        }),
      });

      setCurrentPassword('');
      setNewPassword('');
      setConfirmPassword('');
      setNotice('Password changed successfully.');
    } catch (requestError) {
      setError(requestError.message || 'Unable to change password.');
    } finally {
      setSavingPassword(false);
    }
  };

  if (loading) {
    return <div className="admin-management-loading"><ShieldCheck size={18} />Loading settings…</div>;
  }

  return (
    <div className="civic-dashboard">
      <section className="civic-welcome">
        <div>
          <p className="civic-eyebrow">Account</p>
          <h2>Settings</h2>
          <p>Manage your administrator profile and account security.</p>
        </div>
      </section>

      {error && <div className="admin-management-message is-error">{error}</div>}
      {notice && <div className="admin-management-message is-success">{notice}</div>}

      <section className="admin-management-grid">
        <article className="civic-panel">
          <div className="civic-panel-title"><div><p className="civic-eyebrow">Profile</p><h3>Administrator profile</h3></div><UserRound size={22} /></div>
          <form className="admin-management-form" onSubmit={updateProfile}>
            <label>Name<input value={name} onChange={(event) => setName(event.target.value)} required /></label>
            <label>Phone<input value={phone} onChange={(event) => setPhone(event.target.value)} /></label>
            <label>Email<input value={profile?.email || ''} disabled /></label>
            <label>Employee ID<input value={profile?.employee_id || ''} disabled /></label>
            <label>Role<input value={profile?.roles || 'Unassigned'} disabled /></label>
            <label>Department<input value={profile?.department_name || '—'} disabled /></label>
            <label className="span-2">Area<input value={profile?.area_name || '—'} disabled /></label>
            <div className="admin-management-form-actions span-2"><button type="submit" disabled={savingProfile}><Save size={16} /> {savingProfile ? 'Saving…' : 'Save profile'}</button></div>
          </form>
        </article>

        <article className="civic-panel">
          <div className="civic-panel-title"><div><p className="civic-eyebrow">Security</p><h3>Change password</h3></div><Lock size={22} /></div>
          <form className="admin-management-form" onSubmit={updatePassword}>
            <label className="span-2">Current password<input type="password" value={currentPassword} onChange={(event) => setCurrentPassword(event.target.value)} required /></label>
            <label>New password<input type="password" value={newPassword} onChange={(event) => setNewPassword(event.target.value)} minLength={6} required /></label>
            <label>Confirm password<input type="password" value={confirmPassword} onChange={(event) => setConfirmPassword(event.target.value)} minLength={6} required /></label>
            <div className="admin-management-form-actions span-2"><button type="submit" disabled={savingPassword}>{savingPassword ? 'Updating…' : 'Change password'}</button></div>
          </form>
        </article>
      </section>
    </div>
  );
}
