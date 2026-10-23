import { describe, expect, it, vi } from "vitest";

vi.mock("@/lib/db", () => ({
  db: {
    user: { findUnique: vi.fn() },
    workspaceInvite: { findUnique: vi.fn(), update: vi.fn() },
    $transaction: vi.fn((fn: (tx: unknown) => unknown) =>
      fn({
        workspaceMember: { updateMany: vi.fn().mockResolvedValue({ count: 1 }) },
        workspaceInvite: { update: vi.fn() },
      }),
    ),
  },
}));

vi.mock("@/lib/auth/workspace-access", () => ({
  requireWorkspaceManager: vi.fn(),
}));

vi.mock("@/server/audit/audit-ledger", () => ({
  appendAuditEvent: vi.fn().mockResolvedValue({ id: "audit-1" }),
}));

import { db } from "@/lib/db";
import {
  acceptWorkspaceInvite,
  declineWorkspaceInvite,
} from "@/server/services/joint-workspace";

describe("convites conjuntos", () => {
  it("recusa aceitação com email errado", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u1",
      email: "other@example.local",
    } as never);
    vi.mocked(db.workspaceInvite.findUnique).mockResolvedValue({
      id: "inv1",
      workspaceId: "ws",
      email: "user2@example.local",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
      role: "MEMBER",
    } as never);

    await expect(acceptWorkspaceInvite("u1", "token")).resolves.toBeNull();
  });

  it("declínio invalida convite", async () => {
    vi.mocked(db.user.findUnique).mockResolvedValue({
      id: "u2",
      email: "user2@example.local",
    } as never);
    vi.mocked(db.workspaceInvite.findUnique).mockResolvedValue({
      id: "inv1",
      workspaceId: "ws",
      email: "user2@example.local",
      acceptedAt: null,
      expiresAt: new Date(Date.now() + 60_000),
    } as never);

    await expect(declineWorkspaceInvite("u2", "token")).resolves.toBe(true);
  });
});
