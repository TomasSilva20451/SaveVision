"use client";

import Link from "next/link";
import { primaryButtonClassName, secondaryButtonClassName } from "@/components/ui/form-styles";

export function PlanoHeaderActions() {
  return (
    <>
      <Link href="/plano?novo-plano=1" className={primaryButtonClassName}>
        Criar plano de poupança
      </Link>
      <Link href="/simulacoes" className={secondaryButtonClassName}>
        Abrir simulador
      </Link>
    </>
  );
}
