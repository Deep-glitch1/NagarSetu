import React, { useState } from 'react';
import {
  ArrowRight,
  Building2,
  CheckCircle2,
  Clock3,
  Landmark,
  MapPin,
  ShieldCheck,
  Sparkles,
  UserRound,
} from 'lucide-react';

import LoginPanel from './LoginPanel';
import RegisterPanel from './RegisterPanel';
import PasswordResetPanel from './PasswordResetPanel';

const PortalEntry = ({
  onUserLogin,
  onAdminLogin,
}) => {
  const [screen, setScreen] = useState(null);

  const [forgotAccountType, setForgotAccountType] =
    useState('citizen');

  const stats = [
    ['24,891', 'Issues resolved', CheckCircle2],
    ['4.2 hrs', 'Average response', Clock3],
    ['94%', 'Citizen satisfaction', Sparkles],
    ['60', 'Wards connected', MapPin],
  ];

  const openForgotPassword = (accountType) => {
    setForgotAccountType(accountType);
    setScreen('forgot');
  };

  return (
    <div className="heritage-entry">
      {/* NAVBAR */}
      <header className="heritage-nav">
        <div className="heritage-logo">
          <span>
            <Building2 size={20} />
          </span>
          Nagar<b>Setu</b>
        </div>

        <div className="heritage-nav-links">
          <a href="#how-it-works">
            How it works
          </a>

          <a href="#impact">
            Our impact
          </a>

          <button
            onClick={() => setScreen('citizen')}
          >
            Sign in
            <ArrowRight size={16} />
          </button>
        </div>
      </header>

      <main>
        {/* HERO */}
        <section className="heritage-hero">
          <div className="heritage-copy">
            <p className="heritage-kicker">
              <span />
              Haldwani–Kathgodam Municipal Corporation
            </p>

            <h1>
              Bridging citizens.
              <br />
              <em>Building better cities.</em>
            </h1>

            <p className="heritage-lead">
              A simpler way to report civic issues,
              follow progress, and make every
              neighbourhood stronger.
            </p>

            <div className="heritage-actions">
              <button
                className="heritage-primary"
                onClick={() =>
                  setScreen('citizen')
                }
              >
                Report an issue
                <ArrowRight size={18} />
              </button>

              <a href="#how-it-works">
                Learn how it works
              </a>
            </div>
          </div>

          <div
            className="heritage-scene"
            aria-hidden="true"
          >
            <div className="heritage-sun" />
            <div className="heritage-building heritage-building-one" />
            <div className="heritage-building heritage-building-two" />
            <div className="heritage-building heritage-building-three" />
            <div className="heritage-ground" />
            <Landmark size={114} />

            <span className="heritage-scene-caption">
              A more responsive city, together.
            </span>
          </div>
        </section>

        {/* STATS */}
        <section
          className="heritage-stats"
          id="impact"
        >
          {stats.map(
            ([value, label, Icon]) => (
              <article key={label}>
                <Icon size={19} />
                <strong>{value}</strong>
                <span>{label}</span>
              </article>
            )
          )}
        </section>

        {/* PORTAL CHOICE */}
        <section
          className="heritage-choose"
          id="how-it-works"
        >
          <div className="heritage-section-heading">
            <p className="heritage-kicker">
              <span />
              Choose your portal
            </p>

            <h2>
              Start where you are needed.
            </h2>

            <p>
              Whether you are reporting an issue
              or helping resolve one, NagarSetu
              keeps the next step clear.
            </p>
          </div>

          <div className="heritage-portal-grid">
            {/* CITIZEN */}
            <button
              className="heritage-portal citizen"
              onClick={() =>
                setScreen('citizen')
              }
            >
              <span className="heritage-portal-icon">
                <UserRound size={27} />
              </span>

              <div>
                <small>For residents</small>

                <h3>I am a citizen</h3>

                <p>
                  Report local issues and see every
                  update.
                </p>
              </div>

              <ArrowRight size={21} />
            </button>

            {/* ADMIN */}
            <button
              className="heritage-portal admin"
              onClick={() =>
                setScreen('admin')
              }
            >
              <span className="heritage-portal-icon">
                <ShieldCheck size={27} />
              </span>

              <div>
                <small>
                  For municipal teams
                </small>

                <h3>
                  I am an administrator
                </h3>

                <p>
                  Prioritise, assign, and resolve
                  with clarity.
                </p>
              </div>

              <ArrowRight size={21} />
            </button>
          </div>
        </section>
      </main>

      {/* FOOTER */}
      <footer className="heritage-footer">
        <span>© 2026 NagarSetu</span>
        <span>
          Built for Haldwani–Kathgodam,
          Uttarakhand
        </span>
      </footer>

      {/* CITIZEN LOGIN */}
      <LoginPanel
        isOpen={screen === 'citizen'}
        onClose={() => setScreen(null)}
        onLogin={onUserLogin}
        title="Citizen sign in"
        subtitle="Access your reports and stay connected to your neighbourhood."
        type="citizen"
        registerAction={() =>
          setScreen('register')
        }
        forgotPasswordAction={() =>
          openForgotPassword('citizen')
        }
      />

      {/* ADMIN LOGIN */}
      <LoginPanel
        isOpen={screen === 'admin'}
        onClose={() => setScreen(null)}
        onLogin={onAdminLogin}
        title="Administrator sign in"
        subtitle="Access the workspace for resolving civic complaints."
        type="admin"
        forgotPasswordAction={() =>
          openForgotPassword('employee')
        }
      />

      {/* REGISTER */}
      <RegisterPanel
        isOpen={screen === 'register'}
        onClose={() => setScreen(null)}
        onRegister={(user) => {
          onUserLogin(user);
          setScreen(null);
        }}
        title="Create citizen account"
        subtitle="Join NagarSetu and report local issues."
        type="citizen"
        loginAction={() => setScreen('citizen')}
      />

      {/* FORGOT PASSWORD */}
      <PasswordResetPanel
        isOpen={screen === 'forgot'}
        mode="forgot"
        accountType={forgotAccountType}
        onClose={() => setScreen(null)}
        onBackToLogin={() =>
          setScreen(
            forgotAccountType === 'citizen'
              ? 'citizen'
              : 'admin'
          )
        }
      />
    </div>
  );
};

export default PortalEntry;