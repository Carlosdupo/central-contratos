-- Com envio aberto, documentos novos entram nele (não dá mais "Já existe um envio em análise").
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.documentos (id, tipo_documento, empresa_id, situacao, competencia) values
  ('00000000-0000-0000-0000-0000000000d1', 'fgts_guia', '00000000-0000-0000-0000-00000000aaaa', 'anexado', '2026-10-01');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);

create temp table primeiro as select public.enviar_documentos_empresa('00000000-0000-0000-0000-00000000aaaa') as envio;
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'enviado', 'primeiro envio: guia enviada');

reset role;
insert into public.documentos (id, tipo_documento, empresa_id, situacao, competencia) values
  ('00000000-0000-0000-0000-0000000000d2', 'fgts_comprovante', '00000000-0000-0000-0000-00000000aaaa', 'anexado', '2026-10-01');
set local role authenticated;

select lives_ok(
  $$ select public.enviar_documentos_empresa('00000000-0000-0000-0000-00000000aaaa') $$,
  'segundo envio com o primeiro ainda aberto não dá erro'
);
select is((select count(*)::int from public.envios_analise where empresa_id = '00000000-0000-0000-0000-00000000aaaa'), 1, 'continua um envio só');
select is((select count(*)::int from public.envio_itens where envio_id = (select envio from primeiro)), 2, 'o comprovante entrou no envio aberto');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d2'), 'enviado', 'comprovante enviado');
select throws_ok(
  $$ select public.enviar_documentos_empresa('00000000-0000-0000-0000-00000000aaaa') $$,
  'P0001', 'Não há documentos novos para enviar.', 'sem documento novo continua recusando'
);

select * from finish();
rollback;
