import { describe, expect, it, vi } from "vitest";

async function mutationFlow(refresh: () => Promise<void>): Promise<"success" | "error"> {
  try {
    await refresh();
    return "success";
  } catch {
    return "error";
  }
}

describe("inventory post-mutation refresh contract", () => {
  it("does not report success when the post-mutation refresh rejects", async () => {
    const refresh = vi.fn().mockRejectedValue(new Error("refresh failed"));
    await expect(mutationFlow(refresh)).resolves.toBe("error");
    expect(refresh).toHaveBeenCalledOnce();
  });
});
