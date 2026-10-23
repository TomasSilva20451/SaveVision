import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { buildFinancialReportCsv } from "@/server/services/reports";
import { appendAuditEvent } from "@/server/audit/audit-ledger";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return NextResponse.json({ error: "Sem workspace." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const csv = await buildFinancialReportCsv(user.id, selected.id, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
    includeNarrative: searchParams.get("includeNarrative"),
  });
  if (!csv) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  await appendAuditEvent({
    actorUserId: user.id,
    workspaceId: selected.id,
    action: "REPORT_EXPORTED",
    resourceType: "FinancialReport",
    resourceId: `${searchParams.get("from") ?? "default"}:${searchParams.get("to") ?? "default"}:csv`,
    outcome: "SUCCESS",
    source: "route-handler",
    requestId: request.headers.get("x-request-id"),
    ip: request.headers.get("x-forwarded-for")?.split(",")[0]?.trim() ?? null,
    userAgent: request.headers.get("user-agent"),
    metadata: { format: "csv" },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fintwin-relatorio.csv"',
    },
  });
}
