# Publicação do Nexus v2 (fases 1 a 7)

**Ordem: banco primeiro, app depois.** Modelo: `docs/DEPLOY-CHECKLIST.md`. Stack: Vercel (app), Supabase (banco, Auth, Storage), Resend (e-mail), GitHub Actions (CI).

## Situação das migrations (conferir com `npx supabase migration list --linked`)
| Migration | Fase | Estado ao escrever |
|---|---|---|
| 20261115113848 fase_1a_ajustes_rapidos | 1A | aplicada |
| 20261115150000 fase_1b_matriz | 1B | aplicada |
| 20261115170000 fase_2_auxiliar_e_devolucao | 2 | aplicada |
| 20261115190000 fase_3_avisos_e_urgencia | 3 | aplicada |
| 20261115210000 fase_4_fluxo_v2 | 4 | aplicada |
| 20261115230000 fase_5_calendario_e_planilha | 5 | aplicada |
| **20261116100000 fase_7_endurecimento** | 7 | **pendente** (só tira permissões) |

O banco de desenvolvimento é o mesmo do site oficial: as migrations já aplicadas são compatíveis com o app antigo **exceto** a abertura de contratação (assinatura nova de `abrir_contratacao`, fluxo 2). Por isso o app novo deve entrar logo depois do banco.

## Antes
- [ ] As branches são empilhadas (cada uma parte da anterior): 1A → 1B → 2 → 3 → 4 → 5 → 6 → 7. Abrir os pull requests nessa ordem (textos em `docs/PR-fase-*.md`) e esperar o CI verde em cada um (lint, tipos, Vitest, build, pgTAP).
- [ ] Conferir as variáveis na Vercel (Production e Preview): `CRON_SECRET`, `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_REMETENTE`, `NEXT_PUBLIC_SITE_URL`.
- [ ] `vercel.json` tem 3 tarefas agendadas: `/api/cron/vencimentos` (9h UTC), **`/api/cron/prazos` (10h UTC, nova)** e `/api/cron/notificacoes` (11h UTC). Conferir que o plano da Vercel aceita 3.
- [ ] Backup do banco (Supabase → Database → Backups, ou `pg_dump`).
- [ ] Cadastrar **o prefixo do contrato no Sienge de cada obra** (administração da obra) antes de abrir aditivo ou salvar código de contrato.
- [ ] Cadastrar o **nível de cada usuário por obra** (coordenador ou auxiliar) e os perfis **gerente de suprimentos** e **Suprimentos**.
- [ ] O gerente de suprimentos preenche o **calendário do ano** e Suprimentos importa as **planilhas MO e MAT** (CSV) e o **cronograma** (administração da obra), para a abertura mostrar as datas.

## Publicar
1. [ ] `npm run db:push` (aplica a migration da Fase 7; segundos). Conferir a lista de migrations.
2. [ ] `npm run test:db:remoto` (nada deve falhar; cada arquivo desfaz tudo no fim).
3. [ ] Merge na `main`, na ordem dos pull requests; a Vercel faz o deploy. Acompanhar o build.
4. [ ] **Fora do horário de uso** (as contratações abertas depois da publicação entram no fluxo 2).

## Teste com um usuário de cada perfil (antes de liberar)
- [ ] **Coordenador:** abre contratação normal (matriz, item da planilha, urgência) e um **aditivo** (contrato original com o prefixo da obra); vê "será negociado a partir de…"; faz cotações; cancela uma de teste pelo menu **Mais ações**.
- [ ] **Auxiliar:** abre e faz até a etapa 3; **não** consegue a etapa 4, nem cancelar, nem assinar; no menu aparece "Nome - Auxiliar Obra".
- [ ] **Suprimentos:** escolhe o fornecedor e o valor final; **não** consegue autorizar; importa um CSV da planilha; edita um item na linha.
- [ ] **Gerente:** autoriza com o botão único; define/altera o calendário; recebe o aviso de urgência.
- [ ] **Contratos:** lança o código do contrato (formato do prefixo); no aditivo marca guarda-chuva e a assinatura fica "Não se aplica".
- [ ] **RH:** vê "N de M aprovados", fecha a documentação; **SST:** integração. Empresa já liberada na obra: etapas 10 a 12 "Não se aplica".
- [ ] **Devolver para ajuste** por Suprimentos para a obra: a obra recebe o aviso no sino e por e-mail, com a faixa "Devolvida por…". **Admin:** reabrir etapa refaz as seguintes.
- [ ] **Sino:** contador, marcar como lidos, silenciar o som; o aviso também aparece escrito (e é anunciado ao leitor de tela).
- [ ] **Panorama:** cabe no notebook e no celular sem rolagem lateral; filtros, detalhe e trilha com texto; conferir cores nos dois temas.
- [ ] **Contratação antiga** (aberta antes): segue no fluxo 1 e termina sem erro.
- [ ] `/api/cron/prazos` e `/api/cron/notificacoes` com e sem o `Authorization: Bearer <CRON_SECRET>`: 200 e 401.

## Depois
- [ ] 15 min olhando Vercel → Logs (`[notificacoes]`, erros 500) e `select situacao, count(*) from notificacoes group by 1`.
- [ ] Registrar em `docs/ANOTACOES-FUTURAS.md` o que ficou para depois (ver `docs/REVISAO-SEGURANCA-FASES-1-A-6.md`).

## Plano de volta (decidir antes, não durante)
- **App com problema (tela em branco, formulário que não responde):** Instant Rollback da Vercel (Deployments → versão anterior → Promote). **Atenção:** contratações abertas no fluxo 2 **depois** da publicação não funcionam no app antigo (a etapa 6 não existe nelas). Por isso o teste de perfis vem antes de liberar para todos; se precisar voltar o app depois de haver contratações novas, avise o administrador e **não abra contratações** até republicar.
- **E-mail repetido ou travado:** `select * from notificacoes where situacao = 'enviando'` (a reserva se desfaz sozinha em 10 minutos).
- **Aviso em excesso:** o limite é 20 e-mails por pessoa por hora; o sino não tem limite.
- **Migration da Fase 7 (só permissões):** se alguma tela do app perder acesso, devolver a permissão da função citada no erro com `grant execute on function app.<nome>(...) to authenticated;` e abrir o chamado; nenhum dado é afetado.
- As demais migrations só acrescentam colunas, tabelas e funções; **não há perda de dado** ao voltar o app.
