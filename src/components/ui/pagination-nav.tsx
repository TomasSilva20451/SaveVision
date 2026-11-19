import Link from "next/link";

type PaginationNavProps = {
  pathname: string;
  page: number;
  pageCount: number;
  total: number;
  pageSize?: number;
  params?: Record<string, string | undefined>;
};

function pageHref(pathname: string, params: Record<string, string | undefined>, page: number) {
  const query = new URLSearchParams();
  for (const [key, value] of Object.entries(params)) {
    if (value) query.set(key, value);
  }
  if (page > 1) query.set("page", String(page));
  const encoded = query.toString();
  return encoded ? `${pathname}?${encoded}` : pathname;
}

export function PaginationNav({
  pathname,
  page,
  pageCount,
  total,
  pageSize = 10,
  params = {},
}: PaginationNavProps) {
  if (total === 0) return null;
  const first = (page - 1) * pageSize + 1;
  const last = Math.min(total, page * pageSize);

  return (
    <nav className="flex flex-wrap items-center justify-between gap-3 border-t border-[var(--border)] px-5 py-4 text-sm" aria-label="Paginação">
      <p className="text-slate-500">
        {first}–{last} de {total} · Página {page} de {pageCount}
      </p>
      <div className="flex gap-2">
        {page > 1 ? (
          <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:border-blue-400 hover:text-blue-600" href={pageHref(pathname, params, page - 1)}>
            Anterior
          </Link>
        ) : null}
        {page < pageCount ? (
          <Link className="rounded-lg border border-[var(--border)] px-3 py-1.5 font-medium hover:border-blue-400 hover:text-blue-600" href={pageHref(pathname, params, page + 1)}>
            Seguinte
          </Link>
        ) : null}
      </div>
    </nav>
  );
}
