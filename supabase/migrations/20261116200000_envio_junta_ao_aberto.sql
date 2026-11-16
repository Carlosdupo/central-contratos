-- Enviar para análise com um envio já aberto (caso Plumber, 16/11/2026): em vez de recusar
-- ("Já existe um envio em análise"), os documentos novos entram no envio aberto e o RH analisa
-- tudo junto. Se o documento já estava no envio (foi trocado), o item volta sem decisão.

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
  select id into v_envio from public.envios_analise
  where empresa_id = p_empresa and vinculo_id is null and situacao = 'aberto'
  order by enviado_em limit 1 for update;
  if v_envio is null then
    insert into public.envios_analise (empresa_id) values (p_empresa) returning id into v_envio;
  end if;
  insert into public.envio_itens (envio_id, documento_id, arquivo_id)
  select v_envio, id, arquivo_atual_id from public.documentos
  where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado'
  on conflict (envio_id, documento_id) do update
    set arquivo_id = excluded.arquivo_id, decisao = null, motivo = null, decidido_por = null, decidido_em = null;
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
  select id into v_envio from public.envios_analise
  where vinculo_id = p_vinculo and situacao = 'aberto'
  order by enviado_em limit 1 for update;
  if v_envio is null then
    insert into public.envios_analise (empresa_id, vinculo_id) values (v_empresa, p_vinculo) returning id into v_envio;
  end if;
  insert into public.envio_itens (envio_id, documento_id, arquivo_id)
  select v_envio, id, arquivo_atual_id from public.documentos where vinculo_id = p_vinculo and situacao = 'anexado'
  on conflict (envio_id, documento_id) do update
    set arquivo_id = excluded.arquivo_id, decisao = null, motivo = null, decidido_por = null, decidido_em = null;
  update public.documentos set situacao = 'enviado' where vinculo_id = p_vinculo and situacao = 'anexado';
  update public.alocacoes set situacao = 'em_analise'
  where vinculo_id = p_vinculo and situacao in ('rascunho', 'pendente', 'bloqueado');
  return v_envio;
end $$;
