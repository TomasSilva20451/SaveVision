# Segurança

## Fase 1

- `.env` não entra no repositório. O modelo está em `.env.example`.
- `/api/health` responde `ok` ou `degraded`. Não devolve a mensagem interna da base de dados.
- O acesso a dados futuros passa por `canAccessWorkspace` / `canAccessRecord`, sempre no servidor.

## Fase 2

- Palavras-passe com Argon2id: 19 MiB, 2 iterações, paralelismo 1.
- A sessão Auth.js fica num cookie HttpOnly, SameSite Lax, Secure em produção. Não há token em localStorage. A preferência de tema é o único valor de interface guardado no browser.
- Email inexistente e palavra-passe errada devolvem a mesma mensagem. Ao fim de 5 falhas em 15 minutos, o login fica bloqueado 15 minutos. O contador vive em memória e reinicia com o processo.
- As credenciais de demonstração estão no seed e no ecrã de login. Não são palavras-passe reais.

## Fases seguintes

Argon2id, cookies HttpOnly, rate limit no login, validação de uploads e audit log entram quando essas funcionalidades existirem. Não ficam simulados nesta fase.
