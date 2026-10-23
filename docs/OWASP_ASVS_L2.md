# Baseline OWASP ASVS v4 — Nível 2

FinTwin visa **ASVS L2** (aplicação que trata dados pessoais e financeiros sensíveis). Mapeamento resumido; evidência em CI/docs/código.

| Área ASVS | Requisito L2 (resumo) | Estado | Evidência |
|-----------|----------------------|--------|-----------|
| V1 | Arquitetura segura | Parcial | `docs/ARCHITECTURE.md`, `THREAT_MODEL.md` |
| V2 | Autenticação | Implementado | Argon2id, MFA, passkeys, `SECURITY_CENTER.md` |
| V3 | Gestão sessão | Implementado | JWT revogável, cookies HttpOnly |
| V4 | Controlo acesso | Implementado | Workspace guards, testes isolamento |
| V5 | Validação input | Implementado | Zod, Prisma parametrizado |
| V6 | Cryptografia | Implementado | TLS, backups cifrados, hashes |
| V7 | Erros / logging | Implementado | Logs JSON, sem stack ao cliente |
| V8 | Protecção dados | Implementado | `PRIVACY_GOVERNANCE.md`, export/erase |
| V9 | Comunicações | Implementado | HSTS, TLS enforce, CSP |
| V10 | Malicious code | Parcial | Dependabot, audit, CodeQL |
| V11 | Negócio / lógica | Implementado | Decimal, idempotência receitas |
| V12 | Ficheiros | Implementado | Sniff + malware scan, 5 MB cap |
| V13 | API | Implementado | Auth em rotas, rate limits auth |
| V14 | Config | Implementado | Headers segurança, `next.config.ts` |

**Gaps L2 conhecidos (pré-abertura pública):**

- Rate limit login distribuído (Redis) — ASVS V2.2.1 escala multi-instância.
- CSP sem `'unsafe-inline'` em scripts (nonce pipeline) — endurecimento planeado.
- Pentest externo — ver `PENTEST_READINESS.md`.

Portão release: `quality-gate` + `security-supply-chain` verdes.
