"use client";

import { inputClassName } from "@/components/ui/form-styles";

export function MonthFilterSelect({
  value,
  options,
}: {
  value: string;
  options: { value: string; label: string }[];
}) {
  return (
    <select
      name="period"
      defaultValue={value}
      aria-label="Mês"
      className={`${inputClassName} min-w-0`}
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
