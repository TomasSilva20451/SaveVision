# FinTwin

Gestão financeira privada para dois utilizadores, com espaços pessoais separados e workspace conjunto por convite.

## Funcionalidades

- Autenticação local (Auth.js, Argon2id, cookie de sessão HttpOnly). A sessão expira após 30 minutos sem pedidos ao servidor e, no máximo, 12 horas depois do início de sessão. Ao voltar ao separador, a app confirma a sessão ou pede novo login.
- Workspaces com cookie `fintwin_workspace`. Um espaço conjunto não abre o workspace pessoal de outro membro.
- Contas, transações, transferências e motor decimal (`Europe/Lisbon`). Registar um movimento no drawer volta à lista e mostra o resultado.
- Receitas (familiar, e-commerce, ténis), despesas, recorrências e orçamentos
- Dashboard, análises, património e plano de poupança
- Alertas e simulações determinísticas (não criam movimentos)
- Conta conjunta: convites, membros e objetivos partilhados
- Relatórios PDF/CSV e documentos privados
- Investimentos manuais e previsões por regras
- Open banking só de leitura e reconciliação bancária
- Categorização opcional de transações com Ollama local
- Testes unitários (Vitest) e E2E (Playwright)
- **Performance (produção):** skeletons nas rotas principais, cache Redis opcional (`FINTWIN_REDIS_URL`), Vercel Speed Insights e Web Analytics (Core Web Vitals no dashboard Vercel)

## Stack

- Next.js 16 (App Router) e TypeScript strict
- Tailwind CSS 4
- PostgreSQL 17 e Prisma ORM 7.10
- Vitest e Playwright
- pnpm

## Requisitos

- Node.js 24+ (Node 25 foi usado em desenvolvimento)
- pnpm 10
- Docker
- Ollama com `qwen3.5:4b-mlx` (opcional; apenas para sugestões de categorização)

## Arranque

```bash
cp .env.example .env
docker compose up -d
pnpm install --frozen-lockfile
pnpm db:migrate
pnpm dev
```

O ambiente `development` não recebe dados fictícios automaticamente. Para uma demonstração isolada e explicitamente semeada:

```bash
pnpm db:demo-ui
pnpm dev:demo
```

Contas de desenvolvimento:

- `user1@example.local` / `demo-joao-2026` (João)
- `user2@example.local` / `demo-maria-2026` (Maria)

A aplicação fica em [http://localhost:3000](http://localhost:3000). Health: [http://localhost:3000/api/health](http://localhost:3000/api/health). Postgres em `localhost:5433`.

## Produção local sem dados fictícios

Cria primeiro `.env.production.local` a partir das variáveis de produção documentadas em `.env.example`. Depois prepara a base isolada e cria apenas os utilizadores User1 e User2, cada um com o respetivo workspace pessoal vazio:

```bash
pnpm db:production:setup
pnpm build:production
pnpm start:production
```

`pnpm build` e `pnpm build:production` usam `next build --webpack`, o mesmo comando do deploy na Vercel. A variante local de produção escreve para `.next-production`, para não substituir o artefacto de `pnpm dev`.

O bootstrap de produção não cria contas bancárias, movimentos, categorias, objetivos, investimentos, alertas ou qualquer outro dado financeiro de demonstração.

### Categorização local com Ollama

Instala o modelo e mantém o serviço Ollama ativo:

```bash
ollama pull qwen3.5:4b-mlx
```

O formulário «Nova transação» sugere comerciante, categoria, tipo, natureza, etiquetas e confiança. A sugestão nunca grava uma transação; o utilizador confirma ou corrige antes de submeter. Configuração e garantias: `docs/LOCAL_ML_CATEGORIZATION.md`.

## Verificação

```bash
pnpm ci:verify
```

Este comando cria uma base isolada por execução com sufixo `_e2e`, executa migrações e seed E2E, lint, geração de tipos, testes unitários e de integração, build e Playwright contra o artefacto standalone. Escolhe uma porta E2E livre a partir de 3010, sem interferir com a aplicação normal na porta 3000.

## Build e deploy reproduzíveis

- As fontes Geist estão versionadas em `src/app/fonts/`; o build não consulta Google Fonts.
- Node 24 (`.nvmrc`), pnpm 10.22 e lockfile congelado são usados localmente e no CI.
- `.github/workflows/quality-gate.yml` reproduz o portão num PostgreSQL isolado.
- `.github/workflows/release-image.yml` só publica `ghcr.io/...:sha-<commit>` depois do portão completo; nunca publica `latest`.
- `Dockerfile` gera um artefacto Next.js standalone. Staging e produção usam a mesma imagem e o mesmo `compose.deploy.yml`, variando apenas configuração, base e volume privado.
- `prisma migrate deploy` é executado antes do arranque; staging e produção recusam seeds.

Depois de copiar o exemplo do ambiente para `.env.staging.local` ou `.env.production.local` e indicar a imagem imutável publicada:

```bash
pnpm deploy:staging
pnpm deploy:production
```

Os dois comandos voltam a executar o portão completo e não iniciam o serviço se qualquer etapa falhar. Os perfis e nomes de base permitidos são validados antes de uma migração ou deploy.

### Vercel e Neon

A instância pública está em [savevision.vercel.app](https://savevision.vercel.app). O build na Vercel corre `prisma migrate deploy` e `pnpm build`. A base é Neon, com `sslmode=require`.

Para migrar a mesma base a partir do Mac, copia o exemplo e cola a `DATABASE_URL` só no ficheiro local, que o Git ignora:

```bash
cp .env.vercel-neon.local.example .env.vercel-neon.local
pnpm db:deploy:vercel-neon
```

`.env.vercel-neon.local.example` tem placeholders. Não commits palavras-passe, connection strings nem ficheiros `.env*.local`. Passos e erros comuns: `docs/VERCEL_GITHUB_DEPLOY.md`.

Documentação de testes e auditoria: `docs/TESTING.md`, `docs/SECURITY_AUDIT.md`.

## Backups e continuidade (antes de dados reais de clientes)

- Política **3-2-1**, RPO/RTO e runbooks: `docs/BUSINESS_CONTINUITY.md`.
- Configuração local (secret + off-site + cron):

```bash
pnpm backup:setup
pnpm backup:setup -- --dev-offsite   # rclone → ~/FinTwin-backups-offsite (ou cp se rclone em falta)
pnpm backup:install-cron             # diário 01:15 UTC
pnpm db:backup:run                   # teste
```

Secrets em `.env.backup.local` (gitignored). Produção S3/B2: `brew install rclone`, `RCLONE_CONFIG=.rclone.conf rclone config`.

Detalhe: `docs/BACKUP_RESTORE.md`.

## Segurança e supply chain

- Baseline **OWASP ASVS L2**: `docs/OWASP_ASVS_L2.md`, threat model `docs/THREAT_MODEL.md`.
- Local: `pnpm security:audit`, `pnpm security:sbom`.
- CI: `security-supply-chain.yml` (CodeQL, gitleaks, audit). Release: SBOM + **Cosign**.

## Observabilidade

```bash
pnpm observability:setup && pnpm observability:up && pnpm observability:install-cron
```

- Logs → Loki (Vector), métricas Prometheus em `:9090` (scrape `/api/metrics` com bearer).
- SLOs e IR: `docs/SLO.md`, `docs/INCIDENT_RESPONSE.md`, `docs/OBSERVABILITY.md`.

O Playwright arranca o servidor de desenvolvimento se ainda não estiver a correr. Na primeira execução instala os browsers:

```bash
pnpm exec playwright install chromium
```

## Variáveis

| Nome | Função |
| --- | --- |
| `APP_NAME` | Nome na interface (omissão: FinTwin) |
| `FINTWIN_ENV` | `development`, `demo`, `e2e`, `staging` ou `production` |
| `DATABASE_URL` | Ligação PostgreSQL |
| `AUTH_SECRET` | Segredo da sessão (≥ 32 caracteres). Inatividade: 30 minutos. Tecto: 12 horas. |

Documentação adicional: `docs/ARCHITECTURE.md`, `docs/FINANCIAL_RULES.md`, `docs/SECURITY.md`, `AGENTS.md`.

Não commits o ficheiro `.env`.
