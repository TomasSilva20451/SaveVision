import { redirect } from "next/navigation";
import { Suspense } from "react";
import { LoginForm } from "@/components/auth/login-form";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { demoUsers } from "@/lib/auth/demo-users";
import { appConfig } from "@/lib/config";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";

async function RedirectIfAuthenticated() {
  await ensureRequestDynamic();
  const user = await requireAuthenticatedUser();

  if (user) {
    redirect("/inicio");
  }

  return null;
}

export default function LoginPage() {
  return (
    <main className="mx-auto flex min-h-full w-full max-w-md flex-col justify-center gap-8 px-6 py-16">
      <Suspense fallback={null}>
        <RedirectIfAuthenticated />
      </Suspense>
      <div className="flex flex-col gap-2">
        <h1 className="text-3xl font-semibold tracking-tight">Entrar</h1>
        <p className="text-zinc-600 dark:text-zinc-400">
          {appConfig.name}. As credenciais abaixo são só de desenvolvimento.
        </p>
      </div>
      <LoginForm />
      <ul className="flex flex-col gap-2 text-sm text-zinc-600 dark:text-zinc-400">
        {demoUsers.map((demoUser) => (
          <li key={demoUser.email}>
            {demoUser.name}: {demoUser.email} / {demoUser.password}
          </li>
        ))}
      </ul>
    </main>
  );
}
