import "server-only";

import { db } from "@/lib/db";
import { latestConsentVersion } from "@/lib/privacy/consent-catalog";

export async function hasAcceptedConsent(userId: string, consentKey: string) {
  const def = latestConsentVersion(consentKey);
  if (!def) return false;
  const row = await db.privacyConsent.findUnique({
    where: {
      userId_consentKey_version: { userId, consentKey: def.key, version: def.version },
    },
  });
  return Boolean(row);
}
