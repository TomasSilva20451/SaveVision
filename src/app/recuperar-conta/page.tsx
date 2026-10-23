import { Suspense } from "react";
import { RecoverAccountContent } from "@/app/recuperar-conta/recover-account-content";

export const instant = false;

export default function RecoverAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16 text-sm">A carregar…</main>}>
      <RecoverAccountContent searchParams={searchParams} />
    </Suspense>
  );
}
