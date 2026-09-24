import { API_BASE_URL } from '../config';

export async function apiFetch(path, options = {}) {
  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      credentials: 'include',

      ...options,

      headers: {
        'Content-Type': 'application/json',
        ...options.headers,
      },
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  if (response.status === 401) {
    const error = new Error('Session expired');
    error.status = 401;
    throw error;
  }

  if (!response.ok) {
    const error = new Error(
      data?.detail ||
        `Request failed: ${response.status}`
    );

    error.status = response.status;

    throw error;
  }

  return data;
}