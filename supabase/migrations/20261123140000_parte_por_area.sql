-- Cada área vale sozinha: quando RH (ou Segurança) decide o último item dele no envio, os documentos dele
-- já ficam aprovados ou devolvidos, sem esperar a outra área. A conclusão (integração e e-mail à empresa)
-- continua com quem terminar por último.

create function app.aplicar_parte_da_area(p_envio uuid, p_responsavel text) returns void
language sql security definer set search_path = '' as $$
  update public.documentos d set
    situacao = i.decisao::text::public.situacao_documento,
    motivo_reprovacao = i.motivo, analisado_por = i.decidido_por, analisado_em = i.decidido_em
  from public.envio_itens i, public.tipos_documento t
  where i.envio_id = p_envio and i.documento_id = d.id and i.decisao is not null
    and t.codigo = d.tipo_documento and t.responsavel = p_responsavel
    -- Só o arquivo que foi analisado: se a empresa já trocou o arquivo, a decisão antiga não vale para o novo.
    and d.arquivo_atual_id is not distinct from i.arquivo_id
    and d.situacao in ('enviado', 'aprovado', 'reprovado')
    and d.situacao is distinct from i.decisao::text::public.situacao_documento
$$;
revoke execute on function app.aplicar_parte_da_area(uuid, text) from public, anon, authenticated;

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

  if app.itens_sem_decisao(v_envio, v_resp) = 0 then
    perform app.aplicar_parte_da_area(v_envio, v_resp);
  end if;

  -- Terminou a sua parte e a outra área ainda tem itens: avisa a outra área.
  v_outro := case v_resp when 'rh' then 'sst' else 'rh' end;
  if app.itens_sem_decisao(v_envio, v_resp) = 0 and app.itens_sem_decisao(v_envio, v_outro) > 0 then
    perform app.avisar(
      array(select usuario_id from public.usuario_papeis where papel::text = v_outro),
      'analise', case v_resp when 'rh' then 'RH terminou: ' else 'Segurança terminou: ' end || app.nome_do_envio(v_envio),
      'Faltam os seus itens para concluir a análise.', null, 'feito:' || v_envio || ':' || v_resp || ':' || now());
  end if;
end $$;

-- Envios já abertos: a área que já terminou passa a valer agora.
do $$
declare
  v record;
begin
  for v in
    select e.id, r.resp from public.envios_analise e cross join (values ('rh'), ('sst')) as r(resp)
    where e.situacao = 'aberto'
  loop
    if app.itens_sem_decisao(v.id, v.resp) = 0 then
      perform app.aplicar_parte_da_area(v.id, v.resp);
    end if;
  end loop;
end $$;

-- Conclusão: não sobrescreve documento cujo arquivo a empresa já trocou depois da decisão (corpo igual ao de 20261117210000).
create or replace function public.concluir_envio(p_envio uuid, p_data_integracao date, p_assunto text, p_texto text) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_envio public.envios_analise;
  v_reprovados int;
  v_empresa_aprovada boolean;
  v_resultado text;
  v_email text;
  v_so_mensal boolean;
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
  from public.envio_itens i where i.envio_id = p_envio and i.documento_id = d.id
    and d.arquivo_atual_id is not distinct from i.arquivo_id and d.situacao in ('enviado', 'aprovado', 'reprovado');

  select count(*) into v_reprovados from public.envio_itens where envio_id = p_envio and decisao = 'reprovado';
  -- Envio só com documentos mensais: vale para o pagamento, não muda a situação da empresa nem o acesso à obra.
  select not exists (
    select 1 from public.envio_itens i join public.documentos d on d.id = i.documento_id
    join public.tipos_documento t on t.codigo = d.tipo_documento
    where i.envio_id = p_envio and t.etapa <> 'mensal'
  ) into v_so_mensal;
  update public.envios_analise set situacao = 'concluido', concluido_em = now(), concluido_por = auth.uid() where id = p_envio;

  if v_so_mensal then
    v_resultado := case when v_reprovados > 0 then 'mensal_pendente' else 'mensal_aprovado' end;
  elsif v_envio.vinculo_id is null then
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
      select 1 from public.documentos d join public.tipos_documento t on t.codigo = d.tipo_documento
      where d.vinculo_id = v_envio.vinculo_id and d.situacao in ('anexado', 'reprovado', 'vencido') and t.etapa <> 'mensal'
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
