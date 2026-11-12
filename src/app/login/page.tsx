import { redirect } from "next/navigation";
import { LoginForm } from "@/components/auth/login-form";
import { requireAuthenticatedUser } from "@/lib/auth/auth";
import { demoUsers } from "@/lib/auth/demo-users";
import { ensureRequestDynamic } from "@/lib/auth/ensure-dynamic";
import "./login.css";

export const instant = false;

export default async function LoginPage({
  searchParams,
}: {
  searchParams: Promise<{ expired?: string }>;
}) {
  await ensureRequestDynamic();
  const { expired } = await searchParams;
  const user = await requireAuthenticatedUser();
  if (user) redirect("/inicio");

  const showDevelopmentCredentials = process.env.NODE_ENV !== "production";
  return (
    <main className="login-page">
      {expired === "1" ? (
        <p className="sr-only" role="status">
          A sessão expirou. Entra novamente para continuar.
        </p>
      ) : null}
      <div className="w-full max-w-md">
        {expired === "1" ? (
          <p className="mb-4 text-center text-sm text-slate-600" role="status">
            A sessão expirou. Entra novamente para continuar.
          </p>
        ) : null}
        <LoginForm />
        {showDevelopmentCredentials ? (
          <ul className="mt-6 flex flex-col gap-2 text-center text-xs text-slate-500">
            {demoUsers.map((demoUser) => (
              <li key={demoUser.email}>
                {demoUser.name}: {demoUser.email} / {demoUser.password}
              </li>
            ))}
          </ul>
        ) : null}
      </div>
    </main>
  );
}
