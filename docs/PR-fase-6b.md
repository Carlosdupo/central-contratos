# Fase 6 (ajustes): panorama, itens que faltavam

A Fase 6 (panorama novo) já está na `main`. Esta branch (`fase-6b-panorama-ajustes`, a partir da `main` com as fases 1 a 5 no ar) fecha o que o pedido da revisão listava e ainda não estava na tela. **Sem mudança no banco.**

## O que mudou
- **"x de y aprovados" na linha**, enquanto a contratação está na documentação do RH: a mesma consulta única do panorama agora traz os vínculos e as alocações da empresa (`empresas_terceiras(vinculos(alocacoes))`, respeitando a RLS) e conta, nesta obra, quantos já passaram pelo RH (integração agendada ou liberado). O detalhe mostra "Equipe aprovada pelo RH: 7 de 10 nesta obra". Sócio esporádico não conta.
- **Urgência com a data de necessidade visível** na linha: "Urgente · precisa em 24/11" (antes só aparecia ao passar o mouse).
- **Testes novos:**
  - `tests/unit/panorama-largura.test.ts`: nenhuma regra `.pan-*` fixa largura ou largura mínima acima de 320 px (menor tela), nem liga rolagem lateral nem `nowrap`; as colunas usam `minmax(0, …)` e a linha vira uma coluna só no celular; o detalhe usa `min(100vw, …)`; os arquivos da tela não têm `min-w` acima de 320 px, `overflow-x`, `whitespace-nowrap` nem `<table>`.
  - `tests/ui/fase-6.test.tsx`: selos da linha (urgência com data, aditivo com contrato original, "x de y aprovados" só na documentação) e o uso pelo teclado (Enter abre o detalhe e Esc fecha), além do teste de agente que já existia.

## O que já estava na Fase 6 (resumo)
Resumo no topo, faixa "Com quem estão as contratações em andamento" que filtra a lista, filtros por obra e situação (inclui Urgentes) e busca, atrasadas e urgentes primeiro, uma linha por contratação agrupada por obra com a trilha de etapas lida **pela chave e pela versão do fluxo** (fluxo 1, 2 e aditivo, com "não se aplica"), detalhe em janela lateral (UI SDK) com etapas, prazo, fornecedor, valor, contrato no Sienge, avisos de urgência/devolução/pedido fora do prazo e o link "Abrir contratação". A trilha tem texto para leitor de tela e não depende só de cor; o contraste dos tokens nos dois temas está conferido por teste (Fase 7).
