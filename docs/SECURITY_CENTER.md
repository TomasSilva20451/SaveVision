# Centro de segurança

Protecção de acesso da conta FinTwin. A interface está em `/perfil/seguranca`.

## O que inclui

- Verificação de email por link de uso único (15 minutos). Contas já existentes ficam verificadas na migração. Mudar o email só passa a valer depois da confirmação.
- MFA TOTP (RFC 6238) com QR code no centro de segurança e códigos de recuperação de uso único.
- Passkeys WebAuthn neste dispositivo, em alternativa ou em conjunto com o TOTP no login. No login, email, palavra-passe e TOTP podem ir na mesma submissão. Regista no Safari ou Chrome (`localhost:3000`); o browser integrado do Cursor não conclui o diálogo Touch ID/passkey.
- Limites de tentativas por conta, IP e dispositivo (PostgreSQL; **Redis** opcional com `FINTWIN_REDIS_URL` para réplicas). Várias contas falhadas no mesmo IP contam como credential stuffing.
- **Rate limit API** (exportações PDF/CSV, documentos, privacidade, métricas): janela fixa partilhada via Redis ou fallback `RateLimitCounter` em PostgreSQL. Resposta **429** com `Retry-After`. Desactivar só em dev: `FINTWIN_DISABLE_API_RATE_LIMIT=1`.
- Sessões com identificador revogável. Terminar sessão revoga só o dispositivo actual. «Terminar todas as sessões» revoga todas.
- Confirmação reforçada (palavra-passe e TOTP, se estiver activo) durante 10 minutos para alterar segurança, exportar a conta ou desactivá-la. Entrar com TOTP ou passkey concede a mesma janela de 10 minutos — não é preciso repetir no centro de segurança logo a seguir.
- Recuperação em `/recuperar-conta`. A resposta não revela se o email existe. Com MFA, a reposição exige TOTP ou um código de recuperação.

## Entrega do email

Com **SMTP genérico** (`SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS`, `SMTP_FROM`, opcional `SMTP_SECURE`) a aplicação envia:

- Verificação do email actual (centro de segurança).
- Confirmação de **alteração de email** (perfil — o login mantém o endereço antigo até confirmares o link).
- Recuperação de conta (`/recuperar-conta`).

Os links usam `AUTH_URL` ou `FINTWIN_PUBLIC_URL` como base absoluta (em Vercel podes omitir se `VERCEL_URL` estiver disponível no runtime).

Sem SMTP configurado, **não há email enviado**. Em local, usa **Obter link de confirmação** no perfil (alteração de email pendente) ou o aviso verde após guardar; recuperação de conta escreve o link no log do servidor (`NODE_ENV !== production`). Com SMTP activo, os links **não** aparecem na UI em produção (excepto `FINTWIN_EMAIL_DEV_LINKS=1`).

### Checklist staging / Vercel (SMTP + email)

1. Definir env vars SMTP e `FINTWIN_PUBLIC_URL=https://…` no projecto Vercel; redeploy.
2. Centro de segurança → reenviar verificação → confirmar receção e link válido 15 min.
3. Perfil → alterar email (step-up) → confirmar no **novo** endereço → login passa a usar o email novo.
4. `/recuperar-conta` com email existente → email recebido (resposta genérica na UI).

### Checklist TOTP real (app autenticadora)

1. `/perfil/seguranca` → confirmar identidade (palavra-passe).
2. **Gerar segredo** → ler QR ou chave manual → Google Authenticator / 1Password.
3. **Activar** com código de 6 dígitos → guardar códigos de recuperação.
4. Terminar sessão → login com email, palavra-passe e TOTP na mesma submissão.
5. (Opcional) E2E local: `e2e/16-security-totp.spec.ts` com utilizador Maria.

## Exportação

- `GET /api/account/export` — perfil, sessões, passkeys e eventos recentes (sem movimentos).
- `GET /api/privacy/export` — **exportação completa do titular** (workspaces, amostra de transacções, consentimentos, IA). Ver `docs/PRIVACY_GOVERNANCE.md` e `/perfil/privacidade`.
