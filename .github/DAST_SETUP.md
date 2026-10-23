# Configurar DAST (OWASP ZAP)

1. Autenticar CLI: `gh auth login`
2. Definir URL **HTTPS** de staging (mesmo host que `FINTWIN_PUBLIC_URL`):

```bash
pnpm security:setup-dast-url https://staging.seu-dominio
```

3. Garantir que o remoto tem os workflows (push para `origin` se o repo GitHub ainda estiver vazio).

4. Executar scan:

```bash
gh workflow run security-supply-chain.yml
```

Se aparecer **404 workflow not found**, falta publicar `.github/workflows/security-supply-chain.yml` no branch default.

Ou: **Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `FINTWIN_DAST_TARGET_URL`
- Value: `https://staging.seu-dominio`
