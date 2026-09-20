import { describe, expect, test } from "bun:test";

async function source(path: string): Promise<string> {
  return Bun.file(path).text();
}

describe("homologation CLI media boundary", () => {
  test("functional apply requires explicit deferred-media acknowledgement", async () => {
    const cli = await source("scripts/homologation/cli.ts");
    expect(cli).toContain('HOMOLOGATION_MEDIA_DEFERRED=KATALUU_HML_MEDIA_DEFERRED obrigatório');
    expect(cli).toContain('command === "apply-functional"');
    expect(cli).toContain('mediaMode: "deferred"');
    expect(cli).toContain("mediaPending: true");
  });

  test("full Production apply keeps physical media verification", async () => {
    const cli = await source("scripts/homologation/cli.ts");
    expect(cli).toContain('HOMOLOGATION_ASSETS_READY=true obrigatório');
    expect(cli).toContain("await verifyPublishedAssets(config)");
    expect(cli).toContain('mediaMode: "required"');
  });
});
