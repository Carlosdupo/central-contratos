-- migration: 20261115113848_fase_1a_ajustes_rapidos.sql
-- Fase 1A: cancelar (admin e coordenador da obra), código do Sienge, contrato original no aditivo, botão único da etapa 6.
begin;
create extension if not exists pgtap with schema extensions;
select plan(25);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000001a1', 'adm1a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000001c1', 'coorda1a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000001c2', 'coordb1a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000001e1', 'contratos1a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000001f1', 'suprimentos1a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000001f2', 'gerente1a@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000001a1', 'admin'),
  ('00000000-0000-0000-0000-0000000001c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000001c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000001e1', 'contratos'),
  ('00000000-0000-0000-0000-0000000001f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000001f2', 'gerente_suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf, prefixo_sienge) values
  ('00000000-0000-0000-0000-0000000001aa', 'OBR-1A', 'Obra 1A (com prefixo)', 'Chapecó', 'SC', 'CT/BL'),
  ('00000000-0000-0000-0000-0000000001bb', 'OBR-1B', 'Obra 1B (sem prefixo)', 'Chapecó', 'SC', null);
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-0000000001c1', '00000000-0000-0000-0000-0000000001aa'),
  ('00000000-0000-0000-0000-0000000001c2', '00000000-0000-0000-0000-0000000001bb');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Coordenador da obra A abre as contratações da obra A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c1", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'c1', public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Cancelar pelo coordenador', null, null, 'unico', 'obra');
insert into ids select 'c2', public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Cancelar pelo admin', null, null, 'unico', 'obra');
insert into ids select 'e7a', public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Etapa 7 com prefixo', null, null, 'unico', 'obra');
insert into ids select 'g1', public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Gerente autoriza', null, null, 'unico', 'obra');
insert into ids select 'g2', public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Gerente com dados faltando', null, null, 'unico', 'obra');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c2", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'e7b', public.abrir_contratacao('00000000-0000-0000-0000-0000000001bb', 'Etapa 7 sem prefixo', null, null, 'unico', 'obra');

-- Cancelar
select throws_ok(format($$ select public.cancelar_contratacao(%L, 'Motivo de teste') $$, (select id from ids where nome = 'c1')),
  '42501', null, 'Coordenador de outra obra não cancela');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.cancelar_contratacao(%L, 'abc') $$, (select id from ids where nome = 'c1')),
  'P0001', 'Escreva o motivo do cancelamento.', 'Motivo curto é recusado');
select lives_ok(format($$ select public.cancelar_contratacao(%L, 'Obra mudou o escopo') $$, (select id from ids where nome = 'c1')), 'Coordenador da própria obra cancela');
select is((select situacao::text from public.contratacoes where id = (select id from ids where nome = 'c1')), 'cancelada', 'Contratação ficou cancelada');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001a1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.cancelar_contratacao(%L, 'Motivo de teste') $$, (select id from ids where nome = 'c2')),
  '42501', null, 'Administrador sem verificação em duas etapas não cancela');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001a1", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok(format($$ select public.cancelar_contratacao(%L, 'Cancelado pela direção') $$, (select id from ids where nome = 'c2')), 'Administrador verificado cancela');

-- Aditivo exige o contrato original (e no formato do prefixo da obra)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Aditivo', null, null, 'aditivo', 'obra') $$,
  'P0001', 'Informe o nº do contrato original no Sienge.', 'Aditivo sem contrato original é recusado');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Aditivo', null, null, 'aditivo', 'obra', 'CT/BL83') $$,
  'P0001', null, 'Contrato original com 2 números é recusado (obra com prefixo)');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Aditivo', null, null, 'aditivo', 'obra', 'XX/BL0083') $$,
  'P0001', null, 'Contrato original com outro prefixo é recusado');
select lives_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000001aa', 'Aditivo bom', null, null, 'aditivo', 'obra', 'CT/BL0083') $$, 'Aditivo com CT/BL0083 abre');
select is((select contrato_original from public.contratacoes where servico = 'Aditivo bom'), 'CT/BL0083', 'Contrato original gravado');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000001bb', 'Aditivo livre', null, null, 'aditivo', 'obra', 'QUALQUER-1') $$, 'Obra sem prefixo aceita o contrato original como vier');

-- Código do contrato na etapa 7
reset role;
update public.contratacao_etapas set situacao = 'em_andamento' where etapa = 7 and contratacao_id in (select id from ids where nome in ('e7a', 'e7b'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001e1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.salvar_campo_etapa(%L, 7::smallint, 'CT/BL83') $$, (select id from ids where nome = 'e7a')),
  'P0001', null, 'Obra com prefixo: código com 2 números é recusado');
select throws_ok(format($$ select public.salvar_campo_etapa(%L, 7::smallint, 'CT/BL00831') $$, (select id from ids where nome = 'e7a')),
  'P0001', null, 'Obra com prefixo: código com 5 números é recusado');
select lives_ok(format($$ select public.salvar_campo_etapa(%L, 7::smallint, 'CT/BL0083') $$, (select id from ids where nome = 'e7a')), 'Obra com prefixo: CT/BL0083 é aceito');
select is((select sienge_contrato from public.contratacoes where id = (select id from ids where nome = 'e7a')), 'CT/BL0083', 'Código gravado');
select lives_ok(format($$ select public.salvar_campo_etapa(%L, 7::smallint, 'QUALQUER-77') $$, (select id from ids where nome = 'e7b')), 'Obra sem prefixo aceita como hoje');

-- Botão único da etapa 6
reset role;
update public.contratacao_etapas set situacao = 'em_andamento' where etapa = 6 and contratacao_id in (select id from ids where nome in ('g1', 'g2'));
update public.contratacoes set fornecedor_nome = 'Fornecedor 1A', fornecedor_cnpj = '11222333000181', fornecedor_email = 'forn1a@teste.local', valor_negociado = 1000
where id in (select id from ids where nome in ('g1', 'g2'));
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'g1')),
  '42501', null, 'Suprimentos que não é gerente não autoriza');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'g1')),
  '42501', null, 'Coordenador não autoriza');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000001f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.autorizar_contratacao(%L, true, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'g2')),
  'P0001', null, 'Condições incompletas (permuta sem valor) são recusadas');
select is((select permuta from public.contratacoes where id = (select id from ids where nome = 'g2')), null, 'Recusada: nada ficou gravado');
select lives_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, true, 500, 10, false, null, '5') $$, (select id from ids where nome = 'g1')), 'Gerente autoriza com um botão só');
select is((select fat_direto_valor from public.contratacoes where id = (select id from ids where nome = 'g1')), 500.00, 'Condições gravadas junto');
select is((select situacao::text from public.contratacao_etapas where etapa = 6 and contratacao_id = (select id from ids where nome = 'g1')), 'concluida', 'Etapa 6 concluída na mesma ação');

select ok(not has_function_privilege('authenticated', 'app.ligar_fornecedor(uuid)', 'execute'), 'authenticated não executa app.ligar_fornecedor (continua fechada)');

select * from finish();
rollback;
