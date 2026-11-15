# Fase 1B: abertura pela matriz de contratação

**Esta branch (`fase-1b-matriz`) parte da `fase-1a-ajustes-rapidos`.** Abrir este pull request depois do da 1A (ou apontando para a branch da 1A), senão o diff vem com as duas entregas.

## O que mudou
- **Tabela `matriz_contratacao`** com as 344 atividades de `docs/dados/matriz-contratacao.json`, igual para todas as obras. Usuário interno ativo só lê; ninguém altera pela tela.
- **Abertura:** o campo "Serviço da EAP" deu lugar a "Atividade da matriz" (busca por nome, Combobox do UI SDK). Ao escolher, aparecem forma legal, tipo, unidade da negociação, lotes, unidade de medição e observações.
- **Forma legal gravada** na contratação (`forma_legal` e `matriz_id`). Saíram as opções "serviço único, sem medição" e "serviço para contrato": ficam a marcação **"É aditivo de contrato"** (o campo do contrato original só aparece marcada) e a escolha de **quem negocia** (regra dos R$ 4.000 igual).
- **`abrir_contratacao`** ganhou nova assinatura `(obra, escopo, atividade da matriz, valor, aditivo, quem negocia, contrato original)`; a da 1A saiu. Não pede mais item da EAP. Tipo gravado: `aditivo` se marcado, senão `contrato`.
- **Contratações antigas** continuam mostrando o serviço da EAP (o quadro troca o rótulo para "Atividade da matriz" só nas novas). A tela de importação da EAP continua existindo.
- **Menu lateral:** novo grupo "Apoio" com "Matriz de contratação" (`/apoio/matriz`), tela de consulta com busca (sem acento).

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test`: passam.
- Testes de tela novos (`tests/ui/fase-1b.test.tsx`): atividade mostra os dados e vai no formulário; contrato original só no aditivo (com a dica do prefixo); consulta com busca; teste de agente (todo controle tem nome).
- Banco: `npm run test:db:remoto` passa. Teste novo `supabase/tests/database/fase_1b_matriz.test.sql` (12 asserções): leitura da matriz, ninguém altera, forma legal gravada, abre mesmo a obra tendo EAP, sem atividade recusa, regra dos R$ 4.000, aditivo exige contrato original, coordenador de outra obra não abre.
- Os testes `contratacoes`, `acesso_fornecedor` e `fase_1a` foram trocados para a nova assinatura de `abrir_contratacao`.

## Atenção
- **As migrations 1A (`20261115113848`) e 1B (`20261115150000`) AINDA NÃO FORAM APLICADAS** e nada foi publicado. O site oficial usa o mesmo banco de desenvolvimento: aplicar só depois da revisão, as duas juntas e na ordem, junto da publicação deste código.
- Os testes `contratacoes`, `acesso_fornecedor`, `fase_1a` e `fase_1b` trazem no topo linhas `-- migration: ...` para rodar as migrations ainda não aplicadas dentro da transação do teste. **Depois de aplicar, apagar essas linhas** (senão o teste tenta criar de novo o que já existe).
- A migration só acrescenta (tabela, colunas); a função de abertura é trocada. Nada de dado é apagado.
- `lib/supabase/tipos.ts` atualizado à mão (sem `db:tipos`).
- Fora desta entrega (decidido no plano): forma legal ainda não muda o fluxo; todas seguem as 12 etapas.
