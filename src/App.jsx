import React, { useEffect, useState } from 'react';

import PortalEntry from './components/PortalEntry';
import UserPortal from './components/UserPortal';
import AdminPortal from './components/AdminPortal';
import EmployeePortal from './components/EmployeePortal';
import PasswordResetPanel from './components/PasswordResetPanel';

import { apiFetch } from './api/client';


// ============================================================
// ADMIN ROLES
// ============================================================

const ADMIN_ROLES = [
  'department_head',
  'block_officer',
  'district_officer',
  'municipal_admin',
  'super_admin',
];


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


        // --------------------------------------------------------
        // CITIZEN
        // --------------------------------------------------------

        if (data.user.role === 'citizen') {
          setCurrentView('user');
          return;
        }


        // --------------------------------------------------------
        // EMPLOYEE
        // --------------------------------------------------------

        if (data.user.role === 'employee') {
          if (
            ADMIN_ROLES.includes(
              data.user.employee_role
            )
          ) {
            setCurrentView('admin');
          } else {
            setCurrentView('employee');
          }

          return;
        }


        // --------------------------------------------------------
        // UNKNOWN ROLE
        // --------------------------------------------------------

        setUserData(null);
        setCurrentView('entry');

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
  // GLOBAL SESSION EXPIRY HANDLER
  // ============================================================

  useEffect(() => {
    const handleUnauthorized = () => {
      setUserData(null);
      setCurrentView('entry');
    };

    window.addEventListener(
      'nagarsetu:unauthorized',
      handleUnauthorized
    );

    return () => {
      window.removeEventListener(
        'nagarsetu:unauthorized',
        handleUnauthorized
      );
    };
  }, []);


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

  const handleEmployeeLogin = (data) => {
    setUserData(data);

    if (data.role === 'employee') {

      if (
        ADMIN_ROLES.includes(
          data.employee_role
        )
      ) {
        setCurrentView('admin');
      } else {
        setCurrentView('employee');
      }

      return;
    }

    // Safety fallback
    setCurrentView('entry');
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
        onAdminLogin={handleEmployeeLogin}
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
  // EMPLOYEE PORTAL
  // ============================================================

  if (currentView === 'employee') {
    return (
      <EmployeePortal
        userData={userData}
        onLogout={handleLogout}
      />
    );
  }


  // ============================================================
  // ADMIN PORTAL
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