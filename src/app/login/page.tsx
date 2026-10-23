import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { demoUsers } from "@/lib/auth/demo-users";
import { appConfig } from "@/lib/config";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";

// O login depende da sessão em cada pedido. Com Cache Components, esta rota
// deve bloquear até a sessão ser resolvida em vez de tentar gerar uma shell.
export const instant = false;

export default async function LoginPage() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();
  if (user) redirect("/inicio");

  const showDevelopmentCredentials = process.env.NODE_ENV !== "production";
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {showDevelopmentCredentials
            ? `${appConfig.name}. As credenciais abaixo são só de desenvolvimento.`
            : `${appConfig.name}. Introduz as credenciais da tua conta.`}
        </p>
      </div>
      <LoginForm />
      {showDevelopmentCredentials ? (
        <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
          {demoUsers.map((demoUser) => (
            <li key={demoUser.email}>
              {demoUser.name}: {demoUser.email} / {demoUser.password}
            </li>
          ))}
        </ul>
      ) : null}
    </main>
  );
}
