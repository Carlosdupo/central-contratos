# Escopo da contratação por pacote da matriz

A obra contrata pacotes globais (ex.: toda a elétrica com uma empresa) e a matriz é quebrada em atividades (a 21.1 Elétrica tem 14). Antes, a abertura só deixava escolher **uma** atividade. **Parte da `main` (`ac6aac5`).** Tem uma migration nova.

## O que mudou
- **Abertura:** a busca "Escopo da matriz (atividade, subgrupo ou grupo)" lista três níveis, em três grupos do Combobox do UI SDK: **grupo inteiro** ("21 Inst. Elétrica · 14 atividades"), **subgrupo** ("21.1 Elétrica · 14 atividades") e **atividade** (como antes).
- **Pacote:** ao escolher grupo ou subgrupo aparece a lista das atividades, **todas marcadas** (Marcador de `formulario.tsx`); a obra desmarca o que não entra e **pelo menos uma fica** (a última não desmarca, com aviso). Há "Marcar todas". Escolher uma atividade fica como hoje, só ela, sem a lista.
- **Forma legal** = a mais rigorosa entre as atividades marcadas, na ordem **Contrato + Edital > Contrato > Contrato genérico > Proposta comercial assinada > Pedido > Medição excel**. A tela mostra "Forma legal: X (a mais rigorosa entre as atividades marcadas)" e, se as marcadas têm formas diferentes, lista quais e quantas de cada. Cada atividade mostra a forma dela na lista.
- **Rótulo do escopo** (vira o `pacote` da contratação): "21.1 Elétrica (13 de 14 atividades)"; se todas entram, "21.1 Elétrica (14 atividades)"; se vêm de subgrupos do mesmo grupo, o grupo; uma atividade só, o nome dela (como antes). É montado no servidor a partir das atividades escolhidas.
- **Tela da contratação e detalhe do panorama:** quadro "Escopo" com o rótulo, a forma legal mais rigorosa e a lista das atividades incluídas, que abre e fecha (Collapsible do UI SDK). Contratação de uma atividade só não mostra o quadro.
- **Banco** (`20261116140000_escopo_por_pacote.sql`):
  - tabela `contratacao_atividades (contratacao_id, matriz_id)`, com RLS de leitura igual à das outras tabelas da contratação (quem vê a obra) e **sem escrita direta** (só a função grava);
  - `app.forma_legal_mais_rigorosa(text[])`, a regra no banco (forma desconhecida conta como a menos rigorosa);
  - `abrir_contratacao` passa a receber `p_atividades uuid[]` e `p_escopo text`: tira repetidas, recusa lista vazia ou nula ("Escolha pelo menos uma atividade da matriz."), atividade inexistente ("Atividade da matriz inexistente.") e mais de 100 atividades; **calcula a forma legal no banco**; grava `pacote` com o rótulo; **mantém `matriz_id` com a primeira atividade pela ordem da matriz** (compatibilidade); a assinatura antiga foi removida e o revoke/grant refeito;
  - as contratações que já existem ganham a linha da atividade única em `contratacao_atividades` (nada muda para elas).

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (228 testes): passam.
- Banco: teste novo `supabase/tests/database/escopo_por_pacote.test.sql` (19 asserções): a regra da forma legal (mais rigorosa, desconhecida, vazia); abre com várias atividades (repetida conta uma) e forma = Contrato entre Pedido e Contrato; entre quatro formas vale Contrato + Edital; o rótulo vira o pacote; `matriz_id` = primeira pela ordem; uma atividade só continua funcionando; atividade inexistente, lista vazia e nula recusadas; coordenador de outra obra não abre nem vê as atividades; ninguém grava direto. Os outros 18 arquivos de banco passam com a migration (os que abrem contratação foram atualizados para a assinatura nova e **todos os 9 arquivos que chamam a função têm a linha `-- migration:` no topo**).
- Unitário (`tests/unit/escopo.test.ts`, 9): ordem das formas, mistura, desconhecida, e o rótulo do escopo.
- Tela (`tests/ui/escopo-por-pacote.test.tsx`, 10): três níveis na busca, subgrupo marca todas e mostra a forma legal e as diferentes, desmarcar muda contagem/rótulo/forma, pelo menos uma marcada, o que o formulário envia, uma atividade só, grupo inteiro, quadro de escopo que abre e fecha, e o teste de agente (todo controle tem nome).

## Atenção
- **A migration `20261116140000_escopo_por_pacote.sql` AINDA NÃO FOI APLICADA** (nem no banco de desenvolvimento nem no de produção). **O app novo exige o banco novo** (chama `abrir_contratacao` com a assinatura nova): aplicar a migration **antes** de publicar o app. Depois de aplicar, apagar a linha `-- migration:` do topo dos 9 testes. O app antigo deixa de conseguir **abrir** contratação com o banco novo; as demais telas seguem funcionando.
- O rótulo "Atividade da matriz" da abertura virou "Escopo da matriz (atividade, subgrupo ou grupo)"; o formulário agora envia `matriz` (o item escolhido: `a:`, `s:` ou `g:`) e, no pacote, uma `atividades` por atividade marcada.
- Conferido em jsdom; falta a passada visual no navegador com a matriz inteira (27 grupos, 94 subgrupos, 344 atividades na busca).
