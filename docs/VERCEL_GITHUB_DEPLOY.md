# Deploy na Vercel (GitHub, sem cartão extra)

Fluxo habitual: **repo no GitHub → Import no [Vercel](https://vercel.com) → variáveis de ambiente → Deploy**.  
O Hobby/personal **não exige cartão** para projectos privados na maioria das contas (como já usaste).

Este repo inclui [`vercel.json`](../vercel.json) (`prisma migrate deploy` + `pnpm build --webpack`).

---

## 1. Base de dados (grátis, sem Fly)

Escolhe **uma** (conta grátis; alguns pedem cartão só na BD — se recusares, usa a opção que já tens noutros projectos):

| Serviço | Notas |
|---------|--------|
| **[Neon](https://neon.tech)** | Postgres; copia URL com `sslmode=require` |
| **Vercel → Storage → Postgres** | Integração no dashboard (se disponível na tua conta) |
| **[Supabase](https://supabase.com)** | Postgres; usar connection string “Session pooler” + TLS |

Cria a base (ex. `fintwin_staging` ou `fintwin_live`) e corre **uma vez** no teu Mac:

```bash
DATABASE_URL="postgresql://…?sslmode=require" FINTWIN_ENV=staging pnpm exec prisma migrate deploy
```

*(Ou `db:deploy:production` se usares `fintwin_live` + env production.)*

---

## 2. Redis (opcional mas recomendado)

**[Upstash](https://upstash.com)** free → Redis → copia `UPSTASH_REDIS_REST_URL` ou URL `rediss://…`  
No Vercel podes instalar a integração **Upstash** no projecto (free tier).

```
FINTWIN_REDIS_URL=rediss://default:…
FINTWIN_RATE_LIMIT_BACKEND=redis
```

Sem Redis, o rate limit cai para PostgreSQL (funciona com uma instância).

---

## 3. Variáveis no projecto Vercel

Dashboard → **Settings → Environment Variables** (Production + Preview):

Gera valores locais:

```bash
pnpm deploy:vercel:env
```

Copia o bloco para o Vercel. **Ajusta:**

| Variável | Valor |
|----------|--------|
| `DATABASE_URL` | Neon/Supabase/Vercel Postgres |
| `FINTWIN_PUBLIC_URL` | `https://<o-teu-projecto>.vercel.app` (ou domínio custom) |
| `FINTWIN_ENV` | `staging` (recomendado 1.º deploy) ou `production` |
| `FINTWIN_EXPECTED_DATABASE` | nome da base (ex. `fintwin_staging`) |
| `AUTH_SECRET` | `openssl rand -base64 48` |
| `FINTWIN_DOCUMENT_ENCRYPTION_KEY` | `openssl rand -base64 32` |
| `FINTWIN_DOCUMENT_ENCRYPTION_KEY_ID` | `staging-documents-v1` ou `production-documents-v1` |
| `FINTWIN_AUDIT_SIGNING_KEY` | string ≥ 32 chars |
| `FINTWIN_AUDIT_SIGNING_KEY_ID` | `staging-audit-v1` ou `production-audit-v1` |
| `FINTWIN_REQUIRE_ENCRYPTED_DOCUMENTS` | `1` |
| `FINTWIN_REDIS_URL` | Upstash (opcional) |
| `SMTP_HOST`, `SMTP_PORT`, `SMTP_USER`, `SMTP_PASS` | Email transaccional (domínio com SPF/DKIM) |
| `SMTP_FROM` | Ex. `FinTwin <noreply@teu-dominio.pt>` |
| `SMTP_SECURE` | `1` só para porta 465 |
| `APP_NAME` | Opcional (assuntos pt-PT) |

Gerar bloco base + placeholders SMTP: `pnpm deploy:vercel:env --production`.

`vercel.json` já define: ClamAV off, **IA local off** (`FINTWIN_LOCAL_AI_ENABLED=0`), arquivo JSONL off (`FINTWIN_AUDIT_ARCHIVE_REQUIRED=0`), documentos em `/tmp` (**não persistentes** entre cold starts — OK para testar; para PDFs persistentes usa depois S3/R2 ou Docker).

### IA local (Ollama) vs Vercel

O consentimento em `/perfil/privacidade` **não** liga o Ollama do teu Mac ao deploy público: o servidor Vercel não alcança `127.0.0.1:11434` na tua máquina. Para categorização, assistente e ajuda com modelos locais, usa `pnpm setup:production:local` e abre [`http://127.0.0.1:3000/perfil/ia`](http://127.0.0.1:3000/perfil/ia). Na Vercel, `/perfil/ia` mostra aviso e controlos desactivados. Relay futuro: `docs/OLLAMA_PRIVACY.md` § Roadmap relay.

---

## 4. Import GitHub

1. [vercel.com/new](https://vercel.com/new) → Import **SaveVision** (ou fork).
2. Framework: **Next.js** (detectado).
3. Colar env vars → **Deploy**.
4. Se o build falhar em `migrate deploy`, confirma `DATABASE_URL` em **Build** environment e IP allowlist na BD (Neon: “allow all”).

---

## 5. Utilizadores

Sem seed automático em staging/produção. Uma vez com BD vazia:

```bash
# .env.production.local com DATABASE_URL Neon + bootstrap flags
pnpm db:production:setup
```

Tomás e Telmo recebem **`systemRole=ADMIN`** no bootstrap. Em **Perfil → Backoffice → Contas da plataforma** podem criar mais utilizadores (papel USER, workspace pessoal vazio).

Se já existiam antes desta funcionalidade, volta a correr o bootstrap (idempotente) para promover a ADMIN:

```bash
set -a && source .env.vercel-neon.local && set +a
pnpm exec tsx scripts/bootstrap-production-users.ts
```

### Testes E2E contra o deploy

```bash
pnpm test:e2e:remote
# opcional: FINTWIN_E2E_BASE_URL=https://savevision.vercel.app
```

Corre só **smoke** (health, `/login`, credenciais inválidas). O staging **não** tem `user1@example.local` (seed demo bloqueado).

Sessão completa (login/logout) depois de criares conta com `db:production:setup`:

```bash
FINTWIN_REMOTE_E2E_EMAIL=… FINTWIN_REMOTE_E2E_PASSWORD=… \
  pnpm test:e2e:remote:session
```

URL de preview com **Deployment Protection**: define `VERCEL_AUTOMATION_BYPASS_SECRET` (dashboard Vercel) no mesmo comando.

---

## Limites (honesto)

- Uploads/documentos em `/tmp` **podem desaparecer** após redeploy/cold start.
- Auditoria forense fica na **PostgreSQL**; espelho JSONL desligado no Vercel.
- Não substitui go-live Docker/Fly do [`FREE_PUBLIC_DEPLOY.md`](FREE_PUBLIC_DEPLOY.md).

Para **só** “FinTwin na internet com login” via GitHub + Vercel, este fluxo chega.
