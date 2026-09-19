import { createHash } from "node:crypto";
import { describe, expect, test } from "bun:test";
import { verifyPublishedAssets } from "../../scripts/homologation/assets-verify.ts";
import { expectedAssets } from "../../scripts/homologation/plan.ts";
import { homologationTestConfig } from "../db/homologation-fixture.ts";

function bytes(value: string): Uint8Array { return new TextEncoder().encode(value); }
function hash(value: Uint8Array): string { return createHash("sha256").update(value).digest("hex"); }

function physicalConfig() {
  const config = homologationTestConfig();
  for (const asset of expectedAssets()) {
    const body = bytes(asset.key);
    const resolved = config.resolvedAssets[asset.key];
    if (!resolved) throw new Error(`asset de teste ausente: ${asset.key}`);
    resolved.sizeBytes = body.byteLength;
    resolved.sha256 = hash(body);
  }
  return config;
}

function fakeMediaFetch(): typeof fetch {
  const implementation = (input: string | URL | Request): Promise<Response> => {
    const url = new URL(typeof input === "string" ? input : input instanceof URL ? input.href : input.url);
    if (url.hostname === "assets.example.test") {
      return Promise.resolve(new Response(bytes(`logo:${url.pathname}`), { status: 200, headers: { "content-type": "image/webp" } }));
    }
    const objectKey = url.pathname.slice(1).split("/").map((segment) => decodeURIComponent(segment)).join("/");
    return Promise.resolve(new Response(bytes(objectKey), { status: 200, headers: { "content-type": "image/webp" } }));
  };
  return implementation as typeof fetch;
}

async function rejectionMessage(promise: Promise<unknown>): Promise<string> {
  try {
    await promise;
  } catch (error) {
    return error instanceof Error ? error.message : String(error);
  }
  throw new Error("era esperada uma rejeição");
}

describe("homologation physical media preflight", () => {
  test("confirma fisicamente os 76 assets e 2 logos por conteúdo", async () => {
    const result = await verifyPublishedAssets(physicalConfig(), fakeMediaFetch());
    expect(result).toEqual({ assets: 76, logos: 2 });
  });

  test("falha quando o conteúdo publicado diverge do sha256 esperado", async () => {
    const config = physicalConfig();
    const first = expectedAssets().at(0);
    if (!first) throw new Error("asset esperado ausente");
    const resolved = config.resolvedAssets[first.key];
    if (!resolved) throw new Error("asset resolvido ausente");
    resolved.sha256 = "0".repeat(64);
    const message = await rejectionMessage(verifyPublishedAssets(config, fakeMediaFetch()));
    expect(message).toContain("sha256 divergente");
  });
});
