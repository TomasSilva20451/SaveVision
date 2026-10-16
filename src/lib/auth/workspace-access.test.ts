import { describe, expect, it, vi } from "vitest";
import {
  requireWorkspaceAccess,
  requireWorkspaceEditor,
  requireWorkspaceManager,
  requireWorkspaceRole,
} from "@/lib/auth/workspace-access";

vi.mock("@/server/repositories/workspaces", () => ({
  listMemberships: vi.fn(),
}));

import { listMemberships } from "@/server/repositories/workspaces";

const mockedListMemberships = vi.mocked(listMemberships);

describe("requireWorkspaceAccess", () => {
  it("devolve membership ativa e recusa workspace alheio", async () => {
    mockedListMemberships.mockResolvedValue([
      { workspaceId: "ws-a", role: "OWNER", status: "ACTIVE" },
      { workspaceId: "ws-b", role: "MEMBER", status: "INVITED" },
    ]);

    await expect(requireWorkspaceAccess("user-a", "ws-a")).resolves.toEqual({
      workspaceId: "ws-a",
      role: "OWNER",
      status: "ACTIVE",
    });
    await expect(requireWorkspaceAccess("user-a", "ws-c")).resolves.toBeNull();
    await expect(requireWorkspaceAccess("user-a", "ws-b")).resolves.toBeNull();
  });

  it("exige papéis específicos para gerir ou editar", async () => {
    mockedListMemberships.mockResolvedValue([
      { workspaceId: "ws-joint", role: "VIEWER", status: "ACTIVE" },
    ]);

    await expect(requireWorkspaceRole("user-b", "ws-joint", ["OWNER"])).resolves.toBeNull();
    await expect(requireWorkspaceEditor("user-b", "ws-joint")).resolves.toBeNull();
    await expect(requireWorkspaceManager("user-b", "ws-joint")).resolves.toBeNull();
    await expect(requireWorkspaceAccess("user-b", "ws-joint")).resolves.toEqual({
      workspaceId: "ws-joint",
      role: "VIEWER",
      status: "ACTIVE",
    });
  });
});
