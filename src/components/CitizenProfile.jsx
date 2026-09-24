import React, { useEffect, useState } from 'react';
import {
  CheckCircle2,
  Mail,
  Phone,
  Save,
  ShieldCheck,
  User,
  LoaderCircle,
  AlertCircle,
  CalendarDays,
} from 'lucide-react';

import { apiFetch } from '../api/client';

const CitizenProfile = ({ onProfileUpdate, onLogout }) => {
  const [profile, setProfile] = useState(null);

  const [name, setName] = useState('');
  const [phone, setPhone] = useState('');

  const [isLoading, setIsLoading] = useState(true);
  const [isSaving, setIsSaving] = useState(false);

  const [error, setError] = useState('');
  const [success, setSuccess] = useState('');

  // ============================================================
  // GET PROFILE
  // GET /citizen/profile
  // ============================================================

  const fetchProfile = async () => {
    setIsLoading(true);
    setError('');
    setSuccess('');

    try {
      const data = await apiFetch('/citizen/profile');

      setProfile(data);
      setName(data.name || '');
      setPhone(data.phone || '');

      // Keep app-level user data synchronized.
      if (onProfileUpdate) {
        onProfileUpdate({
          id: data.id,
          name: data.name,
          email: data.email,
          role: 'citizen',
        });
      }
    } catch (err) {
      console.error('Profile fetch error:', err);

      // Session cookie is invalid / expired.
      if (err.status === 401) {
        onLogout?.();
        return;
      }

      setError(
        err.message || 'Unable to load your profile.'
      );
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    fetchProfile();
  }, []);

  // ============================================================
  // UPDATE PROFILE
  // PATCH /citizen/profile
  // ============================================================

  const handleSubmit = async (event) => {
    event.preventDefault();

    setError('');
    setSuccess('');

    const cleanedName = name.trim();
    const cleanedPhone = phone.trim();

    // ----------------------------------------------------------
    // CLIENT-SIDE VALIDATION
    // ----------------------------------------------------------

    if (!cleanedName) {
      setError('Name cannot be blank.');
      return;
    }

    if (cleanedName.length < 2) {
      setError('Name must contain at least 2 characters.');
      return;
    }

    // ----------------------------------------------------------
    // CHECK WHETHER ANYTHING ACTUALLY CHANGED
    // ----------------------------------------------------------

    const nameChanged =
      cleanedName !== (profile?.name || '');

    const phoneChanged =
      cleanedPhone !== (profile?.phone || '');

    if (!nameChanged && !phoneChanged) {
      setSuccess('No changes to save.');
      return;
    }

    setIsSaving(true);

    try {
      // --------------------------------------------------------
      // BUILD ONLY THE CHANGED FIELDS
      // --------------------------------------------------------

      const payload = {};

      if (nameChanged) {
        payload.name = cleanedName;
      }

      if (phoneChanged) {
        payload.phone = cleanedPhone || null;
      }

      // --------------------------------------------------------
      // UPDATE PROFILE
      // --------------------------------------------------------

      const data = await apiFetch(
        '/citizen/profile',
        {
          method: 'PATCH',
          body: JSON.stringify(payload),
        }
      );

      // --------------------------------------------------------
      // UPDATE LOCAL PROFILE STATE
      // --------------------------------------------------------

      setProfile(data);
      setName(data.name || '');
      setPhone(data.phone || '');

      // Keep app-level user data synchronized.
      if (onProfileUpdate) {
        onProfileUpdate({
          id: data.id,
          name: data.name,
          email: data.email,
          role: 'citizen',
        });
      }

      setSuccess('Profile updated successfully.');
    } catch (err) {
      console.error('Profile update error:', err);

      // Session cookie is invalid / expired.
      if (err.status === 401) {
        onLogout?.();
        return;
      }

      setError(
        err.message ||
          'Unable to update your profile.'
      );
    } finally {
      setIsSaving(false);
    }
  };

  // ============================================================
  // LOADING
  // ============================================================

  if (isLoading) {
    return (
      <div className="civic-profile-page civic-empty">
        <LoaderCircle
          size={30}
          className="animate-spin"
        />

        <h2>Loading your profile</h2>

        <p>Please wait a moment.</p>
      </div>
    );
  }

  // ============================================================
  // PROFILE LOAD FAILED
  // ============================================================

  if (!profile) {
    return (
      <div className="civic-profile-page civic-empty">
        <AlertCircle size={30} />

        <h2>Unable to load profile</h2>

        <p>
          {error ||
            'Something went wrong while loading your account.'}
        </p>

        <button
          type="button"
          className="civic-profile-retry"
          onClick={fetchProfile}
        >
          Try again
        </button>
      </div>
    );
  }

  // ============================================================
  // ACCOUNT CREATION DATE
  // ============================================================

  const formattedCreatedAt = profile.created_at
    ? new Date(
        profile.created_at
      ).toLocaleDateString('en-IN', {
        day: 'numeric',
        month: 'long',
        year: 'numeric',
      })
    : '—';

  // ============================================================
  // UI
  // ============================================================

  return (
    <div className="civic-profile-page">

      {/* ======================================================
          HEADER
      ====================================================== */}

      <section className="civic-profile-header">
        <div>
          <p className="civic-eyebrow">
            Account
          </p>

          <h2>Your profile</h2>

          <p>
            Manage the personal information associated
            with your NagarSetu account.
          </p>
        </div>

        <div className="civic-profile-avatar">
          <User size={28} />
        </div>
      </section>

      {/* ======================================================
          ERROR
      ====================================================== */}

      {error && (
        <div className="civic-profile-message civic-profile-error">
          <AlertCircle size={17} />

          <span>{error}</span>
        </div>
      )}

      {/* ======================================================
          SUCCESS
      ====================================================== */}

      {success && (
        <div className="civic-profile-message civic-profile-success">
          <CheckCircle2 size={17} />

          <span>{success}</span>
        </div>
      )}

      {/* ======================================================
          PROFILE FORM
      ====================================================== */}

      <form
        className="civic-profile-grid"
        onSubmit={handleSubmit}
      >

        {/* ==================================================
            PERSONAL INFORMATION
        ================================================== */}

        <section className="civic-panel civic-profile-card">

          <div className="civic-panel-title">
            <div>
              <p className="civic-eyebrow">
                Personal information
              </p>

              <h3>Your details</h3>
            </div>
          </div>

          <div className="civic-profile-fields">

            {/* NAME */}

            <label className="civic-profile-field">
              <span>Name</span>

              <div className="civic-profile-input">
                <User size={17} />

                <input
                  type="text"
                  value={name}
                  onChange={(event) =>
                    setName(event.target.value)
                  }
                  maxLength={150}
                  minLength={2}
                  required
                  placeholder="Your full name"
                />
              </div>
            </label>

            {/* EMAIL */}

            <label className="civic-profile-field">
              <span>Email address</span>

              <div className="civic-profile-input civic-profile-readonly">
                <Mail size={17} />

                <input
                  type="email"
                  value={profile.email}
                  readOnly
                />

                {profile.email_verified && (
                  <span className="civic-verified">
                    <CheckCircle2 size={14} />

                    Verified
                  </span>
                )}
              </div>

              <small>
                Email cannot be changed from your profile.
              </small>
            </label>

            {/* PHONE */}

            <label className="civic-profile-field">
              <span>Phone number</span>

              <div className="civic-profile-input">
                <Phone size={17} />

                <input
                  type="tel"
                  value={phone}
                  onChange={(event) =>
                    setPhone(event.target.value)
                  }
                  maxLength={15}
                  placeholder="Optional phone number"
                />
              </div>

              <small>
                Leave empty if you do not want to provide a
                phone number.
              </small>
            </label>

            {/* SAVE */}

            <button
              type="submit"
              className="civic-profile-save"
              disabled={isSaving}
            >
              {isSaving ? (
                <>
                  <LoaderCircle
                    size={17}
                    className="animate-spin"
                  />

                  Saving...
                </>
              ) : (
                <>
                  <Save size={17} />

                  Save changes
                </>
              )}
            </button>

          </div>
        </section>

        {/* ==================================================
            RIGHT SIDE
        ================================================== */}

        <aside className="civic-profile-side">

          {/* ACCOUNT STATUS */}

          <section className="civic-panel civic-profile-card">

            <p className="civic-eyebrow">
              Account status
            </p>

            <div className="civic-profile-status">
              {profile.is_active ? (
                <CheckCircle2 size={20} />
              ) : (
                <AlertCircle size={20} />
              )}

              <div>
                <strong>
                  {profile.is_active
                    ? 'Active account'
                    : 'Inactive account'}
                </strong>

                <span>
                  {profile.is_active
                    ? 'Your NagarSetu account is active.'
                    : 'Your account has been deactivated.'}
                </span>
              </div>
            </div>

          </section>

          {/* TRUST SCORE */}

          <section className="civic-panel civic-profile-card">

            <p className="civic-eyebrow">
              Citizen trust
            </p>

            <div className="civic-profile-trust">
              <strong>
                {profile.trust_score ?? '—'}
              </strong>

              <span>
                Trust score
              </span>
            </div>

            <p className="civic-profile-note">
              Your trust score is maintained by the
              NagarSetu system and cannot be edited from your
              profile.
            </p>

          </section>

          {/* ACCOUNT HISTORY */}

          <section className="civic-panel civic-profile-card">

            <p className="civic-eyebrow">
              Account history
            </p>

            <div className="civic-profile-meta">

              <CalendarDays size={18} />

              <div>
                <span>
                  Member since
                </span>

                <strong>
                  {formattedCreatedAt}
                </strong>
              </div>

            </div>

            <div className="civic-profile-meta">

              <ShieldCheck size={18} />

              <div>
                <span>
                  Email verification
                </span>

                <strong>
                  {profile.email_verified
                    ? 'Verified'
                    : 'Not verified'}
                </strong>
              </div>

            </div>

          </section>

        </aside>
      </form>
    </div>
  );
};

export default CitizenProfile;