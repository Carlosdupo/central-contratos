# Fase 7: fechamento e publicação

**Esta branch (`fase-7-fechamento`) parte da `fase-6-panorama` e traz junto a correção da importação da Fase 5.** Abrir depois do pull request da Fase 6.

## O que mudou
- **Revisão de segurança das fases 1 a 6** (`docs/REVISAO-SEGURANCA-FASES-1-A-6.md`) com conferência automática que fica como teste (`fase_7_seguranca.test.sql`, 18 asserções): RLS em toda tabela, `search_path` fixo em toda função `SECURITY DEFINER`, visitante sem execução, lista fechada de funções do schema `app` que o usuário logado pode executar, tabelas novas só de leitura para o cliente, funções só do servidor.
- **Migration `20261116100000_fase_7_endurecimento.sql`** (só tira permissões): fecha 15 funções internas do schema `app` que ficaram executáveis por qualquer usuário logado desde as primeiras migrations, e as permissões largas da tabela `matriz_contratacao`. O schema `app` não é exposto pela API, então não havia chamada pela internet; agora também não há pela permissão.
- **Contraste conferido nos dois temas** (`tests/unit/contraste.test.ts`, 40 verificações): texto 4,5:1 e bordas, foco e estados 3:1, calculados a partir dos tokens reais de `app/globals.css`. Tudo passou.
- **Acessibilidade:** o campo de arquivo da EAP passou a usar `CampoArquivo` (UI SDK) como as demais telas novas; levantamento dos controles escritos à mão (restou o envio de documentos do portal, anterior a estas fases, com nome acessível).
- **Guia curto de uso por perfil** (`docs/GUIA-POR-PERFIL.md`) e **checklist de publicação** (`docs/DEPLOY-NEXUS-V2.md`: banco primeiro, app depois, teste com um usuário de cada perfil, plano de volta).

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (182 testes): passam.
- Banco: o teste novo passa (18) e **os outros 15 arquivos passam com esta migration aplicada dentro da transação**, então fechar as funções não quebrou nenhum fluxo (gatilhos, RLS e funções de negócio).

## Atenção
- **A migration `20261116100000_fase_7_endurecimento.sql` AINDA NÃO FOI APLICADA** e nada foi publicado. Depois de aplicar, apagar a linha `-- migration:` do topo do teste da Fase 7.
- **Falta a passada visual no navegador com dados reais e com leitor de tela**; foi coberta por testes em jsdom, teste de agente e contraste dos tokens, mas precisa do teste com um usuário de cada perfil (checklist).
- Se contratações forem abertas no fluxo 2 e for preciso voltar o app, elas não funcionam no app antigo; ver "Plano de volta" no checklist.
