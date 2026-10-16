# Modelo de dados

## Fase 1

`User` tem email único, nome, `passwordHash` e `systemRole` (`USER` ou `ADMIN`).

`Workspace` é `PERSONAL` ou `JOINT` e guarda quem o criou.

`WorkspaceMember` liga utilizador e workspace com papel (`OWNER`, `MEMBER`, `VIEWER`) e estado (`INVITED`, `ACTIVE`, `DECLINED`, `REMOVED`). A chave é o par workspace + utilizador.

Não há contas nem movimentos. Quando forem criados, a chave de isolamento é `workspaceId`, não um booleano de conta conjunta.

## Evolução prevista

Contas, transações, transferências, receitas, despesas, objetivos, documentos, previsões e posições de património. Cada um nasce na fase que o torna funcional.
