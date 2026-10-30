import dotenv from "dotenv";
import pg from "pg";
import { assertE2eCleanupAllowed } from "../src/lib/e2e/cleanup-policy";
import { E2E_RECURRING_PREFIX } from "./recurring-e2e-prefix";

dotenv.config();

const DEMO_USER_EMAILS = ["user1@example.local", "user2@example.local"] as const;

export default async function globalSetup() {
  const raw = process.env.DATABASE_URL;
  if (!raw) {
    return;
  }

  const connectionString = raw.split("?")[0];
  assertE2eCleanupAllowed(connectionString);

  const client = new pg.Client({ connectionString: raw });
  await client.connect();
  try {
    const prefixPattern = `${E2E_RECURRING_PREFIX}%`;
    await client.query(
      `DELETE FROM "RecurringExpenseOccurrence"
       WHERE "recurringExpenseId" IN (
         SELECT id FROM "RecurringExpense" WHERE name LIKE $1
       )`,
      [prefixPattern],
    );
    await client.query(`DELETE FROM "RecurringExpense" WHERE name LIKE $1`, [prefixPattern]);

    const leakedPlans = await client.query(
      `DELETE FROM "SavingsPlan" WHERE name LIKE 'E2E Plano %' RETURNING name`,
    );
    // #region agent log
    fetch("http://127.0.0.1:7610/ingest/17fbe2a7-af6b-4d78-ae47-5d2d2f374366", {
      method: "POST",
      headers: { "Content-Type": "application/json", "X-Debug-Session-Id": "35ddd3" },
      body: JSON.stringify({
        sessionId: "35ddd3",
        runId: "pre-e2e",
        hypothesisId: "A",
        location: "e2e/global-setup.ts",
        message: "removed integration-test savings plans before Playwright",
        data: { deleted: leakedPlans.rowCount, names: leakedPlans.rows.map((row) => row.name) },
        timestamp: Date.now(),
      }),
    }).catch(() => {});
    // #endregion

    for (const email of DEMO_USER_EMAILS) {
      const user = await client.query(`SELECT id FROM "User" WHERE email = $1`, [email]);
      if (user.rowCount === 0) continue;
      await client.query(
        `DELETE FROM "RecurringExpenseOccurrence"
         WHERE "recurringExpenseId" IN (
           SELECT re.id FROM "RecurringExpense" re
           INNER JOIN "Workspace" w ON re."workspaceId" = w.id
           WHERE w."createdById" = $1 AND w.type = 'PERSONAL' AND re.name LIKE $2
         )`,
        [user.rows[0].id, prefixPattern],
      );
      await client.query(
        `DELETE FROM "RecurringExpense" re
         USING "Workspace" w
         WHERE re."workspaceId" = w.id
           AND w."createdById" = $1
           AND w.type = 'PERSONAL'
           AND re.name LIKE $2`,
        [user.rows[0].id, prefixPattern],
      );
    }
  } finally {
    await client.end();
  }
}
