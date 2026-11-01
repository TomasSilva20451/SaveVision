import { NextResponse } from "next/server";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";

/** Confirma se o cookie de sessão ainda é válido. Usado ao retomar a app. */
export async function GET() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (!user) {
    return NextResponse.json({ ok: false }, { status: 401 });
  }
  return NextResponse.json({ ok: true });
}
