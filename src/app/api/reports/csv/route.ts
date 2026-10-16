import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { buildFinancialReportCsv } from "@/server/services/reports";

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
  });
  if (!csv) {
    return NextResponse.json({ error: "Acesso negado." }, { status: 403 });
  }

  return new NextResponse(csv, {
    headers: {
      "Content-Type": "text/csv; charset=utf-8",
      "Content-Disposition": 'attachment; filename="fintwin-relatorio.csv"',
    },
  });
}
