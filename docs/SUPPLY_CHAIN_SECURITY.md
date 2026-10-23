# Cadeia de fornecimento

## Dependências

- **Lockfile** congelado (`pnpm-lock.yaml`); CI usa `--frozen-lockfile`.
- **Auditoria:** `pnpm security:audit` / `scripts/security-audit.mjs` (falha em `high+`).
- **Dependabot:** `.github/dependabot.yml` (npm, actions, Docker semanal).

## SAST / secret scanning

- **ESLint** + TypeScript strict no `quality-gate`.
- **CodeQL:** `.github/workflows/security-supply-chain.yml`.
- **Gitleaks:** mesmo workflow; allowlist `.gitleaks.toml`.

## DAST

- **OWASP ZAP baseline** no workflow `security-supply-chain` (`workflow_dispatch` / semanal).
- Definir variable GitHub:

```bash
pnpm security:setup-dast-url https://staging.seu-dominio
# ou: gh variable set FINTWIN_DAST_TARGET_URL --body https://...
gh workflow run security-supply-chain.yml
```

## ClamAV (uploads)

Staging/produção: `compose.deploy.yml` inclui `clamav-staging` / `clamav-production` e `FINTWIN_CLAMAV_HOST`. Imagem app traz `clamav-clients` (`clamdscan`).

## SBOM

- Por build: `pnpm security:sbom` → `dist/sbom/bom.json` (CycloneDX).
- Release: artefacto GitHub + `sbom: true` no `docker/build-push-action`.
- Manifesto: `dist/sbom/manifest.json` com SHA versão.

## Imagens assinadas

- GHCR tag imutável `sha-<commit>`.
- **Cosign** keyless (OIDC) após push em `release-image.yml`.
- Verificar: `cosign verify ghcr.io/owner/fintwin:sha-…`

## Pentest

Checklist pré-público: `docs/PENTEST_READINESS.md`.
