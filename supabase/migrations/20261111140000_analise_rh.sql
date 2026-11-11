-- F3: análise do RH (documento por documento), conclusão do envio, decisões de visita e fila de avisos.

create type public.decisao_documento as enum ('aprovado', 'reprovado');
create type public.situacao_notificacao as enum ('pendente', 'enviada', 'erro');

create table public.envio_itens (
  id uuid primary key default gen_random_uuid(),
  envio_id uuid not null references public.envios_analise (id) on delete cascade,
  documento_id uuid not null references public.documentos (id) on delete cascade,
  arquivo_id uuid references public.documento_arquivos (id),
  decisao public.decisao_documento,
  motivo text check (motivo is null or length(motivo) <= 300),
  decidido_por uuid references public.usuarios (id),
  decidido_em timestamptz,
  unique (envio_id, documento_id),
  check (decisao is distinct from 'reprovado' or length(btrim(coalesce(motivo, ''))) >= 3)
);

-- Fila de avisos (outbox). O envio pelo Resend é feito pelo servidor; nada se perde se o envio falhar.
create table public.notificacoes (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid references public.empresas_terceiras (id) on delete cascade,
  destinatario text not null check (destinatario ~ '^\S+@\S+\.\S+$'),
  canal text not null default 'email' check (canal in ('email')),
  assunto text not null check (length(assunto) <= 200),
  texto text not null check (length(texto) <= 4000),
  situacao public.situacao_notificacao not null default 'pendente',
  tentativas int not null default 0,
  erro text,
  criado_em timestamptz not null default now(),
  enviado_em timestamptz
);
create index notificacoes_pendentes_idx on public.notificacoes (situacao, criado_em);

create trigger auditar_envio_itens after insert or update or delete on public.envio_itens for each row execute function app.auditar();

alter table public.envio_itens enable row level security;
alter table public.notificacoes enable row level security;
revoke all on public.envio_itens, public.notificacoes from anon;
revoke insert, update, delete, truncate on public.envio_itens, public.notificacoes from authenticated;

create function app.rh_verificado() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel('rh') and app.aal2()
$$;

create policy envio_itens_ler on public.envio_itens for select to authenticated
  using (
    app.usuario_interno_ativo()
    or exists (select 1 from public.envios_analise e where e.id = envio_itens.envio_id and app.usuario_externo_da_empresa(e.empresa_id))
  );
create policy notificacoes_ler on public.notificacoes for select to authenticated
  using (app.admin_verificado() or app.rh_verificado() or app.usuario_externo_da_empresa(empresa_id));

-- Os envios passam a registrar os itens (documento + versão do arquivo) que o RH vai analisar.
create or replace function public.enviar_documentos_empresa(p_empresa uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_envio uuid;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado') then
    raise exception 'Não há documentos novos para enviar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.envios_analise where empresa_id = p_empresa and vinculo_id is null and situacao = 'aberto') then
    raise exception 'Já existe um envio em análise.' using errcode = 'P0001';
  end if;
  insert into public.envios_analise (empresa_id) values (p_empresa) returning id into v_envio;
  insert into public.envio_itens (envio_id, documento_id, arquivo_id)
  select v_envio, id, arquivo_atual_id from public.documentos
  where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado';
  update public.documentos set situacao = 'enviado' where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado';
  update public.empresas_terceiras set situacao = 'em_analise' where id = p_empresa;
  return v_envio;
end $$;

create or replace function public.enviar_documentos_pessoa(p_vinculo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
  v_envio uuid;
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where vinculo_id = p_vinculo and situacao = 'anexado') then
    raise exception 'Não há documentos novos para enviar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.envios_analise where vinculo_id = p_vinculo and situacao = 'aberto') then
    raise exception 'Já existe um envio em análise para esta pessoa.' using errcode = 'P0001';
  end if;
  insert into public.envios_analise (empresa_id, vinculo_id) values (v_empresa, p_vinculo) returning id into v_envio;
  insert into public.envio_itens (envio_id, documento_id, arquivo_id)
  select v_envio, id, arquivo_atual_id from public.documentos where vinculo_id = p_vinculo and situacao = 'anexado';
  update public.documentos set situacao = 'enviado' where vinculo_id = p_vinculo and situacao = 'anexado';
  update public.alocacoes set situacao = 'em_analise'
  where vinculo_id = p_vinculo and situacao in ('rascunho', 'pendente', 'bloqueado');
  return v_envio;
end $$;

-- RH decide um documento do envio.
create function public.decidir_documento(p_item uuid, p_decisao public.decisao_documento, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_item public.envio_itens;
begin
  if not app.rh_verificado() then
    raise exception 'Só o RH, com verificação em duas etapas, analisa documentos.' using errcode = '42501';
  end if;
  select i.* into v_item from public.envio_itens i join public.envios_analise e on e.id = i.envio_id
  where i.id = p_item and e.situacao = 'aberto';
  if not found then
    raise exception 'Item não encontrado ou análise já concluída.' using errcode = 'P0001';
  end if;
  if p_decisao = 'reprovado' and length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da reprovação.' using errcode = 'P0001';
  end if;
  update public.envio_itens set decisao = p_decisao, motivo = case when p_decisao = 'reprovado' then btrim(p_motivo) end,
    decidido_por = auth.uid(), decidido_em = now()
  where id = p_item;
end $$;

-- RH conclui o envio. Situações e integração são calculadas aqui; a data da integração e o texto do aviso
-- vêm do servidor (regra das 18h com feriados em modules/terceiros/dominio/integracao.ts).
create function public.concluir_envio(p_envio uuid, p_data_integracao date, p_assunto text, p_texto text) returns text
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
      update public.alocacoes set situacao = 'integracao_agendada', integracao_data = p_data_integracao
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

-- RH decide pedido de visita de sócio esporádico.
create function public.decidir_visita(p_visita uuid, p_aprovar boolean, p_motivo text, p_assunto text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid;
  v_email text;
begin
  if not app.rh_verificado() then
    raise exception 'Só o RH, com verificação em duas etapas, decide visitas.' using errcode = '42501';
  end if;
  if not p_aprovar and length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da recusa.' using errcode = 'P0001';
  end if;
  update public.visitas set situacao = case when p_aprovar then 'aprovada' else 'recusada' end::public.situacao_visita,
    motivo = case when p_aprovar then null else btrim(p_motivo) end, decidido_por = auth.uid(), decidido_em = now()
  where id = p_visita and situacao = 'solicitada'
  returning app.empresa_do_vinculo(vinculo_id) into v_empresa;
  if v_empresa is null then
    raise exception 'Pedido não encontrado ou já decidido.' using errcode = 'P0001';
  end if;
  select email into v_email from public.empresas_terceiras where id = v_empresa;
  insert into public.notificacoes (empresa_id, destinatario, assunto, texto) values (v_empresa, v_email, left(p_assunto, 200), left(p_texto, 4000));
end $$;

revoke all on function public.decidir_documento(uuid, public.decisao_documento, text), public.concluir_envio(uuid, date, text, text),
  public.decidir_visita(uuid, boolean, text, text, text) from public, anon;
grant execute on function public.decidir_documento(uuid, public.decisao_documento, text), public.concluir_envio(uuid, date, text, text),
  public.decidir_visita(uuid, boolean, text, text, text) to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
