export type Category = "grok" | "flow" | "dreamina";

export type Profile = {
  id: number;
  name: string;
  category: Category;
  description?: string | null;
  headless: boolean;
  concurrency: number;
  timezone?: string | null;
  locale?: string | null;
  user_agent?: string | null;
  screen_width: number;
  screen_height: number;
  proxy_id?: number | null;
  created_at: string;
  updated_at: string;
};

export type ProxyRecord = {
  id: number;
  name: string;
  host: string;
  port: number;
  protocol: string;
  username?: string | null;
  password?: string | null;
  notes?: string | null;
  is_active: boolean;
  created_at: string;
  updated_at: string;
};

export type ApiKeyRecord = {
  id: number;
  name: string;
  key_prefix: string;
  description?: string | null;
  rate_limit_per_minute: number;
  is_active: boolean;
  created_at: string;
  updated_at: string;
  last_used_at?: string | null;
};

export type DashboardStats = {
  profiles: number;
  active_profiles: number;
  proxies: number;
  active_api_keys: number;
  queued_jobs: number;
  running_jobs: number;
};

export type AutomationJob = {
  id: number;
  public_id: string;
  profile_id: number;
  type: "generate_image" | "generate_video";
  prompt: string;
  status: "queued" | "running" | "failed" | "completed";
  output_url?: string | null;
  error_message?: string | null;
  created_at: string;
};

export type AutomationPreview = {
  provider: Category;
  headless: boolean;
  concurrency: number;
  launch_options: Record<string, unknown>;
  steps: string[];
};

export type AuthUser = {
  id: number;
  username: string;
  display_name: string;
  is_active: boolean;
  last_login_at?: string | null;
  created_at: string;
  updated_at: string;
};

export type AuthResponse = {
  access_token: string;
  token_type: "bearer";
  user: AuthUser;
};
