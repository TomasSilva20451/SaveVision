import { describe, expect, it } from "vitest";
import { canAccessRecord } from "@/lib/permissions/workspace-scope";

describe("isolamento de workspace", () => {
  it("permite o registo do próprio workspace e recusa o de outro", () => {
    const memberships = ["workspace-a"];

    expect(
      canAccessRecord(memberships, { workspaceId: "workspace-a" }),
    ).toBe(true);
    expect(
      canAccessRecord(memberships, { workspaceId: "workspace-b" }),
    ).toBe(false);
  });
});
