-- Autorização das funções (RPCs) do schema public: visitante nunca executa; usuário de uma empresa
-- terceirizada não consegue chamar as de uso interno nem mexer em outra empresa.
-- Cobre as funções que ainda não tinham nenhum teste de negação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

select is(
  (select count(*)::int from pg_proc p join pg_namespace n on n.oid = p.pronamespace
   where n.nspname = 'public' and p.prosecdef and has_function_privilege('anon', p.oid, 'execute')),
  0, 'Nenhuma função security definer do schema public é executável pelo visitante (anon)');

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local');
insert into public.empresa_usuarios (usuario_id, empresa_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);

select throws_ok($$ select public.cancelar_contratacao('00000000-0000-0000-0000-000000000001', 'motivo qualquer') $$, null, null, 'Empresa terceirizada não cancela contratação');
select throws_ok($$ select public.reabrir_etapa('00000000-0000-0000-0000-000000000001', 3::smallint, 'motivo qualquer') $$, null, null, 'Empresa terceirizada não reabre etapa');
select throws_ok($$ select public.pular_negociacao('00000000-0000-0000-0000-000000000001') $$, null, null, 'Empresa terceirizada não pula negociação');
select throws_ok($$ select public.salvar_campo_etapa('00000000-0000-0000-0000-000000000001', 4::smallint, '123') $$, null, null, 'Empresa terceirizada não grava campo de etapa');
select throws_ok($$ select public.importar_eap('00000000-0000-0000-0000-000000000001', '[]'::jsonb) $$, null, null, 'Empresa terceirizada não importa EAP');
select throws_ok($$ select public.decidir_visita('00000000-0000-0000-0000-000000000001', true, '', 'a', 'b') $$, null, null, 'Empresa terceirizada não decide visita');
select throws_ok($$ select public.enviar_documentos_empresa('00000000-0000-0000-0000-00000000bbbb') $$, '42501', null, 'Empresa A não envia documentos em nome da empresa B');
select throws_ok($$ select public.salvar_texto_empresa('00000000-0000-0000-0000-00000000bbbb', 'contabilidade', 'Fulano 49 99999-9999') $$, '42501', null, 'Empresa A não grava texto na empresa B');
select throws_ok($$ select public.registrar_primeiro_acesso('00000000-0000-0000-0000-00000000bbbb') $$, '42501', null, 'Empresa A não registra o primeiro acesso da empresa B');
select throws_ok($$ select public.registrar_foto_pessoa('00000000-0000-0000-0000-000000000001', 'empresas/x') $$, null, null, 'Foto de vínculo que não é da empresa é recusada');

select * from finish();
rollback;
