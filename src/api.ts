import type {
  ApiKeyRecord,
  AuthResponse,
  AuthUser,
  AutomationJob,
  AutomationPreview,
  DashboardStats,
  Profile,
  ProxyRecord,
} from "./types";

const API_URL = import.meta.env.VITE_API_URL ?? "";
const TOKEN_KEY = "gateway_access_token";

function getAuthToken(): string {
  return window.localStorage.getItem(TOKEN_KEY) ?? "";
}

async function request<T>(path: string, init?: RequestInit): Promise<T> {
  const token = getAuthToken();
  const response = await fetch(`${API_URL}${path}`, {
    headers: {
      "Content-Type": "application/json",
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
      ...(init?.headers ?? {}),
    },
    ...init,
  });

  if (!response.ok) {
    const message = await response.text();
    throw new Error(message || `Request failed: ${response.status}`);
  }

  if (response.status === 204) {
    return undefined as T;
  }

  return (await response.json()) as T;
}

export const api = {
  setToken: (token: string) => window.localStorage.setItem(TOKEN_KEY, token),
  clearToken: () => window.localStorage.removeItem(TOKEN_KEY),
  hasToken: () => Boolean(getAuthToken()),
  login: (payload: { username: string; password: string }) =>
    request<AuthResponse>("/api/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getMe: () => request<AuthUser>("/api/auth/me"),
  getDashboard: () => request<DashboardStats>("/api/dashboard"),
  getProfiles: () => request<Profile[]>("/api/profiles"),
  createProfile: (payload: Record<string, unknown>) =>
    request<Profile>("/api/profiles", { method: "POST", body: JSON.stringify(payload) }),
  uploadCookies: async (profileId: number, file: File) => {
    const formData = new FormData();
    formData.append("file", file);
    const token = getAuthToken();
    const response = await fetch(`${API_URL}/api/profiles/${profileId}/cookies`, {
      method: "POST",
      headers: token ? { Authorization: `Bearer ${token}` } : {},
      body: formData,
    });
    if (!response.ok) {
      throw new Error((await response.text()) || `Upload failed: ${response.status}`);
    }
    return response.json();
  },
  getProxies: () => request<ProxyRecord[]>("/api/proxies"),
  createProxy: (payload: Record<string, unknown>) =>
    request<ProxyRecord>("/api/proxies", { method: "POST", body: JSON.stringify(payload) }),
  getApiKeys: () => request<ApiKeyRecord[]>("/api/api-keys"),
  createApiKey: (payload: Record<string, unknown>) =>
    request<{ api_key: ApiKeyRecord; raw_key: string }>("/api/api-keys", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getJobs: () => request<AutomationJob[]>("/api/jobs"),
  createJob: (payload: Record<string, unknown>) =>
    request<AutomationJob>("/api/jobs", { method: "POST", body: JSON.stringify(payload) }),
  runJob: (jobId: number) =>
    request<AutomationJob>(`/api/jobs/${jobId}/run`, { method: "POST" }),
  getPreview: (profileId: number) => request<AutomationPreview>(`/api/jobs/preview/${profileId}`),
};
