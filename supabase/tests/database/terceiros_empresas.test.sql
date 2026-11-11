-- F1: isolamento entre empresas, permissões de arquivos (LGPD) e gravação só por RPC.
begin;
create extension if not exists pgtap with schema extensions;
select plan(16);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f1', 'supr@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');
-- Documento sensível (ASO, ainda sem pessoa) e um comum da empresa A
insert into public.documentos (id, tipo_documento, empresa_id, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'cnd_federal', '00000000-0000-0000-0000-00000000aaaa', 'enviado'),
  ('00000000-0000-0000-0000-0000000000d2', 'aso', '00000000-0000-0000-0000-00000000aaaa', 'enviado');
insert into public.documento_arquivos (id, documento_id, storage_path, nome_original, mime, tamanho, sha256, enviado_por) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000d1', 'empresas/teste/a1.pdf', 'cnd.pdf', 'application/pdf', 100, repeat('a', 64), '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000d2', 'empresas/teste/a2.pdf', 'aso.pdf', 'application/pdf', 100, repeat('b', 64), '00000000-0000-0000-0000-0000000000e1');

set local role authenticated;

-- Empresa B não enxerga a A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.empresas_terceiras), 1, 'Empresa B vê só a própria empresa');
select is((select count(*)::int from public.documentos), 0, 'Empresa B não vê documentos da A');
select is((select count(*)::int from public.documento_arquivos), 0, 'Empresa B não vê arquivos da A');
select throws_ok(
  $$ select public.registrar_acesso_arquivo('00000000-0000-0000-0000-0000000000a1') $$,
  '42501', null, 'Empresa B não abre arquivo da A');
select throws_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'cnd_federal', 'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/x.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64), null, '2099-01-01') $$,
  '42501', null, 'Empresa B não grava documento na A');
select throws_ok(
  $$ insert into public.documentos (tipo_documento, empresa_id) values ('pgr', '00000000-0000-0000-0000-00000000bbbb') $$,
  '42501', null, 'Ninguém grava documento direto na tabela (só por função)');

-- Empresa A
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.documento_arquivos), 2, 'Empresa A vê os próprios arquivos, inclusive o ASO');
select throws_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'pgr', 'empresas/outra/empresa/pgr/x.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64), null, '2099-01-01') $$,
  'P0001', null, 'Caminho do arquivo precisa ser da própria empresa e do tipo');
select lives_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'pgr', 'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/pgr/x.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64), null, '2099-01-01') $$,
  'Empresa A anexa o PGR');
select throws_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'ltcat', 'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/ltcat/x.pdf', 'x.pdf', 'application/pdf', 10, repeat('d', 64), null, '2000-01-01') $$,
  'P0001', null, 'Documento com validade vencida é recusado');

-- Equipe interna
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.documentos where empresa_id = '00000000-0000-0000-0000-00000000aaaa'), 3, 'Coordenador vê a situação dos documentos');
select is((select count(*)::int from public.documento_arquivos where documento_id in ('00000000-0000-0000-0000-0000000000d1', '00000000-0000-0000-0000-0000000000d2')), 0, 'Coordenador não abre arquivos');
select throws_ok(
  $$ insert into public.empresas_terceiras (cnpj, razao_social, email) values ('11222333000262', 'X', 'x@teste.local') $$,
  '42501', null, 'Coordenador não cadastra empresa');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.documento_arquivos where documento_id = '00000000-0000-0000-0000-0000000000d2'), 0, 'Suprimentos não abre ASO (dado de saúde)');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok($$ select public.registrar_acesso_arquivo('00000000-0000-0000-0000-0000000000a2') $$, 'RH com verificação em duas etapas abre o ASO');

reset role;
select is((select count(*)::int from public.acessos_documentos where arquivo_id = '00000000-0000-0000-0000-0000000000a2'), 1, 'A abertura do ASO fica registrada');

select * from finish();
rollback;
