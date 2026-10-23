# SLOs por jornada crítica

Janela de medição recomendada: **30 dias**. Error budget = 100% − SLO.

| Jornada | ID | SLI | SLO | Notas |
|---------|-----|-----|-----|--------|
| Login (credenciais + MFA) | `login` | `login success / attempts` excl. `blocked` | **99.5%** | Métrica `fintwin_login_attempts_total{result="success"}` |
| Login latência | `login` | p95 `fintwin_login_duration_seconds` | **< 2 s** | |
| Dashboard disponível | `dashboard` | `/dashboard` 2xx via synthetics | **99.5%** | Health agregado + probes externas |
| Registo transação | `transaction_write` | sucesso API servidor / tentativas | **99.9%** | `fintwin_transactions_total` + erros `onRequestError` em rotas financeiras |
| Export relatório | `report_export` | PDF/CSV 2xx | **99%** | Rotas `/api/reports/*` |
| Backup diário | `backup_job` | job `backup.completed` / execuções | **99%** | Logs `event=job_success` |

## Alertas derivados (burn rate simples)

| Condição | Severidade sugerida |
|----------|---------------------|
| `/api/health` ≠ ok 5 min | P1 |
| `fintwin_http_errors_total` aumento sustentado | P2 |
| Login failure rate > 30% em 15 min | P2 (possível ataque) |
| Backup `job_failure` | P2 |
| Ollama down | P4 (degradado) |

Implementação mínima: `pnpm ops:alert-check` + regras no SIEM sobre logs/métricas.

## Revisão

Rever SLOs trimestralmente após game day ou post-mortem (`docs/INCIDENT_RESPONSE.md`).
