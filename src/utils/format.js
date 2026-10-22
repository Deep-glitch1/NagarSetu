import { API_BASE_URL } from '../config';

export const statusLabel = (value) => {
  return String(value || '')
    .replaceAll('_', ' ')
    .replace(/\b\w/g, (char) => char.toUpperCase());
};

export const priorityClass = (value) => {
  return `priority-${String(value || 'low').toLowerCase()}`;
};

export const formatDate = (value, fallback = 'Not available') => {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleDateString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
  });
};

export const formatDateTime = (
  value,
  fallback = 'Not available'
) => {
  if (!value) return fallback;

  const date = new Date(value);

  if (Number.isNaN(date.getTime())) {
    return fallback;
  }

  return date.toLocaleString('en-IN', {
    day: 'numeric',
    month: 'short',
    year: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
  });
};

export const formatNumber = (value, digits = 1) => {
  if (value === null || value === undefined) {
    return 'Not available';
  }

  const number = Number(value);

  return Number.isFinite(number)
    ? number.toFixed(digits)
    : 'Not available';
};

export const getPhotoUrl = (value) => {
  if (!value) return '';

  if (/^(https?:|data:|blob:)/i.test(value)) {
    return value;
  }

  return `${String(API_BASE_URL).replace(/\/$/, '')}/${String(
    value
  ).replace(/^\//, '')}`;
};