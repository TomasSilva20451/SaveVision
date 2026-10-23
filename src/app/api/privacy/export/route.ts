import { NextResponse } from "next/server";
import { connection } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { hasStepUp } from "@/lib/auth/step-up";
import { observeApiRoute } from "@/lib/observability/with-api-route";
import { recordSecurityEvent } from "@/server/services/auth-protection";
import { buildSubjectAccessExport } from "@/server/services/privacy-export";

export async function GET(request: Request) {
  await connection();
  return observeApiRoute("/api/privacy/export", async () => {
    const user = await requireAuthenticatedUser();
    if (!user) return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
    if (!(await hasStepUp(user.id))) {
      return NextResponse.json({ error: "Confirma a identidade antes de exportar." }, { status: 403 });
    }
    const payload = await buildSubjectAccessExport(user.id);
    await recordSecurityEvent({
      userId: user.id,
      type: "PRIVACY_EXPORT",
      ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim(),
      metadata: { format: payload.format, via: "api" },
    });
    return NextResponse.json(payload, {
      headers: {
        "Content-Disposition": `attachment; filename="fintwin-dados-${user.id.slice(0, 8)}.json"`,
      },
    });
  });
}
