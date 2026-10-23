import { Suspense } from "react";
import { VerifyEmailContent } from "@/app/verificar-email/verify-email-content";

export const instant = false;

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<main className="mx-auto max-w-md px-6 py-16 text-sm">A carregar…</main>}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
