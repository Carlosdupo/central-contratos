-- Cotações: deixa de exigir 3 para concluir a etapa de cotação (pedido do usuário em 2026-11-18). Basta uma; continua aceitando até 3.
-- Só muda essa conferência em public.concluir_etapa; o resto da função é igual ao da fase 4.

create or replace function public.concluir_etapa(p_contratacao uuid, p_etapa smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_chave text;
begin
  select f.chave into v_chave from public.etapas_fluxo f join public.contratacoes c on c.id = p_contratacao and f.versao = c.fluxo_versao where f.etapa = p_etapa;
  if v_chave = 'assinaturas' then raise exception 'A etapa de assinaturas termina com a última assinatura.' using errcode = 'P0001'; end if;
  v_c := app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
  if exists (select 1 from public.etapa_checklist where contratacao_id = p_contratacao and etapa = p_etapa and not marcado) then
    raise exception 'Marque todos os itens da etapa.' using errcode = 'P0001';
  end if;
  -- Pelo menos uma cotação: o fornecedor é escolhido entre as cotações registradas.
  if v_chave = 'cotacao' and not exists (select 1 from public.cotacoes where contratacao_id = p_contratacao) then
    raise exception 'Registre pelo menos uma cotação.' using errcode = 'P0001';
  end if;
  if v_chave = 'negociacao_obra' and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Escolha o fornecedor e informe o valor final (ou deixe a negociação para Suprimentos).' using errcode = 'P0001';
  end if;
  if v_chave = 'fornecedor_valor' and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Informe o fornecedor e o valor negociado.' using errcode = 'P0001';
  end if;
  if v_chave = 'solicitacao_sienge' and v_c.sienge_solicitacao is null then
    raise exception 'Informe o nº da solicitação no Sienge.' using errcode = 'P0001';
  end if;
  if v_chave in ('negociacao', 'autorizacao') and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Escolha o fornecedor e informe o valor final.' using errcode = 'P0001';
  end if;
  if v_chave = 'autorizacao' then
    if not app.tem_papel('gerente_suprimentos') then raise exception 'Só o gerente de suprimentos autoriza.' using errcode = '42501'; end if;
    if v_c.permuta is null or v_c.fat_direto is null or v_c.sinal is null or v_c.caucao is null then
      raise exception 'Preencha as condições: permuta, faturamento direto, sinal e caução.' using errcode = 'P0001';
    end if;
    if v_c.fornecedor_email is null and not exists (select 1 from public.empresas_terceiras where cnpj = v_c.fornecedor_cnpj) then
      raise exception 'Informe o e-mail do fornecedor para o acesso ao portal.' using errcode = 'P0001';
    end if;
  end if;
  if v_chave in ('contrato', 'contrato_aditivo') and v_c.sienge_contrato is null then
    raise exception 'Informe o código do contrato no Sienge.' using errcode = 'P0001';
  end if;
  if v_chave = 'contrato_aditivo' and v_c.aditivo_destino is null then
    raise exception 'Informe se o aditivo cabe em contrato guarda-chuva ou precisa de contrato novo.' using errcode = 'P0001';
  end if;

  update public.contratacao_etapas set situacao = 'concluida', concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = p_contratacao and etapa = p_etapa;
  if v_chave = 'cotacao' and v_c.negociacao = 'suprimentos' then
    update public.contratacao_etapas set situacao = 'pulada', concluida_em = now(), concluida_por = auth.uid()
    where contratacao_id = p_contratacao and etapa = app.etapa_da_chave(p_contratacao, 'negociacao_obra') and situacao = 'pendente';
  end if;
  if v_chave = 'autorizacao' then
    -- Antes de ligar o fornecedor à obra: já era uma empresa aprovada nesta obra? (só no fluxo 2)
    if v_c.fluxo_versao >= 2 then
      update public.contratacoes set empresa_ja_liberada = exists (
        select 1 from public.empresas_terceiras e join public.empresa_obras eo on eo.empresa_id = e.id
        where e.cnpj = v_c.fornecedor_cnpj and eo.obra_id = v_c.obra_id and eo.ativo and e.situacao = 'aprovada'
      ) where id = p_contratacao;
    end if;
    perform app.ligar_fornecedor(p_contratacao);
  end if;
  if v_chave = 'contrato_aditivo' and v_c.aditivo_destino = 'guarda_chuva' then
    update public.contratacao_etapas set situacao = 'pulada', concluida_em = now(), concluida_por = auth.uid()
    where contratacao_id = p_contratacao and etapa = app.etapa_da_chave(p_contratacao, 'assinaturas') and situacao = 'pendente';
  end if;
  perform app.liberar_etapas(p_contratacao);
end $$;

-- Nome e itens da etapa sem o "3" (os itens marcados nas contratações em andamento seguem valendo: só o texto muda).
update public.etapas_fluxo set nome = 'Cotação com fornecedores', itens = array['Escopo enviado aos fornecedores', 'Cotações recebidas e assinadas']
where chave = 'cotacao';
