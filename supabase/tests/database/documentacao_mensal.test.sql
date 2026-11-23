-- RH-4: documentação mensal da empresa e dos funcionários liberados, lembretes e conclusão que não mexe no acesso.
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000e2', 'empresa-b@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values ('00000000-0000-0000-0000-0000000000f3', 'rh');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-M4', 'Obra M4', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada'),
  ('00000000-0000-0000-0000-00000000bbbb', '11444777000161', 'Empresa B Teste', 'b@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa'),
  ('00000000-0000-0000-0000-0000000000e2', '00000000-0000-0000-0000-00000000bbbb');
insert into public.pessoas (id, cpf, nome) values
  ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Liberado Teste'),
  ('00000000-0000-0000-0000-0000000000c2', '11144477735', 'Em Analise Teste');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Servente');
insert into public.alocacoes (vinculo_id, obra_id, situacao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'liberado'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'em_analise');

-- Empresa: 9 mensais sem Simples (fgts x2, inss x2, folha x2, fgts digital, dctfweb, relação); funcionário liberado: 3.
select is(app.mensais_faltando('00000000-0000-0000-0000-00000000aaaa', '2026-10-01'), 12, 'falta tudo: 9 da empresa + 3 do funcionário liberado (o em análise não conta)');
update public.empresas_terceiras set optante_simples = true where id = '00000000-0000-0000-0000-00000000aaaa';
select is(app.mensais_faltando('00000000-0000-0000-0000-00000000aaaa', '2026-10-01'), 14, 'optante do Simples: guia e comprovante do Simples entram');

select is(public.lembretes_documentacao_mensal('2026-11-24'), 0, 'fora dos dias 20, 25 e 28 não avisa');
select is(public.lembretes_documentacao_mensal('2026-11-25'), 1, 'dia 25: avisa só a empresa com funcionário liberado');
select ok((select assunto from public.notificacoes where empresa_id = '00000000-0000-0000-0000-00000000aaaa' order by criado_em desc limit 1) like '%10/2026%até 30/11%', 'aviso cita a competência e o prazo');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.definir_optante_simples('00000000-0000-0000-0000-00000000aaaa', false) $$, '42501', null, 'outra empresa não altera o Simples');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000e1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ select public.definir_optante_simples('00000000-0000-0000-0000-00000000aaaa', false) $$, 'a própria empresa informa o Simples');
select throws_ok(
  $$ select public.registrar_arquivo_pessoa('00000000-0000-0000-0000-0000000000a1', 'cartao_ponto',
       'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/00000000-0000-0000-0000-0000000000a1/cartao_ponto/x.pdf',
       'x.pdf', 'application/pdf', 10, repeat('a', 64)) $$,
  'P0001', 'Informe a competência.', 'documento mensal do funcionário pede a competência');
reset role;

-- Envio só com mensal reprovado: empresa continua aprovada e o funcionário continua liberado.
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, competencia, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'cartao_ponto', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', '2026-10-01', 'enviado');
insert into public.envios_analise (id, empresa_id, vinculo_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1');
insert into public.envio_itens (id, envio_id, documento_id, decisao, motivo) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'reprovado', 'sem assinatura');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select is(
  (select public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'Assunto', 'Texto')),
  'mensal_pendente', 'envio só de mensais tem resultado próprio');
reset role;
select is((select situacao::text from public.alocacoes where vinculo_id = '00000000-0000-0000-0000-0000000000a1'), 'liberado', 'pendência no mensal não tira o funcionário da obra');
select is((select situacao::text from public.empresas_terceiras where id = '00000000-0000-0000-0000-00000000aaaa'), 'aprovada', 'pendência no mensal não muda a situação da empresa');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'reprovado', 'o documento mensal recebe a decisão');

select * from finish();
rollback;
