type InlineSpinnerProps = {
  className?: string;
  /** Só para a11y; omitir texto visível salvo `showLabel`. */
  label?: string;
  showLabel?: boolean;
  size?: "sm" | "md";
};

/** Spinner compacto para acções ou blocos pequenos — não usar em `loading.tsx` nem ecrã inteiro. */
export function InlineSpinner({
  className = "",
  label = "A processar",
  showLabel = false,
  size = "sm",
}: InlineSpinnerProps) {
  const dim = size === "md" ? "h-5 w-5" : "h-4 w-4";
  return (
    <span role="status" className={`inline-flex items-center gap-2 text-sm text-slate-600 dark:text-slate-300 ${className}`}>
      <span
        className={`${dim} animate-spin rounded-full border-2 border-slate-300 border-t-blue-600 dark:border-slate-600 dark:border-t-blue-400`}
        aria-hidden
      />
      {showLabel ? <span aria-hidden>{label}</span> : null}
      <span className="sr-only">{label}</span>
    </span>
  );
}
