-- Acesso do fornecedor: ao autorizar (etapa 6), a empresa é cadastrada/ligada à obra da contratação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

delete from public.empresas_terceiras where cnpj in ('99888777000155');
insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-000000000e01', 'coord-af@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000e02', 'supr-af@teste.local', '{}'),
  ('00000000-0000-0000-0000-000000000e03', 'gerente-af@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-000000000e01', 'coordenador_obra'),
  ('00000000-0000-0000-0000-000000000e02', 'suprimentos'),
  ('00000000-0000-0000-0000-000000000e03', 'gerente_suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000000a1', 'OBR-AF1-TESTE', 'Obra AF1', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000000a2', 'OBR-AF2-TESTE', 'Obra AF2', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-0000000000a1'),
  ('00000000-0000-0000-0000-000000000e01', '00000000-0000-0000-0000-0000000000a2');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000e01", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'um', public.abrir_contratacao('00000000-0000-0000-0000-0000000000a1', 'Pintura', null, 50000, 'contrato', 'suprimentos');
insert into ids select 'dois', public.abrir_contratacao('00000000-0000-0000-0000-0000000000a2', 'Pintura torre 2', null, null, 'contrato', 'suprimentos');

-- Pula direto para a etapa 6 (como postgres), com fornecedor novo escolhido.
reset role;
update public.contratacoes set fornecedor_nome = 'Pinturas Teste Ltda', fornecedor_cnpj = '99888777000155', valor_negociado = 48000
where id in (select id from ids);
update public.contratacao_etapas set situacao = case when etapa <= 5 then 'concluida' when etapa = 6 then 'em_andamento' else 'pendente' end::public.situacao_etapa
where contratacao_id in (select id from ids);
set local role authenticated;

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000e02", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.salvar_email_fornecedor(%L, 'contato@pinturas.com') $$, (select id from ids where nome = 'um')),
  '42501', null, 'Na etapa 6, só o gerente altera o e-mail');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000e03", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.concluir_etapa(%L, 6::smallint) $$, (select id from ids where nome = 'um')),
  'P0001', 'Preencha as condições: permuta, faturamento direto, sinal e caução.', 'Autorizar exige as condições do gerente');
select throws_ok(format($$ select public.salvar_condicoes_gerente(%L, true, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'um')),
  'P0001', 'Permuta: informe o valor e o formato.', 'Permuta sim exige valor e formato');
select lives_ok(format($$ select public.salvar_condicoes_gerente(%L, d, 20000, 'Um apartamento', false, null, null, false, null, '5'), public.salvar_condicoes_gerente(%L, false, null, null, false, null, null, false, null, 'na') from (values (true)) v(d) $$,
  (select id from ids where nome = 'um'), (select id from ids where nome = 'dois')), 'Gerente preenche as condições');
select throws_ok(format($$ select public.concluir_etapa(%L, 6::smallint) $$, (select id from ids where nome = 'um')),
  'P0001', 'Informe o e-mail do fornecedor para o acesso ao portal.', 'Fornecedor novo: autorizar exige o e-mail');
select throws_ok(format($$ select public.salvar_email_fornecedor(%L, 'sem-arroba') $$, (select id from ids where nome = 'um')),
  'P0001', 'Informe um e-mail válido.', 'Recusa e-mail inválido');
select lives_ok(format($$ select public.salvar_email_fornecedor(%L, ' Contato@Pinturas.com ') $$, (select id from ids where nome = 'um')), 'Gerente informa o e-mail');
select lives_ok(format($$ select public.concluir_etapa(%L, 6::smallint) $$, (select id from ids where nome = 'um')), 'Gerente autoriza');

reset role;
select is((select email from public.empresas_terceiras where cnpj = '99888777000155'), 'contato@pinturas.com', 'Empresa cadastrada com o e-mail do fornecedor');
select is((select empresa_id from public.contratacoes where id = (select id from ids where nome = 'um')),
  (select id from public.empresas_terceiras where cnpj = '99888777000155'), 'Contratação ligada à empresa');
select ok(exists (select 1 from public.empresa_obras eo join public.empresas_terceiras e on e.id = eo.empresa_id
  where e.cnpj = '99888777000155' and eo.obra_id = '00000000-0000-0000-0000-0000000000a1' and eo.ativo), 'Empresa liberada na obra da contratação');
set local role authenticated;

-- Mesma empresa em outra obra: não pede e-mail, não duplica e acrescenta a obra.
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-000000000e03", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.concluir_etapa(%L, 6::smallint) $$, (select id from ids where nome = 'dois')), 'Empresa já cadastrada: autoriza sem e-mail');
reset role;
select is((select count(*)::int from public.empresa_obras eo join public.empresas_terceiras e on e.id = eo.empresa_id where e.cnpj = '99888777000155'),
  2, 'A empresa passa a ter as duas obras');

select * from finish();
rollback;
