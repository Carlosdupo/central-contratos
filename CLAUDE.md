@AGENTS.md

# Nexo (central-contratos)

## Interface: UI SDK
- Toda tela ou componente novo usa o **UI SDK** (`@ui-sdk/react` + `@ui-sdk/core`, versão fixada) e segue a skill `ui-sdk` (`.claude/skills/ui-sdk`). Leia `node_modules/@ui-sdk/react/docs/llms.txt` e só a página do componente que for usar.
- Importe por entrada (`@ui-sdk/react/dialog`), nunca de `internal`. Componentes com estado ficam em arquivos `"use client"`.
- O visual continua o do Nexo: tokens em `app/globals.css` (ver `docs/design-system.md`). Estilize as partes por `data-slot` e atributos de estado; sem `web.css` por enquanto.
- Ações sensíveis (aprovar, devolver, autorizar, assinar, cancelar, excluir) levam `data-agent-confirm` com a frase do que fazem.
- Componentes feitos à mão que ainda não migraram (menu lateral, máscaras de CNPJ/telefone, régua de etapas) migram aos poucos; não crie novos assim.

## Limites de sempre
- Mudança no banco só por migration nova, com teste pgTAP (`npm run test:db:remoto`).
- Antes de concluir: `npm run lint`, `npm run typecheck`, `npm test`.
