"use server";

import { headers } from "next/headers";
import { redirect } from "next/navigation";
import crypto from "node:crypto";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { hasStepUp, STEP_UP_REQUIRED_MESSAGE } from "@/lib/auth/step-up";
import { CONSENT_CATALOG, ERASURE_POLICY_VERSION, latestConsentVersion } from "@/lib/privacy/consent-catalog";
import { db } from "@/lib/db";
import { setFlash } from "@/lib/ui/flash";
import { recordSecurityEvent } from "@/server/services/auth-protection";
import { executeVerifiableErasure } from "@/server/services/privacy-erasure";
async function viewer() {
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");
  return user;
}

async function clientHints() {
  const h = await headers();
  const ip = h.get("x-forwarded-for")?.split(",")[0]?.trim() ?? "local";
  const ua = h.get("user-agent") ?? "";
  return {
    ipHash: crypto.createHash("sha256").update(ip).digest("hex").slice(0, 16),
    userAgentHash: crypto.createHash("sha256").update(ua).digest("hex").slice(0, 16),
  };
}

export async function acceptPrivacyConsentAction(formData: FormData) {
  const user = await viewer();
  const consentKey = String(formData.get("consentKey") ?? "");
  const def = latestConsentVersion(consentKey);
  if (!def) {
    await setFlash({ type: "error", text: "Consentimento desconhecido.", targetPath: "/perfil/privacidade" });
    redirect("/perfil/privacidade");
  }
  const hints = await clientHints();
  await db.privacyConsent.upsert({
    where: {
      userId_consentKey_version: { userId: user.id, consentKey: def.key, version: def.version },
    },
    create: {
      userId: user.id,
      consentKey: def.key,
      version: def.version,
      ipHash: hints.ipHash,
      userAgentHash: hints.userAgentHash,
    },
    update: { acceptedAt: new Date(), ipHash: hints.ipHash, userAgentHash: hints.userAgentHash },
  });
  await recordSecurityEvent({
    userId: user.id,
    type: "PRIVACY_CONSENT",
    metadata: { consentKey: def.key, version: def.version },
  });
  await setFlash({ type: "success", text: `Consentimento registado: ${def.title}.`, targetPath: "/perfil/privacidade" });
  redirect("/perfil/privacidade");
}

export async function requestSubjectErasureAction(formData: FormData) {
  const user = await viewer();
  if (!(await hasStepUp(user.id))) {
    await setFlash({ type: "error", text: STEP_UP_REQUIRED_MESSAGE, targetPath: "/perfil/privacidade" });
    redirect("/perfil/privacidade");
  }
  const confirm = String(formData.get("confirm") ?? "").trim();
  if (confirm !== "ELIMINAR A MINHA CONTA") {
    await setFlash({ type: "error", text: "Confirmação inválida.", targetPath: "/perfil/privacidade" });
    redirect("/perfil/privacidade");
  }
  const policy = String(formData.get("policyVersion") ?? "");
  if (policy !== ERASURE_POLICY_VERSION) {
    await setFlash({ type: "error", text: "Versão da política de eliminação desactualizada.", targetPath: "/perfil/privacidade" });
    redirect("/perfil/privacidade");
  }

  const result = await executeVerifiableErasure(user.id);
  await recordSecurityEvent({
    userId: user.id,
    type: "SUBJECT_ERASURE",
    metadata: { requestId: result.requestId, proofSha256: result.proofSha256 },
  });
  redirect("/login");
}

export type PrivacyCenterState = {
  catalog: typeof CONSENT_CATALOG;
  accepted: { consentKey: string; version: string; acceptedAt: Date }[];
  erasurePolicyVersion: string;
};

export async function loadPrivacyCenterState(userId: string): Promise<PrivacyCenterState> {
  const accepted = await db.privacyConsent.findMany({
    where: { userId },
    select: { consentKey: true, version: true, acceptedAt: true },
    orderBy: { acceptedAt: "desc" },
  });
  return { catalog: CONSENT_CATALOG, accepted, erasurePolicyVersion: ERASURE_POLICY_VERSION };
}
