import { appConfig } from "@/lib/config";

export function LoginBrand() {
  return (
    <div className="flex flex-col items-center gap-2 text-center">
      <div className="login-brand-mark" aria-hidden>
        <span className="login-brand-glyph">◈</span>
      </div>
      <p className="text-lg font-semibold tracking-tight text-slate-900">{appConfig.name}</p>
    </div>
  );
}
