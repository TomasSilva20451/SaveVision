import Link from "next/link";
import type { ReactNode } from "react";

type SectionHeaderProps = {
  title: string;
  href?: string;
  linkLabel?: string;
  action?: ReactNode;
};

export function SectionHeader({ title, href, linkLabel = "Ver todos", action }: SectionHeaderProps) {
  return (
    <div className="mb-4 flex flex-wrap items-center justify-between gap-2">
      <h2 className="text-base font-semibold text-slate-900 dark:text-slate-50">{title}</h2>
      <div className="flex items-center gap-3">
        {action}
        {href ? (
          <Link href={href} className="text-sm font-medium text-blue-600 hover:text-blue-700">
            {linkLabel} →
          </Link>
        ) : null}
      </div>
    </div>
  );
}
