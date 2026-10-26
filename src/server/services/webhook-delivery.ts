import { randomUUID } from "node:crypto";

import { signWebhookBody } from "@/lib/corporate/webhook-hmac";
import { db } from "@/lib/db";
import { decryptWebhookSecret } from "@/server/security/webhook-secret";
import { enqueuePlatformJob } from "@/server/services/platform-jobs";

export type WebhookEventPayload = Record<string, string | number | boolean | null>;

export { signWebhookBody, verifyWebhookSignature } from "@/lib/corporate/webhook-hmac";

function webhooksUseQueue(): boolean {
  const raw = process.env.FINTWIN_WEBHOOKS_ASYNC?.trim();
  if (raw === "0") return false;
  return true;
}

export async function deliverWebhookHttp(input: {
  url: string;
  secretEnc: string;
  event: string;
  body: string;
  timestamp: string;
  deliveryId: string;
}): Promise<boolean> {
  const secret = decryptWebhookSecret(input.secretEnc);
  const signature = signWebhookBody(secret, input.timestamp, input.body);

  const response = await fetch(input.url, {
    method: "POST",
    headers: {
      "Content-Type": "application/json",
      "X-FinTwin-Event": input.event,
      "X-FinTwin-Timestamp": input.timestamp,
      "X-FinTwin-Signature": signature,
      "X-FinTwin-Delivery-Id": input.deliveryId,
    },
    body: input.body,
    signal: AbortSignal.timeout(10_000),
  });
  return response.ok;
}

export async function executeWebhookDeliveryJob(payload: {
  workspaceId: string;
  subscriptionId: string;
  deliveryId: string;
  event: string;
  body: string;
  timestamp: string;
}) {
  const sub = await db.webhookSubscription.findFirst({
    where: { id: payload.subscriptionId, workspaceId: payload.workspaceId, active: true },
  });
  if (!sub?.secretEnc) throw new Error("WEBHOOK_SUBSCRIPTION_MISSING");
  const ok = await deliverWebhookHttp({
    url: sub.url,
    secretEnc: sub.secretEnc,
    event: payload.event,
    body: payload.body,
    timestamp: payload.timestamp,
    deliveryId: payload.deliveryId,
  });
  if (!ok) throw new Error("WEBHOOK_HTTP_FAILED");
  return { delivered: "true", deliveryId: payload.deliveryId };
}

export async function dispatchWorkspaceWebhooks(
  workspaceId: string,
  event: string,
  payload: WebhookEventPayload,
): Promise<{ attempted: number; delivered: number; queued: number }> {
  const subs = await db.webhookSubscription.findMany({
    where: { workspaceId, active: true, events: { has: event } },
  });

  let attempted = 0;
  let delivered = 0;
  let queued = 0;
  const body = JSON.stringify({ event, workspaceId, payload, sentAt: new Date().toISOString() });
  const timestamp = String(Math.floor(Date.now() / 1000));

  for (const sub of subs) {
    if (!sub.secretEnc) continue;
    attempted++;
    const deliveryId = randomUUID();

    if (webhooksUseQueue()) {
      await enqueuePlatformJob({
        kind: "WEBHOOK_DELIVERY",
        workspaceId,
        payload: {
          workspaceId,
          subscriptionId: sub.id,
          deliveryId,
          event,
          body,
          timestamp,
        },
      });
      queued += 1;
      continue;
    }

    try {
      const ok = await deliverWebhookHttp({
        url: sub.url,
        secretEnc: sub.secretEnc,
        event,
        body,
        timestamp,
        deliveryId,
      });
      if (ok) delivered += 1;
    } catch {
      // best-effort síncrono
    }
  }

  return { attempted, delivered, queued };
}
