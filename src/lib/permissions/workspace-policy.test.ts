import { describe, expect, it } from "vitest";
import {
  canAccessWorkspace,
  canEditTransaction,
  canManageWorkspace,
  canViewTransaction,
  type WorkspaceMembership,
} from "@/lib/permissions/workspace-policy";

const memberships: WorkspaceMembership[] = [
  { workspaceId: "workspace-a", role: "OWNER", status: "ACTIVE" },
  { workspaceId: "workspace-joint", role: "VIEWER", status: "ACTIVE" },
  { workspaceId: "workspace-invited", role: "MEMBER", status: "INVITED" },
];

describe("política de workspace", () => {
  it("deixa o utilizador entrar no próprio workspace e recusa o de outra pessoa", () => {
    expect(canAccessWorkspace(memberships, "workspace-a")).toBe(true);
    expect(canAccessWorkspace(memberships, "workspace-b")).toBe(false);
    expect(canViewTransaction(memberships, "workspace-a")).toBe(true);
    expect(canViewTransaction(memberships, "workspace-b")).toBe(false);
  });

  it("não trata um convite pendente como acesso", () => {
    expect(canAccessWorkspace(memberships, "workspace-invited")).toBe(false);
    expect(canEditTransaction(memberships, "workspace-invited")).toBe(false);
  });

  it("reserva a gestão ao owner e a edição ao owner ou member", () => {
    expect(canManageWorkspace(memberships, "workspace-a")).toBe(true);
    expect(canEditTransaction(memberships, "workspace-a")).toBe(true);
    expect(canManageWorkspace(memberships, "workspace-joint")).toBe(false);
    expect(canEditTransaction(memberships, "workspace-joint")).toBe(false);
    expect(canViewTransaction(memberships, "workspace-joint")).toBe(true);
  });

  it("deixa um member editar sem gerir o workspace", () => {
    const member: WorkspaceMembership[] = [
      { workspaceId: "workspace-joint", role: "MEMBER", status: "ACTIVE" },
    ];

    expect(canEditTransaction(member, "workspace-joint")).toBe(true);
    expect(canManageWorkspace(member, "workspace-joint")).toBe(false);
  });
});
