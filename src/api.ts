import type {
  ApiFunction,
  AuthResponse,
  AuthUser,
  GatewayExecuteResponse,
  GatewayKey,
  GatewayKeyGenerateResponse,
  GatewayJobStatusResponse,
  GatewaySubmitResponse,
  GatewayKeyVerifyResponse,
  GatewayRequest,
  ListResponse,
  Pool,
  PoolApiKey,
  User,
  Vendor,
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
    const contentType = response.headers.get("content-type") ?? "";
    const detail = contentType.includes("application/json")
      ? ((await response.json()) as { detail?: string }).detail
      : await response.text();
    throw new Error(detail || `Request failed: ${response.status}`);
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
    request<AuthResponse>("/api/v1/auth/login", { method: "POST", body: JSON.stringify(payload) }),
  getMe: () => request<AuthUser>("/api/v1/auth/me"),
  getVendors: () => request<ListResponse<Vendor>>("/api/v1/vendors?limit=100"),
  createVendor: (payload: Record<string, unknown>) =>
    request<Vendor>("/api/v1/vendors", { method: "POST", body: JSON.stringify(payload) }),
  deleteVendor: (vendorId: number) => request<void>(`/api/v1/vendors/${vendorId}`, { method: "DELETE" }),
  getPools: () => request<ListResponse<Pool>>("/api/v1/pools?limit=100"),
  createPool: (payload: Record<string, unknown>) =>
    request<Pool>("/api/v1/pools", { method: "POST", body: JSON.stringify(payload) }),
  deletePool: (poolId: number) => request<void>(`/api/v1/pools/${poolId}`, { method: "DELETE" }),
  getPoolApiKeys: () => request<ListResponse<PoolApiKey>>("/api/v1/pool-api-keys?limit=100"),
  createPoolApiKey: (payload: Record<string, unknown>) =>
    request<PoolApiKey>("/api/v1/pool-api-keys", { method: "POST", body: JSON.stringify(payload) }),
  deletePoolApiKey: (apiKeyId: number) => request<void>(`/api/v1/pool-api-keys/${apiKeyId}`, { method: "DELETE" }),
  getGatewayKeys: () => request<ListResponse<GatewayKey>>("/api/v1/gateway-keys"),
  generateGatewayKey: (payload: { pool_id: number; name: string }) =>
    request<GatewayKeyGenerateResponse>("/api/v1/gateway-keys/generate", {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  deleteGatewayKey: (gatewayKeyId: number) =>
    request<void>(`/api/v1/gateway-keys/${gatewayKeyId}`, { method: "DELETE" }),
  verifyGatewayKey: (gateway_api_key: string) =>
    request<GatewayKeyVerifyResponse>("/api/v1/gateway-keys/verify", {
      method: "POST",
      body: JSON.stringify({ gateway_api_key }),
    }),
  getApiFunctions: () => request<ListResponse<ApiFunction>>("/api/v1/api-functions?limit=100"),
  createApiFunction: (payload: Record<string, unknown>) =>
    request<ApiFunction>("/api/v1/api-functions", { method: "POST", body: JSON.stringify(payload) }),
  deleteApiFunction: (apiFunctionId: number) =>
    request<void>(`/api/v1/api-functions/${apiFunctionId}`, { method: "DELETE" }),
  getRequests: () => request<ListResponse<GatewayRequest>>("/api/v1/gateway/requests?limit=100"),
  getUsers: () => request<ListResponse<User>>("/api/v1/users?limit=100"),
  createUser: (payload: Record<string, unknown>) =>
    request<User>("/api/v1/users", { method: "POST", body: JSON.stringify(payload) }),
  executeFunction: (functionCode: string, payload: Record<string, unknown>) =>
    request<GatewayExecuteResponse>(`/api/v1/gateway/functions/${functionCode}/execute`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  submitFunction: (functionCode: string, payload: Record<string, unknown>) =>
    request<GatewaySubmitResponse>(`/api/v1/gateway/functions/${functionCode}/submit`, {
      method: "POST",
      body: JSON.stringify(payload),
    }),
  getRequestStatus: (requestId: string) =>
    request<GatewayJobStatusResponse>(`/api/v1/gateway/requests/${requestId}/status`),
  retryRequest: (requestId: string) =>
    request<GatewayJobStatusResponse>(`/api/v1/gateway/requests/${requestId}/retry`, { method: "POST" }),
};
