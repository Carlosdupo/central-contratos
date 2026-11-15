-- Fase 1A (ajustes rápidos da contratação). Só acrescenta: nada é apagado.
--  1.1 texto "Valor orçado" -> "Valor Orçamento" no checklist e nas mensagens
--  1.3 botão único da etapa 6 (grava as condições e autoriza na mesma chamada)
--  1.4 coordenador da obra também cancela a contratação
--  1.5 prefixo do contrato no Sienge na obra; código conferido (prefixo + 4 números)
--  1.6 contrato original obrigatório no aditivo

-- 1.5 / 1.6: colunas ----------------------------------------------------------------------------
alter table public.obras
  add column prefixo_sienge text check (prefixo_sienge is null or prefixo_sienge ~ '^[A-Za-z0-9/_-]{1,20}$');
comment on column public.obras.prefixo_sienge is 'Prefixo do contrato no Sienge, ex.: CT/BL. O código fica prefixo + 4 números (CT/BL0083).';

alter table public.contratacoes
  add column contrato_original text check (contrato_original is null or length(contrato_original) between 1 and 40);
comment on column public.contratacoes.contrato_original is 'Aditivo: nº do contrato original no Sienge.';

-- Confere o código do Sienge: sem prefixo na obra, aceita qualquer texto; com prefixo, exige prefixo + 4 números.
create function app.conferir_codigo_sienge(p_obra uuid, p_codigo text) returns void
language plpgsql stable security definer set search_path = '' as $$
declare
  v_prefixo text := (select nullif(btrim(prefixo_sienge), '') from public.obras where id = p_obra);
begin
  if v_prefixo is null then return; end if;
  if left(p_codigo, length(v_prefixo)) is distinct from v_prefixo
     or substr(p_codigo, length(v_prefixo) + 1) !~ '^[0-9]{4}$' then
    raise exception 'O código deve ser % seguido de 4 números (ex.: %0083).', v_prefixo, v_prefixo using errcode = 'P0001';
  end if;
end $$;

-- 1.1: texto do checklist da etapa 1 -------------------------------------------------------------
update public.etapas_fluxo
set itens = array_replace(itens, 'Valor orçado conferido com o orçamento da obra (ou não se aplica)', 'Valor Orçamento conferido com o orçamento da obra (ou não se aplica)')
where etapa = 1;

-- 1.6: abertura recebe o contrato original (exigido no aditivo) -----------------------------------
drop function public.abrir_contratacao(uuid, text, uuid, numeric, public.tipo_contratacao, text);
create function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_eap_item uuid, p_valor numeric, p_tipo public.tipo_contratacao, p_negociacao text,
  p_contrato_original text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_pacote text;
  v_original text := nullif(btrim(coalesce(p_contrato_original, '')), '');
begin
  if not app.pode_agir_como('coordenador_obra', p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  if p_eap_item is not null then
    select referencia || ' ' || descricao into v_pacote from public.obra_eap where id = p_eap_item and obra_id = p_obra;
    if v_pacote is null then raise exception 'Item da EAP inválido para esta obra.' using errcode = 'P0001'; end if;
  elsif exists (select 1 from public.obra_eap where obra_id = p_obra) then
    raise exception 'Escolha o item da EAP.' using errcode = 'P0001';
  end if;
  if p_valor is not null and p_valor <= 0 then raise exception 'Valor Orçamento inválido.' using errcode = 'P0001'; end if;
  if p_negociacao not in ('obra', 'suprimentos') then raise exception 'Escolha quem negocia.' using errcode = 'P0001'; end if;
  if p_negociacao = 'obra' and p_valor is not null and p_valor >= v_limite then
    raise exception '%', 'A partir de R$ ' || replace(to_char(v_limite, 'FM999G999G990'), ',', '.') || ' do orçamento, a negociação é de Suprimentos.'
      using errcode = 'P0001';
  end if;
  if p_tipo = 'aditivo' then
    if v_original is null then raise exception 'Informe o nº do contrato original no Sienge.' using errcode = 'P0001'; end if;
    perform app.conferir_codigo_sienge(p_obra, v_original);
  else
    v_original := null;
  end if;
  insert into public.contratacoes (codigo, obra_id, servico, pacote, eap_item_id, valor_orcado, tipo, negociacao, contrato_original, prazos, limite_obra)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico), v_pacote, p_eap_item, p_valor, p_tipo, p_negociacao, v_original,
    coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}'),
    v_limite
  ) returning id into v_id;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = 1;
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

-- 1.5: código do contrato (etapa 7) conferido pelo prefixo da obra ------------------------------
create or replace function public.salvar_campo_etapa(p_contratacao uuid, p_etapa smallint, p_valor text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  v_c := app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
  if p_etapa = 4 then
    update public.contratacoes set sienge_solicitacao = nullif(btrim(p_valor), '') where id = p_contratacao;
  elsif p_etapa = 7 then
    if nullif(btrim(p_valor), '') is not null then perform app.conferir_codigo_sienge(v_c.obra_id, btrim(p_valor)); end if;
    update public.contratacoes set sienge_contrato = nullif(btrim(p_valor), '') where id = p_contratacao;
  elsif p_etapa = 5 then
    if p_valor !~ '^\d+(\.\d{1,2})?$' or p_valor::numeric <= 0 then
      raise exception 'Valor negociado inválido.' using errcode = 'P0001';
    end if;
    update public.contratacoes set valor_negociado = p_valor::numeric where id = p_contratacao;
  else
    raise exception 'Esta etapa não tem campo.' using errcode = 'P0001';
  end if;
end $$;

-- 1.4: cancelar (mesmo padrão de antes: motivo com 5+ letras, admin verificado); o coordenador da obra também pode.
create or replace function public.cancelar_contratacao(p_contratacao uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_obra uuid := (select obra_id from public.contratacoes where id = p_contratacao);
begin
  if not (app.admin_verificado() or (v_obra is not null and app.pode_agir_como('coordenador_obra', v_obra))) then
    raise exception 'Só o administrador ou o coordenador da obra cancela contratação.' using errcode = '42501';
  end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.' using errcode = 'P0001'; end if;
  update public.contratacoes set situacao = 'cancelada', cancelamento_motivo = btrim(p_motivo)
  where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou já encerrada.' using errcode = 'P0001'; end if;
end $$;

-- 1.3: botão único da etapa 6. Reaproveita as duas funções que já conferem permissão e regras;
-- tudo na mesma transação (se a autorização falhar, as condições também não ficam gravadas).
create function public.autorizar_contratacao(
  p_contratacao uuid,
  p_permuta boolean, p_permuta_valor numeric, p_permuta_formato text,
  p_fat_direto boolean, p_fat_direto_valor numeric, p_fat_direto_percentual numeric,
  p_sinal boolean, p_sinal_valor numeric,
  p_caucao text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform public.salvar_condicoes_gerente(
    p_contratacao, p_permuta, p_permuta_valor, p_permuta_formato,
    p_fat_direto, p_fat_direto_valor, p_fat_direto_percentual, p_sinal, p_sinal_valor, p_caucao
  );
  perform public.concluir_etapa(p_contratacao, 6::smallint);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'abrir_contratacao(uuid, text, uuid, numeric, public.tipo_contratacao, text, text)',
    'salvar_campo_etapa(uuid, smallint, text)',
    'cancelar_contratacao(uuid, text)',
    'autorizar_contratacao(uuid, boolean, numeric, text, boolean, numeric, numeric, boolean, numeric, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
-- O grant acima reabriria esta função, fechada de propósito (acesso_fornecedor e revisão de segurança).
revoke all on function app.ligar_fornecedor(uuid) from public, authenticated;
