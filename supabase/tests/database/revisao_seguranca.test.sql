-- Revisão de segurança: CPF entre empresas, caminho de arquivo, limite de tentativas e fila de e-mails.
begin;
create extension if not exists pgtap with schema extensions;
select plan(31);

insert into auth.users (id, email, raw_app_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-RS', 'Obra RS', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local');
insert into public.empresa_obras (empresa_id, obra_id) values
  ('00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-00000000000b'),
  ('00000000-0000-0000-0000-00000000bbbb', '00000000-0000-0000-0000-00000000000b');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');

-- 1) cadastrar_pessoa: CPF já cadastrado por outra empresa ---------------------------------------
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000aaaa', '52998224725', 'João da Silva Teste', '49 99999-0001', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000b') $$,
  'Empresa A cadastra o funcionário');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.pessoas), 0, 'Empresa B não vê a pessoa cadastrada pela empresa A');
select throws_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000bbbb', '52998224725', 'Outra Pessoa Qualquer', '49 77777-0003', 'funcionario', 'Servente', false, '00000000-0000-0000-0000-00000000000b') $$,
  'P0001', 'Não foi possível cadastrar. Confira o CPF e o nome completo.', 'CPF existente com nome diferente é recusado');
select is((select count(*)::int from public.pessoas), 0, 'Depois da recusa, a empresa B continua sem ver a pessoa');
select lives_ok(
  $$ select public.cadastrar_pessoa('00000000-0000-0000-0000-00000000bbbb', '52998224725', 'JOAO DA SILVA TESTE', '49 88888-0002', 'funcionario', 'Pedreiro', false, '00000000-0000-0000-0000-00000000000b') $$,
  'CPF existente com o mesmo nome (sem acento e em maiúsculas) liga o vínculo');

reset role;
select is((select telefone from public.pessoas where cpf = '52998224725'), '49 99999-0001', 'Telefone da pessoa não é sobrescrito por outra empresa');
select is((select nome from public.pessoas where cpf = '52998224725'), 'João da Silva Teste', 'Nome da pessoa não é alterado');
select is((select count(*)::int from public.vinculos v join public.pessoas p on p.id = v.pessoa_id where p.cpf = '52998224725'), 2, 'A pessoa tem um vínculo em cada empresa');

-- 2) Caminho de arquivo ---------------------------------------------------------------------------
select is(app.caminho_arquivo_valido('empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.pdf'), true, 'Caminho de empresa no formato do servidor é válido');
select is(app.caminho_arquivo_valido('empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/00000000-0000-0000-0000-0000000000c1/aso/00000000-0000-0000-0000-0000000000f1.png'), true, 'Caminho de pessoa no formato do servidor é válido');
select is(app.caminho_arquivo_valido('empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/../../../00000000-0000-0000-0000-00000000bbbb/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.pdf'), false, 'Caminho com ".." é recusado');
select is(app.caminho_arquivo_valido('empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/x.pdf'), false, 'Nome de arquivo que não é UUID é recusado');
select is(app.caminho_arquivo_valido('empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.exe'), false, 'Extensão fora de pdf/jpg/png é recusada');
select is(app.caminho_arquivo_valido(E'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.pdf\n'), false, 'Quebra de linha no fim é recusada');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'cnd_federal', 'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/../../../00000000-0000-0000-0000-00000000bbbb/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64), null, '2099-01-01') $$,
  'P0001', 'Caminho de arquivo inválido.', 'Registrar arquivo com ".." (que passava pelo LIKE) é recusado');
select lives_ok(
  $$ select public.registrar_arquivo_empresa('00000000-0000-0000-0000-00000000aaaa', 'cnd_federal', 'empresas/00000000-0000-0000-0000-00000000aaaa/empresa/cnd_federal/00000000-0000-0000-0000-0000000000f1.pdf', 'x.pdf', 'application/pdf', 10, repeat('c', 64), null, '2099-01-01') $$,
  'Registrar arquivo com caminho do servidor continua funcionando');

-- 3) Limite de tentativas -------------------------------------------------------------------------
reset role;
set local role service_role;
select is(public.consumir_limite('teste-a', 2, 60), true, 'Limite: 1ª tentativa passa');
select is(public.consumir_limite('teste-a', 2, 60), true, 'Limite: 2ª tentativa passa');
select is(public.consumir_limite('teste-a', 2, 60), false, 'Limite: 3ª tentativa é barrada');
select is(public.consumir_limite('teste-b', 2, 60), true, 'Limite: outra chave não é afetada');
select throws_ok($$ select public.consumir_limite('teste-c', 0, 60) $$, '22023', null, 'Limite: parâmetros inválidos são recusados');
reset role;
set local role authenticated;
select throws_ok($$ select public.consumir_limite('teste-a', 2, 60) $$, '42501', null, 'Usuário logado não executa consumir_limite');
select throws_ok($$ select * from public.limites_tentativas $$, '42501', null, 'Usuário logado não lê a tabela de limites');
reset role;
set local role anon;
select throws_ok($$ select public.consumir_limite('teste-a', 2, 60) $$, '42501', null, 'Visitante não executa consumir_limite');
reset role;

-- 4) Fila de e-mails ------------------------------------------------------------------------------
-- Independe do ambiente: avisos reais já na fila saem só dentro desta transação (desfeita no fim).
delete from public.notificacoes;
insert into public.notificacoes (destinatario, assunto, texto) select 'x' || g || '@teste.local', 'Assunto ' || g, 'Texto ' || g from generate_series(1, 4) g;
set local role service_role;
select is((select count(*)::int from public.reservar_notificacoes(2)), 2, 'Fila: reserva 2 dos 4 avisos');
select is((select count(*)::int from public.notificacoes where situacao = 'enviando' and tentativas = 1), 2, 'Fila: os reservados ficam "enviando" com 1 tentativa');
select is((select count(*)::int from public.reservar_notificacoes(10)), 2, 'Fila: a 2ª reserva pega só os 2 restantes (nunca os já reservados)');
select is((select count(*)::int from public.reservar_notificacoes(10)), 0, 'Fila: com tudo reservado, nada sobra');
reset role;
update public.notificacoes set reservado_em = now() - interval '11 minutes' where id = (select id from public.notificacoes order by criado_em, id limit 1);
set local role service_role;
select is((select count(*)::int from public.reservar_notificacoes(10)), 1, 'Fila: reserva esquecida há mais de 10 minutos volta à fila');
reset role;
update public.notificacoes set situacao = 'erro', tentativas = 5, reservado_em = null where id = (select id from public.notificacoes order by criado_em, id limit 1);
set local role service_role;
select is((select count(*)::int from public.reservar_notificacoes(10)), 0, 'Fila: aviso que já gastou as 5 tentativas não é reenviado');
reset role;
set local role authenticated;
select throws_ok($$ select * from public.reservar_notificacoes(5) $$, '42501', null, 'Usuário logado não executa reservar_notificacoes');

select * from finish();
rollback;
