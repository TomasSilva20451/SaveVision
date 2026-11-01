/** Envia `_returnTo` para server actions fecharem drawers com redirect + flash na página certa. */
export function FormReturnTo({ to }: { to: string }) {
  return <input type="hidden" name="_returnTo" value={to} />;
}
