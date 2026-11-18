-- Fase RH-5: liberação para o financeiro. A empresa fica liberada para receber na competência quando toda a
-- documentação mensal (empresa + funcionários liberados) está aprovada. Automático (decisão de 17/11): libera ao
-- aprovar o último item e desfaz se algum voltar a pendente. Sino na hora; e-mail com o resumo na manhã seguinte.

create table public.liberacoes_financeiras (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  competencia date not null check (extract(day from competencia) = 1),
  liberada_em timestamptz not null default now(),
  revogada_em timestamptz,
  motivo_revogacao text check (motivo_revogacao is null or length(motivo_revogacao) <= 300)
);
create unique index liberacoes_ativas_idx on public.liberacoes_financeiras (empresa_id, competencia) where revogada_em is null;
create index liberacoes_competencia_idx on public.liberacoes_financeiras (competencia);
alter table public.liberacoes_financeiras enable row level security;
revoke all on public.liberacoes_financeiras from anon;
revoke insert, update, delete, truncate on public.liberacoes_financeiras from authenticated;

-- Texto em vez de app.tem_papel('financeiro'): o valor do enum é criado na migration anterior.
create function app.tem_papel_financeiro() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuario_papeis up join public.usuarios u on u.id = up.usuario_id
    where up.usuario_id = auth.uid() and up.papel::text = 'financeiro' and u.ativo and u.tipo = 'interno'
  )
$$;

create function app.pode_ver_financeiro() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel_financeiro() or app.admin_verificado() or app.rh_verificado() or app.sst_verificado() or app.tem_papel('direcao')
$$;

create policy liberacoes_ler on public.liberacoes_financeiras for select to authenticated using ((select app.pode_ver_financeiro()));

-- Situação da documentação mensal de uma empresa numa competência (empresa + funcionários liberados em obra).
create function app.situacao_mensal(p_empresa uuid, p_competencia date)
returns table (exigidos int, aprovados int, em_analise int, reprovados int)
language sql stable security definer set search_path = '' as $$
  with itens as (
    select t.codigo, null::uuid as vinculo_id
    from public.matriz_documental m
    join public.tipos_documento t on t.codigo = m.tipo_documento
    join public.empresas_terceiras e on e.id = p_empresa
    where m.ativo and t.ativo and t.etapa = 'mensal' and m.aplica_a = 'empresa'
      and (not t.so_optante_simples or e.optante_simples)
    union all
    select t.codigo, v.id
    from public.vinculos v
    join public.matriz_documental m on m.aplica_a::text = v.tipo::text and m.ativo
    join public.tipos_documento t on t.codigo = m.tipo_documento and t.ativo and t.etapa = 'mensal'
    where v.empresa_id = p_empresa and v.ativo
      and exists (select 1 from public.alocacoes a where a.vinculo_id = v.id and a.situacao = 'liberado')
  )
  select count(*)::int,
    (count(*) filter (where d.situacao = 'aprovado'))::int,
    (count(*) filter (where d.situacao = 'enviado'))::int,
    (count(*) filter (where d.situacao = 'reprovado'))::int
  from itens i
  left join public.documentos d on d.tipo_documento = i.codigo and d.empresa_id = p_empresa
    and d.vinculo_id is not distinct from i.vinculo_id and d.competencia = p_competencia
$$;

create function app.usuarios_financeiro() returns uuid[]
language sql stable security definer set search_path = '' as $$
  select coalesce(array_agg(usuario_id), '{}') from public.usuario_papeis where papel::text = 'financeiro'
$$;

create function app.atualizar_liberacao(p_empresa uuid, p_competencia date) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_s record;
  v_ativa uuid;
  v_nome text;
  v_mes text := to_char(p_competencia, 'MM/YYYY');
begin
  select * into v_s from app.situacao_mensal(p_empresa, p_competencia);
  select id into v_ativa from public.liberacoes_financeiras where empresa_id = p_empresa and competencia = p_competencia and revogada_em is null;
  select razao_social into v_nome from public.empresas_terceiras where id = p_empresa;

  if v_s.exigidos > 0 and v_s.aprovados = v_s.exigidos and v_ativa is null then
    insert into public.liberacoes_financeiras (empresa_id, competencia) values (p_empresa, p_competencia);
    perform app.avisar(app.usuarios_financeiro(), 'financeiro', 'Liberada para pagamento: ' || v_nome || ' (' || v_mes || ')',
      'Documentação mensal completa e aprovada.', null, 'liberada:' || p_empresa || ':' || p_competencia || ':' || clock_timestamp());
  elsif v_ativa is not null and v_s.aprovados < v_s.exigidos then
    update public.liberacoes_financeiras set revogada_em = now(), motivo_revogacao = 'Documento mensal reaberto ou reprovado.'
    where id = v_ativa;
    perform app.avisar(app.usuarios_financeiro(), 'financeiro', 'Liberação desfeita: ' || v_nome || ' (' || v_mes || ')',
      'Um documento mensal voltou para análise ou foi reprovado. Aguarde nova liberação.', null,
      'revogada:' || p_empresa || ':' || p_competencia || ':' || clock_timestamp());
  end if;
end $$;

create function app.documento_mensal_mudou() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.competencia is not null and (tg_op = 'INSERT' or new.situacao is distinct from old.situacao) then
    perform app.atualizar_liberacao(new.empresa_id, new.competencia);
  end if;
  return null;
end $$;
create trigger documento_mensal_liberacao after insert or update of situacao on public.documentos
  for each row execute function app.documento_mensal_mudou();

alter table public.avisos_internos drop constraint avisos_internos_tipo_check;
alter table public.avisos_internos add constraint avisos_internos_tipo_check
  check (tipo in ('etapa', 'devolucao', 'reabertura', 'urgencia', 'prazo_vencendo', 'prazo_vencido', 'autorizada', 'liberada', 'analise', 'financeiro'));

-- Quadro da aba "Liberação financeira": empresas com gente liberada em obra ou com liberação na competência.
create function public.painel_financeiro(p_competencia date)
returns table (
  empresa_id uuid, razao_social text, cnpj text, obras text,
  exigidos int, aprovados int, em_analise int, reprovados int, liberada_em timestamptz
)
language plpgsql stable security definer set search_path = '' as $$
begin
  if not app.pode_ver_financeiro() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return query
  select e.id, e.razao_social::text, e.cnpj::text,
    (select string_agg(distinct o.nome, ', ') from public.vinculos v join public.alocacoes a on a.vinculo_id = v.id
       join public.obras o on o.id = a.obra_id where v.empresa_id = e.id and a.situacao = 'liberado'),
    s.exigidos, s.aprovados, s.em_analise, s.reprovados, l.liberada_em
  from public.empresas_terceiras e
  cross join lateral app.situacao_mensal(e.id, date_trunc('month', p_competencia)::date) s
  left join public.liberacoes_financeiras l on l.empresa_id = e.id and l.competencia = date_trunc('month', p_competencia)::date and l.revogada_em is null
  where l.id is not null
     or (e.situacao = 'aprovada' and exists (select 1 from public.vinculos v join public.alocacoes a on a.vinculo_id = v.id
           where v.empresa_id = e.id and v.ativo and a.situacao = 'liberado'))
  order by e.razao_social;
end $$;
revoke all on function public.painel_financeiro(date) from public, anon;
grant execute on function public.painel_financeiro(date) to authenticated;

-- Resumo diário por e-mail para o financeiro: empresas liberadas no dia anterior (rotina das 9h).
create function public.resumo_financeiro(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_lista text;
  v_u record;
  v_n int := 0;
begin
  select string_agg('- ' || e.razao_social || ' (CNPJ ' || e.cnpj || '): competência ' || to_char(l.competencia, 'MM/YYYY'), E'\n' order by e.razao_social)
  into v_lista
  from public.liberacoes_financeiras l join public.empresas_terceiras e on e.id = l.empresa_id
  where l.revogada_em is null and (l.liberada_em at time zone 'America/Sao_Paulo')::date = p_hoje - 1;
  if v_lista is null then return 0; end if;
  for v_u in select u.email from public.usuarios u where u.id = any(app.usuarios_financeiro()) and u.ativo and u.email ~ '^\S+@\S+\.\S+$' loop
    insert into public.notificacoes (destinatario, assunto, texto)
    values (v_u.email, 'Empresas liberadas para pagamento em ' || to_char(p_hoje - 1, 'DD/MM/YYYY'),
      'Documentação mensal completa e aprovada:' || E'\n' || v_lista || E'\n\nVer no Nexus: ' || app.url_site() || '/apoio/financeiro');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.resumo_financeiro(date) from public, anon, authenticated;
revoke execute on function app.situacao_mensal(uuid, date), app.atualizar_liberacao(uuid, date), app.documento_mensal_mudou(),
  app.usuarios_financeiro(), app.tem_papel_financeiro() from public, anon;
-- Usadas pela RLS (rodam com o papel de quem consulta): só o usuário logado executa.
revoke all on function app.tem_papel_financeiro(), app.pode_ver_financeiro() from public, anon;
grant execute on function app.tem_papel_financeiro(), app.pode_ver_financeiro() to authenticated;

-- Correção da fase RH-2: funções internas da análise ficaram executáveis por qualquer um. Só as funções do banco as chamam.
revoke all on function app.pode_decidir_tipo(text), app.nome_do_envio(uuid), app.itens_sem_decisao(uuid, text),
  app.avisar_envio(uuid), app.avisar_envio_trigger() from public, anon, authenticated;
