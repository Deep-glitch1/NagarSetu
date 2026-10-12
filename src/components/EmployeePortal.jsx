import React, { useState } from 'react';
import {
  Home,
  ClipboardList,
  Settings,
  UserCheck,
} from 'lucide-react';

import CivicShell from '../CivicShell';
import EmployeeDashboard from './employee/EmployeeDashboard';
import EmployeeTasks from './employee/EmployeeTasks';
import EmployeeTaskDetails from './employee/EmployeeTaskDetails';
import EmployeeAssignments from './employee/EmployeeAssignments';
import EmployeeSettings from './employee/EmployeeSettings';
import './employee/EmployeePortal.css';

const EmployeePortal = ({ userData, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTaskId, setSelectedTaskId] = useState(null);

  const employeeRole = userData?.employee_role;
  const isSupervisor = employeeRole === 'supervisor';

  const menuItems = [
    {
      id: 'dashboard',
      label: 'Dashboard',
      icon: Home,
    },
    {
      id: 'tasks',
      label: 'My tasks',
      icon: ClipboardList,
    },
    ...(isSupervisor
      ? [
          {
            id: 'assignments',
            label: 'Assignments',
            icon: UserCheck,
          },
        ]
      : []),
    {
      id: 'settings',
      label: 'Settings',
      icon: Settings,
    },
  ];

  const navigate = (tabId) => {
    setActiveTab(tabId);
  };

  const openTask = (taskId) => {
    setSelectedTaskId(taskId);
    setActiveTab('task-details');
  };

  const backToTasks = () => {
    setSelectedTaskId(null);
    setActiveTab('tasks');
  };

  return (
    <CivicShell
      userData={userData}
      onLogout={onLogout}
      menuItems={menuItems}
      activeTab={activeTab === 'task-details' ? 'tasks' : activeTab}
      onTabChange={navigate}
      searchPlaceholder="Search complaints"
    >
      {(currentTab) => {
        if (currentTab === 'dashboard') {
          return (
            <EmployeeDashboard
              userData={userData}
              onNavigate={navigate}
              onOpenTask={openTask}
            />
          );
        }

        if (currentTab === 'tasks') {
          return <EmployeeTasks onOpenTask={openTask} />;
        }

        if (currentTab === 'task-details') {
          return selectedTaskId ? (
            <EmployeeTaskDetails
              taskId={selectedTaskId}
              onBack={backToTasks}
            />
          ) : (
            <EmployeeTasks onOpenTask={openTask} />
          );
        }

        if (currentTab === 'assignments') {
          return <EmployeeAssignments />;
        }

        if (currentTab === 'settings') {
          return <EmployeeSettings userData={userData} />;
        }

        return null;
      }}
    </CivicShell>
  );
};

export default EmployeePortal;
