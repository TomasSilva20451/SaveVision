"use client";

export function MonthFilterSelect({
  value,
  options,
  className,
}: {
  value: string;
  options: { value: string; label: string }[];
  className?: string;
}) {
  return (
    <select
      name="period"
      defaultValue={value}
      aria-label="Mês"
      className={className ?? "h-9 min-w-0 rounded-lg border border-[var(--border)] bg-[var(--surface)] px-3 text-sm"}
      onChange={(event) => event.currentTarget.form?.requestSubmit()}
    >
      {value === "" ? <option value="">Intervalo personalizado</option> : null}
      {options.map((option) => (
        <option key={option.value} value={option.value}>
          {option.label}
        </option>
      ))}
    </select>
  );
}
