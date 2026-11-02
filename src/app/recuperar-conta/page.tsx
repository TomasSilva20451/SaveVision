import { Suspense } from "react";
import { PageSuspenseFallback } from "@/components/ui/loading";
import { RecoverAccountContent } from "@/app/recuperar-conta/recover-account-content";

export const instant = false;

export default function RecoverAccountPage({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  return (
    <Suspense fallback={<PageSuspenseFallback />}>
      <RecoverAccountContent searchParams={searchParams} />
    </Suspense>
  );
}
