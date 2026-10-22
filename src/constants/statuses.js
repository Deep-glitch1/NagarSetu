import {
  Clock3,
  CheckCircle2,
  AlertCircle,
  RefreshCw,
} from 'lucide-react';

export const STATUS_META = {
  received: {
    label: 'Received',
    icon: Clock3,
    bg: '#eef4ff',
    color: '#315c9d',
    className: '',
  },

  assigned: {
    label: 'Assigned',
    icon: CheckCircle2,
    bg: '#eef7f1',
    color: '#397255',
    className: 'is-waiting',
  },

  in_progress: {
    label: 'In progress',
    icon: Clock3,
    bg: '#fff4e5',
    color: '#b86d20',
    className: 'is-waiting',
  },

  pending_verification: {
    label: 'Pending verification',
    icon: Clock3,
    bg: '#f4f0ff',
    color: '#7654a6',
    className: 'is-waiting',
  },

  pending_citizen_response: {
    label: 'Action required',
    icon: AlertCircle,
    bg: '#fff4e5',
    color: '#b86d20',
    className: 'is-waiting',
  },

  verified: {
    label: 'Verified',
    icon: CheckCircle2,
    bg: '#eaf7ef',
    color: '#397255',
    className: 'is-done',
  },

  closed: {
    label: 'Closed',
    icon: CheckCircle2,
    bg: '#eaf7ef',
    color: '#397255',
    className: 'is-done',
  },

  reopened: {
    label: 'Reopened',
    icon: RefreshCw,
    bg: '#fff0f0',
    color: '#b94a48',
    className: 'is-waiting',
  },

  rejected: {
    label: 'Rejected',
    icon: AlertCircle,
    bg: '#fff0f0',
    color: '#b94a48',
    className: '',
  },
};

export const getStatusMeta = (status) => {
  return STATUS_META[status] || STATUS_META.received;
};