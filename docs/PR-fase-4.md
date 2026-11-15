# Fase 4: fluxo versão 2

**Esta branch (`fase-4-fluxo-v2`) parte da `fase-3-notificacoes`.** Abrir este pull request depois do da Fase 3. As migrations das Fases 1A a 3 já estão no banco de desenvolvimento; a única pendente é a desta fase. O desenho completo do fluxo está em `docs/fluxo-v2.md`.

## O que mudou
- **Chave em cada etapa** (`etapas_fluxo.chave`: `autorizacao`, `contrato`...). Regras do banco e telas passam a ler a etapa pela chave; o número é só a posição. Versões: **1** (contratações antigas, intacta), **2** (normal) e **3** (aditivo).
- **Etapa 1:** a abertura da solicitação já conclui a etapa; saíram os três itens de marcar.
- **Etapas 5 e 6 viram uma só** ("Negociação e autorização de Suprimentos", `autorizacao`): o comprador escolhe o fornecedor e o valor final; **só o gerente de suprimentos** define as condições e autoriza (conferido no banco: comprador recebe erro de permissão).
- **Aditivo:** etapas 2 e 3 viram uma ("Fornecedor e valor negociado", sem 3 cotações). Na etapa do contrato, Contratos marca **guarda-chuva** (a assinatura fica "não se aplica") ou **contrato novo** (segue para assinatura). A alçada continua.
- **Empresa já liberada na obra** (aprovada e ligada à obra antes da autorização): documentação, integração e liberação ficam "Não se aplica"; a contratação é liberada ao terminar contrato e assinaturas.
- **Documentação, integração e liberação ligadas ao módulo de terceiros:** a tela mostra "7 de 10 aprovados nesta obra" e quem falta; **o RH decide e fecha** (sem checklist).
- **Telas:** régua sem o número 6 (1, 2, 3...), "Não se aplica: …" nas etapas puladas, painel e panorama leem as etapas pela chave e pela versão da contratação, fila de Suprimentos separa negociação e autorização pela chave.
- **Prazos:** a etapa de autorização do fluxo 2 herda o prazo que o gerente tinha na etapa 6.
- `abrir_contratacao` abre no fluxo 2 (aditivo: versão 3). Novas funções: `definir_fornecedor_aditivo`, `definir_destino_aditivo`, `app.etapa_da_chave`. `concluir_etapa`, `salvar_condicoes_gerente`, `autorizar_contratacao`, `liberar_etapas`, o gatilho do checklist e o de avisos agora seguem a versão e a chave.

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (101 testes): passam.
- Banco: teste novo `supabase/tests/database/fase_4_fluxo_v2.test.sql` (29 asserções): contratação nova entra no fluxo 2 com 11 etapas e sem a 6, a abertura conclui a 1; comprador não autoriza e só o gerente autoriza; RH fecha a documentação e a obra não; empresa já liberada pula 10, 11 e 12 e a contratação é liberada; aditivo em 10 etapas, sem cotações, guarda-chuva pula a assinatura.
- **Fluxo 1 continua passando:** os testes de contratações, fornecedor, 1A, 2 e 3 agora refazem a contratação aberta no fluxo 1 (função temporária `pg_temp.para_fluxo_1`, só dentro do teste) e passam inteiros, junto com os demais arquivos de banco (15 ao todo), **com esta migration aplicada dentro da transação**.
- Testes de tela (`tests/ui/fase-4.test.tsx`): campos do aditivo, escolha guarda-chuva/contrato novo, numeração da régua, teste de agente. Unitário: resumo "N de M aprovados".

## Atenção
- **A migration `20261115210000_fase_4_fluxo_v2.sql` AINDA NÃO FOI APLICADA.** Aplicar só depois da revisão e junto da publicação deste código. Depois, apagar a linha `-- migration:` do topo do teste da Fase 4. Contratações abertas **depois** de aplicar entram no fluxo 2; as abertas antes continuam no fluxo 1.
- "Empresa liberada" usa a situação `aprovada` + ligação ativa com a obra (decisão registrada em `docs/fluxo-v2.md`); se a regra do RH for outra, é um ajuste só na função `concluir_etapa`.
- Ficou fora: a tela de parâmetros de prazo continua listando as etapas do fluxo 1; a marca "fora do prazo do calendário" é da Fase 5.
- `lib/supabase/tipos.ts` atualizado à mão (sem `db:tipos`).
