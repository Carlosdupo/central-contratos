-- migration: 20261115230000_fase_5_calendario_e_planilha.sql
-- Fase 5: calendário de suprimentos, planilha de planejamento (datas calculadas), indicadores e abertura com item da planilha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000006c1', 'coord5a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000006c2', 'coord5b@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000006f1', 'comprador5@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000006f2', 'gerente5@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000006c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000006c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000006f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000006f2', 'gerente_suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000006aa', 'OBR-6A', 'Obra 6A', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000006bb', 'OBR-6B', 'Obra 6B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-0000000006c1', '00000000-0000-0000-0000-0000000006aa'),
  ('00000000-0000-0000-0000-0000000006c2', '00000000-0000-0000-0000-0000000006bb');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Calendário: só o gerente define
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.salvar_calendario(extract(year from now())::int, '[]'::jsonb) $$, '42501', null, 'O comprador não define o calendário');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.salvar_calendario(extract(year from now())::int, jsonb_build_array(jsonb_build_object('mes', 1, 'ciclo', 1, 'limite', '2026-01-10', 'inicio', '2026-01-10'))) $$,
  'P0001', null, 'Início da negociação no mesmo dia do limite é recusado');
select lives_ok($$ select public.salvar_calendario(extract(year from now())::int, jsonb_build_array(
  jsonb_build_object('mes', 1, 'ciclo', 1, 'limite', (extract(year from now())::int || '-01-10'), 'inicio', (extract(year from now())::int || '-01-11')),
  jsonb_build_object('mes', 1, 'ciclo', 2, 'limite', (extract(year from now())::int || '-01-25'), 'inicio', (extract(year from now())::int || '-01-26')),
  jsonb_build_object('mes', 12, 'ciclo', 2, 'limite', ((now() at time zone 'America/Sao_Paulo')::date + 3)::text, 'inicio', ((now() at time zone 'America/Sao_Paulo')::date + 4)::text)
)) $$, 'O gerente grava o calendário do ano');
select is((select inicio::text from public.ciclo_do_pedido((extract(year from now())::int || '-01-05')::date)), (extract(year from now())::int || '-01-11'), 'Pedido até o limite entra no ciclo daquele limite');
select is((select inicio::text from public.ciclo_do_pedido((extract(year from now())::int || '-01-11')::date)), (extract(year from now())::int || '-01-26'), 'Pedido depois do limite cai no ciclo seguinte');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006c1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.calendario_suprimentos where ano = extract(year from now())::int), 3, 'A obra lê o calendário');
select throws_ok($$ insert into public.calendario_suprimentos (ano, mes, ciclo, limite, inicio) values (2099, 1, 1, '2099-01-10', '2099-01-11') $$, '42501', null, 'Ninguém grava o calendário direto');

-- Planilha: importação e edição só por Suprimentos
select throws_ok(format($$ select public.importar_planejamento(%L, 'MO', '[{"descricao": "Alvenaria"}]'::jsonb) $$, '00000000-0000-0000-0000-0000000006aa'), '42501', null, 'A obra não importa a planilha');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f1", "role": "authenticated", "aal": "aal1"}', true);
select is(public.importar_planejamento('00000000-0000-0000-0000-0000000006aa', 'MO', jsonb_build_array(
  jsonb_build_object('descricao', 'Alvenaria de vedação', 'id_pacote', 'P1', 'prazo_compras_dias', 30, 'prazo_chegada_dias', 30),
  jsonb_build_object('descricao', 'Item sem ID de pacote', 'prazo_compras_dias', 60, 'prazo_chegada_dias', 30),
  jsonb_build_object('descricao', 'Pintura', 'id_pacote', 'P2', 'prazo_compras_dias', 30, 'prazo_chegada_dias', 30)
)), 3, 'Suprimentos importa os itens da planilha de mão de obra');
select throws_ok($$ select public.importar_planejamento('00000000-0000-0000-0000-0000000006aa', 'MO', '[{"descricao": "x", "prazo_compras_dias": -5}]'::jsonb) $$, 'P0001', null, 'Prazo fora do limite recusa a planilha inteira');
select is((select count(*)::int from public.planejamento_itens where obra_id = '00000000-0000-0000-0000-0000000006aa'), 3, 'A planilha recusada não apagou nada');
select throws_ok($$ select public.importar_cronograma('00000000-0000-0000-0000-0000000006aa', '[{"id_pacote": "P1", "inicio": "2026-06-01"}]'::jsonb) $$, '42501', null, 'O comprador não importa o cronograma');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f2", "role": "authenticated", "aal": "aal1"}', true);
select is(public.importar_cronograma('00000000-0000-0000-0000-0000000006aa', '[{"id_pacote": "P1", "inicio": "2026-06-01"}, {"id_pacote": "P2", "inicio": "2026-12-20"}]'::jsonb), 2, 'O gerente importa o cronograma');

-- Datas calculadas
select is((select data_solicitar::text || ' / ' || data_estudo::text || ' / ' || data_compras_fechar::text from public.planejamento_calculado where descricao = 'Alvenaria de vedação'),
  '2026-04-02 / 2026-03-03 / 2026-05-02', 'Datas: início − compras − chegada; estudo 30 dias antes; compras fecha início − chegada');
select is((select data_solicitar from public.planejamento_calculado where descricao = 'Item sem ID de pacote'), null, 'Item sem ID e sem data digitada fica sem data calculada');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.editar_planejamento_item((select id from public.planejamento_itens where descricao = 'Alvenaria de vedação'), 'Ana', 30, 30, '2026-07-01', null) $$, 'P0001', null, 'Item com ID de pacote usa a data do cronograma, não a digitada');
select lives_ok($$ select public.editar_planejamento_item((select id from public.planejamento_itens where descricao = 'Item sem ID de pacote'), 'Bia', 60, 30, '2026-09-01', 'data combinada') $$, 'Item sem ID: a data é digitada na própria linha');
select is((select data_solicitar::text from public.planejamento_calculado where descricao = 'Item sem ID de pacote'), '2026-06-03', 'A data digitada à mão entra no cálculo');

-- Abertura com item da planilha e sem item
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006c2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.planejamento_itens), 0, 'Coordenador de outra obra não vê a planilha');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'com', public.abrir_contratacao('00000000-0000-0000-0000-0000000006aa', 'Alvenaria do bloco A', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos', null, (select id from public.planejamento_itens where descricao = 'Alvenaria de vedação')) $$, 'Abre a contratação escolhendo o item da planilha');
select is((select data_real_obra from public.planejamento_itens where descricao = 'Alvenaria de vedação'), (now() at time zone 'America/Sao_Paulo')::date, 'O fluxo grava a data real da obra');
select is((select fora_do_prazo from public.contratacoes where id = (select id from ids where nome = 'com')), true, 'Pediu depois da data que deveria solicitar: fora do prazo');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000006aa', 'Outra', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos', null, (select id from public.planejamento_itens where descricao = 'Alvenaria de vedação')) $$, 'P0001', 'Item da planilha inválido, já usado em outra contratação ou já atendido.', 'O item da planilha não serve para duas contratações');
select lives_ok($$ insert into ids select 'sem', public.abrir_contratacao('00000000-0000-0000-0000-0000000006aa', 'Fora da planilha', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos') $$, 'Abre sem item da planilha');
select is((select negociacao_a_partir_de from public.contratacoes where id = (select id from ids where nome = 'sem')), (now() at time zone 'America/Sao_Paulo')::date + 4, 'Sem item: a negociação começa no ciclo do calendário');

-- Fluxo grava a data real de compras e o Sienge
reset role;
update public.contratacoes set sienge_solicitacao = '12345' where id = (select id from ids where nome = 'com');
select is((select sienge_solicitacao from public.planejamento_itens where descricao = 'Alvenaria de vedação'), '12345', 'O nº da solicitação no Sienge vai para a planilha');
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa = 5 and contratacao_id = (select id from ids where nome = 'com');
select is((select data_real_compras from public.planejamento_itens where descricao = 'Alvenaria de vedação'), (now() at time zone 'America/Sao_Paulo')::date, 'A autorização do gerente grava a data real de compras');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006f2", "role": "authenticated", "aal": "aal1"}', true);
select is((select obra_atrasada::int from public.indicadores_planejamento(2026, 4) where obra_id = '00000000-0000-0000-0000-0000000006aa'), 1, 'Indicador: a obra pediu depois do prazo (abril)');

-- "ok" na planilha = feito sem data (conta como feito); "NA" = não se aplica (fora da conta); "_" = pendente
select is(public.importar_planejamento('00000000-0000-0000-0000-0000000006aa', 'MAT', jsonb_build_array(
  jsonb_build_object('descricao', 'Aço (ok sem data)', 'id_pacote', 'P1', 'prazo_compras_dias', 30, 'prazo_chegada_dias', 30, 'situacao_obra', 'feito_sem_data', 'situacao_compras', 'feito_sem_data'),
  jsonb_build_object('descricao', 'Item que não se aplica', 'id_pacote', 'P1', 'prazo_compras_dias', 30, 'prazo_chegada_dias', 30, 'situacao_obra', 'nao_se_aplica', 'situacao_compras', 'nao_se_aplica'),
  jsonb_build_object('descricao', 'Concreto pendente', 'id_pacote', 'P1', 'prazo_compras_dias', 30, 'prazo_chegada_dias', 30)
)), 3, 'Importa as situações da planilha (feito sem data, não se aplica, pendente)');
select is((select obra_no_prazo || '/' || obra_atrasada || '/' || previstos_obra from public.indicadores_planejamento(2026, 4) where obra_id = '00000000-0000-0000-0000-0000000006aa'), '1/2/3',
  'Indicador: feito sem data conta como no prazo, não se aplica fica fora, pendente passado conta como atrasado');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000006c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000006aa', 'Já atendido', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos', null, (select id from public.planejamento_itens where descricao = 'Aço (ok sem data)')) $$,
  'P0001', 'Item da planilha inválido, já usado em outra contratação ou já atendido.', 'Item que a planilha já marca como feito não abre contratação');

select * from finish();
rollback;
