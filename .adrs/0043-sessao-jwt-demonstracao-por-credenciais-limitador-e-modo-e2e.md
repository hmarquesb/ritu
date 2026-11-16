# ADR 0043: Sessão em JWT, demonstração como provedor de credenciais, limitador em tabela e modo de E2E em memória

## Status

Aceito · 2026-11-16

## Contexto

A entrada do Ritu tem dois tipos de conta: Google e demonstração a um clique, com perfil semeado e vida de 24 horas (ADR 0017). A demonstração não pode virar porta aberta: é limitada por IP e por dia, sem guardar o IP em claro. O Auth.js v5 é a biblioteca de sessão (`ARCHITECTURE.md` §2), ainda em beta. O gate 6 (Playwright) roda na CI sem Postgres, e o login acontece no servidor, então não dá para fingir a sessão pelo navegador.

## Decisão

1. A sessão é um JWT em cookie `httpOnly`, `SameSite=Lax`, de 30 dias, que carrega só `contaId` e `tipo`. A conta é conferida no banco a cada pedido; não há tabela de sessão. O `next-auth` fica em versão exata.
2. A demonstração é um provedor de credenciais `demo`, sem campos: o `authorize` consome o limite e cria a conta com a cópia do seed (`seed/demo.yaml`, validado contra a base). Google e demonstração passam pelo mesmo caminho de sessão e pelo mesmo Aviso inicial.
3. Os limites usam uma porta genérica `UsageLimiter` (chave, janela, início, teto) sobre a tabela `limites`, com o dia local no fuso padrão. As chaves de IP levam só o HMAC do primeiro endereço de `x-forwarded-for`. A limpeza diária apaga janelas antigas.
4. O `proxy.ts` gera o nonce da CSP a cada pedido, põe os headers de segurança e recusa com `403` todo método que muda estado quando o host do `Origin` não é o do pedido. O nonce também vai para `<meta name="csp-nonce">`, de onde o React Aria o lê para os estilos que injeta.
5. `RITU_MODO=e2e` liga stores, limitador e cidades em memória, guardados em `globalThis`, e o header `x-ritu-e2e` vira o IP e o prefixo das chaves do limitador, para que testes em paralelo não disputem os limites. O modo é recusado em produção.

## Alternativas consideradas

| Alternativa | Por que não |
|---|---|
| Sessão em banco (adapter do Auth.js) | Uma tabela e uma consulta a mais por pedido sem ganho: a conta já é conferida no banco |
| Demonstração por rota própria, fora do Auth.js | Dois caminhos de sessão para manter e testar |
| Limite em memória do processo | Não sobrevive entre instâncias serverless nem a um novo deploy |
| Contador por IP em claro | Guarda dado pessoal sem necessidade; o HMAC basta para contar |
| E2E contra Postgres na CI | Mais lento e frágil; o contrato das portas já é coberto pelo `test:db` |

## Consequências

- Entrar, sair e a demonstração têm um caminho só, testável por E2E sem banco.
- A 021 reaproveita o `UsageLimiter` para mensagens e toques.
- A troca do `next-auth` beta é tarefa consciente, com a versão fixa.
- O modo de E2E é código que não roda em produção e precisa continuar recusado lá: o container lança `modo_e2e_em_producao` quando `RITU_MODO=e2e` encontra `VERCEL_ENV=production`.
- O número 0042 ficou com a ADR de telemetria da trilha principal (015); esta ADR usa o seguinte.
