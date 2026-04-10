import { FormEvent, useEffect, useState } from "react";
import { api } from "./api";
import type {
  ApiKeyRecord,
  AuthUser,
  AutomationJob,
  AutomationPreview,
  DashboardStats,
  Profile,
  ProxyRecord,
} from "./types";

type TabKey = "overview" | "profiles" | "proxies" | "apiKeys" | "jobs";

const emptyStats: DashboardStats = {
  profiles: 0,
  active_profiles: 0,
  proxies: 0,
  active_api_keys: 0,
  queued_jobs: 0,
  running_jobs: 0,
};

export default function App() {
  const [tab, setTab] = useState<TabKey>("overview");
  const [authUser, setAuthUser] = useState<AuthUser | null>(null);
  const [authLoading, setAuthLoading] = useState(true);
  const [stats, setStats] = useState<DashboardStats>(emptyStats);
  const [profiles, setProfiles] = useState<Profile[]>([]);
  const [proxies, setProxies] = useState<ProxyRecord[]>([]);
  const [apiKeys, setApiKeys] = useState<ApiKeyRecord[]>([]);
  const [jobs, setJobs] = useState<AutomationJob[]>([]);
  const [preview, setPreview] = useState<AutomationPreview | null>(null);
  const [latestKey, setLatestKey] = useState<string>("");
  const [error, setError] = useState<string>("");
  const [notice, setNotice] = useState<string>("");

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
      const [dashboard, profileItems, proxyItems, keyItems, jobItems] = await Promise.all([
        api.getDashboard(),
        api.getProfiles(),
        api.getProxies(),
        api.getApiKeys(),
        api.getJobs(),
      ]);
      setStats(dashboard);
      setProfiles(profileItems);
      setProxies(proxyItems);
      setApiKeys(keyItems);
      setJobs(jobItems);
    } catch (err) {
      const message = err instanceof Error ? err.message : "Unknown error";
      if (message.includes("Authentication required") || message.includes("Invalid token")) {
        api.clearToken();
        setAuthUser(null);
      }
      setError(message);
    }
  }

  async function safeAction(action: () => Promise<void>, successMessage?: string) {
    try {
      setError("");
      if (successMessage) {
        setNotice("");
      }
      await action();
      if (successMessage) {
        setNotice(successMessage);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : "Unknown error");
    }
  }

  async function submitProfile(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      await api.createProfile({
        name: form.get("name"),
        category: form.get("category"),
        description: form.get("description"),
        headless: form.get("headless") === "on",
        concurrency: Number(form.get("concurrency") ?? 1),
        timezone: form.get("timezone"),
        locale: form.get("locale"),
        user_agent: form.get("userAgent"),
        screen_width: Number(form.get("screenWidth") ?? 1440),
        screen_height: Number(form.get("screenHeight") ?? 900),
        proxy_id: form.get("proxyId") ? Number(form.get("proxyId")) : null,
        antidetect_config: {
          platform: form.get("platform"),
          deviceMemory: form.get("deviceMemory"),
          hardwareConcurrency: form.get("hardwareConcurrency"),
        },
      });
      event.currentTarget.reset();
      await refreshAll();
    }, "Da tao profile moi");
  }

  async function submitProxy(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      await api.createProxy({
        name: form.get("name"),
        host: form.get("host"),
        port: Number(form.get("port") ?? 80),
        protocol: form.get("protocol"),
        username: form.get("username"),
        password: form.get("password"),
        notes: form.get("notes"),
        is_active: true,
      });
      event.currentTarget.reset();
      await refreshAll();
    }, "Da luu proxy");
  }

  async function submitApiKey(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      const response = await api.createApiKey({
        name: form.get("name"),
        description: form.get("description"),
        rate_limit_per_minute: Number(form.get("rateLimit") ?? 60),
        is_active: true,
      });
      setLatestKey(response.raw_key);
      event.currentTarget.reset();
      await refreshAll();
    }, "Da tao API key moi");
  }

  async function submitCookieUpload(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profileId = Number(form.get("profileId"));
    const file = form.get("cookieFile");
    if (!(file instanceof File) || file.size === 0) {
      setError("Vui long chon file cookie txt/json");
      return;
    }
    await safeAction(async () => {
      await api.uploadCookies(profileId, file);
      event.currentTarget.reset();
      await refreshAll();
    }, "Da import cookie vao profile");
  }

  async function submitJob(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    const profileId = Number(form.get("profileId"));
    await safeAction(async () => {
      await api.createJob({
        profile_id: profileId,
        type: form.get("type"),
        prompt: form.get("prompt"),
        metadata_json: {
          aspectRatio: form.get("aspectRatio"),
          start_url: form.get("startUrl"),
          prompt_selector: form.get("promptSelector"),
          submit_selector: form.get("submitSelector"),
          ready_selector: form.get("readySelector"),
          result_selector: form.get("resultSelector"),
        },
      });
      setPreview(await api.getPreview(profileId));
      event.currentTarget.reset();
      await refreshAll();
    }, "Da queue job moi");
  }

  async function runJob(jobId: number, profileId: number) {
    await safeAction(async () => {
      await api.runJob(jobId);
      setPreview(await api.getPreview(profileId));
      await refreshAll();
    }, "Da gui lenh chay job");
  }

  async function submitLogin(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const form = new FormData(event.currentTarget);
    await safeAction(async () => {
      const response = await api.login({
        username: String(form.get("username") ?? ""),
        password: String(form.get("password") ?? ""),
      });
      api.setToken(response.access_token);
      setAuthUser(response.user);
      event.currentTarget.reset();
      await refreshAll();
    }, "Dang nhap thanh cong");
  }

  function logout() {
    api.clearToken();
    setAuthUser(null);
    setLatestKey("");
    setNotice("Da dang xuat");
    setError("");
  }

  if (authLoading) {
    return (
      <div className="loginShell">
        <section className="loginCard">
          <p className="eyebrow">Gateway Platform</p>
          <h1>Dang tai phien lam viec...</h1>
        </section>
      </div>
    );
  }

  if (!authUser) {
    return (
      <div className="loginShell">
        <section className="loginCard">
          <p className="eyebrow">Prod Gateway</p>
          <h1>Dang nhap quan tri</h1>
          <p className="muted">
            Su dung tai khoan admin de vao trang quan ly profile, proxy, API key va automation.
          </p>
          {error ? <div className="banner error">{error}</div> : null}
          {notice ? <div className="banner success">{notice}</div> : null}
          <form className="form" onSubmit={submitLogin}>
            <input name="username" placeholder="Username" required defaultValue="admin" />
            <input name="password" type="password" placeholder="Password" required />
            <button type="submit">Dang nhap</button>
          </form>
        </section>
      </div>
    );
  }

  return (
    <div className="shell">
      <aside className="sidebar">
        <div>
          <p className="eyebrow">Gateway Platform</p>
          <h1>Profile Control</h1>
          <p className="muted">
            Quan ly profile Grok, Flow, Dreamina, API key client, proxy pool va automation jobs.
          </p>
        </div>
        <nav className="nav">
          {[
            ["overview", "Tong quan"],
            ["profiles", "Profiles"],
            ["proxies", "Proxies"],
            ["apiKeys", "API Keys"],
            ["jobs", "Automation"],
          ].map(([key, label]) => (
            <button
              key={key}
              className={tab === key ? "navItem active" : "navItem"}
              onClick={() => setTab(key as TabKey)}
            >
              {label}
            </button>
          ))}
        </nav>
      </aside>

      <main className="content">
        <div className="topbar">
          <div>
            <strong>{authUser.display_name}</strong>
            <p className="muted">Dang nhap voi @{authUser.username}</p>
          </div>
          <button type="button" className="secondaryButton" onClick={logout}>
            Dang xuat
          </button>
        </div>
        {error ? <div className="banner error">{error}</div> : null}
        {notice ? <div className="banner success">{notice}</div> : null}
        {latestKey ? <div className="banner">API key moi: <code>{latestKey}</code></div> : null}

        {tab === "overview" ? (
          <section className="grid stats">
            <StatCard title="Profiles" value={stats.profiles} subtitle={`${stats.active_profiles} dang hoat dong`} />
            <StatCard title="Proxies" value={stats.proxies} subtitle="Pool cho anti-detect va scale" />
            <StatCard title="API Keys" value={stats.active_api_keys} subtitle="Client key dang bat" />
            <StatCard title="Jobs" value={stats.queued_jobs + stats.running_jobs} subtitle="Hang doi automation" />
          </section>
        ) : null}

        {tab === "profiles" ? (
          <section className="grid twoCols">
            <Panel title="Tao Profile">
              <form className="form" onSubmit={submitProfile}>
                <input name="name" placeholder="Gateway Grok 01" required />
                <select name="category" defaultValue="grok">
                  <option value="grok">Grok</option>
                  <option value="flow">Flow</option>
                  <option value="dreamina">Dreamina</option>
                </select>
                <textarea name="description" placeholder="Mo ta profile va muc dich su dung" />
                <div className="inline">
                  <input name="concurrency" type="number" min="1" max="20" defaultValue="1" />
                  <input name="timezone" placeholder="Asia/Ho_Chi_Minh" />
                </div>
                <div className="inline">
                  <input name="locale" placeholder="vi-VN" />
                  <input name="userAgent" placeholder="Custom user agent" />
                </div>
                <div className="inline">
                  <input name="screenWidth" type="number" defaultValue="1440" />
                  <input name="screenHeight" type="number" defaultValue="900" />
                </div>
                <div className="inline">
                  <select name="proxyId" defaultValue="">
                    <option value="">Khong dung proxy</option>
                    {proxies.map((proxy) => (
                      <option key={proxy.id} value={proxy.id}>
                        {proxy.name}
                      </option>
                    ))}
                  </select>
                  <label className="toggle">
                    <input name="headless" type="checkbox" defaultChecked />
                    Headless true
                  </label>
                </div>
                <div className="inline">
                  <input name="platform" placeholder="Windows" />
                  <input name="deviceMemory" placeholder="8" />
                  <input name="hardwareConcurrency" placeholder="4" />
                </div>
                <button type="submit">Tao profile</button>
              </form>
            </Panel>

            <Panel title="Danh sach Profiles">
              <form className="form inlineForm" onSubmit={submitCookieUpload}>
                <select name="profileId" required defaultValue="">
                  <option value="" disabled>
                    Chon profile de import cookie
                  </option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <input name="cookieFile" type="file" accept=".txt,.json,application/json,text/plain" required />
                <button type="submit">Import cookie</button>
              </form>
              <div className="list">
                {profiles.map((profile) => (
                  <article key={profile.id} className="listItem">
                    <div>
                      <strong>{profile.name}</strong>
                      <p>{profile.category.toUpperCase()} | concurrency {profile.concurrency}</p>
                      <p>
                        {profile.proxy_id ? `Proxy #${profile.proxy_id}` : "No proxy"} | {profile.screen_width}x
                        {profile.screen_height}
                      </p>
                    </div>
                    <span className="pill">{profile.headless ? "headless" : "headed"}</span>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === "proxies" ? (
          <section className="grid twoCols">
            <Panel title="Them Proxy">
              <form className="form" onSubmit={submitProxy}>
                <input name="name" placeholder="SG Proxy 1" required />
                <div className="inline">
                  <input name="host" placeholder="1.2.3.4" required />
                  <input name="port" type="number" placeholder="8080" required />
                </div>
                <div className="inline">
                  <select name="protocol" defaultValue="http">
                    <option value="http">http</option>
                    <option value="https">https</option>
                    <option value="socks5">socks5</option>
                  </select>
                  <input name="username" placeholder="Username" />
                  <input name="password" placeholder="Password" />
                </div>
                <textarea name="notes" placeholder="Ghi chu ve proxy, khu vuc, toc do..." />
                <button type="submit">Luu proxy</button>
              </form>
            </Panel>

            <Panel title="Proxy Pool">
              <div className="list">
                {proxies.map((proxy) => (
                  <article key={proxy.id} className="listItem">
                    <div>
                      <strong>{proxy.name}</strong>
                      <p>
                        {proxy.protocol}://{proxy.host}:{proxy.port}
                      </p>
                    </div>
                    <span className="pill">{proxy.is_active ? "active" : "off"}</span>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === "apiKeys" ? (
          <section className="grid twoCols">
            <Panel title="Tao API Key">
              <form className="form" onSubmit={submitApiKey}>
                <input name="name" placeholder="Client A" required />
                <textarea name="description" placeholder="Mo ta client su dung key nay" />
                <input name="rateLimit" type="number" defaultValue="60" min="1" />
                <button type="submit">Phat hanh key</button>
              </form>
            </Panel>

            <Panel title="Danh sach API Keys">
              <div className="list">
                {apiKeys.map((item) => (
                  <article key={item.id} className="listItem">
                    <div>
                      <strong>{item.name}</strong>
                      <p>{item.key_prefix}... | limit {item.rate_limit_per_minute}/phut</p>
                    </div>
                    <span className="pill">{item.is_active ? "active" : "off"}</span>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}

        {tab === "jobs" ? (
          <section className="grid twoCols">
            <Panel title="Tao Automation Job">
              <form className="form" onSubmit={submitJob}>
                <select name="profileId" required defaultValue="">
                  <option value="" disabled>
                    Chon profile
                  </option>
                  {profiles.map((profile) => (
                    <option key={profile.id} value={profile.id}>
                      {profile.name}
                    </option>
                  ))}
                </select>
                <select name="type" defaultValue="generate_image">
                  <option value="generate_image">Generate image</option>
                  <option value="generate_video">Generate video</option>
                </select>
                <input name="aspectRatio" placeholder="16:9" />
                <input name="startUrl" placeholder="https://grok.com/ hoặc https://labs.google/fx/tools/flow" />
                <input name="promptSelector" placeholder="Prompt selector, vd textarea" />
                <input name="submitSelector" placeholder="Submit selector, vd button[type=submit]" />
                <input name="readySelector" placeholder="Ready selector, vd body hoặc textarea" />
                <input name="resultSelector" placeholder="Result selector, vd img, video, a[href]" />
                <textarea name="prompt" placeholder="Nhap prompt de gen image/video..." required />
                <button type="submit">Queue job</button>
              </form>
            </Panel>

            <Panel title="Job Queue & Preview">
              {preview ? (
                <div className="previewBox">
                  <strong>{preview.provider.toUpperCase()}</strong>
                  <p>Concurrency: {preview.concurrency}</p>
                  <pre>{JSON.stringify(preview.launch_options, null, 2)}</pre>
                  <ul>
                    {preview.steps.map((step) => (
                      <li key={step}>{step}</li>
                    ))}
                  </ul>
                </div>
              ) : null}

              <div className="list">
                {jobs.map((job) => (
                  <article key={job.id} className="listItem">
                    <div>
                      <strong>{job.type}</strong>
                      <p>{job.prompt}</p>
                      <p>Profile #{job.profile_id}</p>
                    </div>
                    <div className="jobActions">
                      <span className="pill">{job.status}</span>
                      <button
                        type="button"
                        className="secondaryButton"
                        onClick={() => void runJob(job.id, job.profile_id)}
                        disabled={job.status === "running"}
                      >
                        Run
                      </button>
                    </div>
                  </article>
                ))}
              </div>
            </Panel>
          </section>
        ) : null}
      </main>
    </div>
  );
}

function StatCard(props: { title: string; value: number; subtitle: string }) {
  return (
    <article className="panel statCard">
      <p className="eyebrow">{props.title}</p>
      <h2>{props.value}</h2>
      <p className="muted">{props.subtitle}</p>
    </article>
  );
}

function Panel(props: { title: string; children: React.ReactNode }) {
  return (
    <section className="panel">
      <div className="panelHeader">
        <h2>{props.title}</h2>
      </div>
      {props.children}
    </section>
  );
}
