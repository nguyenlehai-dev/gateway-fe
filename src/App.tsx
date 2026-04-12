import type { ReactNode } from "react";
import { FormEvent, useEffect, useMemo, useState } from "react";
import { api } from "./api";
import type {
  ApiFunction,
  AuthUser,
  DashboardStats,
  GatewayExecuteResponse,
  GatewayJobStatusResponse,
  GatewayKey,
  GatewayKeyVerifyResponse,
  GatewayRequest,
  GatewaySubmitResponse,
  Pool,
  PoolApiKey,
  User,
  Vendor,
} from "./types";

type TabKey = "dashboard" | "vendors" | "pools" | "functions" | "requests" | "docs" | "playground";

const emptyStats: DashboardStats = {
  vendors: 0,
  active_vendors: 0,
  pools: 0,
  active_pools: 0,
  provider_keys: 0,
  gateway_keys: 0,
  requests: 0,
  customers: 0,
};

const MODEL_PRESETS: Record<string, string[]> = {
  "google.genai.image_generation": [
    "nano-banana-2",
    "nano-banana-pro",
    "gemini-3.1-flash-image-preview",
    "gemini-3-pro-image-preview",
  ],
  "google.genai.text_generation": ["gemini-2.5-flash", "gemini-2.5-pro", "gemini-3-flash-preview", "gemini-3-pro-preview"],
};

function getOptionalText(form: FormData, key: string): string | null {
  const value = String(form.get(key) ?? "").trim();
  return value || null;
}

function parseReferenceList(value: FormDataEntryValue | null): string[] {
  return String(value ?? "")
    .split(/\r?\n|,/)
    .map((item) => item.trim())
    .filter(Boolean);
}

function buildRuntimePayload(form: FormData) {
  return {
    gateway_api_key: getOptionalText(form, "gateway_api_key"),
    api_key: getOptionalText(form, "api_key"),
    project_number: getOptionalText(form, "project_number"),
    model: getOptionalText(form, "model"),
    prompt: String(form.get("prompt") ?? "").trim(),
    aspect_ratio: getOptionalText(form, "aspect_ratio"),
    image_size: getOptionalText(form, "image_size"),
    references_image: parseReferenceList(form.get("references_image")),
    references_video: parseReferenceList(form.get("references_video")),
  };
}

function maskGatewayKey(value: string) {
  if (!value) {
    return "";
  }
  if (value.length <= 10) {
    return value;
  }
  return `${value.slice(0, 3)}${"*".repeat(Math.max(4, value.length - 5))}${value.slice(-2)}`;
}

async function readReferenceFiles(files: File[]) {
  return Promise.all(
    files.map(
      (file) =>
        new Promise<{ mime_type: string; data_base64: string }>((resolve, reject) => {
          const reader = new FileReader();
          reader.onload = () => {
            const result = String(reader.result ?? "");
            const [, dataBase64 = ""] = result.split(",", 2);
            resolve({
              mime_type: file.type || "application/octet-stream",
              data_base64: dataBase64,
            });
          };
          reader.onerror = () => reject(reader.error ?? new Error(`Could not read ${file.name}`));
          reader.readAsDataURL(file);
        }),
    ),
  );
}

export default function App() {
  const [tab, setTab] = useState<TabKey>("dashboard");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [showSystemAuth, setShowSystemAuth] = useState(false);
  const [systemAuthApiBase, setSystemAuthApiBase] = useState("/api/v1");
  const [systemAuthKeyName, setSystemAuthKeyName] = useState("Studio Key");
  const [systemAuthGatewayKey, setSystemAuthGatewayKey] = useState("");
  const [gatewayKeyCheck, setGatewayKeyCheck] = useState<GatewayKeyVerifyResponse | null>(null);
  const [latestGatewayKey, setLatestGatewayKey] = useState("");

  const [vendors, setVendors] = useState<Vendor[]>([]);
  const [pools, setPools] = useState<Pool[]>([]);
  const [poolApiKeys, setPoolApiKeys] = useState<PoolApiKey[]>([]);
  const [gatewayKeys, setGatewayKeys] = useState<GatewayKey[]>([]);
  const [apiFunctions, setApiFunctions] = useState<ApiFunction[]>([]);
  const [requests, setRequests] = useState<GatewayRequest[]>([]);
  const [users, setUsers] = useState<User[]>([]);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);

  const [executeResult, setExecuteResult] = useState<GatewayExecuteResponse | null>(null);
  const [submitResult, setSubmitResult] = useState<GatewaySubmitResponse | null>(null);
  const [jobStatusResult, setJobStatusResult] = useState<GatewayJobStatusResponse | null>(null);

  const [error, setError] = useState("");
  const [notice, setNotice] = useState("");
  const [playgroundFunctionCode, setPlaygroundFunctionCode] = useState("");
  const [playgroundModel, setPlaygroundModel] = useState("");
  const [playgroundPrompt, setPlaygroundPrompt] = useState("");
  const [playgroundAspectRatio, setPlaygroundAspectRatio] = useState("1:1");
  const [playgroundImageSize, setPlaygroundImageSize] = useState("1K");
  const [playgroundReferenceFiles, setPlaygroundReferenceFiles] = useState<File[]>([]);
  const [playgroundReferenceImageUrls, setPlaygroundReferenceImageUrls] = useState("");
  const [playgroundReferenceVideoUrls, setPlaygroundReferenceVideoUrls] = useState("");
  const [statusLookupRequestId, setStatusLookupRequestId] = useState("");

  useEffect(() => {
    void bootstrap();
  }, []);

  async function bootstrap() {
    if (!api.hasToken()) {
      setAuthLoading(false);
      return;
    }

    try {
      const me = await api.getMe();
      setAuthUser(me);
      await refreshAll();
    } catch {
      api.clearToken();
      setAuthUser(null);
    } finally {
      setAuthLoading(false);
    }
  }

  async function refreshAll() {
    try {
      setError("");
      const [vendorResponse, poolResponse, poolApiKeyResponse, gatewayKeyResponse, apiFunctionResponse, requestResponse, userResponse] =
        await Promise.all([
          api.getVendors(),
          api.getPools(),
          api.getPoolApiKeys(),
          api.getGatewayKeys(),
          api.getApiFunctions(),
          api.getRequests(),
          api.getUsers(),
        ]);

      setVendors(vendorResponse.items);
      setPools(poolResponse.items);
      setPoolApiKeys(poolApiKeyResponse.items);
      setGatewayKeys(gatewayKeyResponse.items);
      setApiFunctions(apiFunctionResponse.items);
      setRequests(requestResponse.items);
      setUsers(userResponse.items);
      setStats({
        vendors: vendorResponse.total,
        active_vendors: vendorResponse.items.filter((item) => item.status === "active").length,
        pools: poolResponse.total,
        active_pools: poolResponse.items.filter((item) => item.status === "active").length,
        provider_keys: poolApiKeyResponse.total,
        gateway_keys: gatewayKeyResponse.total,
        requests: requestResponse.total,
        customers: userResponse.items.filter((item) => item.role === "customer").length,
      });
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function safeAction(action: () => Promise<void>, successMessage?: string) {
    try {
      setError("");
      setNotice("");
      await action();
      if (successMessage) {
        setNotice(successMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      const response = await api.login({
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      api.setToken(response.access_token);
      setAuthUser(response.user);
      formEl.reset();
      await refreshAll();
    }, "Dang nhap thanh cong");
  }

  async function submitVendor(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      await api.createVendor({
        name: form.get("name"),
        slug: form.get("slug"),
        code: form.get("code"),
        description: form.get("description"),
        status: "active",
      });
      formEl.reset();
      await refreshAll();
    }, "Da tao vendor");
  }

  async function submitPool(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      await api.createPool({
        vendor_id: Number(form.get("vendor_id")),
        name: form.get("name"),
        slug: form.get("slug"),
        code: form.get("code"),
        description: form.get("description"),
        status: "active",
        default_model: String(form.get("default_model") ?? "") || null,
        config_json: {
          provider: "google",
          timeout_seconds: 60,
        },
      });
      formEl.reset();
      await refreshAll();
    }, "Da tao pool");
  }

  async function submitPoolApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      await api.createPoolApiKey({
        pool_id: Number(form.get("pool_id")),
        name: form.get("name"),
        provider_api_key: form.get("provider_api_key"),
        project_number: form.get("project_number"),
        priority: Number(form.get("priority") ?? 100),
        status: "active",
      });
      formEl.reset();
      await refreshAll();
    }, "Da them API key vao pool");
  }

  async function submitFunction(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      await api.createApiFunction({
        pool_id: Number(form.get("pool_id")),
        name: form.get("name"),
        code: form.get("code"),
        description: form.get("description"),
        http_method: "POST",
        path: form.get("path"),
        provider_action: form.get("provider_action"),
        status: "active",
        schema_json: { type: "object" },
      });
      formEl.reset();
      await refreshAll();
    }, "Da tao gateway function");
  }

  async function submitUser(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const formEl = event.currentTarget;
    const form = new FormData(formEl);
    await safeAction(async () => {
      await api.createUser({
        username: form.get("username"),
        full_name: form.get("full_name"),
        email: form.get("email") || null,
        password: form.get("password"),
        role: "customer",
        status: "active",
        pool_id: Number(form.get("pool_id")),
      });
      formEl.reset();
      await refreshAll();
    }, "Da tao user");
  }

  async function generateSystemAuthKey() {
    const targetPool = selectedPlaygroundPool ?? pools[0];
    if (!targetPool) {
      setError("Chua co pool de phat hanh Gateway API Key");
      return;
    }
    await safeAction(async () => {
      const response = await api.generateGatewayKey({
        pool_id: targetPool.id,
        name: systemAuthKeyName || `Studio Key ${targetPool.name}`,
      });
      setLatestGatewayKey(response.gateway_api_key);
      setSystemAuthGatewayKey(response.gateway_api_key);
      setNotice(`Da generate Gateway API Key cho pool ${response.pool_name}`);
      await refreshAll();
    }, "Da generate Gateway API Key");
  }

  async function verifySystemAuthKey() {
    if (!systemAuthGatewayKey.trim()) {
      setError("Nhap hoac generate Gateway API Key truoc");
      return;
    }
    await safeAction(async () => {
      const response = await api.verifyGatewayKey(systemAuthGatewayKey.trim());
      setGatewayKeyCheck(response);
      setShowSystemAuth(false);
    }, "Da verify Gateway API Key");
  }

  function ensureVerifiedForRuntime() {
    if (gatewayKeyCheck) {
      return true;
    }
    setError("Verify Gateway API Key trong System Auth truoc khi dung Playground");
    setShowSystemAuth(true);
    return false;
  }

  async function submitExecute(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureVerifiedForRuntime()) {
      return;
    }
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      const response = await api.executeFunction(String(form.get("function_code") ?? ""), {
        ...buildRuntimePayload(form),
        gateway_api_key: systemAuthGatewayKey || null,
      });
      setExecuteResult(response);
      setSubmitResult(null);
      setJobStatusResult(null);
    }, "Da execute function");
  }

  async function submitAsync(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureVerifiedForRuntime()) {
      return;
    }
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      const response = await api.submitFunction(String(form.get("function_code") ?? ""), {
        ...buildRuntimePayload(form),
        gateway_api_key: systemAuthGatewayKey || null,
        max_attempts: 3,
      });
      setSubmitResult(response);
    }, "Da submit async");
  }

  async function lookupStatus(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    if (!ensureVerifiedForRuntime()) {
      return;
    }
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      const response = await api.getRequestStatus(String(form.get("request_id") ?? ""));
      setJobStatusResult(response);
    }, "Da lay status");
  }

  function logout() {
    api.clearToken();
    setAuthUser(null);
    setGatewayKeyCheck(null);
    setSystemAuthGatewayKey("");
    setLatestGatewayKey("");
  }

  const poolApiKeyMap = useMemo(() => {
    const grouped = new Map<number, PoolApiKey[]>();
    for (const item of poolApiKeys) {
      const list = grouped.get(item.pool_id) ?? [];
      list.push(item);
      grouped.set(item.pool_id, list);
    }
    return grouped;
  }, [poolApiKeys]);

  const playgroundFunctions = useMemo(() => {
    if (gatewayKeyCheck) {
      return apiFunctions.filter((item) => item.pool_id === gatewayKeyCheck.pool_id);
    }
    return apiFunctions;
  }, [apiFunctions, gatewayKeyCheck]);

  useEffect(() => {
    if (!playgroundFunctions.length) {
      setPlaygroundFunctionCode("");
      return;
    }
    if (!playgroundFunctions.some((item) => item.code === playgroundFunctionCode)) {
      setPlaygroundFunctionCode(playgroundFunctions[0].code);
    }
  }, [playgroundFunctionCode, playgroundFunctions]);

  const selectedPlaygroundFunction =
    playgroundFunctions.find((item) => item.code === playgroundFunctionCode) ?? playgroundFunctions[0] ?? null;
  const selectedPlaygroundPool = selectedPlaygroundFunction
    ? pools.find((item) => item.id === selectedPlaygroundFunction.pool_id) ?? null
    : null;
  const selectedPlaygroundVendor = selectedPlaygroundPool
    ? vendors.find((item) => item.id === selectedPlaygroundPool.vendor_id) ?? null
    : null;
  const playgroundModelOptions = selectedPlaygroundFunction ? MODEL_PRESETS[selectedPlaygroundFunction.provider_action] ?? [] : [];
  const isImageGeneration = selectedPlaygroundFunction?.provider_action === "google.genai.image_generation";

  useEffect(() => {
    if (!playgroundModelOptions.length) {
      setPlaygroundModel("");
      return;
    }
    if (!playgroundModelOptions.includes(playgroundModel)) {
      setPlaygroundModel(playgroundModelOptions[0]);
    }
  }, [playgroundModel, playgroundModelOptions]);

  function vendorName(vendorId: number) {
    return vendors.find((item) => item.id === vendorId)?.name ?? `Vendor #${vendorId}`;
  }

  function poolName(poolId: number | null | undefined) {
    if (!poolId) {
      return "No pool";
    }
    return pools.find((item) => item.id === poolId)?.name ?? `Pool #${poolId}`;
  }

  async function buildPlaygroundPayload() {
    const inputImages = await readReferenceFiles(playgroundReferenceFiles);
    return {
      gateway_api_key: systemAuthGatewayKey || null,
      model: playgroundModel || null,
      prompt: playgroundPrompt.trim(),
      aspect_ratio: isImageGeneration ? playgroundAspectRatio : null,
      image_size: isImageGeneration ? playgroundImageSize : null,
      input_images: inputImages,
      references_image: parseReferenceList(playgroundReferenceImageUrls),
      references_video: parseReferenceList(playgroundReferenceVideoUrls),
    };
  }

  async function executeSelectedFunction() {
    if (!ensureVerifiedForRuntime()) {
      return;
    }
    if (!selectedPlaygroundFunction) {
      setError("Chon API Function truoc khi execute");
      return;
    }
    if (!playgroundPrompt.trim()) {
      setError("Nhap prompt truoc khi execute");
      return;
    }
    await safeAction(async () => {
      const response = await api.executeFunction(selectedPlaygroundFunction.code, await buildPlaygroundPayload());
      setExecuteResult(response);
      setSubmitResult(null);
      setJobStatusResult(null);
      setStatusLookupRequestId(response.request_id);
    }, "Da execute function");
  }

  async function submitSelectedFunction() {
    if (!ensureVerifiedForRuntime()) {
      return;
    }
    if (!selectedPlaygroundFunction) {
      setError("Chon API Function truoc khi submit");
      return;
    }
    if (!playgroundPrompt.trim()) {
      setError("Nhap prompt truoc khi submit");
      return;
    }
    await safeAction(async () => {
      const response = await api.submitFunction(selectedPlaygroundFunction.code, {
        ...(await buildPlaygroundPayload()),
        max_attempts: 3,
      });
      setSubmitResult(response);
      setExecuteResult(null);
      setJobStatusResult(null);
      setStatusLookupRequestId(response.request_id);
    }, "Da submit async");
  }

  const systemAuthVerified = Boolean(gatewayKeyCheck);

  if (authLoading) {
    return <div className="loadingScreen">Loading Gateway Console...</div>;
  }

  if (!authUser) {
    return (
      <div className="loginPage">
        <form className="loginPanel" onSubmit={submitLogin}>
          <div>
            <p className="appKicker">Gateway</p>
            <h1>Admin Console</h1>
            <p className="softText">Dang nhap de quan tri vendor, pools, api keys va gateway runtime.</p>
          </div>
          {error ? <div className="callout error">{error}</div> : null}
          <input name="username" placeholder="Username" defaultValue="admin" required />
          <input name="password" type="password" placeholder="Password" required />
          <button type="submit" className="primaryButton">
            Dang nhap
          </button>
        </form>
      </div>
    );
  }

  const shouldBlockPlayground = tab === "playground" && !systemAuthVerified && !showSystemAuth;

  return (
    <div className="appFrame">
      <aside className="sidebarShell">
        <div className="brandBlock">
          <h1>Gateway</h1>
          <p>Admin Console</p>
        </div>
        <nav className="navStack">
          <SidebarItem label="Dashboard" active={tab === "dashboard"} onClick={() => setTab("dashboard")} />
          <SidebarItem label="Vendors" active={tab === "vendors"} onClick={() => setTab("vendors")} />
          <SidebarItem label="Pools" active={tab === "pools"} onClick={() => setTab("pools")} />
          <SidebarItem label="API Functions" active={tab === "functions"} onClick={() => setTab("functions")} />
          <SidebarItem label="Requests" active={tab === "requests"} onClick={() => setTab("requests")} />
          <SidebarItem label="API Docs" active={tab === "docs"} onClick={() => setTab("docs")} />
          <SidebarItem label="Playground" active={tab === "playground"} onClick={() => setTab("playground")} />
        </nav>
      </aside>

      <section className="mainShell">
        <header className="topHeader">
          <div>
            <h2>Gateway Management</h2>
          </div>
          <div className="topHeaderActions">
            <span className="basePathTag">{systemAuthApiBase}</span>
            <button type="button" className="ghostPill" onClick={() => setShowSystemAuth(true)}>
              System Auth
            </button>
            <span className={`statusBadge ${systemAuthVerified ? "ok" : "warn"}`}>
              System Auth {systemAuthVerified ? "verified" : "not verified"}
            </span>
            <span className="userName">{authUser.username}</span>
            <button type="button" className="ghostPill" onClick={logout}>
              Logout
            </button>
          </div>
        </header>

        <main className="workspace">
          {error ? <div className="callout error">{error}</div> : null}
          {notice ? <div className="callout success">{notice}</div> : null}
          {latestGatewayKey ? <div className="callout success">Gateway API Key moi: {latestGatewayKey}</div> : null}

          {tab === "dashboard" ? (
            <section className="dashboardGrid">
              <MetricCard title="Vendors" value={stats.vendors} subtitle={`${stats.active_vendors} active`} />
              <MetricCard title="Pools" value={stats.pools} subtitle={`${stats.active_pools} active`} />
              <MetricCard title="API Keys" value={stats.provider_keys} subtitle="Thuoc pool de rotation" />
              <MetricCard title="Gateway Keys" value={stats.gateway_keys} subtitle="Prefix gw..." />
              <MetricCard title="Customers" value={stats.customers} subtitle="User role customer" />
              <MetricCard title="Requests" value={stats.requests} subtitle="Gateway request logs" />
              <SectionCard title="Current Flow">
                <div className="miniFlow">
                  <p>Vendor Google</p>
                  <p>Pool gemini-api</p>
                  <p>API Keys thuoc pool</p>
                  <p>Gateway API Key rieng cho client</p>
                  <p>Function goi vao pool va chon key trong pool</p>
                </div>
              </SectionCard>
            </section>
          ) : null}

          {tab === "vendors" ? (
            <section className="splitView">
              <SectionCard title="Create Vendor">
                <form className="formStack" onSubmit={submitVendor}>
                  <input name="name" placeholder="Google" required />
                  <div className="twoUp">
                    <input name="slug" placeholder="google" required />
                    <input name="code" placeholder="google" required />
                  </div>
                  <textarea name="description" placeholder="Vendor description" />
                  <button type="submit" className="primaryButton">
                    Create Vendor
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="Vendor List">
                <div className="tableList">
                  {vendors.map((item) => (
                    <RowCard key={item.id} title={item.name} badge={item.status}>
                      <p>
                        {item.code} / {item.slug}
                      </p>
                      <p>{item.description || "No description"}</p>
                    </RowCard>
                  ))}
                </div>
              </SectionCard>
            </section>
          ) : null}

          {tab === "pools" ? (
            <section className="threePane">
              <SectionCard title="Pools">
                <form className="formStack" onSubmit={submitPool}>
                  <select name="vendor_id" defaultValue="" required>
                    <option value="" disabled>
                      Select Vendor
                    </option>
                    {vendors.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input name="name" placeholder="gemini-api" required />
                  <div className="twoUp">
                    <input name="slug" placeholder="gemini-api" required />
                    <input name="code" placeholder="gemini-api" required />
                  </div>
                  <input name="default_model" placeholder="gemini-2.5-pro" />
                  <textarea name="description" placeholder="Pool description" />
                  <button type="submit" className="primaryButton">
                    Create Pool
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="API Keys In Pool">
                <form className="formStack" onSubmit={submitPoolApiKey}>
                  <select name="pool_id" defaultValue="" required>
                    <option value="" disabled>
                      Select Pool
                    </option>
                    {pools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input name="name" placeholder="Gemini Key 01" required />
                  <input name="provider_api_key" placeholder="AIza..." required />
                  <div className="twoUp">
                    <input name="project_number" placeholder="project number" required />
                    <input name="priority" type="number" defaultValue="100" />
                  </div>
                  <button type="submit" className="primaryButton">
                    Add API Key
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="Pool Overview">
                <div className="tableList">
                  {pools.map((item) => (
                    <RowCard key={item.id} title={item.name} badge={item.status}>
                      <p>{vendorName(item.vendor_id)}</p>
                      <p>Model: {item.config_json?.default_model || "n/a"}</p>
                      <p>API Keys: {(poolApiKeyMap.get(item.id) ?? []).length}</p>
                    </RowCard>
                  ))}
                </div>
              </SectionCard>
            </section>
          ) : null}

          {tab === "functions" ? (
            <section className="splitView">
              <SectionCard title="Gateway Functions">
                <form className="formStack" onSubmit={submitFunction}>
                  <select name="pool_id" defaultValue="" required>
                    <option value="" disabled>
                      Select Pool
                    </option>
                    {pools.map((item) => (
                      <option key={item.id} value={item.id}>
                        {item.name}
                      </option>
                    ))}
                  </select>
                  <input name="name" placeholder="Text Generation" required />
                  <div className="twoUp">
                    <input name="code" placeholder="text-generation" required />
                    <input name="provider_action" placeholder="google.genai.text_generation" required />
                  </div>
                  <input name="path" placeholder="/api/v1/gateway/functions/text-generation/execute" />
                  <textarea name="description" placeholder="Function description" />
                  <button type="submit" className="primaryButton">
                    Create Function
                  </button>
                </form>
              </SectionCard>
              <SectionCard title="Function Mapping">
                <div className="tableList">
                  {apiFunctions.map((item) => (
                    <RowCard key={item.id} title={item.name} badge={item.status}>
                      <p>
                        {item.code} {"->"} {poolName(item.pool_id)}
                      </p>
                      <p>{item.provider_action}</p>
                      <p>Rotation source: {(poolApiKeyMap.get(item.pool_id) ?? []).map((key) => key.name).join(", ") || "No keys"}</p>
                    </RowCard>
                  ))}
                </div>
              </SectionCard>
            </section>
          ) : null}

          {tab === "requests" ? (
            <SectionCard title="Gateway Requests">
              <div className="tableList">
                {requests.map((item) => (
                  <RowCard key={item.id} title={item.request_id} badge={item.status}>
                    <p>
                      {vendorName(item.vendor_id)} / {poolName(item.pool_id)}
                    </p>
                    <p>
                      {item.model} / {item.project_number} / {item.api_key_masked}
                    </p>
                    <p>{item.output_text || item.error_message || "No output"}</p>
                  </RowCard>
                ))}
              </div>
            </SectionCard>
          ) : null}

          {tab === "docs" ? (
            <section className="splitView">
              <SectionCard title="API Docs">
                <div className="docStack">
                  <p>`/api/v1/auth/login`</p>
                  <p>`/api/v1/gateway-keys/verify`</p>
                  <p>/api/v1/gateway/functions/{"{function_code}"}/execute</p>
                  <p>/api/v1/gateway/functions/{"{function_code}"}/submit</p>
                  <p>/api/v1/gateway/requests/{"{request_id}"}/status</p>
                </div>
              </SectionCard>
              <SectionCard title="Business Flow">
                <div className="docStack">
                  <p>1. Tao Vendor Google</p>
                  <p>2. Tao Pool gemini-api</p>
                  <p>3. Nhap API Keys vao pool</p>
                  <p>4. Phat hanh Gateway API Key prefix gw...</p>
                  <p>5. Client goi function, backend chon key trong pool</p>
                </div>
              </SectionCard>
            </section>
          ) : null}

          {tab === "playground" ? (
            <section className="playgroundLayout">
              <SectionCard title="Playground">
                <div className="playgroundPanel">
                  {gatewayKeyCheck ? (
                    <div className="playgroundStatusCard success">
                      <strong>Gateway API Key verified</strong>
                      <p>
                        {maskGatewayKey(systemAuthGatewayKey)} · {gatewayKeyCheck.vendor_name} / {gatewayKeyCheck.pool_name}
                      </p>
                    </div>
                  ) : null}

                  <div className="playgroundGrid">
                    <label className="playgroundField">
                      <span>Vendor</span>
                      <input value={selectedPlaygroundVendor?.name ?? gatewayKeyCheck?.vendor_name ?? ""} readOnly />
                    </label>
                    <label className="playgroundField">
                      <span>Pool</span>
                      <input value={selectedPlaygroundPool?.name ?? gatewayKeyCheck?.pool_name ?? ""} readOnly />
                    </label>
                    <label className="playgroundField">
                      <span>API Function</span>
                      <select
                        value={selectedPlaygroundFunction?.code ?? ""}
                        onChange={(event) => setPlaygroundFunctionCode(event.target.value)}
                      >
                        {playgroundFunctions.map((item) => (
                          <option key={item.id} value={item.code}>
                            {item.name}
                          </option>
                        ))}
                      </select>
                    </label>
                  </div>

                  <label className="playgroundField">
                    <span>Model</span>
                    <input
                      list="playground-model-options"
                      value={playgroundModel}
                      onChange={(event) => setPlaygroundModel(event.target.value)}
                      placeholder="Select or type a model"
                    />
                    <datalist id="playground-model-options">
                      {playgroundModelOptions.map((item) => (
                        <option key={item} value={item}>
                          {item}
                        </option>
                      ))}
                    </datalist>
                  </label>

                  <label className="playgroundField">
                    <span>Prompt</span>
                    <textarea value={playgroundPrompt} onChange={(event) => setPlaygroundPrompt(event.target.value)} placeholder="Prompt..." />
                  </label>

                  {isImageGeneration ? (
                    <>
                      <div className="playgroundInfoCard">
                        <strong>Image Generation</strong>
                        <p>
                          Khong upload anh tham chieu thi day la text-to-image. Upload mot hoac nhieu anh thi day la
                          image-to-image/reference-based generation.
                        </p>
                      </div>

                      <div className="playgroundGrid twoCol">
                        <label className="playgroundField">
                          <span>Aspect Ratio</span>
                          <select value={playgroundAspectRatio} onChange={(event) => setPlaygroundAspectRatio(event.target.value)}>
                            {["1:1", "16:9", "9:16", "4:3", "3:4"].map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>
                        <label className="playgroundField">
                          <span>Image Size</span>
                          <select value={playgroundImageSize} onChange={(event) => setPlaygroundImageSize(event.target.value)}>
                            {["1K", "2K"].map((item) => (
                              <option key={item} value={item}>
                                {item}
                              </option>
                            ))}
                          </select>
                        </label>
                      </div>

                      <label className="playgroundField">
                        <span>Reference Images</span>
                        <input
                          type="file"
                          accept="image/*"
                          multiple
                          onChange={(event) => setPlaygroundReferenceFiles(Array.from(event.target.files ?? []))}
                        />
                        <p className="fieldHelp">
                          Upload anh tham chieu de tao image-to-image. He thong se gui duoi dang base64 `inline_data`.
                        </p>
                        <p className="fieldHelp">
                          {playgroundReferenceFiles.length
                            ? `${playgroundReferenceFiles.length} file da duoc chon cho image generation.`
                            : "Chua co anh tham chieu. Request se duoc xu ly theo kieu text-to-image."}
                        </p>
                      </label>
                    </>
                  ) : null}

                  <label className="playgroundField">
                    <span>Reference Image URLs</span>
                    <textarea
                      value={playgroundReferenceImageUrls}
                      onChange={(event) => setPlaygroundReferenceImageUrls(event.target.value)}
                      placeholder="https://.../ref-1.png"
                    />
                  </label>

                  <label className="playgroundField">
                    <span>Reference Video URLs</span>
                    <textarea
                      value={playgroundReferenceVideoUrls}
                      onChange={(event) => setPlaygroundReferenceVideoUrls(event.target.value)}
                      placeholder="https://.../sample.mp4"
                    />
                  </label>

                  <div className="playgroundActions">
                    <button type="button" className="primaryButton" onClick={() => void executeSelectedFunction()}>
                      Execute
                    </button>
                    <button type="button" className="ghostPill" onClick={() => void submitSelectedFunction()}>
                      Submit Async
                    </button>
                  </div>

                  <form className="playgroundStatusLookup" onSubmit={lookupStatus}>
                    <input
                      name="request_id"
                      value={statusLookupRequestId}
                      onChange={(event) => setStatusLookupRequestId(event.target.value)}
                      placeholder="request_id"
                      required
                    />
                    <button type="submit" className="ghostPill">
                      Check Status
                    </button>
                  </form>
                </div>
              </SectionCard>

              <SectionCard title="Execute Result">
                <div className="playgroundResultPanel">
                  {error ? (
                    <div className="playgroundStatusCard error">
                      <strong>Execute failed</strong>
                      <p>{error}</p>
                    </div>
                  ) : null}
                  {notice ? (
                    <div className="playgroundStatusCard success">
                      <strong>Action completed</strong>
                      <p>{notice}</p>
                    </div>
                  ) : null}
                  <div className="resultConsole">
                    <pre>
                      {JSON.stringify(executeResult ?? submitResult ?? jobStatusResult ?? "No result yet.", null, 2)}
                    </pre>
                  </div>
                </div>
              </SectionCard>
            </section>
          ) : null}

          {shouldBlockPlayground ? (
            <div className="authLockOverlay" role="alert" aria-live="polite">
              <div className="authLockCard">
                <p className="appKicker">System Auth Required</p>
                <h3>Playground is locked</h3>
                <p className="softText">
                  Verify a Gateway API Key before running execute, async submit, or request-status checks from the Playground.
                </p>
                <button type="button" className="primaryButton" onClick={() => setShowSystemAuth(true)}>
                  Open System Auth
                </button>
              </div>
            </div>
          ) : null}
        </main>
      </section>

      {showSystemAuth ? (
        <div className="modalScrim" onClick={() => setShowSystemAuth(false)}>
          <div className="systemAuthModal" onClick={(event) => event.stopPropagation()}>
            <div className="modalHead">
              <h3>System Auth</h3>
              <button type="button" className="iconButton" onClick={() => setShowSystemAuth(false)}>
                x
              </button>
            </div>
            <div className="formStack">
              <label className="fieldLabel">API Base URL</label>
              <input value={systemAuthApiBase} onChange={(event) => setSystemAuthApiBase(event.target.value)} />

              <label className="fieldLabel">Key Name / Identifier</label>
              <input value={systemAuthKeyName} onChange={(event) => setSystemAuthKeyName(event.target.value)} />

              <label className="fieldLabel">Gateway API Key</label>
              <div className="keyInputRow">
                <input
                  value={systemAuthGatewayKey}
                  placeholder="Paste your Gateway API key"
                  onChange={(event) => {
                    setSystemAuthGatewayKey(event.target.value);
                    setGatewayKeyCheck(null);
                  }}
                />
                <button type="button" className="ghostPill" onClick={() => void generateSystemAuthKey()}>
                  Generate Key
                </button>
              </div>

              <div className={`verifyCard ${systemAuthVerified ? "verified" : ""}`}>
                <strong>{systemAuthVerified ? "Verified" : "Not verified"}</strong>
                <p>
                  {systemAuthVerified
                    ? `${gatewayKeyCheck?.pool_name} / ${gatewayKeyCheck?.vendor_name}`
                    : "Generate a key or paste one here, then click Verify. Until then, customer-facing flows stay locked."}
                </p>
              </div>

              <div className="modalActions">
                <button
                  type="button"
                  className="ghostPill"
                  onClick={() => {
                    setGatewayKeyCheck(null);
                    setSystemAuthGatewayKey("");
                    setLatestGatewayKey("");
                  }}
                >
                  Clear
                </button>
                <button type="button" className="primaryButton" onClick={() => void verifySystemAuthKey()}>
                  Verify
                </button>
              </div>
            </div>
          </div>
        </div>
      ) : null}
    </div>
  );
}

function SidebarItem(props: { label: string; active: boolean; onClick: () => void }) {
  return (
    <button type="button" className={`sidebarItem ${props.active ? "active" : ""}`} onClick={props.onClick}>
      {props.label}
    </button>
  );
}

function MetricCard(props: { title: string; value: number; subtitle: string }) {
  return (
    <article className="metricCard">
      <span>{props.title}</span>
      <strong>{props.value}</strong>
      <p>{props.subtitle}</p>
    </article>
  );
}

function SectionCard(props: { title: string; children: ReactNode }) {
  return (
    <section className="sectionCard">
      <div className="sectionHead">
        <h3>{props.title}</h3>
      </div>
      {props.children}
    </section>
  );
}

function RowCard(props: { title: string; badge: string; children: ReactNode }) {
  return (
    <article className="rowCard">
      <div>
        <strong>{props.title}</strong>
        <div className="rowMeta">{props.children}</div>
      </div>
      <span className="tableBadge">{props.badge}</span>
    </article>
  );
}
