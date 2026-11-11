-- Checklist das etapas de volta (pedido do usuário): todos os itens começam desmarcados,
-- quem é da etapa marca, e só conclui com tudo marcado. A etapa 1 volta a ter os 3 itens.

update public.etapas_fluxo set itens = array[
  'Escopo atende a um pacote do planejamento (EAP)',
  'Valor orçado conferido com o orçamento da obra (ou não se aplica)',
  'Tipo de contrato definido'
] where versao = 1 and etapa = 1;

-- Cria as linhas do checklist de cada etapa da contratação (todas desmarcadas).
create function app.criar_checklist_da_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.etapa_checklist (contratacao_id, etapa, item)
  select new.contratacao_id, new.etapa, i
  from public.etapas_fluxo f, generate_series(1, coalesce(array_length(f.itens, 1), 0)) i
  where f.versao = 1 and f.etapa = new.etapa
  on conflict do nothing;
  return new;
end $$;
create trigger criar_checklist after insert on public.contratacao_etapas
  for each row execute function app.criar_checklist_da_etapa();

-- Acerta as contratações existentes: tira itens que não existem mais e cria os que faltam.
-- Etapas já concluídas ou puladas ficam com os itens marcados; as demais, desmarcados.
delete from public.etapa_checklist k using public.etapas_fluxo f
where f.versao = 1 and f.etapa = k.etapa and k.item > coalesce(array_length(f.itens, 1), 0);
update public.etapa_checklist k set marcado = false, marcado_por = null, marcado_em = null
from public.contratacao_etapas e
where e.contratacao_id = k.contratacao_id and e.etapa = k.etapa and e.situacao in ('pendente', 'em_andamento');
insert into public.etapa_checklist (contratacao_id, etapa, item, marcado)
select e.contratacao_id, e.etapa, i, e.situacao in ('concluida', 'pulada')
from public.contratacao_etapas e
join public.etapas_fluxo f on f.versao = 1 and f.etapa = e.etapa
cross join lateral generate_series(1, coalesce(array_length(f.itens, 1), 0)) i
on conflict do nothing;

-- Conclusão volta a exigir todos os itens marcados.
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
  if p_etapa = 3 and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Escolha o fornecedor e informe o valor final (ou deixe a negociação para Suprimentos).' using errcode = 'P0001';
  end if;
  if p_etapa = 4 and v_c.sienge_solicitacao is null then
    raise exception 'Informe o nº da solicitação no Sienge.' using errcode = 'P0001';
  end if;
  if p_etapa = 5 and (v_c.fornecedor_cnpj is null or v_c.valor_negociado is null) then
    raise exception 'Escolha o fornecedor e informe o valor final.' using errcode = 'P0001';
  end if;
  if p_etapa = 6 and (v_c.permuta is null or v_c.fat_direto is null or v_c.sinal is null or v_c.caucao is null) then
    raise exception 'Preencha as condições: permuta, faturamento direto, sinal e caução.' using errcode = 'P0001';
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
  if p_etapa = 2 and v_c.negociacao = 'suprimentos' then
    update public.contratacao_etapas set situacao = 'pulada', concluida_em = now(), concluida_por = auth.uid()
    where contratacao_id = p_contratacao and etapa = 3 and situacao = 'pendente';
  end if;
  if p_etapa = 6 then perform app.ligar_fornecedor(p_contratacao); end if;
  perform app.liberar_etapas(p_contratacao);
end $$;
