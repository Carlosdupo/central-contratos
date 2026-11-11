-- F6: fluxo de contratação (12 etapas, regra dos R$ 4.000, pular, assinaturas em ordem, visibilidade A8).
begin;
create extension if not exists pgtap with schema extensions;
select plan(23);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000c01', 'coord@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000c02', 'coord2@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000501', 'supr@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000601', 'gerente@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000701', 'contratos@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000d01', 'direcao@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000801', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000901', 'sst@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-000000000c01', 'coordenador_obra'), ('00000000-0000-0000-0000-000000000c02', 'coordenador_obra'),
  ('00000000-0000-0000-0000-000000000501', 'suprimentos'), ('00000000-0000-0000-0000-000000000601', 'gerente_suprimentos'),
  ('00000000-0000-0000-0000-000000000701', 'contratos'), ('00000000-0000-0000-0000-000000000d01', 'direcao'),
  ('00000000-0000-0000-0000-000000000801', 'rh'), ('00000000-0000-0000-0000-000000000901', 'sst');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000000b', 'OBR-T6', 'Obra T6', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000000c', 'OBR-T6B', 'Obra T6B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-000000000c01', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-000000000c02', '00000000-0000-0000-0000-00000000000c');
update public.parametros set valor = '4000' where chave = 'limite_escolha_obra_reais';
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Abertura
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000c02", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-00000000000b', 'Alvenaria', null, 100000, 'contrato') $$, '42501', null, 'Coordenador de outra obra não abre contratação aqui');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000c01", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'grande', public.abrir_contratacao('00000000-0000-0000-0000-00000000000b', 'Alvenaria de vedação', 'Alvenaria', 100000, 'contrato');
insert into ids select 'pequena', public.abrir_contratacao('00000000-0000-0000-0000-00000000000b', 'Soleiras', null, 3200, 'unico');
select ok((select codigo from public.contratacoes where id = (select id from ids where nome = 'grande')) ~ '^CT-\d{4}-\d{3,}$', 'Código no formato CT-AAAA-NNN');
select is((select situacao::text from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'grande') and etapa = 1), 'em_andamento', 'Etapa 1 começa ao abrir');
select throws_ok(format($$ select public.concluir_etapa(%L, 1::smallint) $$, (select id from ids where nome = 'grande')), 'P0001', null, 'Não conclui com item desmarcado');
select lives_ok(format($$ select public.marcar_item(%L, 1::smallint, 1::smallint, true) $$, (select id from ids where nome = 'grande')), 'Coordenador marca o item');
select lives_ok(format($$ select public.concluir_etapa(%L, 1::smallint) $$, (select id from ids where nome = 'grande')), 'Coordenador conclui a etapa 1');

-- Cotações
select lives_ok(format($$ select public.registrar_cotacao(%L, 'Fornecedor A', '11222333000181', 97000, 45) $$, (select id from ids where nome = 'grande')), 'Registra cotação 1');
select lives_ok(format($$ select public.registrar_cotacao(%L, 'Fornecedor B', '11444777000161', 104000, 40) $$, (select id from ids where nome = 'grande')), 'Registra cotação 2');
select throws_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'grande')), 'P0001', null, 'Etapa 2 exige 3 cotações');
select lives_ok(format($$ select public.registrar_cotacao(%L, 'Fornecedor C', '11222333000262', 109000, 50) $$, (select id from ids where nome = 'grande')), 'Registra cotação 3');
select lives_ok(format($$ select public.marcar_item(%L, 2::smallint, i::smallint, true) from generate_series(1, 2) i $$, (select id from ids where nome = 'grande')), 'Marca itens da etapa 2');
select lives_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'grande')), 'Conclui a etapa 2');

-- Regra dos R$ 4.000: acima do limite, a obra não escolhe; pode pular a negociação
select throws_ok(format($$ select public.escolher_fornecedor(id) from public.cotacoes where contratacao_id = %L and fornecedor = 'Fornecedor A' $$, (select id from ids where nome = 'grande')),
  'P0001', 'A partir de R$ 4.000, quem escolhe o fornecedor é Suprimentos, na etapa 5.', 'Acima de R$ 4.000 a obra não escolhe o fornecedor');
select lives_ok(format($$ select public.pular_negociacao(%L) $$, (select id from ids where nome = 'grande')), 'Obra pula a negociação');
select is((select situacao::text from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'grande') and etapa = 4), 'em_andamento', 'Depois de pular, começa a etapa 4');

-- Contratação pequena: a obra escolhe
select lives_ok(format($$ select public.marcar_item(%L, 1::smallint, 1::smallint, true) $$, (select id from ids where nome = 'pequena')), 'Marca item da pequena');

-- Visibilidade (A8)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000c02", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.contratacoes where id in (select id from ids)), 0, 'Coordenador de outra obra não vê as contratações (A8)');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000d01", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.contratacoes where id in (select id from ids)), 2, 'Direção vê todas');
select throws_ok(format($$ select public.concluir_etapa(%L, 4::smallint) $$, (select id from ids where nome = 'grande')), '42501', null, 'Direção não age em etapa da obra');

-- Assinaturas em ordem (pula direto para a etapa 9 como postgres)
reset role;
update public.contratacao_etapas set situacao = 'em_andamento' where contratacao_id = (select id from ids where nome = 'grande') and etapa = 9;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000501", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.assinar_contrato(%L, 2::smallint) $$, (select id from ids where nome = 'grande')), 'P0001', null, 'Suprimentos não assina antes do coordenador');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000c01", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.assinar_contrato(%L, 1::smallint) $$, (select id from ids where nome = 'grande')), 'Coordenador assina primeiro');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000501", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.assinar_contrato(%L, 2::smallint) $$, (select id from ids where nome = 'grande')), 'Suprimentos assina em segundo');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000801", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok(format($$ select public.assinar_contrato(%L, 5::smallint) $$, (select id from ids where nome = 'grande')), 'P0001', null, 'RH não assina fora da vez');

select * from finish();
rollback;
