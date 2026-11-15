-- Fase 3: avisos internos (sino + e-mail) e urgência. Só acrescenta; nada é apagado.
--
-- Avisos: chegou etapa para a sua área, devolução/reabertura, urgência, prazo vencendo ou vencido,
-- contratação autorizada (etapa 6) e contratação liberada. Cada pessoa só lê os próprios avisos.
-- E-mail: sai pela fila que já existe (public.notificacoes) e leva só o código da contratação e o link.
-- Limite: no máximo 20 e-mails por pessoa por hora; passou disso, o aviso fica só no sino.

-- Preferências por pessoa -----------------------------------------------------------------------
create table public.preferencias_aviso (
  usuario_id uuid primary key references public.usuarios (id) on delete cascade,
  som boolean not null default true,
  email boolean not null default true
);
alter table public.preferencias_aviso enable row level security;
revoke all on public.preferencias_aviso from anon;
revoke insert, update, delete, truncate on public.preferencias_aviso from authenticated;
create policy preferencias_ler on public.preferencias_aviso for select to authenticated using (usuario_id = auth.uid());

create function public.salvar_preferencias_aviso(p_som boolean, p_email boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.usuario_interno_ativo() then raise exception 'Sem permissão.' using errcode = '42501'; end if;
  if p_som is null or p_email is null then raise exception 'Escolha som e e-mail.' using errcode = 'P0001'; end if;
  insert into public.preferencias_aviso (usuario_id, som, email) values (auth.uid(), p_som, p_email)
  on conflict (usuario_id) do update set som = excluded.som, email = excluded.email;
end $$;

-- Avisos internos ---------------------------------------------------------------------------------
create table public.avisos_internos (
  id uuid primary key default gen_random_uuid(),
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  tipo text not null check (tipo in ('etapa', 'devolucao', 'reabertura', 'urgencia', 'prazo_vencendo', 'prazo_vencido', 'autorizada', 'liberada')),
  titulo text not null check (length(titulo) <= 200),
  texto text check (texto is null or length(texto) <= 1000),
  contratacao_id uuid references public.contratacoes (id) on delete cascade,
  chave text,
  criado_em timestamptz not null default now(),
  lido_em timestamptz,
  unique (usuario_id, chave)
);
create index avisos_internos_usuario_idx on public.avisos_internos (usuario_id, criado_em desc);
alter table public.avisos_internos enable row level security;
revoke all on public.avisos_internos from anon;
revoke insert, update, delete, truncate on public.avisos_internos from authenticated;
create policy avisos_ler_proprios on public.avisos_internos for select to authenticated using (usuario_id = auth.uid());

-- Marca como lidos os avisos informados (ou todos, sem lista). Só os da própria pessoa.
create function public.marcar_avisos_lidos(p_ids uuid[] default null) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd int;
begin
  update public.avisos_internos set lido_em = now()
  where usuario_id = auth.uid() and lido_em is null and (p_ids is null or id = any(p_ids));
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

-- Endereço do site nos e-mails (muda por migration se o domínio mudar).
create function app.url_site() returns text language sql immutable set search_path = '' as $$ select 'https://nexus-terceiros.vercel.app'::text $$;

-- Quem recebe o aviso de uma etapa: quem age nela (o auxiliar da obra nas etapas 1 a 3).
create function app.destinatarios_da_etapa(p_obra uuid, p_etapa smallint, p_versao int default 1) returns setof uuid
language sql stable security definer set search_path = '' as $$
  select distinct u.id
  from public.etapas_fluxo f
  join public.usuario_papeis up on up.papel = f.papel
    or (f.papel = 'suprimentos' and up.papel = 'gerente_suprimentos')
  join public.usuarios u on u.id = up.usuario_id and u.ativo and u.tipo = 'interno'
  where f.versao = p_versao and f.etapa = p_etapa and f.papel is not null
    and (
      f.papel <> 'coordenador_obra'
      or exists (
        select 1 from public.usuario_obras uo
        where uo.usuario_id = u.id and uo.obra_id = p_obra and (uo.nivel = 'coordenador' or p_etapa <= 3)
      )
    )
$$;

-- Grava o aviso no sino e, se a pessoa quer e não passou do limite, enfileira o e-mail (só código e link).
-- p_chave evita aviso repetido (mesma pessoa, mesmo fato).
create function app.avisar(p_usuarios uuid[], p_tipo text, p_titulo text, p_texto text, p_contratacao uuid, p_chave text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_u record;
  v_novo uuid;
  v_quer_email boolean;
begin
  for v_u in select id, email from public.usuarios where id = any(p_usuarios) and ativo and tipo = 'interno' loop
    insert into public.avisos_internos (usuario_id, tipo, titulo, texto, contratacao_id, chave)
    values (v_u.id, p_tipo, left(p_titulo, 200), left(p_texto, 1000), p_contratacao, p_chave)
    on conflict (usuario_id, chave) do nothing
    returning id into v_novo;
    if v_novo is null then continue; end if;
    v_quer_email := coalesce((select email from public.preferencias_aviso where usuario_id = v_u.id), true);
    if v_quer_email and v_u.email ~ '^\S+@\S+\.\S+$'
       and (select count(*) from public.notificacoes where destinatario = v_u.email and criado_em > now() - interval '1 hour') < 20 then
      insert into public.notificacoes (destinatario, assunto, texto)
      values (v_u.email, left(p_titulo, 200),
        p_titulo || E'\n\nAbrir no Nexus: ' || app.url_site() || coalesce('/contratacoes/' || p_contratacao::text, '/painel'));
    end if;
  end loop;
end $$;

-- Mudança de situação de uma etapa: chegou para a área, contratação autorizada, contratação liberada.
create function app.avisar_mudanca_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_nome text;
begin
  select * into v_c from public.contratacoes where id = new.contratacao_id;
  select nome into v_nome from public.etapas_fluxo where versao = v_c.fluxo_versao and etapa = new.etapa;
  if new.situacao = 'em_andamento' and coalesce(current_setting('app.devolucao', true), '') <> '1' then
    perform app.avisar(
      array(select app.destinatarios_da_etapa(v_c.obra_id, new.etapa, v_c.fluxo_versao)),
      'etapa', v_c.codigo || ': chegou a etapa ' || new.etapa || ' (' || v_nome || ') para a sua área', null, v_c.id,
      'etapa:' || v_c.id || ':' || new.etapa || ':' || extract(epoch from coalesce(new.iniciada_em, now()))::bigint);
  elsif new.situacao = 'concluida' and new.etapa = 6 then
    perform app.avisar(
      array(select u.id from public.usuario_obras uo join public.usuarios u on u.id = uo.usuario_id and u.ativo and u.tipo = 'interno' where uo.obra_id = v_c.obra_id),
      'autorizada', v_c.codigo || ': contratação autorizada pelo gerente de suprimentos', null, v_c.id, 'autorizada:' || v_c.id);
  elsif new.situacao = 'concluida' and new.etapa = 12 then
    perform app.avisar(
      array(select u.id from public.usuario_obras uo join public.usuarios u on u.id = uo.usuario_id and u.ativo and u.tipo = 'interno' where uo.obra_id = v_c.obra_id),
      'liberada', v_c.codigo || ': empresa liberada para a obra', null, v_c.id, 'liberada:' || v_c.id);
  end if;
  return null;
end $$;
create trigger avisar_mudanca_etapa after update of situacao on public.contratacao_etapas
  for each row when (old.situacao is distinct from new.situacao) execute function app.avisar_mudanca_etapa();

-- Devolução/reabertura: o mesmo recuo da fase 2, agora avisando quem recebe a etapa (com o motivo no sino).
create or replace function app.recuar_para_etapa(p_contratacao uuid, p_para smallint, p_de smallint, p_tipo text, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_depois smallint[];
begin
  select * into v_c from public.contratacoes where id = p_contratacao;
  with recursive d(etapa) as (
    select p_para
    union
    select f.etapa from public.etapas_fluxo f join d on d.etapa = any(f.dependencias) where f.versao = v_c.fluxo_versao
  )
  select coalesce(array_agg(etapa), '{}') into v_depois from d where etapa <> p_para;

  perform set_config('app.devolucao', '1', true);
  update public.contratacao_etapas set situacao = 'pendente', iniciada_em = null, concluida_em = null, concluida_por = null
  where contratacao_id = p_contratacao and etapa = any(v_depois) and situacao <> 'pendente';
  update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now(), concluida_em = null, concluida_por = null
  where contratacao_id = p_contratacao and etapa = p_para;
  perform set_config('app.devolucao', '', true);
  update public.etapa_checklist set marcado = false, marcado_por = null, marcado_em = null
  where contratacao_id = p_contratacao and (etapa = p_para or etapa = any(v_depois));
  if p_para = 9 or 9 = any(v_depois) then
    delete from public.assinaturas where contratacao_id = p_contratacao;
  end if;
  if v_c.situacao = 'liberada' then
    update public.contratacoes set situacao = 'em_andamento' where id = p_contratacao;
  end if;
  insert into public.contratacao_devolucoes (contratacao_id, tipo, de_etapa, para_etapa, motivo)
  values (p_contratacao, p_tipo, p_de, p_para, btrim(p_motivo));
  perform app.avisar(
    array(select app.destinatarios_da_etapa(v_c.obra_id, p_para, v_c.fluxo_versao)),
    case when p_tipo = 'reabertura' then 'reabertura' else 'devolucao' end,
    v_c.codigo || case when p_tipo = 'reabertura' then ': etapa ' || p_para || ' reaberta' else ': etapa ' || p_para || ' devolvida para ajuste' end,
    btrim(p_motivo), p_contratacao, 'dev:' || p_contratacao || ':' || p_para || ':' || extract(epoch from clock_timestamp())::bigint);
end $$;
revoke all on function app.recuar_para_etapa(uuid, smallint, smallint, text, text) from public, anon, authenticated;

-- Urgência ----------------------------------------------------------------------------------------
alter table public.contratacoes
  add column urgente boolean not null default false,
  add column urgente_motivo text check (urgente_motivo is null or length(urgente_motivo) <= 300),
  add column urgente_data date,
  add column urgente_por uuid references public.usuarios (id),
  add column urgente_em timestamptz,
  add constraint urgente_completa check (not urgente or (urgente_motivo is not null and urgente_data is not null));
comment on column public.contratacoes.urgente is 'Marca para todos verem. Não muda o prazo do Suprimentos e não precisa de aceite.';

-- Coordenador ou auxiliar da obra marca ou tira a urgência. Marcar exige motivo e data de necessidade.
create function public.marcar_urgencia(p_contratacao uuid, p_urgente boolean, p_motivo text, p_data date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  select * into v_c from public.contratacoes where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou encerrada.' using errcode = 'P0001'; end if;
  if not app.pode_na_obra(v_c.obra_id) then raise exception 'Só a obra marca urgência.' using errcode = '42501'; end if;
  if p_urgente is null then raise exception 'Informe se é urgente.' using errcode = 'P0001'; end if;
  if p_urgente then
    if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Explique o motivo da urgência.' using errcode = 'P0001'; end if;
    if p_data is null then raise exception 'Informe a data de necessidade.' using errcode = 'P0001'; end if;
    update public.contratacoes set urgente = true, urgente_motivo = btrim(p_motivo), urgente_data = p_data, urgente_por = auth.uid(), urgente_em = now()
    where id = p_contratacao;
    perform app.avisar(
      array(select u.id from public.usuario_papeis up join public.usuarios u on u.id = up.usuario_id and u.ativo and u.tipo = 'interno' where up.papel = 'gerente_suprimentos'),
      'urgencia', v_c.codigo || ': marcada como urgente (necessária até ' || to_char(p_data, 'DD/MM/YYYY') || ')', btrim(p_motivo), v_c.id,
      'urgencia:' || v_c.id || ':' || to_char(p_data, 'YYYYMMDD') || ':' || extract(epoch from clock_timestamp())::bigint);
  else
    update public.contratacoes set urgente = false, urgente_motivo = null, urgente_data = null, urgente_por = null, urgente_em = null
    where id = p_contratacao;
  end if;
end $$;

-- Aviso de prazo, chamado pela tarefa agendada (só o servidor): vencendo (hoje ou amanhã) ou vencido, uma vez por dia.
create function public.gerar_aviso_prazo(p_contratacao uuid, p_etapa smallint, p_tipo text, p_dia date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  if p_tipo not in ('prazo_vencendo', 'prazo_vencido') then raise exception 'Tipo inválido.' using errcode = 'P0001'; end if;
  select * into v_c from public.contratacoes where id = p_contratacao and situacao = 'em_andamento';
  if not found then return; end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = p_etapa and situacao = 'em_andamento') then return; end if;
  perform app.avisar(
    array(select app.destinatarios_da_etapa(v_c.obra_id, p_etapa, v_c.fluxo_versao)),
    p_tipo,
    v_c.codigo || case when p_tipo = 'prazo_vencido' then ': prazo da etapa ' || p_etapa || ' venceu' else ': prazo da etapa ' || p_etapa || ' vence em breve' end,
    null, p_contratacao, 'prazo:' || p_contratacao || ':' || p_etapa || ':' || p_tipo || ':' || to_char(p_dia, 'YYYYMMDD'));
end $$;

-- Permissões --------------------------------------------------------------------------------------
revoke all on function app.url_site() from public, anon, authenticated;
revoke all on function app.destinatarios_da_etapa(uuid, smallint, int) from public, anon, authenticated;
revoke all on function app.avisar(uuid[], text, text, text, uuid, text) from public, anon, authenticated;
revoke all on function app.avisar_mudanca_etapa() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.salvar_preferencias_aviso(boolean, boolean)',
    'public.marcar_avisos_lidos(uuid[])',
    'public.marcar_urgencia(uuid, boolean, text, date)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
revoke all on function public.gerar_aviso_prazo(uuid, smallint, text, date) from public, anon, authenticated;
grant execute on function public.gerar_aviso_prazo(uuid, smallint, text, date) to service_role;
