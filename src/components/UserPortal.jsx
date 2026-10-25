import React, { useState } from 'react';

import {
  Home,
  MapPin,
  Award,
  Settings,
  Camera,
  UserCircle,
  Truck,
} from 'lucide-react';

import CivicShell from './CivicShell';
import CitizenProfile from './CitizenProfile';
import CitizenDashboard from './citizen/CitizenDashboard';
import AccountSettings from './citizen/AccountSettings';
import ReportIssue from './citizen/ReportIssue';
import MyComplaints from './citizen/MyComplaints';
import MyImpact from './citizen/MyImpact';
import WasteCollectionTracking from './citizen/WasteCollectionTracking';
import './citizen/CitizenPortal.css';

const UserPortal = ({
  userData,
  onLogout,
  onProfileUpdate,
}) => {
  /*
   * UserPortal owns the current page.
   * CivicShell only displays the navigation and
   * calls onTabChange when the user clicks a tab.
   *
   * Child components can also call onNavigate()
   * to move the user to another tab.
   */

  const [activeTab, setActiveTab] =
    useState('dashboard');

  const menuItems = [
    {
      id: 'dashboard',
      label: 'My dashboard',
      icon: Home,
    },

    {
      id: 'profile',
      label: 'My profile',
      icon: UserCircle,
    },

    {
      id: 'report',
      label: 'Report an issue',
      icon: Camera,
    },
    {
      id: 'waste-collection',
      label: 'Waste collection',
      icon: Truck,
    },
    {
      id: 'complaints',
      label: 'My complaints',
      icon: MapPin,
    },

    {
      id: 'achievements',
      label: 'My impact',
      icon: Award,
    },

    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const navigate = (tabId) => {
    setActiveTab(tabId);
  };

  const handleLogout = () => {
    onLogout();
  };

  return (
    <CivicShell
      userData={userData}
      onLogout={handleLogout}
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={navigate}
      searchPlaceholder="Search your reports"
    >
      {(currentTab, activeItem) =>
        currentTab === 'dashboard' ? (
          <CitizenDashboard
            userData={userData}
            onNavigate={navigate}
          />
        ) : currentTab === 'profile' ? (
          <CitizenProfile
            onProfileUpdate={onProfileUpdate}
            onLogout={onLogout}
          />
        ) : currentTab === 'report' ? (
          <ReportIssue />
        ) : currentTab === 'waste-collection' ? (
          <WasteCollectionTracking />
        ) : currentTab === 'complaints' ? (
          <MyComplaints />
        ) : currentTab === 'achievements' ? (
          <MyImpact />
        ) : currentTab === 'waste-tracking' ? (
         <WasteCollectionTracking />
        ) : currentTab === 'settings' ? (
         <AccountSettings
           onLogout={onLogout}
         />
        ) : (
          <div className="civic-empty">
            {activeItem?.icon &&
              React.createElement(
                activeItem.icon,
                { size: 30 }
              )}

            <h2>
              {activeItem?.label || 'Page'}
            </h2>

            <p>
              This workspace is ready for your
              next feature.
            </p>
          </div>
        )
      }
    </CivicShell>
  );
};

export default UserPortal;
