import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";
import { readDocumentBytes } from "@/server/services/documents";
import { enforceApiRateLimit } from "@/server/security/enforce-api-rate-limit";

type Params = { params: Promise<{ id: string }> };

export async function GET(request: Request, { params }: Params) {
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ error: "Não autenticado." }, { status: 401 });
  }

  const limited = await enforceApiRateLimit(request, { scope: "document-download", userId: user.id });
  if (limited) return limited;

  const { selected } = await resolveWorkspaceContext(user.id);
  if (!selected) {
    return NextResponse.json({ error: "Sem workspace." }, { status: 400 });
  }

  const { id } = await params;
  const result = await readDocumentBytes(user.id, selected.id, id);
  if (!result) {
    return NextResponse.json({ error: "Documento não encontrado." }, { status: 404 });
  }
  if (!("bytes" in result)) {
    return NextResponse.json(
      { error: "Documento indisponível (integridade). Contacta o gestor do workspace." },
      { status: 410 },
    );
  }

  return new NextResponse(Buffer.from(result.bytes), {
    headers: {
      "Content-Type": result.doc.mimeType,
      "Content-Disposition": `attachment; filename="${result.doc.originalName.replace(/"/g, "")}"`,
      "Cache-Control": "private, no-store",
    },
  });
}
