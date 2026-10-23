import { verifyEmailTokenAction } from "@/lib/auth/security-actions";
import { primaryButtonClassName } from "@/components/ui/form-styles";

export async function VerifyEmailContent({ searchParams }: { searchParams: Promise<{ token?: string }> }) {
  const { token } = await searchParams;
  return (
    <main className="mx-auto flex min-h-full max-w-md flex-col justify-center gap-4 px-6 py-16">
      <h1 className="text-2xl font-semibold">Verificar email</h1>
      <p className="text-sm text-zinc-600">Confirma que este endereço te pertence. O link expira em 15 minutos.</p>
      <form action={verifyEmailTokenAction}>
        <input type="hidden" name="token" value={token ?? ""} />
        <button className={primaryButtonClassName} type="submit">Confirmar email</button>
      </form>
    </main>
  );
}
