-- Acesso do fornecedor ao portal a partir da autorização do gerente de suprimentos (etapa 6).
-- Ao autorizar, o sistema cadastra a empresa (se ainda não existir pelo CNPJ) e a liga à obra da
-- contratação. O convite por e-mail sai pela ação do servidor, logo depois (precisa da API do Auth).

alter table public.contratacoes
  add column fornecedor_email text check (fornecedor_email is null or fornecedor_email ~ '^\S+@\S+\.\S+$');

-- E-mail do fornecedor para o acesso ao portal: Suprimentos na etapa 5 ou o gerente na etapa 6.
create function public.salvar_email_fornecedor(p_contratacao uuid, p_email text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_etapa smallint;
  v_email text := lower(btrim(coalesce(p_email, '')));
begin
  v_etapa := case when exists (
    select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = 6 and situacao = 'em_andamento'
  ) then 6 else 5 end;
  perform app.exigir_etapa_em_andamento(p_contratacao, v_etapa);
  if v_email !~ '^\S+@\S+\.\S+$' or length(v_email) > 160 then
    raise exception 'Informe um e-mail válido.' using errcode = 'P0001';
  end if;
  update public.contratacoes set fornecedor_email = v_email where id = p_contratacao;
end $$;

-- Cadastra (se preciso) a empresa do fornecedor e a liga à obra da contratação.
create function app.ligar_fornecedor(p_contratacao uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_empresa uuid;
begin
  select * into v_c from public.contratacoes where id = p_contratacao;
  if v_c.fornecedor_cnpj is null then return null; end if;
  select id into v_empresa from public.empresas_terceiras where cnpj = v_c.fornecedor_cnpj;
  if v_empresa is null then
    insert into public.empresas_terceiras (cnpj, razao_social, email)
    values (v_c.fornecedor_cnpj, v_c.fornecedor_nome, v_c.fornecedor_email)
    returning id into v_empresa;
  end if;
  update public.contratacoes set empresa_id = v_empresa where id = p_contratacao;
  insert into public.empresa_obras (empresa_id, obra_id) values (v_empresa, v_c.obra_id)
  on conflict (empresa_id, obra_id) do update set ativo = true;
  return v_empresa;
end $$;
revoke all on function app.ligar_fornecedor(uuid) from public, authenticated;

-- concluir_etapa: igual à anterior, mais a regra da etapa 6 (e-mail obrigatório se a empresa não existe)
-- e a ligação do fornecedor depois da autorização.
create or replace function public.concluir_etapa(p_contratacao uuid, p_etapa smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  if p_etapa = 9 then raise exception 'A etapa de assinaturas termina com a última assinatura.' using errcode = 'P0001'; end if;
  v_c := app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
  if exists (select 1 from public.etapa_checklist where contratacao_id = p_contratacao and etapa = p_etapa and not marcado) then
    raise exception 'Marque todos os itens da etapa.' using errcode = 'P0001';
  end if;
  if p_etapa = 2 and (select count(*) from public.cotacoes where contratacao_id = p_contratacao) < 3 then
    raise exception 'Registre as 3 cotações.' using errcode = 'P0001';
  end if;
  if p_etapa = 4 and v_c.sienge_solicitacao is null then
    raise exception 'Informe o nº da solicitação no Sienge.' using errcode = 'P0001';
  end if;
  if p_etapa = 5 and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Escolha o fornecedor e informe o valor negociado.' using errcode = 'P0001';
  end if;
  if p_etapa = 6 and v_c.fornecedor_email is null
     and not exists (select 1 from public.empresas_terceiras where cnpj = v_c.fornecedor_cnpj) then
    raise exception 'Informe o e-mail do fornecedor para o acesso ao portal.' using errcode = 'P0001';
  end if;
  if p_etapa = 7 and v_c.sienge_contrato is null then
    raise exception 'Informe o código do contrato no Sienge.' using errcode = 'P0001';
  end if;
  update public.contratacao_etapas set situacao = 'concluida', concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = p_contratacao and etapa = p_etapa;
  if p_etapa = 6 then perform app.ligar_fornecedor(p_contratacao); end if;
  perform app.liberar_etapas(p_contratacao);
end $$;

revoke all on function public.salvar_email_fornecedor(uuid, text) from public, anon;
grant execute on function public.salvar_email_fornecedor(uuid, text) to authenticated;
