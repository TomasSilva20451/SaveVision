import { logoutAction } from "@/lib/auth/actions";

export function LogoutButton() {
  return (
    <form action={logoutAction}>
      <button
        type="submit"
        className="logout-button group inline-flex h-9 items-center gap-1.5 rounded-xl px-2.5 text-xs font-semibold focus-visible:outline focus-visible:outline-2 focus-visible:outline-offset-2 focus-visible:outline-blue-500"
        aria-label="Terminar sessão"
      >
        <svg viewBox="0 0 24 24" className="h-4 w-4" fill="none" stroke="currentColor" strokeWidth="1.8" aria-hidden>
          <path d="M14 8l4 4-4 4M18 12H8" strokeLinecap="round" strokeLinejoin="round" />
          <path d="M11 5V4a1 1 0 0 0-1-1H5a1 1 0 0 0-1 1v16a1 1 0 0 0 1 1h5a1 1 0 0 0 1-1v-1" strokeLinecap="round" />
        </svg>
        <span className="hidden lg:inline">Sair</span>
      </button>
    </form>
  );
}
