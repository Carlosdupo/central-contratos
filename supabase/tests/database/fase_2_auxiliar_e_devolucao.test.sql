-- Fase 2: auxiliar de obra (etapas 1 a 3) e devolução de etapa.
begin;
create extension if not exists pgtap with schema extensions;
select plan(24);
-- Contratações novas entram no fluxo 2. Estes testes cobrem o fluxo 1 (contratações antigas), então a contratação aberta
-- é refeita no fluxo 1 (idempotente: só converte as que ainda estão no fluxo 2).
create function pg_temp.para_fluxo_1(p uuid) returns void language plpgsql as $f$
begin
  if (select fluxo_versao from public.contratacoes where id = p) = 1 then return; end if;
  delete from public.etapa_checklist where contratacao_id = p;
  delete from public.contratacao_etapas where contratacao_id = p;
  if to_regclass('public.avisos_internos') is not null then
    execute format('delete from public.avisos_internos where contratacao_id = %L', p);
    delete from public.notificacoes where empresa_id is null;
  end if;
  update public.contratacoes set fluxo_versao = 1 where id = p;
  insert into public.contratacao_etapas (contratacao_id, etapa) select p, etapa from public.etapas_fluxo where versao = 1;
  perform app.liberar_etapas(p);
end $f$;

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000003a1', 'adm2@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003c1', 'coord2a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003c2', 'aux2a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003c3', 'aux2b@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003f1', 'suprimentos2@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003f2', 'gerente2@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000003e1', 'contratos2@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000003a1', 'admin'),
  ('00000000-0000-0000-0000-0000000003c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000003c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000003c3', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000003f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000003f2', 'gerente_suprimentos'),
  ('00000000-0000-0000-0000-0000000003e1', 'contratos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000003aa', 'OBR-3A', 'Obra 3A', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000003bb', 'OBR-3B', 'Obra 3B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id, nivel) values
  ('00000000-0000-0000-0000-0000000003c1', '00000000-0000-0000-0000-0000000003aa', 'coordenador'),
  ('00000000-0000-0000-0000-0000000003c2', '00000000-0000-0000-0000-0000000003aa', 'auxiliar'),
  ('00000000-0000-0000-0000-0000000003c3', '00000000-0000-0000-0000-0000000003bb', 'auxiliar');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Auxiliar da obra A abre e leva a contratação até a etapa 3
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'a', public.abrir_contratacao('00000000-0000-0000-0000-0000000003aa', 'Contratação do auxiliar', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos') $$, 'Auxiliar abre a solicitação');
reset role;
do $$ begin perform pg_temp.para_fluxo_1(id) from ids; end $$;
set local role authenticated;
select lives_ok(format($$ select public.marcar_item(%L, 1::smallint, i::smallint, true) from generate_series(1, 3) i $$, (select id from ids where nome = 'a')), 'Auxiliar marca os itens da etapa 1');
select lives_ok(format($$ select public.concluir_etapa(%L, 1::smallint) $$, (select id from ids where nome = 'a')), 'Auxiliar conclui a etapa 1');
select throws_ok(format($$ select public.cancelar_contratacao(%L, 'Cancelar pelo auxiliar') $$, (select id from ids where nome = 'a')), '42501', null, 'Auxiliar não cancela');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c3", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.marcar_item(%L, 2::smallint, 1::smallint, true) $$, (select id from ids where nome = 'a')), '42501', null, 'Auxiliar de outra obra não age');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000003aa', 'Em outra obra', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos') $$, '42501', null, 'Auxiliar de outra obra não abre');

-- Etapa 4 (solicitação no Sienge): só o coordenador
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa in (2, 3) and contratacao_id = (select id from ids where nome = 'a');
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() where etapa = 4 and contratacao_id = (select id from ids where nome = 'a');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.salvar_campo_etapa(%L, 4::smallint, '12345') $$, (select id from ids where nome = 'a')), '42501', 'Esta etapa é de outra área.', 'Auxiliar não age na etapa 4');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.salvar_campo_etapa(%L, 4::smallint, '12345') $$, (select id from ids where nome = 'a')), 'Coordenador age na etapa 4');

-- Devolução: Suprimentos (etapa 5) devolve para a obra (etapa 4)
select lives_ok($$ insert into ids select 'd', public.abrir_contratacao('00000000-0000-0000-0000-0000000003aa', 'Contratação devolvida', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos') $$, 'Coordenador abre outra contratação');
reset role;
do $$ begin perform pg_temp.para_fluxo_1(id) from ids; end $$;
set local role authenticated;
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa <= 4 and contratacao_id = (select id from ids where nome = 'd');
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() - interval '5 days' where etapa = 5 and contratacao_id = (select id from ids where nome = 'd');
update public.etapa_checklist set marcado = true where etapa = 5 and contratacao_id = (select id from ids where nome = 'd');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.devolver_etapa(%L, 5::smallint, 4::smallint, 'Faltou o anexo do Sienge') $$, (select id from ids where nome = 'd')), '42501', null, 'Quem não é responsável pela etapa 5 não devolve');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.devolver_etapa(%L, 5::smallint, 4::smallint, 'abc') $$, (select id from ids where nome = 'd')), 'P0001', 'Escreva o motivo da devolução.', 'Motivo curto é recusado');
select throws_ok(format($$ select public.devolver_etapa(%L, 5::smallint, 5::smallint, 'Faltou o anexo do Sienge') $$, (select id from ids where nome = 'd')), 'P0001', 'Escolha uma etapa anterior.', 'Não devolve para a mesma etapa');
select lives_ok(format($$ select public.devolver_etapa(%L, 5::smallint, 4::smallint, 'Faltou o anexo do Sienge') $$, (select id from ids where nome = 'd')), 'Suprimentos devolve para a obra');
select is((select situacao::text from public.contratacao_etapas where etapa = 4 and contratacao_id = (select id from ids where nome = 'd')), 'em_andamento', 'A etapa escolhida reabriu');
select is((select situacao::text from public.contratacao_etapas where etapa = 5 and contratacao_id = (select id from ids where nome = 'd')), 'pendente', 'A etapa que devolveu ficou aguardando');
select is((select count(*)::int from public.etapa_checklist where etapa = 5 and marcado and contratacao_id = (select id from ids where nome = 'd')), 0, 'Checklist da etapa seguinte foi limpo');
select ok((select iniciada_em > now() - interval '1 minute' from public.contratacao_etapas where etapa = 4 and contratacao_id = (select id from ids where nome = 'd')), 'O prazo da etapa devolvida recomeça');
select is((select motivo || ' / ' || de_etapa || '>' || para_etapa from public.contratacao_devolucoes where contratacao_id = (select id from ids where nome = 'd')), 'Faltou o anexo do Sienge / 5>4', 'A devolução fica no histórico com motivo');
select is((select count(*)::int from public.contratacao_devolucoes), 1, 'Quem pode ver a obra lê o histórico');

-- Administrador reabre uma etapa antiga: as seguintes recuam, inclusive as paralelas que dependem dela
reset role;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'r', public.abrir_contratacao('00000000-0000-0000-0000-0000000003aa', 'Contratação reaberta', (select id from public.matriz_contratacao order by ordem limit 1), 100000, false, 'suprimentos') $$, 'Coordenador abre a contratação para a reabertura');
reset role;
do $$ begin perform pg_temp.para_fluxo_1(id) from ids; end $$;
set local role authenticated;
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa <= 9 and contratacao_id = (select id from ids where nome = 'r');
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() where etapa = 10 and contratacao_id = (select id from ids where nome = 'r');
insert into public.assinaturas (contratacao_id, ordem, assinado_por) select (select id from ids where nome = 'r'), ordem, '00000000-0000-0000-0000-0000000003a1' from public.assinantes_fluxo;
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000003a1", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok(format($$ select public.reabrir_etapa(%L, 6::smallint, 'Condições do gerente erradas') $$, (select id from ids where nome = 'r')), 'Administrador reabre a etapa 6');
select is((select string_agg(etapa || ':' || situacao, ' ' order by etapa) from public.contratacao_etapas where etapa between 6 and 10 and contratacao_id = (select id from ids where nome = 'r')),
  '6:em_andamento 7:pendente 8:pendente 9:pendente 10:pendente', 'As etapas que dependem da 6 recuaram, as paralelas também');
select is((select count(*)::int from public.assinaturas where contratacao_id = (select id from ids where nome = 'r')), 0, 'As assinaturas foram desfeitas');
select is((select tipo from public.contratacao_devolucoes where contratacao_id = (select id from ids where nome = 'r')), 'reabertura', 'A reabertura fica no histórico');

select * from finish();
rollback;
