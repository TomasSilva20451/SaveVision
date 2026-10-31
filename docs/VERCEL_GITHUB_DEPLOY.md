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

Cria a base (ex. `fintwin_staging` ou `fintwin_live`) e aplica migrações **antes ou depois** do 1.º deploy Vercel (o [`vercel.json`](../vercel.json) também corre `prisma migrate deploy` no build).

### Migrações Neon manualmente (savevision / Vercel)

Escolhe **um** método. Confirma sempre o **nome da base** no log (`fintwin_staging` vs `fintwin_live`) — tem de coincidir com `FINTWIN_EXPECTED_DATABASE` no Vercel.

#### Método A — recomendado (Neon = Vercel)

1. Vercel → projecto **savevision** → **Settings → Environment Variables** → copia `DATABASE_URL` (Production).
2. No repo:
   ```bash
   cp .env.vercel-neon.local.example .env.vercel-neon.local
   ```
3. Cola a URL em `DATABASE_URL` no `.env.vercel-neon.local` (ficheiro gitignored).
4. Aplica migrações:
   ```bash
   pnpm db:deploy:vercel-neon
   ```
5. Verifica: o comando termina com `Database schema is up to date!`

#### Método B — `.env.production.local` (Docker + URL inline)

Se usas `DATABASE_URL` **e** caminhos `FINTWIN_*_SECRET_FILE` (como no `.env.production.example`), o script antigo falhava com *«DATABASE_URL e DATABASE_URL_FILE não podem ser usados em simultâneo»*. Isso está corrigido: valores **inline** têm prioridade sobre ficheiros montados.

```bash
pnpm db:deploy:production
```

Requisitos: `.env.production.local` com `DATABASE_URL` apontando ao Neon **correcto** e `FINTWIN_EXPECTED_DATABASE` alinhado.

#### Método C — uma linha (sem ficheiro)

```bash
DATABASE_URL="postgresql://…?sslmode=require" \
  FINTWIN_ENV=staging \
  FINTWIN_EXPECTED_DATABASE=fintwin_staging \
  pnpm exec prisma migrate deploy
```

#### Erro comum

| Sintoma | Causa | Acção |
|--------|--------|--------|
| `DATABASE_URL e DATABASE_URL_FILE não podem…` | URL inline + caminhos Docker no mesmo env | Usa **Método A** ou actualiza o repo (`deploy-database.mjs` preferir inline) |
| Migração OK local mas app antiga | Só migraste uma base; Vercel usa outra URL | Copia `DATABASE_URL` **de Production** no Vercel, não de Preview/local |
| Build Vercel falha em `migrate deploy` | IP/firewall Neon | Neon → allow all; confirma `sslmode=require` |

Depois das migrações: `vercel --prod` ou push para `main` (se Git ligado).

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
pnpm db:deploy:vercel-neon   # se ainda não aplicaste migrações nesta base
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
