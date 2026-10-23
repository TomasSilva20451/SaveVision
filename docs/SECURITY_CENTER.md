# Centro de segurança

Protecção de acesso da conta FinTwin. A interface está em `/perfil/seguranca`.

## O que inclui

- Verificação de email por link de uso único (15 minutos). Contas já existentes ficam verificadas na migração. Mudar o email só passa a valer depois da confirmação.
- MFA TOTP (RFC 6238) com QR code no centro de segurança e códigos de recuperação de uso único.
- Passkeys WebAuthn neste dispositivo, em alternativa ou em conjunto com o TOTP no login. No login, email, palavra-passe e TOTP podem ir na mesma submissão. Regista no Safari ou Chrome (`localhost:3000`); o browser integrado do Cursor não conclui o diálogo Touch ID/passkey.
- Limites de tentativas na base de dados, por conta, IP e dispositivo. Várias contas falhadas no mesmo IP contam como credential stuffing.
- Sessões com identificador revogável. Terminar sessão revoga só o dispositivo actual. «Terminar todas as sessões» revoga todas.
- Confirmação reforçada (palavra-passe e TOTP, se estiver activo) durante 10 minutos para alterar segurança, exportar a conta ou desactivá-la. Entrar com TOTP ou passkey concede a mesma janela de 10 minutos — não é preciso repetir no centro de segurança logo a seguir.
- Recuperação em `/recuperar-conta`. A resposta não revela se o email existe. Com MFA, a reposição exige TOTP ou um código de recuperação.

## Entrega do email

Sem SMTP configurado, **não há email enviado**. Em local, usa **Obter link de confirmação** no perfil (alteração de email pendente) ou o aviso verde após guardar; recuperação de conta escreve o link no log do servidor. Em produção liga SMTP antes de depender disto fora da máquina local.

## Exportação

- `GET /api/account/export` — perfil, sessões, passkeys e eventos recentes (sem movimentos).
- `GET /api/privacy/export` — **exportação completa do titular** (workspaces, amostra de transacções, consentimentos, IA). Ver `docs/PRIVACY_GOVERNANCE.md` e `/perfil/privacidade`.
