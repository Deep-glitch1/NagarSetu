import React, { useEffect, useMemo, useState } from 'react';
import {
  Home,
  ClipboardList,
  Settings,
  UserCheck,
  Clock3,
  CircleCheck,
  AlertTriangle,
} from 'lucide-react';

import CivicShell from './CivicShell';
import { apiFetch } from '../api/client';
import EmployeeDashboard from './employee/EmployeeDashboard';
import EmployeeTasks from './employee/EmployeeTasks';
import EmployeeTaskDetails from './employee/EmployeeTaskDetails';
import EmployeeAssignments from './employee/EmployeeAssignments';
import EmployeeSettings from './employee/EmployeeSettings';
import './employee/EmployeePortal.css';

const EmployeePortal = ({ userData, onLogout }) => {
  const [activeTab, setActiveTab] = useState('dashboard');
  const [selectedTask, setSelectedTask] = useState(null);
  const [tasks, setTasks] = useState([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState('');

  const employeeRole = userData?.employee_role;
  const isSupervisor = employeeRole === 'supervisor';

  const loadTasks = async () => {
    setLoading(true);
    setError('');

    try {
      const data = await apiFetch('/employee/complaints/tasks');
      setTasks(Array.isArray(data?.complaints) ? data.complaints : []);
    } catch (requestError) {
      console.error('Employee tasks load failed:', requestError);
      setTasks([]);
      setError(requestError.message || 'Unable to load your assigned tasks.');
    } finally {
      setLoading(false);
    }
  };

  useEffect(() => {
    loadTasks();
  }, []);

  const stats = useMemo(() => {
    const inProgress = tasks.filter((item) => item.status === 'in_progress').length;
    const pendingVerification = tasks.filter((item) => item.status === 'pending_verification').length;
    const highPriority = tasks.filter((item) =>
      ['high', 'critical'].includes(String(item.priority || '').toLowerCase())
    ).length;

    return [
      { label: 'My tasks', value: tasks.length, icon: ClipboardList },
      { label: 'In progress', value: inProgress, icon: Clock3 },
      { label: 'Pending verification', value: pendingVerification, icon: CircleCheck },
      { label: 'High priority', value: highPriority, icon: AlertTriangle },
    ];
  }, [tasks]);

  const menuItems = [
    { id: 'dashboard', label: 'Dashboard', icon: Home },
    { id: 'tasks', label: 'My tasks', icon: ClipboardList },
    ...(selectedTask ? [{ id: 'task-details', label: 'Task details', icon: ClipboardList }] : []),
    ...(isSupervisor ? [{ id: 'assignments', label: 'Assignments', icon: UserCheck }] : []),
    { id: 'settings', label: 'Settings', icon: Settings },
  ];

  const navigate = (tabId) => {
    if (tabId === 'task-details' && !selectedTask) {
      setActiveTab('tasks');
      return;
    }
    setActiveTab(tabId);
  };

  const openTask = (task) => {
    if (!task?.id) return;
    setSelectedTask(task);
    setActiveTab('task-details');
  };

  const backToTasks = () => {
    setSelectedTask(null);
    setActiveTab('tasks');
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
            <EmployeeDashboard
              userData={userData}
              tasks={tasks}
              stats={stats}
              loading={loading}
              error={error}
              onRefresh={loadTasks}
              onNavigate={navigate}
              onOpenTask={openTask}
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
          return selectedTask ? (
            <EmployeeTaskDetails
              taskId={selectedTask.id}
              onBack={backToTasks}
              onRefreshTasks={loadTasks}
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
          return <EmployeeSettings userData={userData} />;
        }

        return null;
      }}
    </CivicShell>
  );
};

export default EmployeePortal;
