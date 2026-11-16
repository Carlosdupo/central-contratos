-- A empresa lê o nome das obras liberadas para ela, e só essas.
begin;
create extension if not exists pgtap with schema extensions;
select plan(4);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000000b', 'OBR-LB', 'Obra Liberada', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000000c', 'OBR-LC', 'Obra de Outra', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000000d', 'OBR-LD', 'Obra Desligada', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.empresa_obras (empresa_id, obra_id, ativo) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b', true),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000d', false);

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);

select is((select nome from public.obras where id = '00000000-0000-0000-0000-00000000000b'), 'Obra Liberada', 'empresa lê a obra liberada');
select is((select count(*)::int from public.obras where id = '00000000-0000-0000-0000-00000000000c'), 0, 'empresa não lê obra que não é dela');
select is((select count(*)::int from public.obras where id = '00000000-0000-0000-0000-00000000000d'), 0, 'empresa não lê obra desligada');
select is(
  (select o.nome from public.empresa_obras eo join public.obras o on o.id = eo.obra_id
   where eo.empresa_id = '00000000-0000-0000-0000-00000000aaaa' and eo.ativo),
  'Obra Liberada', 'a lista do portal traz o nome da obra'
);

select * from finish();
rollback;
