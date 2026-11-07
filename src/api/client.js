import { API_BASE_URL } from '../config';

export async function apiFetch(path, options = {}) {
  const isFormData =
    typeof FormData !== 'undefined' &&
    options.body instanceof FormData;

  let body = options.body;

  if (
    body &&
    !isFormData &&
    typeof body !== 'string'
  ) {
    body = JSON.stringify(body);
  }

  const headers = new Headers(
    options.headers || {}
  );

  // Browser sets multipart boundary automatically.
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
      ...options,
      credentials: 'include',
      headers,
      body,
    }
  );

  // No response body.
  if (response.status === 204) {
    return null;
  }

  let data = {};

  try {
    data = await response.json();
  } catch {
    data = {};
  }

  const isAuthEndpoint =
    path.startsWith('/auth/');

  // Authentication/session errors.
  if (response.status === 401) {
    if (!isAuthEndpoint) {
      window.dispatchEvent(
        new CustomEvent('nagarsetu:unauthorized')
      );
    }

    const error = new Error(
      isAuthEndpoint &&
      typeof data?.detail === 'string'
        ? data.detail
        : 'Session expired'
    );

    error.status = 401;
    error.data = data;

    throw error;
  }

  // Other API errors.
  if (!response.ok) {
    let message =
      `Request failed: ${response.status}`;

    if (typeof data?.detail === 'string') {
      message = data.detail;
    } else if (
      Array.isArray(data?.detail)
    ) {
      const validationMessages = data.detail
        .map((item) => {
          const location =
            Array.isArray(item?.loc)
              ? item.loc.join('.')
              : 'field';

          const fieldMessage =
            item?.msg || 'Invalid value';

          return `${location}: ${fieldMessage}`;
        })
        .filter(Boolean);

      if (validationMessages.length) {
        message =
          validationMessages.join(' | ');
      }
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
