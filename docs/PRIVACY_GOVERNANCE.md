# Privacidade e governação de dados

Centro de Privacidade: **`/perfil/privacidade`**. Exportação API: **`GET /api/privacy/export`** (confirmação reforçada).

## Princípios

- Minimização: só recolhemos o necessário para finanças pessoais e segurança.
- Isolamento por `workspaceId`; membership conjunta não abre workspaces pessoais.
- IA local (Ollama) **opcional** e com consentimento explícito.
- Sem venda de dados; sem publicidade; sem cloud ML por omissão.

## Inventário resumido

Ver inventário completo: [`docs/DATA_INVENTORY.md`](DATA_INVENTORY.md).

| Categoria | Sensibilidade | Base legal | Finalidade |
|-----------|---------------|------------|------------|
| Identidade (email, nome, telefone) | Alta | Contrato | Conta e autenticação |
| Credenciais (hash, MFA) | Crítica | Contrato / interesse legítimo | Segurança |
| Movimentos financeiros | Alta | Contrato | Funcionalidade core |
| Documentos/recibos | Alta | Contrato | Arquivo privado |
| Eventos segurança | Média | Interesse legítimo | Detecção abuso |
| Metadados Ollama | Média | **Consentimento** | Sugestões locais |
| Auditoria (`AuditEvent`) | Média | Obrigação legal / legítimo | Integridade |

## Consentimentos versionados

Catálogo em código: `src/lib/privacy/consent-catalog.ts`. Registo em `PrivacyConsent` (utilizador, chave, versão, data, hashes IP/UA).

## Retenção e eliminação

Política em `src/lib/privacy/retention-policy.ts`. Resumo:

- Perfil: enquanto conta activa.
- Movimentos/documentos: até 10 anos (obrigações contabilísticas/fiscais típicas — ajustar com assessoria).
- Sessões revogadas / desafios email: 30–90 dias.
- Backups cifrados: 30 dias (configurável).

**Eliminação verificável:** `SubjectErasureRequest` com `proofSha256` do export prévio; anonimização do titular; revogação MFA/sessões. Movimentos podem permanecer despersonalizados no workspace.

## Direitos do titular

| Direito | Implementação |
|---------|----------------|
| Acesso | Export JSON (`/api/privacy/export`) |
| Retificação | `/perfil` |
| Apagar | Centro de privacidade (eliminação verificável) |
| Limitar | Desactivar IA local; desactivar conta |
| Portabilidade | JSON export |

## DPIA

Funcionalidades de maior risco (IA local, exportação massiva): [`docs/DPIA_LOCAL_AI.md`](DPIA_LOCAL_AI.md).

## Ollama

[`docs/OLLAMA_PRIVACY.md`](OLLAMA_PRIVACY.md) — dados enviados, prompts, retenção, `storePrompts`.
