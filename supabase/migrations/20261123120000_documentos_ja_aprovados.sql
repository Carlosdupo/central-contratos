-- Documentos já aprovados no cadastro:
-- 1) pessoa que já é da empresa entra em outra obra pelo mesmo cadastro, com os documentos que já tem;
--    se tudo já está aprovado, a empresa envia só para o RH marcar a integração da obra nova;
-- 2) pessoa que veio de outra empresa: RH/SST veem os documentos da pessoa (RG/CNH e NR) aprovados lá
--    e decidem, caso a caso, se aproveitam. Documentos do empregador (ASO, contrato etc.) nunca são aproveitados.

alter table public.tipos_documento add column aproveitavel boolean not null default false;
comment on column public.tipos_documento.aproveitavel is 'Documento da pessoa (não do empregador): RH/SST podem aproveitar o aprovado em outra empresa.';
update public.tipos_documento set aproveitavel = true
where codigo in ('rg_cnh', 'nr06', 'nr10', 'nr12', 'nr18', 'nr35', 'formacao_eletrica');

alter table public.documentos add column aproveitado_de uuid references public.documentos (id) on delete set null;
comment on column public.documentos.aproveitado_de is 'Documento aprovado em outra empresa que RH/SST aproveitaram para este vínculo.';

create function app.pessoa_tem_aproveitaveis(p_vinculo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.vinculos v
    join public.vinculos o on o.pessoa_id = v.pessoa_id and o.id <> v.id
    join public.documentos d on d.vinculo_id = o.id and d.situacao = 'aprovado'
    join public.tipos_documento t on t.codigo = d.tipo_documento and t.aproveitavel
    where v.id = p_vinculo
      and (d.data_validade is null or d.data_validade >= (now() at time zone 'America/Sao_Paulo')::date)
      and not exists (
        select 1 from public.documentos x
        where x.vinculo_id = v.id and x.tipo_documento = d.tipo_documento and x.situacao in ('aprovado', 'enviado')
      )
  )
$$;
revoke execute on function app.pessoa_tem_aproveitaveis(uuid) from public, anon, authenticated;

-- Portal: a empresa só fica sabendo que existe algo aprovado; não vê de qual empresa nem os arquivos.
create function public.tem_documentos_em_outra_empresa(p_vinculo uuid) returns boolean
language plpgsql stable security definer set search_path = '' as $$
begin
  if not (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(app.empresa_do_vinculo(p_vinculo))) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  return app.pessoa_tem_aproveitaveis(p_vinculo);
end $$;
revoke all on function public.tem_documentos_em_outra_empresa(uuid) from public, anon;
grant execute on function public.tem_documentos_em_outra_empresa(uuid) to authenticated;

create or replace function public.cadastrar_pessoa(
  p_empresa uuid, p_cpf text, p_nome text, p_telefone text, p_tipo public.tipo_vinculo,
  p_funcao text, p_eletricidade boolean, p_obra uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_pessoa uuid;
  v_nome_atual text;
  v_vinculo uuid;
  v_tipo_atual public.tipo_vinculo;
  v_ativo boolean;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_cpf !~ '^\d{11}$' then
    raise exception 'CPF inválido.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.empresa_obras where empresa_id = p_empresa and obra_id = p_obra and ativo) then
    raise exception 'Obra não liberada para esta empresa.' using errcode = 'P0001';
  end if;

  insert into public.pessoas (cpf, nome, telefone) values (p_cpf, btrim(p_nome), nullif(btrim(p_telefone), ''))
  on conflict (cpf) do nothing
  returning id into v_pessoa;

  if v_pessoa is null then
    select id, nome into v_pessoa, v_nome_atual from public.pessoas where cpf = p_cpf;
    if regexp_replace(app.sem_acento(btrim(v_nome_atual)), '\s+', ' ', 'g') <> regexp_replace(app.sem_acento(btrim(p_nome)), '\s+', ' ', 'g') then
      raise exception 'Não foi possível cadastrar. Confira o CPF e o nome completo.' using errcode = 'P0001';
    end if;
  end if;

  select id, tipo, ativo into v_vinculo, v_tipo_atual, v_ativo
  from public.vinculos where pessoa_id = v_pessoa and empresa_id = p_empresa;

  if v_vinculo is not null then
    -- Já é da empresa: entra na obra nova com o mesmo cadastro e os mesmos documentos.
    if v_tipo_atual = 'socio_esporadico' then
      raise exception 'Esta pessoa já está cadastrada na empresa (sócio com acesso esporádico pede visita).' using errcode = 'P0001';
    end if;
    if v_ativo and exists (select 1 from public.alocacoes where vinculo_id = v_vinculo and obra_id = p_obra) then
      raise exception 'Esta pessoa já está nesta obra.' using errcode = 'P0001';
    end if;
    update public.vinculos set ativo = true where id = v_vinculo and not ativo;
    insert into public.alocacoes (vinculo_id, obra_id) values (v_vinculo, p_obra)
    on conflict (vinculo_id, obra_id) do nothing;
    return v_vinculo;
  end if;

  insert into public.vinculos (pessoa_id, empresa_id, tipo, funcao, eletricidade)
  values (v_pessoa, p_empresa, p_tipo, btrim(p_funcao), p_tipo = 'funcionario' and coalesce(p_eletricidade, false))
  returning id into v_vinculo;

  if p_tipo <> 'socio_esporadico' then
    insert into public.alocacoes (vinculo_id, obra_id) values (v_vinculo, p_obra);
  end if;

  if p_tipo <> 'socio_esporadico' and app.pessoa_tem_aproveitaveis(v_vinculo) then
    perform app.avisar(
      array(select distinct usuario_id from public.usuario_papeis where papel::text in ('rh', 'sst')),
      'analise', 'Documentos para aproveitar: ' || btrim(p_nome),
      'Esta pessoa já tem RG/CNH ou NR aprovados em outra empresa. Abra a pessoa em Consultar pessoas e decida se aproveita.',
      null, 'aproveitar:' || v_vinculo);
  end if;
  return v_vinculo;
end $$;

-- Pessoa já liberada em uma obra, com todos os documentos aprovados, indo para outra obra:
-- não há arquivo novo, mas o envio vai para o RH marcar a integração da obra nova.
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
    if not exists (select 1 from public.alocacoes where vinculo_id = p_vinculo and situacao = 'rascunho')
       or not exists (select 1 from public.alocacoes where vinculo_id = p_vinculo and situacao in ('liberado', 'integracao_agendada'))
       or exists (
         select 1 from public.documentos d join public.tipos_documento t on t.codigo = d.tipo_documento
         where d.vinculo_id = p_vinculo and t.etapa <> 'mensal' and d.situacao <> 'aprovado'
       ) then
      raise exception 'Não há documentos novos para enviar.' using errcode = 'P0001';
    end if;
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

-- RH/SST aproveitam um documento da pessoa aprovado em outra empresa (cada área os do seu tipo).
create function public.aproveitar_documento(p_origem uuid, p_vinculo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo text;
  v_resp text;
  v_aproveitavel boolean;
  v_situacao public.situacao_documento;
  v_validade date;
  v_pessoa_origem uuid;
  v_vinculo_origem uuid;
  v_pessoa uuid;
  v_empresa uuid;
  v_destino public.situacao_documento;
  v_id uuid;
begin
  select d.tipo_documento, t.responsavel, t.aproveitavel, d.situacao, d.data_validade, o.pessoa_id, o.id
  into v_tipo, v_resp, v_aproveitavel, v_situacao, v_validade, v_pessoa_origem, v_vinculo_origem
  from public.documentos d
  join public.tipos_documento t on t.codigo = d.tipo_documento
  join public.vinculos o on o.id = d.vinculo_id
  where d.id = p_origem;
  if not found or not v_aproveitavel then
    raise exception 'Este documento não pode ser aproveitado.' using errcode = 'P0001';
  end if;
  if not app.pode_decidir_tipo(v_resp) then
    raise exception '%', case v_resp when 'sst' then 'Este documento é da Segurança do Trabalho (com verificação em duas etapas).'
      else 'Este documento é do RH (com verificação em duas etapas).' end using errcode = '42501';
  end if;
  if v_situacao <> 'aprovado' or (v_validade is not null and v_validade < (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Só dá para aproveitar documento aprovado e dentro da validade.' using errcode = 'P0001';
  end if;

  select pessoa_id, empresa_id into v_pessoa, v_empresa from public.vinculos where id = p_vinculo;
  if v_pessoa is null or v_pessoa <> v_pessoa_origem or p_vinculo = v_vinculo_origem then
    raise exception 'O documento não é desta pessoa.' using errcode = 'P0001';
  end if;
  select situacao into v_destino from public.documentos
  where vinculo_id = p_vinculo and tipo_documento = v_tipo and competencia is null;
  if v_destino in ('aprovado', 'enviado') then
    raise exception 'Este documento já está aprovado ou em análise na empresa atual.' using errcode = 'P0001';
  end if;

  insert into public.documentos (tipo_documento, empresa_id, vinculo_id, situacao, data_emissao, data_validade, valor_texto,
    arquivo_atual_id, analisado_por, analisado_em, aproveitado_de)
  select tipo_documento, v_empresa, p_vinculo, 'aprovado', data_emissao, data_validade, valor_texto,
    arquivo_atual_id, auth.uid(), now(), id
  from public.documentos where id = p_origem
  on conflict (tipo_documento, empresa_id, vinculo_id, competencia) do update set
    situacao = 'aprovado', data_emissao = excluded.data_emissao, data_validade = excluded.data_validade,
    valor_texto = excluded.valor_texto, arquivo_atual_id = excluded.arquivo_atual_id, motivo_reprovacao = null,
    analisado_por = excluded.analisado_por, analisado_em = excluded.analisado_em, aproveitado_de = excluded.aproveitado_de
  returning id into v_id;
  return v_id;
end $$;
revoke all on function public.aproveitar_documento(uuid, uuid) from public, anon;
grant execute on function public.aproveitar_documento(uuid, uuid) to authenticated;
