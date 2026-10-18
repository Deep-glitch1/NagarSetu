import { apiFetch } from './client';

export const getMyTasks = () =>
  apiFetch('/employee/complaints/tasks');

export const getTaskDetails = (complaintId) =>
  apiFetch(`/employee/complaints/${complaintId}/task`);

export const startTask = (complaintId) =>
  apiFetch(`/employee/complaints/${complaintId}/start`, {
    method: 'POST',
  });

export const uploadResolution = (complaintId, file) => {
  const formData = new FormData();
  formData.append('file', file);

  return apiFetch(
    `/employee/complaints/${complaintId}/resolution`,
    {
      method: 'POST',
      body: formData,
    },
  );
};

export const verifyComplaint = async (complaintId) => {
  return apiFetch(
    `/employee/complaints/${complaintId}/verify`,
    {
      method: 'POST',
    }
  );
};

export const getEmployeeQueue = () => apiFetch('/employee/complaints');

export const getComplaintOfficers = (complaintId) => apiFetch(`/employee/complaints/${complaintId}/officers`);

export const assignComplaint = (complaintId, officerId) => {
  const formData = new FormData();
  formData.append('officer_id', String(officerId));

  return apiFetch(
    `/employee/complaints/${complaintId}/assign`,
    {
      method: 'POST',
      body: formData,
    },
  );
};