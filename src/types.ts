export type Vendor = {
  id: number;
  name: string;
  slug: string;
  code: string;
  description?: string | null;
  status: string;
  created_at: string;
  updated_at: string;
};

export type Pool = {
  id: number;
  vendor_id: number;
  name: string;
  slug: string;
  code: string;
  description?: string | null;
  status: string;
  config_json?: {
    provider?: string;
    timeout_seconds?: number;
    default_model?: string;
    gateway_api_key_configured?: boolean;
  } | null;
  created_at: string;
  updated_at: string;
};

export type PoolApiKey = {
  id: number;
  pool_id: number;
  name: string;
  provider_api_key_masked: string;
  project_number: string;
  status: string;
  priority: number;
  last_used_at?: string | null;
  last_error_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type GatewayKey = {
  id: number;
  name: string;
  gateway_api_key_masked: string;
  pool_id: number;
  pool_name: string;
  status: string;
  created_at: string;
  updated_at: string;
};

export type ApiFunction = {
  id: number;
  pool_id: number;
  name: string;
  code: string;
  description?: string | null;
  http_method: string;
  path?: string | null;
  provider_action: string;
  status: string;
  schema_json?: Record<string, unknown> | null;
  created_at: string;
  updated_at: string;
};

export type GatewayRequest = {
  id: number;
  vendor_id: number;
  pool_id: number;
  api_function_id: number;
  selected_pool_api_key_id?: number | null;
  selected_pool_api_key_name?: string | null;
  request_id: string;
  model: string;
  project_number: string;
  api_key_masked: string;
  payload_json: Record<string, unknown>;
  provider_request_json?: Record<string, unknown> | null;
  provider_response_json?: Record<string, unknown> | null;
  output_text?: string | null;
  status: string;
  error_message?: string | null;
  latency_ms?: number | null;
  created_at: string;
  updated_at: string;
};

export type User = {
  id: number;
  username: string;
  email?: string | null;
  full_name: string;
  role: string;
  status: string;
  pool_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type AuthUser = {
  id: number;
  username: string;
  email?: string | null;
  full_name: string;
  role: string;
  status: string;
  pool_id?: number | null;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  expires_in: number;
  user: AuthUser;
};

export type ListResponse<T> = {
  items: T[];
  total: number;
};

export type GatewayKeyGenerateResponse = {
  gateway_api_key: string;
  gateway_api_key_masked: string;
  gateway_key_name: string;
  pool_id: number;
  pool_name: string;
};

export type GatewayKeyVerifyResponse = {
  gateway_api_key_masked: string;
  gateway_key_name?: string | null;
  vendor_id: number;
  vendor_name: string;
  vendor_code: string;
  pool_id: number;
  pool_name: string;
  pool_code: string;
  default_model?: string | null;
};

export type DashboardStats = {
  vendors: number;
  active_vendors: number;
  pools: number;
  active_pools: number;
  provider_keys: number;
  gateway_keys: number;
  requests: number;
  customers: number;
};

export type GatewayExecuteResponse = {
  request_id: string;
  vendor: string;
  pool: string;
  function: string;
  model: string;
  status: string;
  output: {
    text?: string | null;
    images: Array<{
      mime_type?: string | null;
      data_base64: string;
    }>;
  };
  usage: {
    input_tokens?: number | null;
    output_tokens?: number | null;
    total_tokens?: number | null;
  };
  latency_ms: number;
};

export type GatewaySubmitResponse = {
  request_id: string;
  status: string;
  function: string;
  poll_path: string;
  webhook_url?: string | null;
};

export type GatewayJobStatusResponse = {
  request_id: string;
  function: string;
  status: string;
  model: string;
  output: {
    text?: string | null;
    images: Array<{
      mime_type?: string | null;
      data_base64: string;
    }>;
  };
  error_message?: string | null;
  latency_ms?: number | null;
  retry_count: number;
  max_attempts: number;
  next_retry_at?: string | null;
  webhook_status?: string | null;
};
