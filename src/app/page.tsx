import { redirect } from "next/navigation";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";

export const instant = false;

export default async function Home() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();

  redirect(user ? "/inicio" : "/login");
}
