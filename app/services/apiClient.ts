// services/apiClient.ts

const API_BASE_URL = process.env.NEXT_PUBLIC_API_URL;

export class ApiError extends Error {
  status: number;
  // The refusal's kind (ianus' `error_type`, e.g. "InvestorPolicyRequiredError") and its body,
  // which may carry what the refusal names (e.g. `request_uuid`).
  errorType?: string;
  body: Record<string, unknown>;
  constructor(status: number, message: string, errorType?: string, body: Record<string, unknown> = {}) {
    super(message);
    this.status = status;
    this.name = 'ApiError';
    this.errorType = errorType;
    this.body = body;
  }
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
    throw new ApiError(response.status, errorData.detail || `Error ${response.status}`, errorData.error_type, errorData);
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
    throw new ApiError(response.status, errorData.detail || `Error ${response.status}`);
  }

  if (response.status === 204) return undefined as T;
  return response.json();
}