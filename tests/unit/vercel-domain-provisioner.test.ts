import { describe, expect, test } from "bun:test";
import {
  normalizeManagedKataluuHostname,
} from "@white-label/domains";
import {
  VercelDomainProvisioningError,
  VercelProjectDomainProvisioner,
  type VercelDomainErrorCode,
} from "../../apps/web/src/lib/server/vercel-domain-provisioner.server.ts";

interface FetchCall {
  url: string;
  method: string;
}

function response(status: number, body: unknown, headers?: Record<string, string>): Response {
  return new Response(JSON.stringify(body), {
    status,
    headers: { "content-type": "application/json", ...headers },
  });
}

function sequenceFetch(items: Array<Response | Error>) {
  const calls: FetchCall[] = [];
  const fn = ((input: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
    const url = typeof input === "string"
      ? input
      : input instanceof URL
        ? input.toString()
        : input.url;
    calls.push({ url, method: init?.method ?? "GET" });
    const next = items.shift();
    if (!next) return Promise.reject(new Error("mock sem resposta"));
    if (next instanceof Error) return Promise.reject(next);
    return Promise.resolve(next);
  }) as typeof fetch;
  return { fn, calls };
}

function provisioner(fetchImpl: typeof fetch, overrides: {
  token?: string | null;
  projectId?: string | null;
  teamId?: string | null;
  timeoutMs?: number;
} = {}) {
  return new VercelProjectDomainProvisioner({
    token: overrides.token === undefined ? "token-test" : overrides.token,
    projectId: overrides.projectId === undefined ? "prj_test" : overrides.projectId,
    teamId: overrides.teamId === undefined ? "team_test" : overrides.teamId,
    timeoutMs: overrides.timeoutMs,
    fetchImpl,
    log: () => undefined,
  });
}

async function expectErrorCode(
  promise: Promise<unknown>,
  code: VercelDomainErrorCode,
): Promise<VercelDomainProvisioningError> {
  try {
    await promise;
  } catch (error) {
    expect(error).toBeInstanceOf(VercelDomainProvisioningError);
    const typed = error as VercelDomainProvisioningError;
    expect(typed.code).toBe(code);
    return typed;
  }
  throw new Error(`esperava erro ${code}`);
}

describe("Vercel project-domain provisioner", () => {
  test("normaliza somente hostname puro dentro de *.kataluu.com.br", () => {
    expect(normalizeManagedKataluuHostname("  LUME-HML.KATALUU.COM.BR  "))
      .toBe("lume-hml.kataluu.com.br");
  });

  test("rejeita hostname fora da zona", () => {
    expect(() => normalizeManagedKataluuHostname("google.com")).toThrow("fora da zona");
  });

  test("rejeita protocolo", () => {
    expect(() => normalizeManagedKataluuHostname("https://lume-hml.kataluu.com.br"))
      .toThrow("protocolo");
  });

  test("rejeita path", () => {
    expect(() => normalizeManagedKataluuHostname("lume-hml.kataluu.com.br/catalogo"))
      .toThrow("path");
  });

  test("respeita domínio reservado", () => {
    expect(() => normalizeManagedKataluuHostname("media.kataluu.com.br")).toThrow("reservado");
  });

  test("falha fechado sem token", async () => {
    const mock = sequenceFetch([]);
    await expectErrorCode(
      provisioner(mock.fn, { token: null }).getProjectDomainState("lume-hml.kataluu.com.br"),
      "configuration",
    );
    expect(mock.calls).toHaveLength(0);
  });

  test("falha fechado sem project id", async () => {
    const mock = sequenceFetch([]);
    await expectErrorCode(
      provisioner(mock.fn, { projectId: null }).getProjectDomainState("lume-hml.kataluu.com.br"),
      "configuration",
    );
    expect(mock.calls).toHaveLength(0);
  });

  test("cria domínio ausente no Project Domains", async () => {
    const mock = sequenceFetch([
      response(404, { error: { message: "not found" } }),
      response(200, { name: "botanica-hml.kataluu.com.br", projectId: "prj_test", verified: true }),
    ]);
    const result = await provisioner(mock.fn).ensureProjectDomain("botanica-hml.kataluu.com.br");
    expect(result.action).toBe("created");
    expect(result.provisioned).toBe(true);
    expect(mock.calls.map((call) => call.method)).toEqual(["GET", "POST"]);
    expect(mock.calls[1]?.url).toContain("/v10/projects/prj_test/domains");
  });

  test("lume já existente é sucesso idempotente sem POST", async () => {
    const mock = sequenceFetch([
      response(200, { name: "lume-hml.kataluu.com.br", projectId: "prj_test", verified: true }),
    ]);
    const result = await provisioner(mock.fn).ensureProjectDomain("lume-hml.kataluu.com.br");
    expect(result.action).toBe("already_provisioned");
    expect(mock.calls.map((call) => call.method)).toEqual(["GET"]);
  });

  test("corrida 400/already exists reconcilia por GET", async () => {
    const mock = sequenceFetch([
      response(404, {}),
      response(400, { error: { message: "domain already exists" } }),
      response(200, { name: "passo-hml.kataluu.com.br", projectId: "prj_test", verified: true }),
    ]);
    const result = await provisioner(mock.fn).ensureProjectDomain("passo-hml.kataluu.com.br");
    expect(result.action).toBe("already_provisioned");
    expect(mock.calls.map((call) => call.method)).toEqual(["GET", "POST", "GET"]);
  });

  test("409 de outro projeto permanece conflito quando GET não confirma", async () => {
    const mock = sequenceFetch([
      response(404, {}),
      response(409, { error: { message: "assigned to another project" } }),
      response(404, {}),
    ]);
    await expectErrorCode(
      provisioner(mock.fn).ensureProjectDomain("nexo-hml.kataluu.com.br"),
      "conflict",
    );
  });

  test("401 e 403 não são tratados como idempotência", async () => {
    for (const [status, code] of [[401, "unauthorized"], [403, "forbidden"]] as const) {
      const mock = sequenceFetch([response(status, { error: { message: code } })]);
      await expectErrorCode(
        provisioner(mock.fn).getProjectDomainState("casa-hml.kataluu.com.br"),
        code,
      );
    }
  });

  test("429 preserva retry-after sem loop de retry", async () => {
    const mock = sequenceFetch([
      response(429, { error: { message: "rate limit" } }, { "retry-after": "17" }),
    ]);
    const error = await expectErrorCode(
      provisioner(mock.fn).getProjectDomainState("casa-hml.kataluu.com.br"),
      "rate_limited",
    );
    expect(error.retryAfterSeconds).toBe(17);
    expect(mock.calls).toHaveLength(1);
  });

  test("5xx retorna erro upstream", async () => {
    const mock = sequenceFetch([response(503, { error: { message: "unavailable" } })]);
    await expectErrorCode(
      provisioner(mock.fn).getProjectDomainState("casa-hml.kataluu.com.br"),
      "upstream",
    );
  });

  test("resposta HTTP inesperada permanece erro estruturado", async () => {
    const mock = sequenceFetch([response(418, { error: { message: "unexpected" } })]);
    await expectErrorCode(
      provisioner(mock.fn).getProjectDomainState("casa-hml.kataluu.com.br"),
      "unexpected",
    );
  });

  test("falha de rede retorna erro estruturado", async () => {
    const mock = sequenceFetch([new TypeError("socket reset")]);
    await expectErrorCode(
      provisioner(mock.fn).getProjectDomainState("casa-hml.kataluu.com.br"),
      "network",
    );
  });

  test("timeout aborta uma única requisição", async () => {
    let calls = 0;
    const fetchImpl = ((_: Parameters<typeof fetch>[0], init?: Parameters<typeof fetch>[1]) => {
      calls += 1;
      return new Promise<Response>((_, reject) => {
        init?.signal?.addEventListener("abort", () => {
          const error = new Error("aborted");
          error.name = "AbortError";
          reject(error);
        });
      });
    }) as typeof fetch;
    await expectErrorCode(
      provisioner(fetchImpl, { timeoutMs: 1 }).getProjectDomainState("casa-hml.kataluu.com.br"),
      "network",
    );
    expect(calls).toBe(1);
  });
});
