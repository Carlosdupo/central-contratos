-- Fase 2: nível "auxiliar" da obra e devolução de etapa. Só acrescenta (coluna, tabela, funções); nada é apagado.
--
-- Auxiliar de obra: o usuário continua com o papel coordenador_obra e fica ligado à obra com nivel = 'auxiliar'
-- (por obra: a mesma pessoa pode ser coordenadora numa obra e auxiliar em outra). O auxiliar vê a obra, abre a
-- solicitação e age nas etapas 1 a 3; a etapa 4 em diante é só do coordenador. Não cancela nem assina.
--
-- Devolução: qualquer responsável da etapa em andamento devolve para uma etapa anterior já concluída, com motivo.
-- A etapa escolhida reabre (o prazo recomeça) e as que dependem dela voltam a pendente, com checklist limpo.

alter table public.usuario_obras
  add column nivel text not null default 'coordenador' check (nivel in ('coordenador', 'auxiliar'));
comment on column public.usuario_obras.nivel is 'coordenador: age em todas as etapas da obra. auxiliar: abre e age até a etapa 3.';

-- Coordenador ou auxiliar da obra.
create function app.pode_na_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.tem_papel('coordenador_obra')
    and exists (select 1 from public.usuario_obras where usuario_id = auth.uid() and obra_id = p_obra)
$$;

-- Quem age como coordenador: só o nível coordenador (o auxiliar não).
create or replace function app.pode_agir_como(p_papel public.papel, p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_papel = 'coordenador_obra' then app.tem_papel('coordenador_obra') and exists (select 1 from public.usuario_obras where usuario_id = auth.uid() and obra_id = p_obra and nivel = 'coordenador')
    when p_papel in ('rh', 'sst') then app.tem_papel(p_papel) and app.aal2()
    when p_papel = 'suprimentos' then app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos')
    else app.tem_papel(p_papel)
  end
$$;

-- Quem age numa etapa: o papel da etapa; nas etapas 1 a 3 o auxiliar da obra também.
create function app.pode_agir_na_etapa(p_papel public.papel, p_obra uuid, p_etapa smallint) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.pode_agir_como(p_papel, p_obra) or (p_papel = 'coordenador_obra' and p_etapa <= 3 and app.pode_na_obra(p_obra))
$$;

create or replace function app.exigir_etapa_em_andamento(p_contratacao uuid, p_etapa smallint) returns public.contratacoes
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_papel public.papel;
begin
  select * into v_c from public.contratacoes where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou encerrada.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = p_etapa and situacao = 'em_andamento') then
    raise exception 'Esta etapa não está em andamento.' using errcode = 'P0001';
  end if;
  select papel into v_papel from public.etapas_fluxo where versao = v_c.fluxo_versao and etapa = p_etapa;
  if v_papel is null or not app.pode_agir_na_etapa(v_papel, v_c.obra_id, p_etapa) then
    raise exception 'Esta etapa é de outra área.' using errcode = '42501';
  end if;
  return v_c;
end $$;

-- Histórico de devoluções e reaberturas ---------------------------------------------------------
create table public.contratacao_devolucoes (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  tipo text not null default 'devolucao' check (tipo in ('devolucao', 'reabertura')),
  de_etapa smallint check (de_etapa between 1 and 12),
  para_etapa smallint not null check (para_etapa between 1 and 12),
  motivo text not null check (length(btrim(motivo)) >= 5),
  por uuid not null references public.usuarios (id) default auth.uid(),
  em timestamptz not null default now()
);
create index contratacao_devolucoes_idx on public.contratacao_devolucoes (contratacao_id, em);
alter table public.contratacao_devolucoes enable row level security;
revoke all on public.contratacao_devolucoes from anon;
revoke insert, update, delete, truncate on public.contratacao_devolucoes from authenticated;
create policy devolucoes_ler on public.contratacao_devolucoes for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));
create trigger auditar_devolucoes after insert or update or delete on public.contratacao_devolucoes for each row execute function app.auditar();

-- Reabre a etapa p_para e recua as que dependem dela (transitivamente): voltam a pendente, sem checklist
-- marcado nem assinaturas. O prazo da etapa reaberta recomeça agora.
create function app.recuar_para_etapa(p_contratacao uuid, p_para smallint, p_de smallint, p_tipo text, p_motivo text) returns void
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

  update public.contratacao_etapas set situacao = 'pendente', iniciada_em = null, concluida_em = null, concluida_por = null
  where contratacao_id = p_contratacao and etapa = any(v_depois) and situacao <> 'pendente';
  update public.contratacao_etapas set situacao = 'em_andamento', iniciada_em = now(), concluida_em = null, concluida_por = null
  where contratacao_id = p_contratacao and etapa = p_para;
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
end $$;
revoke all on function app.recuar_para_etapa(uuid, smallint, smallint, text, text) from public, anon, authenticated;

-- Devolver para ajuste: o responsável da etapa em andamento (p_de) devolve para uma etapa anterior já concluída
-- da qual ela depende (p_para), com motivo.
create function public.devolver_etapa(p_contratacao uuid, p_de smallint, p_para smallint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo da devolução.' using errcode = 'P0001'; end if;
  v_c := app.exigir_etapa_em_andamento(p_contratacao, p_de);
  if p_para is null or p_para >= p_de then
    raise exception 'Escolha uma etapa anterior.' using errcode = 'P0001';
  end if;
  if not exists (
    with recursive a(etapa) as (
      select unnest(f.dependencias) from public.etapas_fluxo f where f.versao = v_c.fluxo_versao and f.etapa = p_de
      union
      select unnest(f.dependencias) from public.etapas_fluxo f join a on a.etapa = f.etapa where f.versao = v_c.fluxo_versao
    )
    select 1 from a where a.etapa = p_para
  ) or not exists (
    select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = p_para and situacao = 'concluida'
  ) then
    raise exception 'Só dá para devolver para uma etapa anterior já concluída.' using errcode = 'P0001';
  end if;
  perform app.recuar_para_etapa(p_contratacao, p_para, p_de, 'devolucao', p_motivo);
end $$;

-- Reabrir etapa (administrador): passa pela mesma regra, então também recua as etapas seguintes.
create or replace function public.reabrir_etapa(p_contratacao uuid, p_etapa smallint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.admin_verificado() then raise exception 'Só o administrador reabre etapa.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo da reabertura.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.contratacoes where id = p_contratacao and situacao in ('em_andamento', 'liberada')) then
    raise exception 'Contratação não encontrada ou cancelada.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = p_etapa and situacao in ('concluida', 'pulada')) then
    raise exception 'Etapa não está concluída.' using errcode = 'P0001';
  end if;
  perform app.recuar_para_etapa(p_contratacao, p_etapa, null, 'reabertura', p_motivo);
end $$;

-- Abertura: coordenador ou auxiliar da obra (o resto da função é o da fase 1B).
create or replace function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_matriz uuid, p_valor numeric, p_aditivo boolean, p_negociacao text,
  p_contrato_original text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_m public.matriz_contratacao;
  v_original text := nullif(btrim(coalesce(p_contrato_original, '')), '');
begin
  if not app.pode_na_obra(p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  select * into v_m from public.matriz_contratacao where id = p_matriz;
  if not found then raise exception 'Escolha a atividade da matriz.' using errcode = 'P0001'; end if;
  if p_valor is not null and p_valor <= 0 then raise exception 'Valor Orçamento inválido.' using errcode = 'P0001'; end if;
  if p_negociacao not in ('obra', 'suprimentos') then raise exception 'Escolha quem negocia.' using errcode = 'P0001'; end if;
  if p_negociacao = 'obra' and p_valor is not null and p_valor >= v_limite then
    raise exception '%', 'A partir de R$ ' || replace(to_char(v_limite, 'FM999G999G990'), ',', '.') || ' do orçamento, a negociação é de Suprimentos.'
      using errcode = 'P0001';
  end if;
  if coalesce(p_aditivo, false) then
    if v_original is null then raise exception 'Informe o nº do contrato original no Sienge.' using errcode = 'P0001'; end if;
    perform app.conferir_codigo_sienge(p_obra, v_original);
  else
    v_original := null;
  end if;
  insert into public.contratacoes (codigo, obra_id, servico, pacote, matriz_id, forma_legal, valor_orcado, tipo, negociacao, contrato_original, prazos, limite_obra)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico), left(coalesce(v_m.subgrupo_codigo, v_m.grupo_codigo) || ' ' || v_m.atividade, 120),
    v_m.id, v_m.forma_legal, p_valor,
    case when coalesce(p_aditivo, false) then 'aditivo' else 'contrato' end::public.tipo_contratacao,
    p_negociacao, v_original,
    coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}'),
    v_limite
  ) returning id into v_id;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = 1;
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'app.pode_na_obra(uuid)',
    'app.pode_agir_na_etapa(public.papel, uuid, smallint)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
  foreach f in array array[
    'public.devolver_etapa(uuid, smallint, smallint, text)',
    'public.reabrir_etapa(uuid, smallint, text)',
    'public.abrir_contratacao(uuid, text, uuid, numeric, boolean, text, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
