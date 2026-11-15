# Fase 1A: ajustes rápidos da contratação

## O que mudou
- **1.1 Texto:** "Valor orçado" virou "Valor Orçamento" na abertura, no subtítulo, nas mensagens e no item do checklist da etapa 1 (no banco).
- **1.2 Campo de valor:** `CampoReais` (`components/app/campos-mascara.tsx`) mostra `1.234,56` enquanto a pessoa digita só números. Está em todos os campos de R$: abertura, cotação, nova proposta, valor final, permuta, faturamento direto e sinal. Há uma só implementação (`lib/valor-reais.ts`); a cópia que existia na abertura saiu. As ações do servidor usam `lerValor`/`numeroOuNulo` desse mesmo arquivo (`1.234,56` vira `1234.56`).
- **1.3 Botão único da etapa 6:** "Autorizar contratação" grava as condições e conclui a etapa na mesma chamada, com confirmação. No banco, `autorizar_contratacao` só chama `salvar_condicoes_gerente` e `concluir_etapa(…, 6)` (que já conferem permissão e regras), na mesma transação. O botão "Salvar condições" saiu.
- **1.4 Cancelar:** menu "Mais ações" no topo da contratação (Menu do UI SDK). "Cancelar contratação" abre a janela com motivo obrigatório. Aparece para administrador e coordenador. No banco, `cancelar_contratacao` mantém as regras de antes (admin verificado, motivo com 5+ letras, `search_path` vazio) e aceita também o coordenador **daquela obra**.
- **1.5 Prefixo do Sienge:** a obra ganha `prefixo_sienge` (campo na tela da obra). Com prefixo, o código do contrato (etapa 7) e o contrato original do aditivo precisam ser o prefixo + 4 números (`CT/BL0083`); sem prefixo, aceita como antes. O banco confere (`app.conferir_codigo_sienge`) e a tela mostra a regra na dica do campo.
- **1.6 Aditivo:** `abrir_contratacao` recebe e grava `p_contrato_original` e o exige no aditivo. O campo só aparece na abertura quando o tipo escolhido é aditivo, e o número aparece no quadro da contratação.

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (77 testes): passam.
- Testes de tela novos (`tests/ui/fase-1a.test.tsx`): campo de valor, botão único do gerente (com o teste de agente) e o menu "Mais ações". Unitário: `tests/unit/valor-reais.test.ts`.
- Banco: `npm run test:db:remoto` passa (11 arquivos). O teste novo `supabase/tests/database/fase_1a_ajustes_rapidos.test.sql` (24 asserções) cobre: coordenador da obra cancela; coordenador de outra obra não; motivo curto recusado; código do Sienge com e sem prefixo; aditivo sem contrato original recusado; botão único grava e conclui; quem não é gerente não consegue.
- Como a migration ainda não está no banco, o teste pede `-- migration: arquivo.sql` na primeira linha e `scripts/testes-banco-remoto.mjs` roda esse arquivo dentro da mesma transação do teste (desfeita no fim).

## Atenção
- **A migration `20261115113848_fase_1a_ajustes_rapidos.sql` AINDA NÃO FOI APLICADA** no banco, e nada foi publicado. O site oficial usa o mesmo banco de desenvolvimento: aplicar só depois da revisão, junto da publicação deste código (a tela da obra e a abertura já usam as colunas novas).
- A migration só acrescenta (colunas, funções novas ou trocadas); nada é apagado.
- `lib/supabase/tipos.ts` foi atualizado à mão (sem `db:tipos`).
