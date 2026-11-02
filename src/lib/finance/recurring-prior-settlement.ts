import type { CivilDate } from "@/lib/datetime/civil-date";

export function isCivilDateBefore(left: CivilDate, right: CivilDate): boolean {
  if (left.year !== right.year) return left.year < right.year;
  if (left.month !== right.month) return left.month < right.month;
  return left.day < right.day;
}
