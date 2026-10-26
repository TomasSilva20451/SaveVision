import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { appendAuditEvent } from "@/server/audit/audit-ledger";
import { buildAccountingExportCsv } from "@/server/services/reports";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { enforceApiRateLimit } from "@/server/security/enforce-api-rate-limit";

export async function GET(request: Request) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceApiRateLimit(request, { scope: "reports-accounting-csv", userId: user.id });
  if (limited) return limited;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return NextResponse.json({ error: "Sem workspace." }, { status: 400 });
  }

  const { searchParams } = new URL(request.url);
  const csv = await buildAccountingExportCsv(user.id, selected.id, {
    from: searchParams.get("from"),
    to: searchParams.get("to"),
  });
  if (!csv) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  await appendAuditEvent({
    actorUserId: user.id,
    workspaceId: selected.id,
    action: "ACCOUNTING_EXPORT",
    resourceType: "FinancialReport",
    resourceId: "accounting-csv",
    outcome: "SUCCESS",
    source: "route-handler",
    metadata: { format: "accounting-csv" },
  });

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fintwin-contabilidade.csv"',
    },
  });
}
