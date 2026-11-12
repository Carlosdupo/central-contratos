-- F2: pessoas por CPF, vínculos, alocação por obra, envio, visita e busca (A3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-T2', 'Obra T2', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local');
insert into public.empresa_obras (empresa_id, obra_id) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);

select lives_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '52998224725', 'João da Silva Teste', '', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000b') $$,
  'Empresa A cadastra funcionário');
select throws_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '52998224725', 'Outro Nome', '', 'funcionario', 'Servente', false, '00000000-0000-0000-0000-00000000000b') $$,
  'P0001', null, 'Mesma pessoa não é cadastrada duas vezes na empresa');
select throws_ok(
  $$ select cpf from public.pessoas $$,
  '42501', null, 'CPF não sai por consulta direta (só mascarado)');
select is((select situacao::text from public.alocacoes limit 1), 'rascunho', 'Funcionário entra como rascunho na obra');
select lives_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '11144477735', 'Maria Sócia Teste', '', 'socio_esporadico', 'Sócio', false, '00000000-0000-0000-0000-00000000000b') $$,
  'Empresa A cadastra sócio esporádico');
select is(
  (select count(*)::int from public.alocacoes a join public.vinculos v on v.id = a.vinculo_id where v.tipo = 'socio_esporadico'), 0,
  'Sócio esporádico não fica alocado na obra (só visita)');
select throws_ok(
  format($$ select public.solicitar_visita(%L, '00000000-0000-0000-0000-00000000000b', (now() at time zone 'America/Sao_Paulo')::date, %L, 'cnh.jpg') $$,
    (select id from public.vinculos where tipo = 'socio_esporadico'),
    'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/' || (select id from public.vinculos where tipo = 'socio_esporadico') || '/visita/00000000-0000-4000-8000-000000000012.jpg'),
  'P0001', null, 'Visita para hoje é recusada (precisa de antecedência)');

-- Arquivo de pessoa: caminho certo grava; envio coloca a obra em análise
select lives_ok(
  format($$ select public.registrar_arquivo_pessoa(%L, 'aso', %L, 'aso.pdf', 'application/pdf', 10, repeat('e', 64), (now() at time zone 'America/Sao_Paulo')::date - 10) $$,
    (select id from public.vinculos where tipo = 'funcionario'),
    'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/' || (select id from public.vinculos where tipo = 'funcionario') || '/aso/00000000-0000-4000-8000-000000000009.pdf'),
  'Empresa A anexa o ASO do funcionário');
select throws_ok(
  format($$ select public.registrar_arquivo_pessoa(%L, 'aso', 'empresas/outra/00000000-0000-4000-8000-000000000010.pdf', 'aso.pdf', 'application/pdf', 10, repeat('f', 64), (now() at time zone 'America/Sao_Paulo')::date - 10) $$,
    (select id from public.vinculos where tipo = 'funcionario')),
  'P0001', null, 'Caminho de arquivo de outra pasta é recusado');
select lives_ok(
  format($$ select public.enviar_documentos_pessoa(%L) $$, (select id from public.vinculos where tipo = 'funcionario')),
  'Empresa A envia os documentos da pessoa');
select is((select situacao::text from public.alocacoes limit 1), 'em_analise', 'Envio coloca a pessoa em análise na obra');

-- Empresa B
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.vinculos), 0, 'Empresa B não vê a equipe da A');
select throws_ok($$ select * from public.buscar_pessoas('joao') $$, '42501', null, 'Empresa terceirizada não usa a consulta de pessoas');

-- Equipe interna: busca sem acento e por CPF
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select is((select cpf_mascarado from public.buscar_pessoas('joao da silva teste') limit 1), '***.982.247-**', 'Busca por nome sem acento acha a pessoa, com CPF mascarado');
select is((select nome from public.buscar_pessoas('529.982.247-25') limit 1), 'João da Silva Teste', 'Busca pelo CPF completo');

-- Revisão de segurança: outra empresa com o mesmo CPF não altera nem descobre dados da pessoa
reset role;
insert into public.empresa_obras (empresa_id, obra_id) values ('00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-00000000000b');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000bbbb', '52998224725', 'Nome Errado', '49999990000', 'funcionario', 'Servente', false, '00000000-0000-0000-0000-00000000000b') $$,
  'P0001', 'Não foi possível cadastrar. Confira o CPF e o nome completo.', 'Outra empresa com nome que não confere: recusado sem revelar o cadastro');
reset role;
select is((select telefone from public.pessoas where cpf = '52998224725'), null, 'Os dados da pessoa não foram alterados');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000bbbb', '52998224725', '  JOAO  da silva teste ', '', 'funcionario', 'Servente', false, '00000000-0000-0000-0000-00000000000b') $$,
  'Nome que confere (sem acento, maiúsculas, espaços): liga à outra empresa');
reset role;
select is(app.caminho_arquivo_valido('empresas/../00000000-0000-4000-8000-000000000011.pdf'), false, 'Caminho de arquivo fora do padrão é recusado');

select * from finish();
rollback;
