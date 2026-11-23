-- RH-2: RH e Segurança analisam o mesmo envio, cada um os seus documentos; avisos no sino.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'sst@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f4', 'sst');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-T9', 'Obra T9', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.pessoas (id, cpf, nome) values ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Pessoa Teste');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro');
insert into public.alocacoes (vinculo_id, obra_id, situacao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'em_analise');
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'aso', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado'),
  ('00000000-0000-0000-0000-0000000000d2', 'rg_cnh', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado');
insert into public.envios_analise (id, empresa_id, vinculo_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1');
insert into public.envio_itens (id, envio_id, documento_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2');

select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f3' and tipo = 'analise'), 1, 'RH recebe aviso do envio novo');
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f4' and tipo = 'analise'), 1, 'Segurança recebe aviso do envio novo');
select ok((select count(*) > 0 from public.notificacoes where destinatario = 'sst@teste.local'), 'Chegada de documentos vai também por e-mail');

-- Com autenticador configurado, a verificação em duas etapas continua obrigatória.
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f4', 'totp', 'verified', now(), now());
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, '42501', null, 'RH não decide o ASO (é da Segurança)');
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000012', 'aprovado') $$, 'RH aprova o RG');

reset role;
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f4' and titulo like 'RH terminou%'), 1, 'Segurança é avisada que o RH terminou a parte dele');
set local role authenticated;

select throws_ok($$ select public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'a', 'b') $$, 'P0001', null, 'Não conclui com o item da Segurança sem decisão');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, '42501', null, 'Segurança sem verificação em duas etapas não decide');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000012', 'reprovado', 'teste') $$, '42501', null, 'Segurança não decide o RG (é do RH)');
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, 'Segurança aprova o ASO');
select is(
  (select public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'Assunto', 'Texto')),
  'pessoa_integracao', 'Segurança conclui: pessoa vai para a integração');

reset role;
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f3' and titulo like 'Segurança terminou%'), 0, 'Quem termina por último não gera aviso de "terminou"');
update public.envio_itens set decisao = null where id = '00000000-0000-0000-0000-000000000012';
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f3' and tipo = 'analise' and titulo like 'Documentos para analisar%'), 2, 'Documento trocado (volta sem decisão) avisa de novo');

select * from finish();
rollback;
