-- migration: 20261118150000_download_foto.sql
-- Foto do funcionário para a catraca: só RH/SST baixam e cada download fica registrado.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada');
insert into public.pessoas (id, cpf, nome, foto_path) values
  ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Com Foto', 'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/00000000-0000-0000-0000-0000000000a1/foto/00000000-0000-0000-0000-0000000000f0.jpg'),
  ('00000000-0000-0000-0000-0000000000c2', '11144477735', 'Sem Foto', null);
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Servente');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.registrar_download_foto('00000000-0000-0000-0000-0000000000a1') $$, '42501', null, 'coordenador de obra não baixa a foto');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal1"}', true);
select is(public.registrar_download_foto('00000000-0000-0000-0000-0000000000a1'), 'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/00000000-0000-0000-0000-0000000000a1/foto/00000000-0000-0000-0000-0000000000f0.jpg', 'RH recebe o caminho da foto');
select throws_ok($$ select public.registrar_download_foto('00000000-0000-0000-0000-0000000000a2') $$, 'P0001', 'Esta pessoa ainda não tem foto.', 'sem foto, avisa');
select throws_ok($$ insert into public.downloads_fotos (pessoa_id) values ('00000000-0000-0000-0000-0000000000c1') $$, '42501', null, 'ninguém grava o registro direto');
reset role;
select is((select count(*)::int from public.downloads_fotos where pessoa_id = '00000000-0000-0000-0000-0000000000c1' and usuario_id = '00000000-0000-0000-0000-0000000000f3'), 1, 'o download fica registrado com quem baixou');

select * from finish();
rollback;
