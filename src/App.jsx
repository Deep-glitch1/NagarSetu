import React, { useState } from 'react';
import PortalEntry from './components/PortalEntry';
import UserPortal from './components/UserPortal';
import AdminPortal from './components/AdminPortal';

function App() {
  const [currentView, setCurrentView] = useState('entry');
  const [userData, setUserData] = useState(null);

  const handleUserLogin = (data) => {
    setUserData(data);
    setCurrentView('user');
  };

  const handleAdminLogin = (data) => {
    setUserData(data);
    setCurrentView('admin');
  };

  const handleLogout = () => {
    setUserData(null);
    setCurrentView('entry');
  };

  if (currentView === 'entry') {
    return <PortalEntry 
      onUserLogin={handleUserLogin} 
      onAdminLogin={handleAdminLogin} 
    />;
  }

  if (currentView === 'user') {
    return <UserPortal userData={userData} onLogout={handleLogout} />;
  }

  if (currentView === 'admin') {
    return <AdminPortal userData={userData} onLogout={handleLogout} />;
  }

  return null;
}

export default App;