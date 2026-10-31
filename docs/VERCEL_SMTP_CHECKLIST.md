# Checklist Vercel — SMTP, migração e smoke

Operações após merge do código de email transaccional. Credenciais **só** no dashboard Vercel ou ficheiros locais ignorados pelo Git.

## 1. Git e base de dados

- [ ] `main` no GitHub inclui migração `20261030160000_financial_alert_email_notified`.
- [ ] Neon: `pnpm db:deploy:vercel-neon` (`.env.vercel-neon.local` = `DATABASE_URL` do Vercel Production) **ou** confirmar `prisma migrate deploy` verde no log de build. Ver [VERCEL_GITHUB_DEPLOY.md § Migrações Neon](VERCEL_GITHUB_DEPLOY.md#migrações-neon-manualmente-savevision--vercel).
- [ ] Coluna `FinancialAlertUserState.emailNotifiedAt` presente (Neon SQL editor ou `\d "FinancialAlertUserState"`).

## 2. Variáveis Vercel (Production)

Scope **Production** e **Build** para `DATABASE_URL`.

| Variável | Notas |
|----------|--------|
| `FINTWIN_PUBLIC_URL` | `https://savevision.vercel.app` (ou domínio custom) |
| `SMTP_HOST` / `SMTP_PORT` | Provedor do domínio |
| `SMTP_USER` / `SMTP_PASS` | Secret no Vercel |
| `SMTP_FROM` | Alinhado com SPF/DKIM |
| `SMTP_SECURE` | `1` se porta 465 |

Gerar template base: `pnpm deploy:vercel:env --production`.

Push SMTP para a Vercel (Production + Preview) a partir de ficheiro local:

```bash
cp .env.smtp.local.example .env.smtp.local
# editar credenciais reais (nunca commitar)
pnpm vercel:smtp:push
```

**Não** activar `FINTWIN_LOCAL_AI_ENABLED=1` — `vercel.json` mantém IA local desligada no deploy público.

## 3. Gmail (`@gmail.com`)

- [ ] Verificação em **2 passos** activa na conta Google.
- [ ] **App Password** criada em [Google App Passwords](https://myaccount.google.com/apppasswords) → colar em `.env.smtp.local` como `SMTP_PASS` (não uses a password normal).
- [ ] `SMTP_HOST=smtp.gmail.com`, `SMTP_PORT=587`, `SMTP_USER` = o teu Gmail, `SMTP_FROM=FinTwin <o-mesmo@gmail.com>`.
- [ ] Teste local: `pnpm smtp:test` (envia para o próprio Gmail por omissão).

Gmail não exige SPF/DKIM no teu domínio; o remetente será o endereço `@gmail.com` (limites de envio da Google aplicam-se).

## 4. DNS (domínio próprio, não Gmail)

- [ ] SPF inclui o host SMTP.
- [ ] DKIM activo no provedor.
- [ ] DMARC recomendado (`p=none` inicial).

## 5. Redeploy

- [ ] Deployments → Redeploy Production (cache off se quiseres build limpo).
- [ ] Log: `migrate deploy` + `pnpm build` OK.

## 6. Smoke manual ([`SECURITY_CENTER.md`](SECURITY_CENTER.md))

- [ ] Centro de segurança → reenviar verificação → email + link `/verificar-email`.
- [ ] Perfil → alterar email (step-up) → confirmar no novo endereço.
- [ ] `/recuperar-conta` → link na caixa de entrada.
- [ ] `/alertas` → Atualizar alertas → email para CRITICAL/HIGH ou `SAVINGS_PLAN_*` (conta com `emailVerifiedAt`).

Falhas: Runtime Logs Vercel (`[fintwin] falha SMTP`).

## 7. Ollama (expectativa)

- [ ] `https://…/perfil/ia` — banner «instalação online não alcança o Ollama do Mac», controlos desactivados.
- [ ] Local: `http://127.0.0.1:3000/perfil/ia` após `pnpm setup:production:local` + Ollama a correr — teste ligação OK.
