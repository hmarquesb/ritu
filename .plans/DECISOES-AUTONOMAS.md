# Decisões autônomas

| Spec · Tarefa | O que faltava | Decisão | Por quê | Como desfazer |
|---|---|---|---|---|
| 001 · T1 | `@types/node` "mais recente" resolvia para 26, com runtime Node 24 | `@types/node@24` | Tipos devem casar com o runtime (`engines`, `.nvmrc`) | `npm install -D @types/node@latest` |
| 001 · T1 | `npm run dup` falha se `src/` não existe | `src/.gitkeep` até a T2 criar `src/app/` | Gate precisa passar desde a T1 | Apagar `src/.gitkeep` quando houver arquivos em `src/` |
| 001 · T2 | `next build` reescreve o `tsconfig.json` (jsx, include) e o lint passa a falhar depois do build | Aceitar o formato do Next no `tsconfig.json`, formatado de modo que um segundo build não o altere | Build idempotente; não brigar com a ferramenta | Voltar o `tsconfig.json` da T1 e rodar lint antes do build |
| 001 · T2 | Playwright 1.65 rejeita `port` e `url` juntos no `webServer` | Só `port: 3000` | Única forma aceita; define o baseURL | — |
| 001 · T7 | Como achar imports sem falso positivo em comentário e string | AST pela API do `typescript` (devDependency já instalada), no próprio teste | Mais robusto que regex; nada novo instalado | Trocar por remoção de comentários + regex em `src/architecture.test.ts` |
