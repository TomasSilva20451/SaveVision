import { signWebhookBody } from "@/lib/corporate/webhook-hmac";
import { db } from "@/lib/db";
import { decryptWebhookSecret } from "@/server/security/webhook-secret";

export type WebhookEventPayload = Record<string, string | number | boolean | null>;

export { signWebhookBody, verifyWebhookSignature } from "@/lib/corporate/webhook-hmac";

export async function dispatchWorkspaceWebhooks(
  workspaceId: string,
  event: string,
  payload: WebhookEventPayload,
): Promise<{ attempted: number; delivered: number }> {
  const subs = await db.webhookSubscription.findMany({
    where: { workspaceId, active: true, events: { has: event } },
  });

  let attempted = 0;
  let delivered = 0;
  const body = JSON.stringify({ event, workspaceId, payload, sentAt: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));

  for (const sub of subs) {
    if (!sub.secretEnc) continue;
    attempted++;
    const secret = decryptWebhookSecret(sub.secretEnc);
    const signature = signWebhookBody(secret, timestamp, body);

    try {
      const response = await fetch(sub.url, {
        method: "POST",
        headers: {
          "Content-Type": "application/json",
          "X-FinTwin-Event": event,
          "X-FinTwin-Timestamp": timestamp,
          "X-FinTwin-Signature": signature,
        },
        body,
        signal: AbortSignal.timeout(10_000),
      });
      if (response.ok) delivered++;
    } catch {
      // entrega best-effort; falhas não revertem reconciliação
    }
  }

  return { attempted, delivered };
}
