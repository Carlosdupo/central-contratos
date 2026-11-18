-- Fase RH-4: documentação mensal (procedimento rev. 02, item 2), para liberar o pagamento.
-- Pacote por empresa: itens da empresa + itens de cada funcionário liberado em obra. Competência = mês anterior;
-- envio de 25 a 30. Pendência no mensal não muda a situação da empresa nem o acesso à obra (decisão de 17/11).

alter table public.tipos_documento add column so_optante_simples boolean not null default false;
update public.tipos_documento set so_optante_simples = true where codigo in ('simples_guia', 'simples_comprovante');

alter table public.empresas_terceiras add column optante_simples boolean not null default false;

update public.matriz_documental set ativo = true
where tipo_documento in ('folha_pagamento', 'folha_comprovante', 'simples_guia', 'simples_comprovante', 'fgts_digital_alocacao',
  'dctfweb', 'relacao_funcionarios_obra', 'ficha_epi_mensal', 'cartao_ponto', 'cartao_ponto_comprovante');

-- A empresa (ou o RH) informa se é optante do Simples Nacional.
create function public.definir_optante_simples(p_empresa uuid, p_optante boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.usuario_externo_da_empresa(p_empresa) or app.rh_verificado()) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  update public.empresas_terceiras set optante_simples = coalesce(p_optante, false) where id = p_empresa;
end $$;
revoke all on function public.definir_optante_simples(uuid, boolean) from public, anon;
grant execute on function public.definir_optante_simples(uuid, boolean) to authenticated;

-- Documento mensal de pessoa precisa da competência (antes só a empresa tinha).
drop function public.registrar_arquivo_pessoa(uuid, text, text, text, text, bigint, text, date, date);
create function public.registrar_arquivo_pessoa(
  p_vinculo uuid, p_tipo text, p_storage_path text, p_nome text, p_mime text, p_tamanho bigint, p_sha256 text,
  p_data_emissao date default null, p_data_validade date default null, p_competencia date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
  v_tipo public.tipos_documento;
  v_doc public.documentos;
  v_arquivo uuid;
  v_comp date;
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  select * into v_tipo from public.tipos_documento where codigo = p_tipo and ativo and escopo = 'pessoa';
  if not found then
    raise exception 'Tipo de documento inválido.' using errcode = 'P0001';
  end if;
  if p_storage_path not like 'empresas/' || v_empresa || '/vinculos/' || p_vinculo || '/' || p_tipo || '/%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'mensal' and p_competencia is null then
    raise exception 'Informe a competência.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'meses_apos_emissao' and (p_data_emissao is null or p_data_emissao > current_date) then
    raise exception 'Informe a data de emissão (não pode ser futura).' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'data_informada' and (p_data_validade is null or p_data_validade < current_date) then
    raise exception 'Informe uma data de validade futura.' using errcode = 'P0001';
  end if;
  v_comp := case when v_tipo.regra_validade = 'mensal' then date_trunc('month', p_competencia)::date end;

  select * into v_doc from public.documentos
  where tipo_documento = p_tipo and vinculo_id = p_vinculo and competencia is not distinct from v_comp;
  if found and v_doc.situacao in ('enviado', 'aprovado') then
    raise exception 'Este documento está em análise ou já foi aprovado.' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.documentos (tipo_documento, empresa_id, vinculo_id, competencia, situacao)
    values (p_tipo, v_empresa, p_vinculo, v_comp, 'anexado') returning * into v_doc;
  end if;

  insert into public.documento_arquivos (documento_id, storage_path, nome_original, mime, tamanho, sha256)
  values (v_doc.id, p_storage_path, left(p_nome, 200), p_mime, p_tamanho, p_sha256)
  returning id into v_arquivo;

  update public.documentos set
    situacao = 'anexado', arquivo_atual_id = v_arquivo, motivo_reprovacao = null,
    data_emissao = case when v_tipo.regra_validade = 'meses_apos_emissao' then p_data_emissao end,
    data_validade = case when v_tipo.regra_validade = 'data_informada' then p_data_validade end
  where id = v_doc.id;
  return v_doc.id;
end $$;
revoke all on function public.registrar_arquivo_pessoa(uuid, text, text, text, text, bigint, text, date, date, date) from public, anon;
grant execute on function public.registrar_arquivo_pessoa(uuid, text, text, text, text, bigint, text, date, date, date) to authenticated;

-- Quantos documentos mensais da competência ainda não chegaram (empresa + funcionários liberados).
create function app.mensais_faltando(p_empresa uuid, p_competencia date) returns int
language sql stable security definer set search_path = '' as $$
  select ((
    select count(*) from public.matriz_documental m
    join public.tipos_documento t on t.codigo = m.tipo_documento
    join public.empresas_terceiras e on e.id = p_empresa
    where m.ativo and t.ativo and t.etapa = 'mensal' and m.aplica_a = 'empresa'
      and (not t.so_optante_simples or e.optante_simples)
      and not exists (select 1 from public.documentos d where d.empresa_id = p_empresa and d.vinculo_id is null
        and d.tipo_documento = t.codigo and d.competencia = p_competencia and d.situacao in ('enviado', 'aprovado'))
  ) + (
    select count(*) from public.vinculos v
    join public.matriz_documental m on m.aplica_a::text = v.tipo::text and m.ativo
    join public.tipos_documento t on t.codigo = m.tipo_documento and t.ativo and t.etapa = 'mensal'
    where v.empresa_id = p_empresa and v.ativo
      and exists (select 1 from public.alocacoes a where a.vinculo_id = v.id and a.situacao = 'liberado')
      and not exists (select 1 from public.documentos d where d.vinculo_id = v.id
        and d.tipo_documento = t.codigo and d.competencia = p_competencia and d.situacao in ('enviado', 'aprovado'))
  ))::int
$$;

-- Lembretes da janela 25–30 (rotina diária): dia 20 avisa que abre, 25 abre, 28 lembra quem ainda não mandou tudo.
create function public.lembretes_documentacao_mensal(p_hoje date default (now() at time zone 'America/Sao_Paulo')::date) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_dia int := extract(day from p_hoje);
  v_comp date := (date_trunc('month', p_hoje) - interval '1 month')::date;
  v_rotulo text := to_char(v_comp, 'MM/YYYY');
  v_fim text := '30/' || to_char(p_hoje, 'MM');
  v_e record;
  v_faltam int;
  v_n int := 0;
begin
  if v_dia not in (20, 25, 28) then return 0; end if;
  for v_e in
    select e.id, e.email from public.empresas_terceiras e
    where e.situacao = 'aprovada' and e.email ~ '^\S+@\S+\.\S+$'
      and exists (select 1 from public.vinculos v join public.alocacoes a on a.vinculo_id = v.id
        where v.empresa_id = e.id and v.ativo and a.situacao = 'liberado')
  loop
    v_faltam := app.mensais_faltando(v_e.id, v_comp);
    if v_faltam = 0 then continue; end if;
    insert into public.notificacoes (empresa_id, destinatario, assunto, texto)
    values (v_e.id, v_e.email,
      case v_dia when 20 then 'Documentação mensal ' || v_rotulo || ': envio de 25 a ' || v_fim
                 when 25 then 'Documentação mensal ' || v_rotulo || ': envio aberto até ' || v_fim
                 else 'Lembrete: documentação mensal ' || v_rotulo || ' até ' || v_fim end,
      'Faltam ' || v_faltam || ' documento(s) da documentação mensal de ' || v_rotulo
        || ' (empresa e funcionários). Sem ela completa e aprovada, o pagamento do mês não é liberado.'
        || E'\n\nEnvie pelo portal: ' || app.url_site() || '/portal' || E'\n\nNexus');
    v_n := v_n + 1;
  end loop;
  return v_n;
end $$;
revoke all on function public.lembretes_documentacao_mensal(date) from public, anon, authenticated;
revoke all on function app.mensais_faltando(uuid, date) from public, anon;

-- Conclusão: envio só de mensais não mexe na empresa nem nas alocações.
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
  from public.envio_itens i where i.envio_id = p_envio and i.documento_id = d.id;

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

