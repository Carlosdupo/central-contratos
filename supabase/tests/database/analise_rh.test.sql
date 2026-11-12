-- F3: análise do RH, conclusão, integração automática e avisos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-T3', 'Obra T3', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'em_analise'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');
insert into public.pessoas (id, cpf, nome) values ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Pessoa Teste');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro');
insert into public.alocacoes (vinculo_id, obra_id, situacao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'em_analise');
-- Envio da pessoa (2 documentos) e envio da empresa (1 documento)
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'aso', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado'),
  ('00000000-0000-0000-0000-0000000000d2', 'nr18', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado'),
  ('00000000-0000-0000-0000-0000000000d3', 'pgr', '00000000-0000-0000-0000-00000000aaaa', null, 'enviado');
insert into public.envios_analise (id, empresa_id, vinculo_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1'),
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000aaaa', null, '00000000-0000-0000-0000-0000000000e1');
insert into public.envio_itens (id, envio_id, documento_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2'),
  ('00000000-0000-0000-0000-000000000013', '00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-0000000000d3');

set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, '42501', null, 'Coordenador não analisa documentos');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, '42501', null, 'RH sem verificação em duas etapas não analisa');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'reprovado', '') $$, 'P0001', null, 'Reprovar exige motivo');
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'aprovado') $$, 'RH aprova o ASO');
select throws_ok($$ select public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'a', 'b') $$, 'P0001', null, 'Não conclui com documento sem decisão');
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000012', 'aprovado') $$, 'RH aprova a NR-18');
select is(
  (select public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'Assunto', 'Texto')),
  'pessoa_aguardando_empresa', 'Pessoa aprovada com a empresa ainda em análise fica aguardando a empresa');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'aprovado', 'Documento recebe a decisão');

select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000013', 'aprovado') $$, 'RH aprova o PGR da empresa');
select is(
  (select public.concluir_envio('00000000-0000-0000-0000-0000000000b2', (now() at time zone 'America/Sao_Paulo')::date + 2, 'Assunto', 'Texto')),
  'empresa_aprovada', 'Empresa aprovada');
select is(
  (select situacao::text || ' ' || (integracao_data = (now() at time zone 'America/Sao_Paulo')::date + 2)::text from public.alocacoes where vinculo_id = '00000000-0000-0000-0000-0000000000a1'),
  'integracao_agendada true', 'Quem aguardava a empresa entra na integração na data calculada');

-- Avisos: cada empresa vê só os seus
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.notificacoes), 2, 'Empresa A vê os dois avisos dela');
select throws_ok($$ insert into public.notificacoes (destinatario, assunto, texto) values ('x@teste.local', 'x', 'x') $$, '42501', null, 'Ninguém cria aviso direto na tabela');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.notificacoes), 0, 'Empresa B não vê avisos da A');

select * from finish();
rollback;
