import Link from "next/link";
import { redirect } from "next/navigation";
import { Suspense } from "react";
import { AppShell } from "@/components/shell/app-shell";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import { readPageFlash } from "@/lib/ui/page-shell";
import { civilDateFromInstant, formatCivilDateIso } from "@/lib/datetime/civil-date";
import { requireWorkspaceAccess } from "@/lib/auth/workspace-access";
import { ReportExportForms } from "@/components/reports/report-export-forms";
import { uploadDocumentAction } from "@/lib/finance/document-actions";
import { listDocuments } from "@/server/services/documents";
import { resolveWorkspaceContext } from "@/server/services/workspace-context";

async function RelatoriosContent() {
  await ensureRequestDynamic();
  const flash = await readPageFlash();
  const user = await requireAuthenticatedUser();
  if (!user) redirect("/login");

  const { workspaces, selected } = await resolveWorkspaceContext(user.id);
  if (!selected) redirect("/inicio");

  const membership = await requireWorkspaceAccess(user.id, selected.id);
  if (!membership) redirect("/inicio");

  const documents = (await listDocuments(user.id, selected.id)) ?? [];
  const civil = civilDateFromInstant(new Date());
  const defaultFrom = formatCivilDateIso({ year: civil.year, month: civil.month, day: 1 });
  const defaultTo = formatCivilDateIso(civil);

  return (
    <AppShell
      userName={user.name}
      workspaces={workspaces}
      activeWorkspaceId={selected.id}
      flash={flash}
    >
      <h1 className="text-2xl font-semibold tracking-tight">Relatórios e documentos</h1>
      <p className="mt-1 text-sm text-zinc-600 dark:text-zinc-400">
        Exportações geradas no servidor. Uploads privados (sem URLs públicas previsíveis).
      </p>

      <ReportExportForms defaultFrom={defaultFrom} defaultTo={defaultTo} />
      <p className="mt-2 text-xs text-zinc-600 dark:text-zinc-400">
        Os totais e a listagem PDF/CSV correspondem ao mesmo intervalo de datas.
      </p>

      <section className="mt-8">
        <h2 className="text-lg font-medium">Carregar documento</h2>
        <form action={uploadDocumentAction} className="mt-3 flex max-w-md flex-col gap-2">
          <input name="file" type="file" accept=".pdf,.png,.jpg,.jpeg,.csv,.txt" required />
          <button type="submit" className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm text-white dark:bg-zinc-100 dark:text-zinc-900">
            Enviar
          </button>
        </form>
      </section>

      <ul className="mt-6 flex flex-col gap-2 text-sm">
        {documents.map((doc) => (
          <li key={doc.id}>
            <Link href={`/api/documents/${doc.id}`} className="underline">
              {doc.originalName}
            </Link>{" "}
            ({doc.mimeType}, {doc.sizeBytes} bytes)
          </li>
        ))}
      </ul>
    </AppShell>
  );
}

export default function RelatoriosPage() {
  return (
    <Suspense fallback={<p className="p-6 text-sm">A carregar…</p>}>
      <RelatoriosContent />
    </Suspense>
  );
}
