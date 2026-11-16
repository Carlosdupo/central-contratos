-- migration: 20261116140000_escopo_por_pacote.sql
-- Fase 1B: matriz de contratação e abertura pela atividade da matriz.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000002c1', 'coorda1b@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000002c2', 'coordb1b@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000002c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000002c2', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000002aa', 'OBR-2A', 'Obra 2A', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000002bb', 'OBR-2B', 'Obra 2B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-0000000002c1', '00000000-0000-0000-0000-0000000002aa'),
  ('00000000-0000-0000-0000-0000000002c2', '00000000-0000-0000-0000-0000000002bb');
-- A obra 2A tem EAP importada: a abertura não depende mais dela.
insert into public.obra_eap (obra_id, referencia, descricao, nivel, ordem) values
  ('00000000-0000-0000-0000-0000000002aa', '1', 'Fundação', 1, 1);
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000002c1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.matriz_contratacao), 344, 'Usuário interno lê a matriz inteira (344 atividades)');
select throws_ok($$ insert into public.matriz_contratacao (ordem, grupo_codigo, grupo, subgrupo_codigo, subgrupo, atividade, forma_legal) values (9999, '9', 'g', '9.1', 's', 'a', 'Contrato') $$,
  '42501', null, 'Ninguém altera a matriz pela tela');

insert into ids select 'ped', id from public.matriz_contratacao where forma_legal = 'Pedido' order by ordem limit 1;
insert into ids select 'ctt', id from public.matriz_contratacao where forma_legal = 'Contrato + Edital' order by ordem limit 1;

select lives_ok(format($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Pedido de teste', array[%L::uuid], null, 3000, false, 'obra') $$, (select id from ids where nome = 'ped')),
  'Abre pela atividade da matriz, sem escolher item da EAP (mesmo a obra tendo EAP)');
select is((select forma_legal from public.contratacoes where servico = 'Pedido de teste'), 'Pedido', 'A forma legal da atividade é gravada na contratação');
select is((select matriz_id from public.contratacoes where servico = 'Pedido de teste'), (select id from ids where nome = 'ped'), 'A atividade da matriz fica ligada à contratação');
select is((select tipo::text from public.contratacoes where servico = 'Pedido de teste'), 'contrato', 'Sem marcar aditivo, o tipo é contrato');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Sem atividade', null::uuid[], null, 3000, false, 'obra') $$,
  'P0001', 'Escolha pelo menos uma atividade da matriz.', 'Sem atividade da matriz não abre');
select throws_ok(format($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Grande pela obra', array[%L::uuid], null, 50000, false, 'obra') $$, (select id from ids where nome = 'ctt')),
  'P0001', 'A partir de R$ 4.000 do orçamento, a negociação é de Suprimentos.', 'Regra dos R$ 4.000 continua');
select throws_ok(format($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Aditivo sem número', array[%L::uuid], null, 3000, true, 'obra') $$, (select id from ids where nome = 'ctt')),
  'P0001', 'Informe o nº do contrato original no Sienge.', 'Aditivo continua exigindo o contrato original');
select lives_ok(format($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Aditivo bom', array[%L::uuid], null, 3000, true, 'suprimentos', 'CT/BL0083') $$, (select id from ids where nome = 'ctt')),
  'Aditivo com contrato original abre');
select is((select tipo::text from public.contratacoes where servico = 'Aditivo bom'), 'aditivo', 'Marcar aditivo grava o tipo aditivo');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000002c2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000002aa', 'Outra obra', array[%L::uuid], null, 3000, false, 'obra') $$, (select id from ids where nome = 'ped')),
  '42501', null, 'Coordenador de outra obra não abre');

select * from finish();
rollback;
