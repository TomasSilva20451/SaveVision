import "server-only";

import { buildFinancialAlertMessage } from "@/lib/auth/email-templates";
import { isSmtpEmailDeliveryConfigured } from "@/lib/auth/email-delivery";
import { isFinancialAlertEmailEligible } from "@/lib/finance/financial-alert-email-policy";
import { db } from "@/lib/db";
import { resolveEmailDeliveryProvider } from "@/server/providers/email/registry";

const MAX_EMAILS_PER_USER_PER_SYNC = 10;

export async function notifyFinancialAlertEmails(workspaceId: string): Promise<number> {
  if (!isSmtpEmailDeliveryConfigured()) return 0;

  const provider = resolveEmailDeliveryProvider();
  if (!provider) return 0;

  const alerts = await db.financialAlert.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: {
      id: true,
      type: true,
      severity: true,
      title: true,
      description: true,
      actionUrl: true,
    },
  });

  const eligible = alerts.filter((row) =>
    isFinancialAlertEmailEligible({ type: row.type, severity: row.severity }),
  );
  if (eligible.length === 0) return 0;

  const members = await db.workspaceMember.findMany({
    where: { workspaceId, status: "ACTIVE" },
    select: {
      user: { select: { id: true, email: true, emailVerifiedAt: true } },
    },
  });

  const recipients = members
    .map((m) => m.user)
    .filter((u) => u.emailVerifiedAt != null);

  if (recipients.length === 0) return 0;

  let sent = 0;

  for (const user of recipients) {
    let userSent = 0;
    for (const alert of eligible) {
      if (userSent >= MAX_EMAILS_PER_USER_PER_SYNC) break;

      const state = await db.financialAlertUserState.findUnique({
        where: { alertId_userId: { alertId: alert.id, userId: user.id } },
        select: { emailNotifiedAt: true },
      });
      if (state?.emailNotifiedAt) continue;

      const payload = buildFinancialAlertMessage({
        toEmail: user.email,
        title: alert.title,
        description: alert.description,
        severity: alert.severity,
        actionPath: alert.actionUrl,
      });

      try {
        await provider.send({
          to: user.email,
          subject: payload.subject,
          text: payload.text,
          html: payload.html,
        });
      } catch (error) {
        console.error("[fintwin] falha email alerta", {
          workspaceId,
          alertId: alert.id,
          userId: user.id,
          error: error instanceof Error ? error.message : String(error),
        });
        continue;
      }

      await db.financialAlertUserState.upsert({
        where: { alertId_userId: { alertId: alert.id, userId: user.id } },
        create: {
          alertId: alert.id,
          userId: user.id,
          emailNotifiedAt: new Date(),
        },
        update: { emailNotifiedAt: new Date() },
      });

      userSent += 1;
      sent += 1;
    }
  }

  return sent;
}
