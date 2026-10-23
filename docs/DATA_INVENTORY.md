# Inventário de dados (FinTwin)

Classificação: **Pública** · **Interna** · **Confidencial** · **Crítica**

## Identidade e acesso

| Dado | Modelo / local | Sensibilidade | Finalidade | Base legal |
|------|------------------|---------------|------------|------------|
| Email, nome, telefone, data nascimento | `User` | Confidencial | Conta | Contrato |
| Hash palavra-passe | `User.passwordHash` | Crítica | Autenticação | Contrato |
| MFA TOTP | `UserTotpCredential` | Crítica | Segurança | Interesse legítimo |
| Passkeys | `PasskeyCredential` | Crítica | Autenticação | Contrato |
| Sessões | `AuthSession` | Confidencial | Sessão | Contrato |
| Eventos segurança | `SecurityEvent` | Confidencial | Audit trail | Interesse legítimo |
| Consentimentos | `PrivacyConsent` | Interna | RGPD | Obrigação legal |
| Eliminação | `SubjectErasureRequest` | Interna | Prova de apagamento | Obrigação legal |

## Workspaces e finanças

| Dado | Modelo | Sensibilidade | Finalidade | Base legal |
|------|--------|---------------|------------|------------|
| Membership | `WorkspaceMember` | Confidencial | Autorização | Contrato |
| Contas, saldos | `FinancialAccount` | Confidencial | Tesouraria | Contrato |
| Transações | `Transaction` | Confidencial | Registo financeiro | Contrato |
| Orçamentos, património, alertas | vários | Confidencial | Planeamento | Contrato |
| Documentos | `StoredDocument` + disco | Confidencial | Recibos/relatórios | Contrato |

## IA local

| Dado | Local | Sensibilidade | Finalidade | Base legal |
|------|-------|---------------|------------|------------|
| Preferências IA | `UserLocalAiSettings` | Interna | Config Ollama | Consentimento |
| Payloads Ollama | Rede localhost | Confidencial | Sugestões | Consentimento |
| Prompts ajuda | BD/cache curto | Confidencial | UX ajuda | Consentimento (se `storePrompts`) |

## Operações

| Dado | Local | Sensibilidade | Finalidade |
|------|-------|---------------|------------|
| Logs JSON | stdout / Loki | Interna | Observabilidade |
| Backups cifrados | `storage/backups` | Crítica | Continuidade |
| Ledger auditoria | `AuditEvent` | Confidencial | Integridade |

## Fluxos externos

- **Ollama:** apenas endpoint configurado (localhost por omissão).
- **SMTP:** se configurado, email de verificação (sem conteúdo financeiro).
- **Sem** analytics third-party na app core.
