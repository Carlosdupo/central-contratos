-- Documentos já aprovados: mesma empresa em outra obra aproveita o cadastro; outra empresa, RH/SST decidem caso a caso.
begin;
create extension if not exists pgtap with schema extensions;
select plan(17);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'sst@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f4', 'sst');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000000b', 'OBR-T1', 'Obra T1', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-00000000000c', 'OBR-T2', 'Obra T2', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');
insert into public.empresa_obras (empresa_id, obra_id) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000c'),
  ('00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-00000000000b');
insert into public.pessoas (id, cpf, nome) values
  ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Pessoa Teste'),
  ('00000000-0000-0000-0000-0000000000c2', '11144477735', 'Outra Pessoa');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Servente');
insert into public.alocacoes (vinculo_id, obra_id, situacao, liberado_em) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'liberado', now());
insert into public.alocacoes (vinculo_id, obra_id) values
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b');
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, situacao, data_validade) values
  ('00000000-0000-0000-0000-0000000000d1', 'aso', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'aprovado', current_date + 200),
  ('00000000-0000-0000-0000-0000000000d2', 'rg_cnh', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'aprovado', current_date + 900),
  ('00000000-0000-0000-0000-0000000000d3', 'nr35', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'aprovado', current_date + 300);

set local role authenticated;

-- Mesma empresa, outra obra
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}', true);
select is(
  public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '52998224725', 'Pessoa  teste', '', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000c'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'CPF que já é da empresa entra na obra nova com o mesmo cadastro');
select is((select situacao::text from public.alocacoes where vinculo_id = '00000000-0000-0000-0000-0000000000a1' and obra_id = '00000000-0000-0000-0000-00000000000c'),
  'rascunho', 'Obra nova começa em rascunho');
select throws_ok($$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '52998224725', 'Pessoa Teste', '', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000c') $$,
  'P0001', 'Esta pessoa já está nesta obra.', 'Não repete a mesma obra');
select lives_ok($$ select public.enviar_documentos_pessoa('00000000-0000-0000-0000-0000000000a1') $$, 'Tudo aprovado: envia sem arquivo novo para marcar a integração');
select is((select situacao::text from public.alocacoes where vinculo_id = '00000000-0000-0000-0000-0000000000a1' and obra_id = '00000000-0000-0000-0000-00000000000c'),
  'em_analise', 'Obra nova vai para a análise do RH');
select throws_ok($$ select public.enviar_documentos_pessoa('00000000-0000-0000-0000-0000000000a2') $$,
  'P0001', 'Não há documentos novos para enviar.', 'Quem nunca foi liberado não envia sem documento');

-- Outra empresa
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}', true);
select isnt(
  public.cadastrar_pessoa('00000000-0000-0000-0000-00000000bbbb', '52998224725', 'Pessoa Teste', '', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000b'),
  '00000000-0000-0000-0000-0000000000a1'::uuid, 'Outra empresa ganha cadastro próprio');
create temp table vb on commit drop as
  select id from public.vinculos where empresa_id = '00000000-0000-0000-0000-00000000bbbb';
grant select on vb to authenticated;
select ok(public.tem_documentos_em_outra_empresa((select id from vb)), 'Empresa nova sabe que há documentos aprovados para aproveitar');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated"}', true);
select throws_ok($$ select public.tem_documentos_em_outra_empresa((select id from vb)) $$, '42501', null, 'Outra empresa não consulta a pessoa');

reset role;
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f4' and titulo like 'Documentos para aproveitar%'),
  1, 'Segurança é avisada que há documentos para aproveitar');
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated"}', true);
select throws_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d3', (select id from vb)) $$, '42501', null, 'Empresa não aproveita sozinha');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d3', (select id from vb)) $$, '42501', null, 'RH não aproveita NR (é da Segurança)');
select lives_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d2', (select id from vb)) $$, 'RH aproveita o RG/CNH');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d1', (select id from vb)) $$, 'P0001', null, 'ASO é do empregador: não aproveita');
select lives_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d3', (select id from vb)) $$, 'Segurança aproveita a NR-35');
select throws_ok($$ select public.aproveitar_documento('00000000-0000-0000-0000-0000000000d3', (select id from vb)) $$, 'P0001', null, 'Não aproveita duas vezes');

reset role;
select is(app.pessoa_tem_aproveitaveis((select id from vb)), false, 'Depois de aproveitar tudo, não sobra nada para aproveitar');

select * from finish();
rollback;
