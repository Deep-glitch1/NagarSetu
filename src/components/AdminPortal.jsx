import React, { useState } from 'react';

import {
  Home,
  Users,
  BarChart3,
  Settings,
  Building2,
  ClipboardList,
  Truck,
} from 'lucide-react';

import { apiFetch } from '../api/client';

import CivicShell from './CivicShell';

import AdminDashboard from './admin/AdminDashboard';
import AdminComplaints from './admin/AdminComplaints';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminDepartments from './admin/AdminDepartments';
import AdminUsers from './admin/AdminUsers';
import AdminSettings from './admin/AdminSettings';
import AdminWasteCollection from './admin/AdminWasteCollection';


const AdminPortal = ({
  userData,
  onLogout,
}) => {

  const [activeTab, setActiveTab] =
    useState('dashboard');

  const canManageWasteCollection = userData?.employee_role === 'super_admin';


  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
    },

    {
      id: 'complaints',
      label: 'Complaints Queue',
      icon: ClipboardList,
    },

    {
      id: 'analytics',
      label: 'Analytics',
      icon: BarChart3,
    },

    {
      id: 'departments',
      label: 'Departments',
      icon: Building2,
    },

    {
      id: 'users',
      label: 'Users',
      icon: Users,
    },

    ...(canManageWasteCollection ? [{
      id: 'waste-collection',
      label: 'Waste collection',
      icon: Truck,
    }] : []),

    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];


  const navigate = (tabId) => {
    setActiveTab(tabId);
  };


  return (
    <CivicShell
      userData={userData}
      onLogout={onLogout}
      menuItems={menuItems}
      activeTab={activeTab}
      onTabChange={navigate}
      searchPlaceholder="Search complaints"
    >

      {(currentTab) => {

        if (currentTab === 'dashboard') {
          return (
            <AdminDashboard
              userData={userData}
              onNavigate={navigate}
            />
          );
        }

        if (currentTab === 'complaints') {
          return (
            <AdminComplaints />
          );
        }

        if (currentTab === 'analytics') {
          return (
            <AdminAnalytics />
          );
        }

        if (currentTab === 'departments') {
          return (
            <AdminDepartments />
          );
        }

        if (currentTab === 'users') {
          return (
            <AdminUsers />
          );
        }

        if (currentTab === 'waste-collection' && canManageWasteCollection) {
          return <AdminWasteCollection />;
        }

        if (currentTab === 'settings') {
          return (
            <AdminSettings />
          );
        }

        return null;
      }}

    </CivicShell>
  );
};


export default AdminPortal;
