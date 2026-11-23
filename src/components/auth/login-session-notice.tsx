export function LoginSessionNotice() {
  return (
    <div
      className="login-session-notice"
      role="status"
      aria-live="polite"
      data-testid="login-session-expired"
    >
      <span className="login-session-notice-icon" aria-hidden>
        <svg width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" strokeWidth="2">
          <circle cx="12" cy="12" r="9" />
          <path d="M12 7v5l3 2" strokeLinecap="round" strokeLinejoin="round" />
        </svg>
      </span>
      <div className="login-session-notice-copy">
        <p className="login-session-notice-title">Sessão expirada</p>
        <p className="login-session-notice-text">Por segurança, volta a iniciar sessão para continuar.</p>
      </div>
    </div>
  );
}