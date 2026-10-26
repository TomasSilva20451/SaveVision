# Configurar DAST (OWASP ZAP)

1. Autenticar CLI: `gh auth login`
2. Definir URL **HTTPS** de staging (mesmo host que `FINTWIN_PUBLIC_URL`):

```bash
pnpm security:setup-dast-url https://staging.seu-dominio
```

Não use `*.example`: é apenas um domínio documental e não resolve em DNS. Enquanto não existir um staging real, o workflow dedicado termina com aviso e os passos ZAP ficam ignorados, sem criar um falso incidente de segurança.

3. Garantir que o remoto tem os workflows (push para `origin` se o repo GitHub ainda estiver vazio).

4. Executar scan:

```bash
gh workflow run dast-staging.yml
```

Se aparecer **404 workflow not found**, falta publicar `.github/workflows/dast-staging.yml` no branch default.

Ou: **Settings → Secrets and variables → Actions → Variables → New repository variable**

- Name: `FINTWIN_DAST_TARGET_URL`
- Value: `https://staging.seu-dominio`
