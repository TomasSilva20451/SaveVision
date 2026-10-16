import Link from "next/link";
import { connection } from "next/server";
import { Suspense } from "react";
import { civilDateFromInstant, formatCivilDate } from "@/lib/datetime/civil-date";
import { formatEUR } from "@/lib/finance/money";
import { appConfig } from "@/lib/config";

async function TodayInLisbon() {
  await connection();
  const today = civilDateFromInstant(new Date());

  return <dd className="mt-1 text-lg font-medium">{formatCivilDate(today)}</dd>;
}

export default function Home() {
  return (
    <main className="mx-auto flex w-full max-w-3xl flex-1 flex-col justify-center gap-8 px-6 py-16">
      <div className="flex flex-col gap-3">
        <p className="text-sm font-medium tracking-wide text-zinc-500">
          {appConfig.locale} · {appConfig.currency} · {appConfig.timeZone}
        </p>
        <h1 className="text-4xl font-semibold tracking-tight">{appConfig.name}</h1>
        <p className="max-w-xl text-lg leading-8 text-zinc-600 dark:text-zinc-400">
          Base local pronta. Entra com uma das contas de desenvolvimento para
          abrir a sessão.
        </p>
        <Link
          href="/login"
          className="w-fit rounded-lg bg-zinc-900 px-3 py-2 text-sm font-medium text-white hover:bg-zinc-700 focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-zinc-900 dark:bg-zinc-100 dark:text-zinc-900 dark:hover:bg-white dark:focus-visible:outline-zinc-100"
        >
          Entrar
        </Link>
      </div>
      <dl className="grid gap-4 sm:grid-cols-2">
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <dt className="text-sm text-zinc-500">Hoje em Lisboa</dt>
          <Suspense
            fallback={<dd className="mt-1 text-lg font-medium">A calcular…</dd>}
          >
            <TodayInLisbon />
          </Suspense>
        </div>
        <div className="rounded-xl border border-zinc-200 p-4 dark:border-zinc-800">
          <dt className="text-sm text-zinc-500">Exemplo de montante</dt>
          <dd className="mt-1 text-lg font-medium">{formatEUR("1234.56")}</dd>
        </div>
      </dl>
    </main>
  );
}
