-- Solicitação para o Sienge: a obra (coordenador e auxiliar) cria e edita; outras áreas só leem; outra obra não mexe.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-00000000b5c1', 'coordsie@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000b5c2', 'auxsie@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000b5c3', 'outrasie@teste.local', '{}'),
  ('00000000-0000-0000-0000-00000000b5c4', 'supsie@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-00000000b5c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000b5c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000b5c3', 'coordenador_obra'),
  ('00000000-0000-0000-0000-00000000b5c4', 'suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000b5aa', 'OBR-SA', 'Obra SA', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000b5bb', 'OBR-SB', 'Obra SB', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id, nivel) values
  ('00000000-0000-0000-0000-00000000b5c1', '00000000-0000-0000-0000-00000000b5aa', 'coordenador'),
  ('00000000-0000-0000-0000-00000000b5c2', '00000000-0000-0000-0000-00000000b5aa', 'auxiliar'),
  ('00000000-0000-0000-0000-00000000b5c3', '00000000-0000-0000-0000-00000000b5bb', 'coordenador');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b5c2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ with s as (insert into public.solicitacoes_sienge (obra_id, titulo, unidade_construtiva, conta_financeira) values ('00000000-0000-0000-0000-00000000b5aa', 'BL0087', '5', '2.01.02.01.03') returning id) insert into ids select 's1', id from s $$, 'Auxiliar cria a solicitação da obra dele');
select is((select criado_por from public.solicitacoes_sienge where id = (select id from ids where nome = 's1')), '00000000-0000-0000-0000-00000000b5c2'::uuid, 'Autor gravado pelo banco');
select throws_ok($$ insert into public.solicitacoes_sienge (obra_id, titulo) values ('00000000-0000-0000-0000-00000000b5bb', 'Outra') $$, '42501', null, 'Não cria em obra que não é dele');
select throws_ok($$ update public.solicitacoes_sienge set itens = '{}'::jsonb where id = (select id from ids where nome = 's1') $$, '23514', null, 'Itens precisam ser uma lista');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b5c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ update public.solicitacoes_sienge set itens = '[{"id":"a","referencia":"23.005","descricao":"X"}]'::jsonb where id = (select id from ids where nome = 's1') $$, 'Coordenador da obra edita');
select is((select atualizado_por from public.solicitacoes_sienge where id = (select id from ids where nome = 's1')), '00000000-0000-0000-0000-00000000b5c1'::uuid, 'Quem alterou por último fica gravado');
select throws_ok($$ update public.solicitacoes_sienge set obra_id = '00000000-0000-0000-0000-00000000b5bb' where id = (select id from ids where nome = 's1') $$, '42501', null, 'Não troca a obra');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b5c3", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.solicitacoes_sienge where id = (select id from ids where nome = 's1')), 0, 'Coordenador de outra obra não vê');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b5c4", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.solicitacoes_sienge where id = (select id from ids where nome = 's1')), 1, 'Suprimentos vê');
update public.solicitacoes_sienge set titulo = 'Mudou' where id = (select id from ids where nome = 's1');
select is((select titulo from public.solicitacoes_sienge where id = (select id from ids where nome = 's1')), 'BL0087', 'Suprimentos não altera');

select * from finish();
rollback;
