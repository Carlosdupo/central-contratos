-- migration: 20261116140000_escopo_por_pacote.sql
-- Fase 3: avisos internos (sino e e-mail) e urgência.
begin;
create extension if not exists pgtap with schema extensions;
select plan(28);
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
  ('00000000-0000-0000-0000-0000000004c1', 'coord3a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000004c2', 'aux3a@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000004c3', 'coord3b@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000004f1', 'supr3@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000004f2', 'gerente3@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000004c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000004c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000004c3', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000004f1', 'suprimentos'),
  ('00000000-0000-0000-0000-0000000004f2', 'gerente_suprimentos');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000004aa', 'OBR-4A', 'Obra 4A', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000004bb', 'OBR-4B', 'Obra 4B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id, nivel) values
  ('00000000-0000-0000-0000-0000000004c1', '00000000-0000-0000-0000-0000000004aa', 'coordenador'),
  ('00000000-0000-0000-0000-0000000004c2', '00000000-0000-0000-0000-0000000004aa', 'auxiliar'),
  ('00000000-0000-0000-0000-0000000004c3', '00000000-0000-0000-0000-0000000004bb', 'coordenador');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
-- Aviso de chegada da etapa 1: coordenador e auxiliar da obra A, ninguém mais
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'u', public.abrir_contratacao('00000000-0000-0000-0000-0000000004aa', 'Contratação com aviso', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 100000, false, 'suprimentos') $$, 'Coordenador abre a contratação');
reset role;
do $$ begin perform pg_temp.para_fluxo_1(id) from ids; end $$;
set local role authenticated;
select is((select count(*)::int from public.avisos_internos where tipo = 'etapa' and contratacao_id = (select id from ids where nome = 'u')), 1, 'O coordenador lê o próprio aviso de chegada (e só o dele)');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.avisos_internos where tipo = 'etapa' and contratacao_id = (select id from ids where nome = 'u')), 1, 'O auxiliar da obra também recebe (etapa 1)');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c3", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.avisos_internos), 0, 'Coordenador de outra obra não recebe nem lê aviso dos outros');
select throws_ok($$ insert into public.avisos_internos (usuario_id, tipo, titulo) values ('00000000-0000-0000-0000-0000000004c3', 'etapa', 'falso') $$, '42501', null, 'Ninguém grava aviso direto');

-- E-mail: só código e link, na fila que já existe
reset role;
select is((select count(*)::int from public.notificacoes where destinatario = 'coord3a@teste.local' and empresa_id is null), 1, 'O e-mail do aviso entrou na fila');
select ok((select texto like '%/contratacoes/%' and assunto like 'CT-%' from public.notificacoes where destinatario = 'coord3a@teste.local'), 'O e-mail leva o código e o link');
set local role authenticated;

-- Marcar como lidos: só os da própria pessoa
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c1", "role": "authenticated", "aal": "aal1"}', true);
select is(public.marcar_avisos_lidos(), 1, 'Marca os avisos da pessoa como lidos');
select is((select count(*)::int from public.avisos_internos where lido_em is null), 0, 'Nenhum aviso sem ler');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.avisos_internos where lido_em is null), 1, 'Os avisos dos outros continuam sem ler');

-- Urgência: o auxiliar marca; o gerente é avisado (no sino, sem e-mail porque desligou)
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004f2", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ select public.salvar_preferencias_aviso(true, false) $$, 'Gerente desliga o e-mail dos avisos');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.marcar_urgencia(%L, true, 'abc', current_date + 5) $$, (select id from ids where nome = 'u')), 'P0001', 'Explique o motivo da urgência.', 'Urgência pede o motivo');
select throws_ok(format($$ select public.marcar_urgencia(%L, true, 'Concretagem marcada para a semana', null) $$, (select id from ids where nome = 'u')), 'P0001', 'Informe a data de necessidade.', 'Urgência pede a data de necessidade');
select lives_ok(format($$ select public.marcar_urgencia(%L, true, 'Concretagem marcada para a semana', current_date + 5) $$, (select id from ids where nome = 'u')), 'Auxiliar marca a urgência');
select is((select urgente from public.contratacoes where id = (select id from ids where nome = 'u')), true, 'A contratação ficou urgente');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004f1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok(format($$ select public.marcar_urgencia(%L, true, 'Concretagem marcada para a semana', current_date + 5) $$, (select id from ids where nome = 'u')), '42501', null, 'Quem não é da obra não marca urgência');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004f2", "role": "authenticated", "aal": "aal1"}', true);
select is((select texto from public.avisos_internos where tipo = 'urgencia'), 'Concretagem marcada para a semana', 'O gerente recebe o aviso de urgência com o motivo no sino');
reset role;
select is((select count(*)::int from public.notificacoes where destinatario = 'gerente3@teste.local'), 0, 'Sem e-mail para quem desligou');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.marcar_urgencia(%L, false, null, null) $$, (select id from ids where nome = 'u')), 'Coordenador tira a urgência');
select is((select urgente from public.contratacoes where id = (select id from ids where nome = 'u')), false, 'A urgência foi tirada');

-- Devolução avisa quem recebe a etapa, com o motivo; contratação autorizada avisa a obra
select lives_ok($$ insert into ids select 'd', public.abrir_contratacao('00000000-0000-0000-0000-0000000004aa', 'Contratação devolvida', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 100000, false, 'suprimentos') $$, 'Abre outra contratação');
reset role;
do $$ begin perform pg_temp.para_fluxo_1(id) from ids; end $$;
set local role authenticated;
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa <= 4 and contratacao_id = (select id from ids where nome = 'd');
update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now() where etapa = 5 and contratacao_id = (select id from ids where nome = 'd');
set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004f1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok(format($$ select public.devolver_etapa(%L, 5::smallint, 4::smallint, 'Faltou o anexo do Sienge') $$, (select id from ids where nome = 'd')), 'Suprimentos devolve a etapa 5');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000004c1", "role": "authenticated", "aal": "aal1"}', true);
select is((select texto from public.avisos_internos where tipo = 'devolucao' and contratacao_id = (select id from ids where nome = 'd')), 'Faltou o anexo do Sienge', 'O coordenador é avisado da devolução, com o motivo');
select is((select count(*)::int from public.avisos_internos where tipo = 'etapa' and contratacao_id = (select id from ids where nome = 'd') and titulo like '%etapa 4%'), 0, 'A devolução não gera também o aviso de chegada');
reset role;
update public.contratacao_etapas set situacao = 'concluida', concluida_em = now() where etapa = 6 and contratacao_id = (select id from ids where nome = 'u');
select is((select count(*)::int from public.avisos_internos where tipo = 'autorizada' and contratacao_id = (select id from ids where nome = 'u')), 2, 'Concluir a etapa 6 avisa a obra (coordenador e auxiliar)');
select is((select count(*)::int from public.notificacoes where destinatario = 'coord3a@teste.local' and assunto like '%autorizada%'), 0, 'Contratação autorizada fica só no sino, sem e-mail');
select is((select count(*)::int from public.notificacoes where destinatario = 'coord3a@teste.local' and assunto like '%devolvida%'), 1, 'Devolução vai por e-mail');

-- Aviso de prazo: só o servidor chama, e só uma vez por dia
select ok(not has_function_privilege('authenticated', 'public.gerar_aviso_prazo(uuid, smallint, text, date)', 'execute'), 'Usuário logado não gera aviso de prazo');
select * from finish();
rollback;
