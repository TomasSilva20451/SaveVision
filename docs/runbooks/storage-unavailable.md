# Runbook: armazenamento de documentos indisponível

**Sintomas:** Uploads falham; download `/api/documents/[id]` 404/500; volume Docker `fintwin_*_documents` desmontado ou disco cheio.

**RTO alvo:** 4 h | **RPO alvo:** igual ao último tarball `documents-*.tar.gz` (tipicamente 24 h)

## 1. Deteção

- Erros ao gerar PDF com anexo ou guardar recibo.
- Verificar volume: `docker volume inspect fintwin_production_documents` (deploy) ou `storage/documents/` (dev).

## 2. Recuperação imediata

| Ambiente | Acção |
|----------|--------|
| Docker Compose deploy | Remontar volume; `docker compose --profile production up -d` |
| Disco cheio | Expandir volume; mover backups antigos off-site |
| Dados apagados | Restaurar tarball do último `pnpm db:backup:run` |

Restauro tarball:

```bash
tar -xzf storage/backups/documents-YYYYMMDD-HHMMSS.tar.gz -C storage/
# ou extrair para volume: docker run --rm -v fintwin_production_documents:/data -v $PWD/storage/backups:/b alpine tar -xzf /b/documents-....tar.gz -C /data
```

Permissões: processo Node precisa leitura/escrita no mount (`storage/documents` fora de `public/`).

## 3. Integridade

- Amostragem: descarregar 3 documentos conhecidos por ID na UI.
- PDF/CSV **não** dependem do volume para dados tabulares; só anexos e recibos escaneados.

## 4. Prevenção

- Incluir documentos em cada `db:backup:run`.
- Off-site dos `.tar.gz` (e `.enc`) com a mesma política 3-2-1 da base de dados.
