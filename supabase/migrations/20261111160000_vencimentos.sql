-- F5: vencimentos (bloqueio automático, A5) e avisos 30/15/0 dias. Roda uma vez por dia (tarefa agendada).

-- Validade de um documento (mesma regra de modules/terceiros/dominio/documentos.ts).
create function app.validade_documento(p_tipo text, p_emissao date, p_validade date) returns date
language sql stable security definer set search_path = '' as $$
  select case t.regra_validade
    when 'meses_apos_emissao' then
      case when p_emissao is null then null
      else (p_emissao + make_interval(months => coalesce((select (valor ->> t.chave_validade)::int from public.parametros where chave = 'validade_documentos_meses'), 12)) - interval '1 day')::date end
    when 'data_informada' then p_validade
    else null end
  from public.tipos_documento t where t.codigo = p_tipo
$$;

create table public.avisos_vencimento (
  documento_id uuid not null references public.documentos (id) on delete cascade,
  validade date not null,
  marco int not null check (marco in (30, 15, 0)),
  criado_em timestamptz not null default now(),
  primary key (documento_id, validade, marco)
);
alter table public.avisos_vencimento enable row level security;
revoke all on public.avisos_vencimento from anon, authenticated;
grant select on public.avisos_vencimento to authenticated;
create policy avisos_vencimento_admin on public.avisos_vencimento for select to authenticated using (app.admin_verificado());

-- Processamento diário. Só a tarefa agendada (service role) chama; pode rodar mais de uma vez no dia.
create function public.processar_vencimentos(p_hoje date) returns jsonb
language plpgsql security definer set search_path = '' as $$
declare
  v_vencidos int;
  v_bloqueados int;
  v_avisos int;
begin
  -- 1. Documentos aprovados que passaram da validade
  with venc as (
    update public.documentos d set situacao = 'vencido'
    where d.situacao = 'aprovado' and app.validade_documento(d.tipo_documento, d.data_emissao, d.data_validade) < p_hoje
    returning d.id
  ) select count(*) into v_vencidos from venc;

  -- 2. Pessoa com documento vencido fica bloqueada na obra (A5)
  with bloq as (
    update public.alocacoes a set situacao = 'bloqueado',
      bloqueio_motivo = 'Documento vencido: ' || (
        select string_agg(t.nome, ', ') from public.documentos d join public.tipos_documento t on t.codigo = d.tipo_documento
        where d.vinculo_id = a.vinculo_id and d.situacao = 'vencido')
    where a.situacao in ('liberado', 'integracao_agendada', 'aguardando_empresa')
      and exists (select 1 from public.documentos d where d.vinculo_id = a.vinculo_id and d.situacao = 'vencido')
    returning a.id
  ) select count(*) into v_bloqueados from bloq;

  -- 3. Documento da empresa vencido: empresa fica pendente e a equipe liberada é bloqueada
  update public.empresas_terceiras e set situacao = 'pendente'
  where e.situacao = 'aprovada'
    and exists (select 1 from public.documentos d where d.empresa_id = e.id and d.vinculo_id is null and d.situacao = 'vencido');
  update public.alocacoes a set situacao = 'bloqueado', bloqueio_motivo = 'Documento da empresa vencido'
  from public.vinculos v
  where v.id = a.vinculo_id and a.situacao in ('liberado', 'integracao_agendada')
    and exists (select 1 from public.documentos d where d.empresa_id = v.empresa_id and d.vinculo_id is null and d.situacao = 'vencido');

  -- 4. Avisos a 30, 15 e 0 dias do vencimento (um por marco)
  with alvo as (
    select d.id, d.empresa_id, t.nome as documento, p.nome as pessoa,
           app.validade_documento(d.tipo_documento, d.data_emissao, d.data_validade) as validade
    from public.documentos d
    join public.tipos_documento t on t.codigo = d.tipo_documento
    left join public.vinculos v on v.id = d.vinculo_id
    left join public.pessoas p on p.id = v.pessoa_id
    where d.situacao = 'aprovado'
  ), marcos as (
    select a.*, (a.validade - p_hoje) as dias from alvo a
    where a.validade is not null and (a.validade - p_hoje) in (30, 15, 0)
  ), novos as (
    insert into public.avisos_vencimento (documento_id, validade, marco)
    select id, validade, dias from marcos
    on conflict do nothing
    returning documento_id, marco
  ), fila as (
    insert into public.notificacoes (empresa_id, destinatario, assunto, texto)
    select m.empresa_id, e.email,
      case when n.marco = 0 then 'Documento vence hoje: ' else 'Documento vence em ' || n.marco || ' dias: ' end || m.documento,
      m.documento || coalesce(' de ' || m.pessoa, ' da empresa') || ' vale até ' || to_char(m.validade, 'DD/MM/YYYY') || '. '
        || 'Envie o documento renovado pelo portal para não haver bloqueio de acesso à obra.'
    from novos n join marcos m on m.id = n.documento_id join public.empresas_terceiras e on e.id = m.empresa_id
    returning 1
  ) select count(*) into v_avisos from fila;

  return jsonb_build_object('vencidos', v_vencidos, 'bloqueados', v_bloqueados, 'avisos', v_avisos);
end $$;

revoke all on function public.processar_vencimentos(date) from public, anon, authenticated;
grant execute on function public.processar_vencimentos(date) to service_role;
revoke all on function app.validade_documento(text, date, date) from public;
grant execute on function app.validade_documento(text, date, date) to authenticated, service_role;
grant usage on schema app to service_role;

-- Conclusão da análise: quem já tinha feito a integração volta direto para liberado
-- (renovação de documento depois de bloqueio). Reintegração periódica depende da P5.

create or replace function public.concluir_envio(p_envio uuid, p_data_integracao date, p_assunto text, p_texto text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.envios_analise;
  v_reprovados int;
  v_empresa_aprovada boolean;
  v_resultado text;
  v_email text;
begin
  if not app.rh_verificado() then
    raise exception 'Só o RH, com verificação em duas etapas, conclui análises.' using errcode = '42501';
  end if;
  select * into v_envio from public.envios_analise where id = p_envio and situacao = 'aberto' for update;
  if not found then
    raise exception 'Envio não encontrado ou já concluído.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.envio_itens where envio_id = p_envio and decisao is null) then
    raise exception 'Ainda há documentos sem decisão.' using errcode = 'P0001';
  end if;
  if p_data_integracao is null or p_data_integracao <= (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Data de integração inválida.' using errcode = 'P0001';
  end if;

  -- Documentos recebem a decisão.
  update public.documentos d set
    situacao = i.decisao::text::public.situacao_documento,
    motivo_reprovacao = i.motivo, analisado_por = i.decidido_por, analisado_em = i.decidido_em
  from public.envio_itens i where i.envio_id = p_envio and i.documento_id = d.id;

  select count(*) into v_reprovados from public.envio_itens where envio_id = p_envio and decisao = 'reprovado';
  update public.envios_analise set situacao = 'concluido', concluido_em = now(), concluido_por = auth.uid() where id = p_envio;

  if v_envio.vinculo_id is null then
    -- Documentos da empresa
    if v_reprovados > 0 then
      update public.empresas_terceiras set situacao = 'pendente' where id = v_envio.empresa_id;
      v_resultado := 'empresa_pendente';
    else
      update public.empresas_terceiras set situacao = 'aprovada' where id = v_envio.empresa_id;
      -- Quem já estava aprovado esperando a empresa vai para a integração.
      update public.alocacoes a set situacao = 'integracao_agendada', integracao_data = p_data_integracao
      from public.vinculos v where v.id = a.vinculo_id and v.empresa_id = v_envio.empresa_id and a.situacao = 'aguardando_empresa';
      -- Bloqueados só por documento da empresa vencido voltam a liberado.
      update public.alocacoes a set situacao = 'liberado', bloqueio_motivo = null
      from public.vinculos v where v.id = a.vinculo_id and v.empresa_id = v_envio.empresa_id
        and a.situacao = 'bloqueado' and a.bloqueio_motivo like 'Documento da empresa vencido%'
        and not exists (select 1 from public.documentos d where d.vinculo_id = a.vinculo_id and d.situacao in ('vencido', 'reprovado'));
      v_resultado := 'empresa_aprovada';
    end if;
  else
    -- Documentos de uma pessoa
    select situacao = 'aprovada' into v_empresa_aprovada from public.empresas_terceiras where id = v_envio.empresa_id;
    if v_reprovados > 0 then
      update public.alocacoes set situacao = 'pendente' where vinculo_id = v_envio.vinculo_id and situacao = 'em_analise';
      v_resultado := 'pessoa_pendente';
    elsif exists (
      select 1 from public.documentos where vinculo_id = v_envio.vinculo_id and situacao in ('anexado', 'reprovado', 'vencido')
    ) then
      update public.alocacoes set situacao = 'pendente' where vinculo_id = v_envio.vinculo_id and situacao = 'em_analise';
      v_resultado := 'pessoa_pendente';
    elsif v_empresa_aprovada then
      -- Quem já fez a integração (renovou documento depois de bloqueio) volta direto para liberado.
      update public.alocacoes set
        situacao = case when liberado_em is not null then 'liberado' else 'integracao_agendada' end::public.situacao_alocacao,
        integracao_data = case when liberado_em is not null then integracao_data else p_data_integracao end,
        bloqueio_motivo = null
      where vinculo_id = v_envio.vinculo_id and situacao = 'em_analise';
      v_resultado := 'pessoa_integracao';
    else
      update public.alocacoes set situacao = 'aguardando_empresa' where vinculo_id = v_envio.vinculo_id and situacao = 'em_analise';
      v_resultado := 'pessoa_aguardando_empresa';
    end if;
  end if;

  select email into v_email from public.empresas_terceiras where id = v_envio.empresa_id;
  insert into public.notificacoes (empresa_id, destinatario, assunto, texto)
  values (v_envio.empresa_id, v_email, left(p_assunto, 200), left(p_texto, 4000));
  return v_resultado;
end $$;
