-- Liberar obra para a empresa sem contratação: RH e Suprimentos podem; coordenador e empresa não.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'supr@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000000b', 'OBR-LB', 'Obra LB', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000000c', 'OBR-LC', 'Obra LC', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.empresa_obras (empresa_id, obra_id, ativo) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000c', false);

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$ select public.liberar_obra_empresa('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'a própria empresa não libera obra'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$ select public.liberar_obra_empresa('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'coordenador de obra não libera obra'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok(
  $$ select public.liberar_obra_empresa('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b') $$,
  'RH libera obra sem contratação'
);
select is(
  (select ativo from public.empresa_obras where empresa_id = '00000000-0000-0000-0000-00000000aaaa' and obra_id = '00000000-0000-0000-0000-00000000000b'),
  true, 'empresa fica ligada à obra'
);

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(
  $$ select public.liberar_obra_empresa('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000c') $$,
  'Suprimentos reativa uma obra que estava desligada'
);
select is(
  (select ativo from public.empresa_obras where empresa_id = '00000000-0000-0000-0000-00000000aaaa' and obra_id = '00000000-0000-0000-0000-00000000000c'),
  true, 'ligação desativada volta a valer'
);

select * from finish();
rollback;
