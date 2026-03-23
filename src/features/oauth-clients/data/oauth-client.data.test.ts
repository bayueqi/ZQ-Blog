import { beforeEach, describe, expect, it, vi } from "vitest";
import { deleteOAuthConsentById } from "./oauth-client.data";

const oauthHelpers = vi.hoisted(() => ({
  revokeGrant: vi.fn(),
}));

const getOAuthHelpersMock = vi.hoisted(() => vi.fn(() => oauthHelpers));

vi.mock(
  "@/features/oauth-provider/oauth-provider.config",
  async (importOriginal) => {
    const actual =
      await importOriginal<
        typeof import("@/features/oauth-provider/oauth-provider.config")
      >();

    return {
      ...actual,
      getOAuthHelpers: getOAuthHelpersMock,
    };
  },
);

describe("oauth-client data", () => {
  beforeEach(() => {
    vi.clearAllMocks();
  });

  it("revokes the grant when it belongs to the user", async () => {
    oauthHelpers.revokeGrant.mockResolvedValue(undefined);

    await expect(
      deleteOAuthConsentById({} as Env, "consent_123", "user_123"),
    ).resolves.toEqual({
      consentId: "consent_123",
    });

    expect(oauthHelpers.revokeGrant).toHaveBeenCalledWith(
      "consent_123",
      "user_123",
    );
  });

  it("throws when revokeGrant fails", async () => {
    const error = new Error("kv unavailable");
    oauthHelpers.revokeGrant.mockRejectedValue(error);

    await expect(
      deleteOAuthConsentById({} as Env, "consent_123", "user_123"),
    ).rejects.toThrow("kv unavailable");
  });
});
