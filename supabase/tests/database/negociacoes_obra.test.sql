-- Quadro de negociações da obra: a obra anota e move; outras áreas só leem; contratação aberta só pelo vínculo.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000a0c1', 'coordneg@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000a0c2', 'auxneg@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000a0c3', 'outraneg@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000a0c4', 'supneg@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-00000000a0c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000a0c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000a0c3', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000a0c4', 'suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000a0aa', 'OBR-NA', 'Obra NA', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000a0bb', 'OBR-NB', 'Obra NB', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id, nivel) values
  ('00000000-0000-0000-0000-00000000a0c1', '00000000-0000-0000-0000-00000000a0aa', 'coordenador'),
  ('00000000-0000-0000-0000-00000000a0c2', '00000000-0000-0000-0000-00000000a0aa', 'auxiliar'),
  ('00000000-0000-0000-0000-00000000a0c3', '00000000-0000-0000-0000-00000000a0bb', 'coordenador');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Auxiliar anota
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000a0c2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ with n as (insert into public.negociacoes (obra_id, titulo, tipo, valor_estimado) values ('00000000-0000-0000-0000-00000000a0aa', 'Impermeabilização', 'nova', 18500) returning id) insert into ids select 'n1', id from n $$, 'Auxiliar anota um item na obra dele');
select is((select criado_por from public.negociacoes where id = (select id from ids where nome = 'n1')), '00000000-0000-0000-0000-00000000a0c2'::uuid, 'Autor gravado pelo banco');
select is((select coluna from public.negociacoes where id = (select id from ids where nome = 'n1')), 'a_negociar', 'Começa em A negociar');
select throws_ok($$ insert into public.negociacoes (obra_id, titulo) values ('00000000-0000-0000-0000-00000000a0bb', 'Em outra obra') $$, '42501', null, 'Não anota em obra que não é dele');
select throws_ok($$ insert into public.negociacoes (obra_id, titulo, coluna) values ('00000000-0000-0000-0000-00000000a0aa', 'Direto', 'contratacao_aberta') $$, null, null, 'Não nasce como Contratação aberta');
select lives_ok($$ update public.negociacoes set coluna = 'falta_contrato', valor_negociado = 17000 where id = (select id from ids where nome = 'n1') $$, 'Move para Negociado, falta contrato');
select throws_ok($$ update public.negociacoes set coluna = 'contratacao_aberta' where id = (select id from ids where nome = 'n1') $$, 'P0001', 'Para virar contratação, abra a contratação pelo item.', 'Contratação aberta só com a contratação');
select throws_ok($$ update public.negociacoes set obra_id = '00000000-0000-0000-0000-00000000a0bb' where id = (select id from ids where nome = 'n1') $$, '42501', null, 'Não troca a obra do item');

-- Coordenador abre a contratação e liga ao item
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000a0c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'ct', public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-00000000a0aa', p_servico => 'Impermeabilização', p_atividades => array[]::uuid[], p_escopo => '', p_valor => 18500, p_aditivo => false, p_negociacao => 'suprimentos', p_fora_matriz => 'Impermeabilização das floreiras') $$, 'Abre a contratação');
select lives_ok($$ update public.negociacoes set contratacao_id = (select id from ids where nome = 'ct') where id = (select id from ids where nome = 'n1') $$, 'Liga a contratação ao item');
select is((select coluna from public.negociacoes where id = (select id from ids where nome = 'n1')), 'contratacao_aberta', 'Ligado à contratação, vai para Contratação aberta');
select throws_ok($$ update public.negociacoes set coluna = 'a_negociar' where id = (select id from ids where nome = 'n1') $$, 'P0001', 'O item já virou contratação.', 'Não volta depois de virar contratação');
select lives_ok($$ delete from public.negociacoes where id = (select id from ids where nome = 'n1') $$, 'Tentar apagar não dá erro');
select is((select count(*)::int from public.negociacoes where id = (select id from ids where nome = 'n1')), 1, 'Item que virou contratação não é apagado');

-- Outras áreas e outras obras
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000a0c4", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.negociacoes where obra_id = '00000000-0000-0000-0000-00000000a0aa'), 1, 'Suprimentos vê o quadro da obra');
select lives_ok($$ update public.negociacoes set titulo = 'Mexido' where obra_id = '00000000-0000-0000-0000-00000000a0aa' $$, 'Tentar alterar não dá erro');
select is((select count(*)::int from public.negociacoes where titulo = 'Mexido'), 0, 'Suprimentos não altera');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000a0c3", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.negociacoes where obra_id = '00000000-0000-0000-0000-00000000a0aa'), 0, 'Coordenador de outra obra não vê');

select * from finish();
rollback;
