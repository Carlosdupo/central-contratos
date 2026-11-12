-- F4 (integração e liberação) e F5 (vencimentos, bloqueio e avisos).
begin;
create extension if not exists pgtap with schema extensions;
select plan(12);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f4', 'sst@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f4', 'sst'), ('00000000-0000-0000-0000-0000000000f3', 'rh');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-T4', 'Obra T4', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.pessoas (id, cpf, nome) values
  ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Pessoa Um'),
  ('00000000-0000-0000-0000-0000000000c2', '11144477735', 'Pessoa Dois');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro'),
  ('00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Servente');
insert into public.alocacoes (id, vinculo_id, obra_id, situacao, integracao_data) values
  ('00000000-0000-0000-0000-000000000a11', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'integracao_agendada', (now() at time zone 'America/Sao_Paulo')::date),
  ('00000000-0000-0000-0000-000000000a22', '00000000-0000-0000-0000-0000000000a2', '00000000-0000-0000-0000-00000000000b', 'integracao_agendada', (now() at time zone 'America/Sao_Paulo')::date);
-- ASO da pessoa 1 emitido há 13 meses (validade de 12): vence. NR-18 da pessoa 2 vence daqui a 30 dias.
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, situacao, data_emissao) values
  ('00000000-0000-0000-0000-0000000000d1', 'aso', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'aprovado', (now() at time zone 'America/Sao_Paulo')::date - interval '13 months'),
  ('00000000-0000-0000-0000-0000000000d2', 'nr18', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a2', 'aprovado', ((now() at time zone 'America/Sao_Paulo')::date + 31) - interval '24 months');

set local role authenticated;

-- F4: integração
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.registrar_integracao('00000000-0000-0000-0000-000000000a11', true, (now() at time zone 'America/Sao_Paulo')::date, 'a', 'b') $$, '42501', null, 'RH não registra integração (é da segurança do trabalho)');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.registrar_integracao('00000000-0000-0000-0000-000000000a11', true, (now() at time zone 'America/Sao_Paulo')::date, 'a', 'b') $$, '42501', null, 'SST sem verificação em duas etapas não registra');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok($$ select public.registrar_integracao('00000000-0000-0000-0000-000000000a11', true, (now() at time zone 'America/Sao_Paulo')::date, 'Liberado', 'Texto') $$, 'SST marca presença');
select is((select situacao::text from public.alocacoes where id = '00000000-0000-0000-0000-000000000a11'), 'liberado', 'Presença libera a pessoa para a obra');
select throws_ok($$ select public.registrar_integracao('00000000-0000-0000-0000-000000000a22', false, (now() at time zone 'America/Sao_Paulo')::date, 'a', 'b') $$, 'P0001', null, 'Falta exige nova data futura');
select lives_ok($$ select public.registrar_integracao('00000000-0000-0000-0000-000000000a22', false, (now() at time zone 'America/Sao_Paulo')::date + 1, 'Falta', 'Texto') $$, 'SST registra falta e remarca');
select is((select integracao_data from public.alocacoes where id = '00000000-0000-0000-0000-000000000a22'), (now() at time zone 'America/Sao_Paulo')::date + 1, 'Falta remarca a integração');
select throws_ok($$ select public.processar_vencimentos((now() at time zone 'America/Sao_Paulo')::date) $$, '42501', null, 'Usuário logado não roda o processamento de vencimentos');

-- F5: vencimentos (como a tarefa agendada)
reset role;
select is((select (public.processar_vencimentos((now() at time zone 'America/Sao_Paulo')::date) ->> 'vencidos')::int), 1, 'ASO vencido é marcado');
select is((select situacao::text || ' ' || bloqueio_motivo from public.alocacoes where id = '00000000-0000-0000-0000-000000000a11'),
  'bloqueado Documento vencido: ASO (Atestado de Saúde Ocupacional)', 'Pessoa liberada com documento vencido é bloqueada (A5)');
select is((select count(*)::int from public.avisos_vencimento where documento_id = '00000000-0000-0000-0000-0000000000d2' and marco = 30), 1, 'Aviso de 30 dias criado para a NR-18');
select is((select (public.processar_vencimentos((now() at time zone 'America/Sao_Paulo')::date) ->> 'avisos')::int), 0, 'Rodar de novo no mesmo dia não repete avisos');

select * from finish();
rollback;
