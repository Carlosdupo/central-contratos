-- Fase RH-2: RH e Segurança do Trabalho analisam o mesmo envio, cada um os documentos do seu tipo
-- (tipos_documento.responsavel). Quem decidir o último item conclui. Avisos no sino e por e-mail na chegada.

alter table public.avisos_internos drop constraint avisos_internos_tipo_check;
alter table public.avisos_internos add constraint avisos_internos_tipo_check
  check (tipo in ('etapa', 'devolucao', 'reabertura', 'urgencia', 'prazo_vencendo', 'prazo_vencido', 'autorizada', 'liberada', 'analise'));

create or replace function app.avisar(p_usuarios uuid[], p_tipo text, p_titulo text, p_texto text, p_contratacao uuid, p_chave text) returns void
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
    -- Por e-mail só o que chega para a pessoa fazer (etapa, devolução, reabertura, documentos para analisar).
    v_quer_email := p_tipo in ('etapa', 'devolucao', 'reabertura', 'analise')
      and coalesce((select email from public.preferencias_aviso where usuario_id = v_u.id), true);
    if v_quer_email and v_u.email ~ '^\S+@\S+\.\S+$'
       and (select count(*) from public.notificacoes where destinatario = v_u.email and criado_em > now() - interval '1 hour') < 20 then
      insert into public.notificacoes (destinatario, assunto, texto)
      values (v_u.email, left(p_titulo, 200),
        p_titulo || E'\n\nAbrir no Nexus: ' || app.url_site()
          || case when p_tipo = 'analise' then '/terceiros/analise' else coalesce('/contratacoes/' || p_contratacao::text, '/painel') end);
    end if;
  end loop;
end $$;

create function app.pode_decidir_tipo(p_responsavel text) returns boolean
language sql stable set search_path = '' as $$
  select case p_responsavel when 'rh' then app.rh_verificado() when 'sst' then app.sst_verificado() else false end
$$;

create function app.nome_do_envio(p_envio uuid) returns text
language sql stable security definer set search_path = '' as $$
  select coalesce(p.nome, e.razao_social)
  from public.envios_analise ea
  join public.empresas_terceiras e on e.id = ea.empresa_id
  left join public.vinculos v on v.id = ea.vinculo_id
  left join public.pessoas p on p.id = v.pessoa_id
  where ea.id = p_envio
$$;

create function app.itens_sem_decisao(p_envio uuid, p_responsavel text) returns int
language sql stable security definer set search_path = '' as $$
  select count(*)::int from public.envio_itens i
  join public.documentos d on d.id = i.documento_id
  join public.tipos_documento t on t.codigo = d.tipo_documento
  where i.envio_id = p_envio and i.decisao is null and t.responsavel = p_responsavel
$$;

-- Avisa quem tem documentos sem decisão no envio (RH, Segurança ou os dois).
create function app.avisar_envio(p_envio uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_resp text;
begin
  foreach v_resp in array array['rh', 'sst'] loop
    if app.itens_sem_decisao(p_envio, v_resp) > 0 then
      perform app.avisar(
        array(select usuario_id from public.usuario_papeis where papel::text = v_resp),
        'analise', 'Documentos para analisar: ' || app.nome_do_envio(p_envio),
        case v_resp when 'sst' then 'Itens da Segurança do Trabalho.' else 'Itens do RH.' end,
        null, 'envio:' || p_envio || ':' || v_resp || ':' || clock_timestamp());
    end if;
  end loop;
end $$;

-- Documento novo no envio ou trocado (volta sem decisão): avisa as áreas, uma vez por transação.
create function app.avisar_envio_trigger() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  perform app.avisar_envio(n.envio_id) from (select distinct envio_id from novos where decisao is null) n;
  return null;
end $$;
create trigger avisar_envio_itens_novos after insert on public.envio_itens
  referencing new table as novos for each statement execute function app.avisar_envio_trigger();
create trigger avisar_envio_itens_trocados after update on public.envio_itens
  referencing new table as novos for each statement execute function app.avisar_envio_trigger();

create or replace function public.decidir_documento(p_item uuid, p_decisao public.decisao_documento, p_motivo text default null) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_envio uuid;
  v_resp text;
  v_outro text;
begin
  select i.envio_id, t.responsavel into v_envio, v_resp
  from public.envio_itens i
  join public.envios_analise e on e.id = i.envio_id
  join public.documentos d on d.id = i.documento_id
  join public.tipos_documento t on t.codigo = d.tipo_documento
  where i.id = p_item and e.situacao = 'aberto';
  if not found then
    raise exception 'Item não encontrado ou análise já concluída.' using errcode = 'P0001';
  end if;
  if not app.pode_decidir_tipo(v_resp) then
    raise exception '%', case v_resp when 'sst' then 'Este documento é da Segurança do Trabalho (com verificação em duas etapas).'
      else 'Este documento é do RH (com verificação em duas etapas).' end using errcode = '42501';
  end if;
  if p_decisao = 'reprovado' and length(btrim(coalesce(p_motivo, ''))) < 3 then
    raise exception 'Escreva o motivo da reprovação.' using errcode = 'P0001';
  end if;
  update public.envio_itens set decisao = p_decisao, motivo = case when p_decisao = 'reprovado' then btrim(p_motivo) end,
    decidido_por = auth.uid(), decidido_em = now()
  where id = p_item;

  -- Terminou a sua parte e a outra área ainda tem itens: avisa a outra área.
  v_outro := case v_resp when 'rh' then 'sst' else 'rh' end;
  if app.itens_sem_decisao(v_envio, v_resp) = 0 and app.itens_sem_decisao(v_envio, v_outro) > 0 then
    perform app.avisar(
      array(select usuario_id from public.usuario_papeis where papel::text = v_outro),
      'analise', case v_resp when 'rh' then 'RH terminou: ' else 'Segurança terminou: ' end || app.nome_do_envio(v_envio),
      'Faltam os seus itens para concluir a análise.', null, 'feito:' || v_envio || ':' || v_resp || ':' || now());
  end if;
end $$;

-- Conclusão: RH ou Segurança (quem decidir o último item). Corpo igual ao de 20261111160000_vencimentos.
create or replace function public.concluir_envio(p_envio uuid, p_data_integracao date, p_assunto text, p_texto text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.envios_analise;
  v_reprovados int;
  v_empresa_aprovada boolean;
  v_resultado text;
  v_email text;
begin
  if not (app.rh_verificado() or app.sst_verificado()) then
    raise exception 'Só RH ou Segurança do Trabalho, com verificação em duas etapas, concluem análises.' using errcode = '42501';
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

