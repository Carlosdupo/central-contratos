-- Testes da RLS e das regras do banco da F0. Rodar com: npx supabase test db
begin;
create extension if not exists pgtap with schema extensions;
select plan(15);

-- Usuários de teste (o trigger cria as linhas em public.usuarios)
insert into auth.users (id, email, raw_app_meta_data, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin@teste.local', '{"tipo": "interno"}', '{"nome": "Admin Teste"}'),
  ('00000000-0000-0000-0000-0000000000c1', 'coord@teste.local', '{}', '{}'),
  ('00000000-0000-0000-0000-0000000000e1', 'empresa@teste.local', '{"tipo": "externo"}', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000a1', 'admin'),
  ('00000000-0000-0000-0000-0000000000c1', 'coordenador_obra');
insert into public.obras (codigo, nome, cidade, uf) values ('IPE-TESTE', 'Residencial Ipê', 'Chapecó', 'SC');
-- Teste independente do ambiente: num banco com dados, outros admins e obras já existem.
-- Tudo isto é desfeito pelo rollback no fim.
delete from public.usuario_papeis where papel = 'admin' and usuario_id <> '00000000-0000-0000-0000-0000000000a1';
delete from public.usuario_obras;

select is(
  (select count(*)::int from pg_tables where schemaname = 'public' and not rowsecurity), 0,
  'Toda tabela do schema public tem RLS ativa');
select is(
  (select tipo::text from public.usuarios where id = '00000000-0000-0000-0000-0000000000e1'), 'externo',
  'O trigger cria o usuário com o tipo vindo de app_metadata');
select is(
  (select nome from public.usuarios where id = '00000000-0000-0000-0000-0000000000c1'), 'coord',
  'Sem nome informado, usa a parte do e-mail antes do @');

-- Coordenador de obra ------------------------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c1", "role": "authenticated", "aal": "aal1"}', true);

select ok((select count(*)::int from public.obras where codigo = 'IPE-TESTE') = 1, 'Coordenador vê as obras');
select throws_ok(
  $$ insert into public.obras (codigo, nome, cidade, uf) values ('X', 'Obra X', 'Chapecó', 'SC') $$,
  '42501', null, 'Coordenador não cria obra');
select throws_ok(
  $$ insert into public.usuario_papeis (usuario_id, papel) values ('00000000-0000-0000-0000-0000000000c1', 'admin') $$,
  '42501', null, 'Coordenador não se dá papel de admin');
select is((select count(*)::int from public.usuario_papeis), 1, 'Coordenador vê só os próprios papéis');
select is((select count(*)::int from public.auditoria), 0, 'Coordenador não lê a auditoria');

-- Empresa terceirizada (usuário externo) -------------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.obras), 0, 'Usuário externo não vê obras');
select is((select count(*)::int from public.usuarios), 1, 'Usuário externo vê só a si mesmo');

-- Admin sem e com verificação em duas etapas ------------------------------
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$ insert into public.obras (codigo, nome, cidade, uf) values ('X', 'Obra X', 'Chapecó', 'SC') $$,
  '42501', null, 'Admin sem verificação em duas etapas não cria obra');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a1", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok(
  $$ insert into public.obras (codigo, nome, cidade, uf) values ('AUR-TESTE', 'Edifício Aurora', 'Chapecó', 'SC') $$,
  'Admin com verificação em duas etapas cria obra');
select throws_ok(
  $$ delete from public.usuario_papeis where usuario_id = '00000000-0000-0000-0000-0000000000a1' and papel = 'admin' $$,
  'P0001', null, 'Não dá para remover o último administrador');
select throws_ok(
  $$ delete from public.auditoria $$,
  '42501', null, 'Ninguém apaga a auditoria, nem o admin');

reset role;
select ok(
  (select count(*) from public.auditoria where tabela = 'obras' and registro_id is not null and acao = 'INSERT') >= 2,
  'Inclusões de obra ficam na auditoria');

select * from finish();
rollback;
