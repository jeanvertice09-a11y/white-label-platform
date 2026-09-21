import {
  normalizeManagedKataluuHostname,
  type EnsureProjectDomainResult,
  type ManagedDomainProvisioner,
  type ProjectDomainState,
} from "@white-label/domains";

const VERCEL_API_ORIGIN = "https://api.vercel.com";
const DEFAULT_TIMEOUT_MS = 8_000;

export type VercelDomainErrorCode =
  | "configuration"
  | "unauthorized"
  | "forbidden"
  | "not_found"
  | "rate_limited"
  | "conflict"
  | "upstream"
  | "network"
  | "unexpected";

export class VercelDomainProvisioningError extends Error {
  constructor(
    message: string,
    readonly code: VercelDomainErrorCode,
    readonly status: number | null = null,
    readonly retryAfterSeconds: number | null = null,
  ) {
    super(message);
    this.name = "VercelDomainProvisioningError";
  }
}

export interface DomainProvisioningLog {
  hostname: string;
  action: "check" | "ensure";
  result: string;
  status: number | null;
  errorType?: VercelDomainErrorCode;
}

type FetchLike = typeof fetch;
type LogFn = (entry: DomainProvisioningLog) => void;

export interface VercelProjectDomainConfig {
  token: string | null;
  projectId: string | null;
  teamId?: string | null;
  timeoutMs?: number;
  fetchImpl?: FetchLike;
  log?: LogFn;
}

function defaultLog(entry: DomainProvisioningLog): void {
  process.stdout.write(`[domain-provisioning] ${JSON.stringify(entry)}\n`);
}

function retryAfterSeconds(response: Response): number | null {
  const raw = response.headers.get("retry-after");
  if (!raw) return null;
  const seconds = Number.parseInt(raw, 10);
  return Number.isFinite(seconds) && seconds >= 0 ? seconds : null;
}

async function responseBody(response: Response): Promise<Record<string, unknown> | null> {
  try {
    const value: unknown = await response.json();
    return value && typeof value === "object" && !Array.isArray(value)
      ? value as Record<string, unknown>
      : null;
  } catch {
    return null;
  }
}

function responseMessage(body: Record<string, unknown> | null): string | null {
  const error = body?.["error"];
  if (error && typeof error === "object" && !Array.isArray(error)) {
    const message = (error as Record<string, unknown>)["message"];
    if (typeof message === "string" && message.trim()) return message;
  }
  const message = body?.["message"];
  return typeof message === "string" && message.trim() ? message : null;
}

function classifyHttpError(response: Response, body: Record<string, unknown> | null): VercelDomainProvisioningError {
  const message = responseMessage(body) ?? `Vercel respondeu HTTP ${String(response.status)}.`;
  if (response.status === 401) return new VercelDomainProvisioningError(message, "unauthorized", 401);
  if (response.status === 403) return new VercelDomainProvisioningError(message, "forbidden", 403);
  if (response.status === 404) return new VercelDomainProvisioningError(message, "not_found", 404);
  if (response.status === 429) {
    return new VercelDomainProvisioningError(message, "rate_limited", 429, retryAfterSeconds(response));
  }
  if (response.status === 409 || response.status === 400) {
    return new VercelDomainProvisioningError(message, "conflict", response.status);
  }
  if (response.status >= 500) return new VercelDomainProvisioningError(message, "upstream", response.status);
  return new VercelDomainProvisioningError(message, "unexpected", response.status);
}

function parseProjectDomain(hostname: string, body: Record<string, unknown> | null): ProjectDomainState {
  return {
    hostname,
    provisioned: true,
    verified: typeof body?.["verified"] === "boolean" ? body["verified"] : null,
    projectId: typeof body?.["projectId"] === "string" ? body["projectId"] : null,
  };
}

export class VercelProjectDomainProvisioner implements ManagedDomainProvisioner {
  private readonly fetchImpl: FetchLike;
  private readonly timeoutMs: number;
  private readonly log: LogFn;

  constructor(private readonly config: VercelProjectDomainConfig) {
    this.fetchImpl = config.fetchImpl ?? fetch;
    this.timeoutMs = config.timeoutMs ?? DEFAULT_TIMEOUT_MS;
    this.log = config.log ?? defaultLog;
  }

  private assertConfigured(): { token: string; projectId: string; teamId: string | null } {
    const token = this.config.token?.trim() ?? "";
    const projectId = this.config.projectId?.trim() ?? "";
    const teamId = this.config.teamId?.trim() || null;
    if (!token) throw new VercelDomainProvisioningError("VERCEL_API_TOKEN não configurado.", "configuration");
    if (!projectId) throw new VercelDomainProvisioningError("VERCEL_PROJECT_ID não configurado.", "configuration");
    return { token, projectId, teamId };
  }

  private async request(method: "GET" | "POST", path: string, body?: unknown): Promise<Response> {
    const { token, teamId } = this.assertConfigured();
    const url = new URL(`${VERCEL_API_ORIGIN}${path}`);
    if (teamId) url.searchParams.set("teamId", teamId);
    const controller = new AbortController();
    const timer = setTimeout(() => {
      controller.abort();
    }, this.timeoutMs);
    try {
      return await this.fetchImpl(url, {
        method,
        headers: {
          Authorization: `Bearer ${token}`,
          "Content-Type": "application/json",
        },
        body: body === undefined ? undefined : JSON.stringify(body),
        signal: controller.signal,
      });
    } catch (error) {
      const reason = error instanceof Error ? error.name : "network";
      throw new VercelDomainProvisioningError(`Falha de rede/timeout na Vercel (${reason}).`, "network");
    } finally {
      clearTimeout(timer);
    }
  }

  async getProjectDomainState(input: string): Promise<ProjectDomainState> {
    const hostname = normalizeManagedKataluuHostname(input);
    const { projectId } = this.assertConfigured();
    const response = await this.request(
      "GET",
      `/v9/projects/${encodeURIComponent(projectId)}/domains/${encodeURIComponent(hostname)}`,
    );
    if (response.status === 404) {
      this.log({ hostname, action: "check", result: "not_provisioned", status: 404 });
      return { hostname, provisioned: false, verified: null, projectId: null };
    }
    const body = await responseBody(response);
    if (!response.ok) {
      const error = classifyHttpError(response, body);
      this.log({ hostname, action: "check", result: "error", status: response.status, errorType: error.code });
      throw error;
    }
    this.log({ hostname, action: "check", result: "provisioned", status: response.status });
    return parseProjectDomain(hostname, body);
  }

  async ensureProjectDomain(input: string): Promise<EnsureProjectDomainResult> {
    const hostname = normalizeManagedKataluuHostname(input);
    const current = await this.getProjectDomainState(hostname);
    if (current.provisioned) return { ...current, action: "already_provisioned" };

    const { projectId } = this.assertConfigured();
    const response = await this.request(
      "POST",
      `/v10/projects/${encodeURIComponent(projectId)}/domains`,
      { name: hostname },
    );
    const body = await responseBody(response);
    if (response.ok) {
      this.log({ hostname, action: "ensure", result: "created", status: response.status });
      return { ...parseProjectDomain(hostname, body), action: "created" };
    }

    if (response.status === 400 || response.status === 409) {
      const reconciled = await this.getProjectDomainState(hostname);
      if (reconciled.provisioned) {
        this.log({ hostname, action: "ensure", result: "already_provisioned", status: response.status });
        return { ...reconciled, action: "already_provisioned" };
      }
    }

    const error = classifyHttpError(response, body);
    this.log({ hostname, action: "ensure", result: "error", status: response.status, errorType: error.code });
    throw error;
  }
}

export function createConfiguredVercelDomainProvisioner(): ManagedDomainProvisioner {
  return new VercelProjectDomainProvisioner({
    token: process.env["VERCEL_API_TOKEN"] ?? null,
    projectId: process.env["VERCEL_PROJECT_ID"] ?? null,
    teamId: process.env["VERCEL_TEAM_ID"] ?? null,
  });
}
