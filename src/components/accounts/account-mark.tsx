const tones: Record<string, string> = {
  CURRENT: "bg-blue-100 text-blue-700",
  SAVINGS: "bg-emerald-100 text-emerald-700",
  CASH: "bg-amber-100 text-amber-800",
  INVESTMENT: "bg-violet-100 text-violet-700",
  LIABILITY: "bg-rose-100 text-rose-700",
  OTHER: "bg-slate-100 text-slate-600",
};

export function AccountMark({ type, bare = false }: { type: string; bare?: boolean }) {
  return (
    <span
      className={
        bare
          ? "grid h-5 w-5 place-items-center"
          : `grid h-9 w-9 shrink-0 place-items-center rounded-xl ${tones[type] ?? tones.OTHER}`
      }
      aria-hidden
    >
      <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8">
        {type === "SAVINGS" ? (
          <path d="M12 3v18M7 8h7a3 3 0 0 1 0 6H9a3 3 0 0 0 0 6h8" strokeLinecap="round" />
        ) : (
          <path d="M4 10h16v8H4zM7 10V7a5 5 0 0 1 10 0v3" strokeLinecap="round" strokeLinejoin="round" />
        )}
      </svg>
    </span>
  );
}

export const accountTypeLabel: Record<string, string> = {
  CURRENT: "Conta à ordem",
  SAVINGS: "Poupança",
  CASH: "Dinheiro",
  INVESTMENT: "Investimento",
  CRYPTO: "Cripto",
  LIABILITY: "Responsabilidade",
  OTHER: "Outra",
};
