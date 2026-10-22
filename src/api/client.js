import { API_BASE_URL } from '../config';

export async function apiFetch(path, options = {}) {
  const isFormData =
    typeof FormData !== 'undefined' &&
    options.body instanceof FormData;

  const headers = new Headers(
    options.headers || {}
  );

  // FormData ke case mein Content-Type manually mat lagao.
  // Browser khud multipart boundary ke saath set karega.
  if (isFormData) {
    headers.delete('Content-Type');
  } else if (!headers.has('Content-Type')) {
    headers.set(
      'Content-Type',
      'application/json'
    );
  }

  const response = await fetch(
    `${API_BASE_URL}${path}`,
    {
      credentials: 'include',
      ...options,
      headers,
    }
  );

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  // Session expired
  if (response.status === 401) {
    window.dispatchEvent(
      new CustomEvent('nagarsetu:unauthorized')
    );

    const error = new Error(
      data?.detail ||
        (path === '/auth/me'
          ? 'Session expired'
          : 'Authentication failed.')
    );

    error.status = 401;
    error.data = data;
    error.detail = data?.detail;

    throw error;
  }
  // Other API errors
  if (!response.ok) {
    let message =
      `Request failed: ${response.status}`;

    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (
      data?.detail &&
      typeof data.detail === 'object' &&
      typeof data.detail.message === 'string'
    ) {
      message = data.detail.message;
    }

    const error = new Error(message);

    error.status = response.status;
    error.data = data;
    error.detail = data?.detail;

    throw error;
  }

  return data;
}