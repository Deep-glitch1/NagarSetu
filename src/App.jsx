import React, { useEffect, useState } from 'react';
import PortalEntry from './components/PortalEntry';
import UserPortal from './components/UserPortal';
import AdminPortal from './components/AdminPortal';
import PasswordResetPanel from './components/PasswordResetPanel';
import { apiFetch } from './api/client';

function App() {
  const [currentView, setCurrentView] = useState('entry');
  const [userData, setUserData] = useState(null);
  const [checkingSession, setCheckingSession] = useState(true);

  // ============================================================
  // PASSWORD RESET ROUTE
  // ============================================================

  const resetToken = new URLSearchParams(
    window.location.search
  ).get('token');

  const isPasswordResetRoute =
    window.location.pathname === '/reset-password' &&
    !!resetToken;

  // ============================================================
  // RESTORE REDIS SESSION
  // ============================================================

  useEffect(() => {
    // Do not restore the normal application session
    // while the user is opening a password reset link.
    if (isPasswordResetRoute) {
      setCheckingSession(false);
      return;
    }

    const restoreSession = async () => {
      try {
        const data = await apiFetch('/auth/me');

        if (!data.user) {
          setUserData(null);
          setCurrentView('entry');
          return;
        }

        setUserData(data.user);

        if (data.user.role === 'employee') {
          setCurrentView('admin');
        } else {
          setCurrentView('user');
        }
      } catch (error) {
        console.error(
          'Session restore failed:',
          error
        );

        setUserData(null);
        setCurrentView('entry');
      } finally {
        setCheckingSession(false);
      }
    };

    restoreSession();
  }, [isPasswordResetRoute]);

  // ============================================================
  // CITIZEN LOGIN
  // ============================================================

  const handleUserLogin = (data) => {
    setUserData(data);
    setCurrentView('user');
  };

  // ============================================================
  // EMPLOYEE LOGIN
  // ============================================================

  const handleAdminLogin = (data) => {
    setUserData(data);
    setCurrentView('admin');
  };

  // ============================================================
  // LOGOUT
  // ============================================================

  const handleLogout = async () => {
    try {
      await apiFetch('/auth/logout', {
        method: 'POST',
      });
    } catch (error) {
      console.error(
        'Logout request failed:',
        error
      );
    } finally {
      setUserData(null);
      setCurrentView('entry');
    }
  };

  // ============================================================
  // PROFILE UPDATE
  // ============================================================

  const handleProfileUpdate = (updatedUser) => {
    setUserData(updatedUser);
  };

  // ============================================================
  // PASSWORD RESET PAGE
  // ============================================================

  if (isPasswordResetRoute) {
    return (
      <PasswordResetPanel
        isOpen={true}
        mode="reset"
        accountType="citizen"
        token={resetToken}
        onClose={() => {
          window.location.href = '/';
        }}
        onBackToLogin={() => {
          window.location.href = '/';
        }}
      />
    );
  }

  // ============================================================
  // SESSION CHECK
  // ============================================================

  if (checkingSession) {
    return null;
  }

  // ============================================================
  // PORTAL ENTRY
  // ============================================================

  if (currentView === 'entry') {
    return (
      <PortalEntry
        onUserLogin={handleUserLogin}
        onAdminLogin={handleAdminLogin}
      />
    );
  }

  // ============================================================
  // CITIZEN PORTAL
  // ============================================================

  if (currentView === 'user') {
    return (
      <UserPortal
        userData={userData}
        onLogout={handleLogout}
        onProfileUpdate={handleProfileUpdate}
      />
    );
  }

  // ============================================================
  // EMPLOYEE / ADMIN PORTAL
  // ============================================================

  if (currentView === 'admin') {
    return (
      <AdminPortal
        userData={userData}
        onLogout={handleLogout}
      />
    );
  }

  return null;
}

export default App;