import { describe, expect, it } from "vitest";
import { evaluateE2eCleanupPolicy } from "@/lib/e2e/cleanup-policy";

const DEMO = "postgresql://fintwin:fintwin@localhost:5433/fintwin";

describe("evaluateE2eCleanupPolicy (fail-closed)", () => {
  it("bloqueia a antiga base de desenvolvimento mesmo no Docker local", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: DEMO,
      nodeEnv: "test",
    });
    expect(d.allowed).toBe(false);
  });

  it("permite base dedicada fintwin_e2e local com confirmação", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: "postgresql://u:p@127.0.0.1:5434/fintwin_e2e",
      nodeEnv: "test",
      allowFlag: "yes",
    });
    expect(d.allowed).toBe(true);
  });

  it("bloqueia produção NODE_ENV", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: DEMO,
      nodeEnv: "production",
    });
    expect(d.allowed).toBe(false);
  });

  it("bloqueia base remota mesmo com FINTWIN_ALLOW_E2E_CLEANUP=yes", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: "postgresql://u:p@db.example.com:5432/fintwin_e2e",
      nodeEnv: "test",
      allowFlag: "yes",
    });
    expect(d.allowed).toBe(false);
  });

  it("bloqueia fintwin em localhost:5432 (não é demo Compose)", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: "postgresql://u:p@localhost:5432/fintwin",
      nodeEnv: "test",
      allowFlag: "yes",
    });
    expect(d.allowed).toBe(false);
  });

  it("bloqueia nomes backup/prod", () => {
    expect(
      evaluateE2eCleanupPolicy({
        connectionString: "postgresql://u:p@localhost:5433/fintwin_backup",
        nodeEnv: "test",
      }).allowed,
    ).toBe(false);
  });

  it("bloqueia se DATABASE_URL coincide com base principal declarada", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: DEMO,
      nodeEnv: "test",
      primaryDatabaseUrl: DEMO,
    });
    expect(d.allowed).toBe(false);
  });

  it("não expõe credenciais na razão", () => {
    const d = evaluateE2eCleanupPolicy({
      connectionString: "postgresql://secret:secret@prod.example.com:5432/myapp",
      nodeEnv: "test",
    });
    expect(d.reason).not.toContain("secret");
  });
});
