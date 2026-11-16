-- migration: 20261116140000_escopo_por_pacote.sql
-- Fase 4: fluxo versão 2 (normal e aditivo). As contratações antigas (fluxo 1) são cobertas pelos testes das fases anteriores.
begin;
create extension if not exists pgtap with schema extensions;
select plan(29);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000005c1', 'coord4@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000005f1', 'comprador4@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000005f2', 'gerente4@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000005e1', 'contratos4@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000005b1', 'rh4@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000005c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000005f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000005f2', 'gerente_suprimentos'),
  ('00000000-0000-0000-0000-0000000005e1', 'contratos'),
  ('00000000-0000-0000-0000-0000000005b1', 'rh');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-0000000005aa', 'OBR-5A', 'Obra 5A', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values ('00000000-0000-0000-0000-0000000005c1', '00000000-0000-0000-0000-0000000005aa');
-- Uma empresa que já está aprovada e ligada à obra
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-0000000005e9', '11444777000161', 'Empresa já liberada', 'liberada4@teste.local', 'aprovada');
insert into public.empresa_obras (empresa_id, obra_id) values ('00000000-0000-0000-0000-0000000005e9', '00000000-0000-0000-0000-0000000005aa');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005c1", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'a', public.abrir_contratacao('00000000-0000-0000-0000-0000000005aa', 'Contratação nova', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 100000, false, 'suprimentos');
insert into ids select 'b', public.abrir_contratacao('00000000-0000-0000-0000-0000000005aa', 'Empresa já liberada', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 100000, false, 'suprimentos');
insert into ids select 'ad', public.abrir_contratacao('00000000-0000-0000-0000-0000000005aa', 'Aditivo novo', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 5000, true, 'suprimentos', 'CT/BL0083');

-- Abertura entra no fluxo 2 e já conclui a etapa 1
select is((select fluxo_versao from public.contratacoes where id = (select id from ids where nome = 'a')), 2, 'Contratação nova entra no fluxo 2');
select is((select count(*)::int from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'a')), 11, 'Fluxo 2: 11 etapas (a 6 foi unida à 5)');
select is((select count(*)::int from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'a') and etapa = 6), 0, 'Não existe etapa 6 no fluxo 2');
select is((select string_agg(etapa || ':' || situacao, ' ' order by etapa) from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'a') and etapa <= 3), '1:concluida 2:em_andamento 3:pendente', 'A abertura conclui a etapa 1 e a cotação começa');
select is((select count(*)::int from public.etapa_checklist where contratacao_id = (select id from ids where nome = 'a') and etapa = 1), 0, 'A etapa 1 não tem itens para marcar');
select is((select fluxo_versao from public.contratacoes where id = (select id from ids where nome = 'ad')), 3, 'Aditivo entra no fluxo 2 do aditivo');
select is((select count(*)::int from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'ad')), 10, 'Aditivo: 10 etapas, sem a negociação da obra e sem a 6');
select is((select chave from public.etapas_fluxo where versao = 2 and etapa = 5), 'autorizacao', 'A etapa 5 do fluxo 2 é a autorização (negociação e autorização unidas)');

-- Normal: o comprador prepara, só o gerente autoriza
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa in (2, 4) and contratacao_id in (select id from ids where nome in ('a', 'b'));
update public.contratacao_etapas set situacao = 'pulada', concluida_em = now() where etapa = 3 and contratacao_id in (select id from ids where nome in ('a', 'b'));
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() where etapa = 5 and contratacao_id in (select id from ids where nome in ('a', 'b'));
update public.etapa_checklist set marcado = true where etapa = 5 and contratacao_id in (select id from ids where nome in ('a', 'b'));
update public.contratacoes set fornecedor_nome = 'Fornecedor novo', fornecedor_cnpj = '11222333000181', fornecedor_email = 'forn4@teste.local', valor_negociado = 1000 where id = (select id from ids where nome = 'a');
update public.contratacoes set fornecedor_nome = 'Empresa já liberada', fornecedor_cnpj = '11444777000161', fornecedor_email = 'liberada4@teste.local', valor_negociado = 1000 where id = (select id from ids where nome = 'b');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'a')), '42501', null, 'O comprador não autoriza');
select throws_ok(format($$ select public.concluir_etapa(%L, 5::smallint) $$, (select id from ids where nome = 'a')), '42501', 'Só o gerente de suprimentos autoriza.', 'O comprador não conclui a etapa de autorização');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.concluir_etapa(%L, 5::smallint) $$, (select id from ids where nome = 'a')), 'P0001', 'Preencha as condições: permuta, faturamento direto, sinal e caução.', 'Sem as condições o gerente não conclui');
select lives_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, false, null, null, false, null, '5') $$, (select id from ids where nome = 'a')), 'O gerente autoriza com o botão único (etapa 5 do fluxo 2)');
select is((select string_agg(etapa || ':' || situacao, ' ' order by etapa) from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'a') and etapa in (5, 7, 10)), '5:concluida 7:em_andamento 10:em_andamento', 'Depois da autorização: contrato e documentação começam');
select is((select empresa_ja_liberada from public.contratacoes where id = (select id from ids where nome = 'a')), false, 'Empresa nova: documentação e integração se aplicam');

-- RH decide e fecha a documentação
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.concluir_etapa(%L, 10::smallint) $$, (select id from ids where nome = 'a')), '42501', null, 'A obra não fecha a documentação');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005b1", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok(format($$ select public.concluir_etapa(%L, 10::smallint) $$, (select id from ids where nome = 'a')), 'O RH fecha a documentação');
select is((select situacao::text from public.contratacao_etapas where etapa = 11 and contratacao_id = (select id from ids where nome = 'a')), 'em_andamento', 'A integração começa depois');

-- Empresa já liberada na obra: documentação, integração e liberação não se aplicam
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005f2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.autorizar_contratacao(%L, false, null, null, false, null, null, false, null, '3') $$, (select id from ids where nome = 'b')), 'O gerente autoriza a empresa já liberada');
select is((select empresa_ja_liberada from public.contratacoes where id = (select id from ids where nome = 'b')), true, 'O sistema reconhece a empresa já liberada na obra');
select is((select string_agg(etapa || ':' || situacao, ' ' order by etapa) from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'b') and etapa in (10, 11, 12)), '10:pulada 11:pulada 12:pendente', 'Documentação e integração: não se aplica');
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa in (7, 8, 9) and contratacao_id = (select id from ids where nome = 'b');
do $$ begin perform app.liberar_etapas((select id from ids where nome = 'b')); end $$;
set local role authenticated;
select is((select situacao::text from public.contratacoes where id = (select id from ids where nome = 'b')), 'liberada', 'Contrato e assinaturas prontos: a contratação é liberada sem passar pelo RH e pela integração');

-- Aditivo: sem cotações; guarda-chuva pula a assinatura
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'ad')), 'P0001', 'Informe o fornecedor e o valor negociado.', 'Aditivo: precisa do fornecedor e do valor');
select lives_ok(format($$ select public.definir_fornecedor_aditivo(%L, 'Fornecedor do contrato', '11.222.333/0001-81', 4800) $$, (select id from ids where nome = 'ad')), 'Aditivo: a obra informa fornecedor e valor negociado');
select lives_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'ad')), 'Aditivo: conclui sem 3 cotações');
select is((select situacao::text from public.contratacao_etapas where etapa = 4 and contratacao_id = (select id from ids where nome = 'ad')), 'em_andamento', 'Depois vem a solicitação no Sienge');
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa in (4, 5) and contratacao_id = (select id from ids where nome = 'ad');
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() where etapa = 7 and contratacao_id = (select id from ids where nome = 'ad');
update public.contratacoes set sienge_contrato = 'CT/BL0083' where id = (select id from ids where nome = 'ad');
update public.etapa_checklist set marcado = true where etapa = 7 and contratacao_id = (select id from ids where nome = 'ad');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000005e1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.concluir_etapa(%L, 7::smallint) $$, (select id from ids where nome = 'ad')), 'P0001', 'Informe se o aditivo cabe em contrato guarda-chuva ou precisa de contrato novo.', 'Contratos precisa marcar guarda-chuva ou contrato novo');
select lives_ok(format($$ select public.definir_destino_aditivo(%L, 'guarda_chuva') $$, (select id from ids where nome = 'ad')), 'Contratos marca que cabe em contrato guarda-chuva');
select lives_ok(format($$ select public.concluir_etapa(%L, 7::smallint) $$, (select id from ids where nome = 'ad')), 'Contratos conclui o aditivo');
select is((select string_agg(etapa || ':' || situacao, ' ' order by etapa) from public.contratacao_etapas where contratacao_id = (select id from ids where nome = 'ad') and etapa in (8, 9)), '8:em_andamento 9:pulada', 'Guarda-chuva: a alçada continua e a assinatura não se aplica');

select * from finish();
rollback;
