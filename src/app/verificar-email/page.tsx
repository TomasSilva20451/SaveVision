import { Suspense } from "react";
import { PageSuspenseFallback } from "@/components/ui/loading";
import { VerifyEmailContent } from "@/app/verificar-email/verify-email-content";

export const instant = false;

export default function VerifyEmailPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <VerifyEmailContent searchParams={searchParams} />
    </Suspense>
  );
}
