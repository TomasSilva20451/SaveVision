#!/usr/bin/env node
/**
 * Activa o modelo «Desafio 300 €» num workspace PERSONAL.
 * Uso: FINTWIN_ENV=production node scripts/activate-savings-plan-user.mjs --email user@example --dry-run
 *      ... --apply
 */
import { config } from "dotenv";
import path from "node:path";
import fs from "node:fs";

const args = process.argv.slice(2);
const dryRun = !args.includes("--apply");
const emailArg = args.find((a) => a.startsWith("--email="))?.slice("--email=".length)
  ?? (args.includes("--email") ? args[args.indexOf("--email") + 1] : null);

if (!emailArg) {
  console.error("Uso: node scripts/activate-savings-plan-user.mjs --email <email> [--dry-run|--apply]");
  process.exit(1);
}

const envName = process.env.FINTWIN_ENV ?? "production";
const envPath = path.resolve(`.env.${envName}.local`);
if (fs.existsSync(envPath)) config({ path: envPath });

if (process.env.FINTWIN_ENV !== "production" && process.env.FINTWIN_ENV !== "staging") {
  console.error("Recusado: só staging ou production.");
  process.exit(1);
}

const email = emailArg.trim().toLowerCase();

async function main() {
  const { db } = await import("../src/lib/db.ts");
  const {
    activateSavingsPlan,
    buildSavingsPlanActivationPreview,
    defaultWizardFromTemplate,
  } = await import("../src/server/services/savings-plan.ts");
  const { CHALLENGE_300_TEMPLATE_KEY } = await import("../src/lib/finance/savings-plan-template.ts");

  const user = await db.user.findUnique({ where: { email } });
  if (!user) {
    console.error(`Utilizador não encontrado: ${email}`);
    process.exit(1);
  }

  const membership = await db.workspaceMember.findFirst({
    where: { userId: user.id, status: "ACTIVE", workspace: { type: "PERSONAL" } },
    include: { workspace: true },
  });
  if (!membership) {
    console.error("Sem workspace PERSONAL activo.");
    process.exit(1);
  }

  const workspaceId = membership.workspaceId;
  const input = defaultWizardFromTemplate(CHALLENGE_300_TEMPLATE_KEY);
  if (!input) {
    console.error("Modelo Desafio 300 € indisponível.");
    process.exit(1);
  }
  input.confirmBudgetOverrides = true;

  const preview = await buildSavingsPlanActivationPreview(user.id, workspaceId, input);
  if (!preview) {
    console.error("Pré-visualização recusada.");
    process.exit(1);
  }

  const txBefore = await db.transaction.count({ where: { workspaceId } });
  const contribBefore = await db.savingsGoalContribution.count({ where: { workspaceId } });

  console.log(JSON.stringify({
    mode: dryRun ? "dry-run" : "apply",
    email,
    workspaceId,
    workspaceName: membership.workspace.name,
    workspaceType: membership.workspace.type,
    preview,
    countsBefore: { transactions: txBefore, contributions: contribBefore },
  }, null, 2));

  if (dryRun) {
    console.log("\nNenhuma escrita. Repete com --apply para activar.");
    return;
  }

  const result = await activateSavingsPlan(user.id, workspaceId, input);
  if (!result) {
    console.error("Activação recusada (conflitos ou permissões).");
    process.exit(1);
  }

  const txAfter = await db.transaction.count({ where: { workspaceId } });
  const contribAfter = await db.savingsGoalContribution.count({ where: { workspaceId } });

  console.log(JSON.stringify({
    planId: result.planId,
    reused: result.reused,
    transactionsCreated: txAfter - txBefore,
    contributionsCreated: contribAfter - contribBefore,
  }, null, 2));

  if (txAfter !== txBefore || contribAfter !== contribBefore) {
    console.error("ERRO: foram criadas transações ou contribuições — investigar.");
    process.exit(1);
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});
