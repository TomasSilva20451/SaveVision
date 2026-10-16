import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    workspace: { findUnique: vi.fn() },
  },
}));

vi.mock("@/lib/auth/workspace-access", () => ({
  requireWorkspaceAccess: vi.fn(),
}));

import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { db } from "@/lib/db";
import { assertPersonalWorkspaceIsolation } from "@/server/services/joint-workspace";

describe("assertPersonalWorkspaceIsolation", () => {
  it("confirma que utilizador sem membership não acede a workspace pessoal alheio", async () => {
    vi.mocked(db.workspace.findUnique).mockResolvedValue({
      id: "ws-personal-b",
      type: "PERSONAL",
    } as never);
    vi.mocked(requireWorkspaceAccess).mockResolvedValue(null);

    await expect(
      assertPersonalWorkspaceIsolation("user-a", "ws-personal-b"),
    ).resolves.toBe(true);
  });

  it("recusa quando o workspace não é pessoal", async () => {
    vi.mocked(db.workspace.findUnique).mockResolvedValue({
      id: "ws-joint",
      type: "JOINT",
    } as never);

    await expect(
      assertPersonalWorkspaceIsolation("user-a", "ws-joint"),
    ).resolves.toBe(false);
  });
});
