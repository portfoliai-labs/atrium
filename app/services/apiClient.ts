// services/apiClient.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  constructor(status: number, message: string) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
  }
}

// FastAPI's `detail` field on an error response isn't always a string: a 422 validation
// error carries an array of {loc, msg, type} objects instead. Left as-is, that array ends
// up as `ApiError.message`, and rendering it (e.g. `{error}` in JSX) shows "[object Object]"
// rather than anything readable — so it's normalized to a string up front, at the one place
// every ApiError gets constructed.
function formatErrorDetail(detail: unknown, status: number): string {
  if (typeof detail === 'string' && detail.trim()) return detail;
  if (Array.isArray(detail) && detail.length > 0) {
    return detail
      .map((item) => (typeof item === 'string' ? item : (item as { msg?: string })?.msg ?? JSON.stringify(item)))
      .join('; ');
  }
  if (detail && typeof detail === 'object') {
    const msg = (detail as { msg?: string }).msg;
    if (typeof msg === 'string') return msg;
  }
  return `Error ${status}`;
}

export async function apiFetch<T>(endpoint: string, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    'Content-Type': 'application/json',
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    headers: defaultHeaders,
  });

  // INTERCEPTOR: Handle 401 Unauthorized
  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      // Pulisci subito per invalidare eventuali altre chiamate concorrenti
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_profile");
      window.dispatchEvent(new Event("auth-unauthorized"));
    }
    throw new ApiError(401, "Unauthorized");
  }

  // Handle other errors
  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, formatErrorDetail(errorData.detail, response.status));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}

// Like apiFetch, but for multipart/form-data bodies (e.g. file uploads).
// Content-Type is intentionally omitted so the browser can set the multipart boundary itself.
export async function apiFetchForm<T>(endpoint: string, formData: FormData, options: RequestInit = {}): Promise<T> {
  const token = typeof window !== 'undefined' ? localStorage.getItem("auth_token") : null;

  const defaultHeaders = {
    'Authorization': `Bearer ${token}`,
    ...options.headers,
  };

  const response = await fetch(`${API_BASE_URL}${endpoint}`, {
    ...options,
    body: formData,
    headers: defaultHeaders,
  });

  if (response.status === 401) {
    if (typeof window !== 'undefined') {
      localStorage.removeItem("auth_token");
      localStorage.removeItem("user_profile");
      window.dispatchEvent(new Event("auth-unauthorized"));
    }
    throw new ApiError(401, "Unauthorized");
  }

  if (!response.ok) {
    const errorData = await response.json().catch(() => ({}));
    throw new ApiError(response.status, formatErrorDetail(errorData.detail, response.status));
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}