import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { hasStepUp } from "@/lib/auth/step-up";
import { db } from "@/lib/db";
import { recordSecurityEvent } from "@/server/services/auth-protection";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  if (!(await hasStepUp(user.id))) {
    return NextResponse.json({ error: "Confirma a identidade no centro de segurança antes de exportar." }, { status: 403 });
  }

  const [profile, sessions, events, passkeys] = await Promise.all([
    db.user.findUnique({
      where: { id: user.id },
      select: { id: true, email: true, name: true, phone: true, emailVerifiedAt: true, createdAt: true },
    }),
    db.authSession.findMany({
      where: { userId: user.id },
      select: { id: true, deviceLabel: true, createdAt: true, lastSeenAt: true, revokedAt: true },
    }),
    db.securityEvent.findMany({
      where: { userId: user.id },
      orderBy: { createdAt: "desc" },
      take: 50,
      select: { type: true, createdAt: true },
    }),
    db.passkeyCredential.findMany({
      where: { userId: user.id },
      select: { id: true, deviceLabel: true, createdAt: true, lastUsedAt: true },
    }),
  ]);

  await recordSecurityEvent({
    userId: user.id,
    type: "DATA_EXPORT",
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
    metadata: { scope: "account" },
  });
  return NextResponse.json({ profile, sessions, events, passkeys });
}
