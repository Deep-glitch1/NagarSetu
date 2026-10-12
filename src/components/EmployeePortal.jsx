import React, {
  useEffect,
  useMemo,
  useState,
} from 'react';

import {
  Home,
  ClipboardList,
  Settings,
  UserCheck,
} from 'lucide-react';

import CivicShell from '../CivicShell';

import { apiFetch } from '../api/client';

import EmployeeDashboard from './employee/EmployeeDashboard';
import EmployeeTasks from './employee/EmployeeTasks';
import EmployeeTaskDetails from './employee/EmployeeTaskDetails';
import EmployeeAssignments from './employee/EmployeeAssignments';
import EmployeeSettings from './employee/EmployeeSettings';

import './employee/EmployeePortal.css';

const EmployeePortal = ({
  userData,
  onLogout,
}) => {
  const [activeTab, setActiveTab] =
    useState('dashboard');

  const [selectedTaskId, setSelectedTaskId] =
    useState(null);

  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const employeeRole =
    userData?.employee_role;

  const isSupervisor =
    employeeRole === 'supervisor';

  const loadTasks = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch(
        '/employee/complaints/tasks'
      );

      setTasks(
        Array.isArray(data?.tasks)
          ? data.tasks
          : []
      );
    } catch (err) {
      console.error(
        'Employee tasks load failed:',
        err
      );

      setTasks([]);

      setError(
        err.message ||
        'Unable to load your assigned tasks.'
      );
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const stats = useMemo(() => {
    const inProgress = tasks.filter(
      (task) =>
        task.status === 'in_progress'
    ).length;

    const pendingVerification =
      tasks.filter(
        (task) =>
          task.status ===
          'pending_verification'
      ).length;

    const urgent = tasks.filter((task) =>
      ['critical', 'high'].includes(
        String(
          task.priority || ''
        ).toLowerCase()
      )
    ).length;

    return {
      total: tasks.length,
      inProgress,
      pendingVerification,
      urgent,
    };
  }, [tasks]);

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

  const openTask = (task) => {
    setSelectedTaskId(task.id);
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
      activeTab={
        activeTab === 'task-details'
          ? 'tasks'
          : activeTab
      }
      onTabChange={navigate}
      searchPlaceholder="Search complaints"
    >
      {(currentTab) => {
        if (currentTab === 'dashboard') {
          return (
            <EmployeeDashboard
              userData={userData}
              employeeRole={employeeRole}
              stats={stats}
              loading={loading}
              error={error}
              onRefresh={loadTasks}
              onNavigate={navigate}
            />
          );
        }

        if (currentTab === 'tasks') {
          return (
            <EmployeeTasks
              tasks={tasks}
              loading={loading}
              error={error}
              onRefresh={loadTasks}
              onOpenTask={openTask}
            />
          );
        }

        if (currentTab === 'task-details') {
          return selectedTaskId ? (
            <EmployeeTaskDetails
              taskId={selectedTaskId}
              onBack={backToTasks}
            />
          ) : (
            <EmployeeTasks
              tasks={tasks}
              loading={loading}
              error={error}
              onRefresh={loadTasks}
              onOpenTask={openTask}
            />
          );
        }

        if (currentTab === 'assignments') {
          return <EmployeeAssignments />;
        }

        if (currentTab === 'settings') {
          return (
            <EmployeeSettings
              userData={userData}
            />
          );
        }

        return null;
      }}
    </CivicShell>
  );
};

export default EmployeePortal;