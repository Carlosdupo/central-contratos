-- Mensagem clara quando a obra tenta escolher o fornecedor acima do limite (regra dos R$ 4.000).
create or replace function public.escolher_fornecedor(p_cotacao uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cot public.cotacoes;
  v_c public.contratacoes;
  v_etapa smallint;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao;
  if not found then raise exception 'Cotação não encontrada.' using errcode = 'P0001'; end if;
  select * into v_c from public.contratacoes where id = v_cot.contratacao_id;
  v_etapa := case when v_c.valor_orcado < v_c.limite_obra then 3 else 5 end;
  if v_etapa = 3 and exists (select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = 5 and situacao = 'em_andamento')
     and v_c.empresa_id is null and v_c.fornecedor_cnpj is null then
    v_etapa := 5; -- obra pulou a negociação sem escolher: Suprimentos escolhe
  end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = v_etapa and situacao = 'em_andamento') then
    raise exception '%', case when v_etapa = 5
      then 'A partir de R$ ' || to_char(v_c.limite_obra, 'FM999G999G990') || ', quem escolhe o fornecedor é Suprimentos, na etapa 5.'
      else 'A escolha do fornecedor é feita na etapa 3.' end using errcode = 'P0001';
  end if;
  perform app.exigir_etapa_em_andamento(v_c.id, v_etapa);
  if v_etapa = 5 and v_c.valor_orcado < v_c.limite_obra and v_c.fornecedor_cnpj is not null then
    raise exception 'Abaixo do limite, quem escolhe é a obra; o fornecedor já foi escolhido.' using errcode = 'P0001';
  end if;
  update public.cotacoes set escolhida = (id = p_cotacao), escolhida_por = case when id = p_cotacao then auth.uid() end
  where contratacao_id = v_c.id;
  update public.contratacoes set
    fornecedor_nome = v_cot.fornecedor, fornecedor_cnpj = v_cot.cnpj,
    empresa_id = (select id from public.empresas_terceiras where cnpj = v_cot.cnpj)  -- A2: puxa a empresa cadastrada
  where id = v_c.id;
end $$;
