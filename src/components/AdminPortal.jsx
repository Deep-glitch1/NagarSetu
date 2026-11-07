import React, { useState } from 'react';

import {
  Home,
  Users,
  BarChart3,
  Settings,
  Building2,
  ClipboardList,
  Truck,
  ShieldAlert,
} from 'lucide-react';

import CivicShell from './CivicShell';

import AdminDashboard from './admin/AdminDashboard';
import AdminComplaints from './admin/AdminComplaints';
import AdminAnalytics from './admin/AdminAnalytics';
import AdminDepartments from './admin/AdminDepartments';
import AdminEmployees from './admin/AdminEmployees';
import AdminSettings from './admin/AdminSettings';
import AdminWasteCollection from './admin/AdminWasteCollection';


const MANAGEMENT_ROLES = new Set([
  'super_admin',
  'municipal_admin',
]);


const AdminPortal = ({
  userData,
  onLogout,
}) => {
  const [activeTab, setActiveTab] =
    useState('dashboard');


  // ============================================================
  // ROLE / ACCESS
  // ============================================================

  const employeeRole = userData?.employee_role;
  const canManageDepartmentsAndUsers = MANAGEMENT_ROLES.has(employeeRole);
  const canManageWasteCollection = employeeRole === 'super_admin';
 
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

    ...(canManageDepartmentsAndUsers
      ? [
          {
            id: 'departments',
            label: 'Departments',
            icon: Building2,
          },
          {
            id: 'employees',
            label: 'Employees',
            icon: Users,
          },
        ]
      : []),

    ...(canManageWasteCollection
      ? [
          {
            id: 'waste-collection',
            label: 'Waste collection',
            icon: Truck,
          },
        ]
      : []),

    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];


  // ============================================================
  // NAVIGATION
  // ============================================================

  const navigate = (tabId) => {
    setActiveTab(tabId);
  };


  // ============================================================
  // CONTENT
  // ============================================================

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

        // ------------------------------------------------------
        // DASHBOARD
        // ------------------------------------------------------

        if (currentTab === 'dashboard') {
          return (
            <AdminDashboard
              userData={userData}
              onNavigate={navigate}
            />
          );
        }


        // ------------------------------------------------------
        // COMPLAINTS
        // ------------------------------------------------------

        if (currentTab === 'complaints') {
          return <AdminComplaints />;
        }


        // ------------------------------------------------------
        // ANALYTICS
        // ------------------------------------------------------

        if (currentTab === 'analytics') {
          return <AdminAnalytics />;
        }


        // ------------------------------------------------------
        // DEPARTMENTS
        // ------------------------------------------------------

        if (
          currentTab === 'departments' &&
          canManageDepartmentsAndUsers
        ) {
          return <AdminDepartments />;
        }


        // ------------------------------------------------------
        // EMPLOYEES
        // ------------------------------------------------------

        if (
          currentTab === 'employees' &&
          canManageDepartmentsAndUsers
        ) {
          return (
            <AdminEmployees
              userData={userData}
            />
          );
        }


        // ------------------------------------------------------
        // WASTE COLLECTION
        // ------------------------------------------------------

        if (
          currentTab === 'waste-collection' &&
          canManageWasteCollection
        ) {
          return <AdminWasteCollection />;
        }


        // ------------------------------------------------------
        // SETTINGS
        // ------------------------------------------------------

        if (currentTab === 'settings') {
          return (
            <AdminSettings
              userData={userData}
            />
          );
        }


        return (
          <div className="civic-empty">
            <ShieldAlert size={30} />
            <h2>Not authorized</h2>
            <p>Your role does not have access to this section.</p>
          </div>
        );
      }}
    </CivicShell>
  );
};


export default AdminPortal;
