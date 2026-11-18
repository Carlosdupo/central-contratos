-- Atividade que não consta na matriz. A obra marca "Não consta na matriz" e descreve a atividade; a contratação abre sem
-- atividades da matriz e sem forma legal (Suprimentos define). Só acrescenta um parâmetro opcional no fim; o resto da abertura não muda.

alter table public.contratacoes add column fora_da_matriz text;
comment on column public.contratacoes.fora_da_matriz is 'Descrição da atividade quando ela não consta na matriz (contratação sem atividades da matriz).';

drop function public.abrir_contratacao(uuid, text, uuid[], text, numeric, boolean, text, text, uuid);
create function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_atividades uuid[], p_escopo text, p_valor numeric, p_aditivo boolean, p_negociacao text,
  p_contrato_original text default null, p_planejamento_item uuid default null, p_fora_matriz text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_m public.matriz_contratacao;
  v_ids uuid[];
  v_forma text;
  v_original text := nullif(btrim(coalesce(p_contrato_original, '')), '');
  v_versao int := case when coalesce(p_aditivo, false) then 3 else 2 end;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_inicio date;
  v_fora boolean := false;
  v_solicitar date;
  v_prazos jsonb := coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}');
  v_fora_matriz text := nullif(btrim(coalesce(p_fora_matriz, '')), '');
begin
  if not app.pode_na_obra(p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  -- Escopo: pelo menos uma atividade, todas existentes. A primeira (pela ordem da matriz) fica em matriz_id, por compatibilidade.
  -- Não consta na matriz: nenhuma atividade, só a descrição; forma legal fica em branco (Suprimentos define).
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_atividades, '{}')) as x where x is not null;
  if v_fora_matriz is not null then
    if v_ids is not null and cardinality(v_ids) > 0 then
      raise exception 'Escolha atividades da matriz ou marque que não consta, não os dois.' using errcode = 'P0001';
    end if;
    if char_length(v_fora_matriz) < 3 then raise exception 'Descreva a atividade que não consta na matriz.' using errcode = 'P0001'; end if;
    v_fora_matriz := left(v_fora_matriz, 200);
    v_ids := '{}';
  else
    if v_ids is null or cardinality(v_ids) = 0 then raise exception 'Escolha pelo menos uma atividade da matriz.' using errcode = 'P0001'; end if;
    if cardinality(v_ids) > 100 then raise exception 'Escopo grande demais (até 100 atividades).' using errcode = 'P0001'; end if;
    if (select count(*) from public.matriz_contratacao where id = any(v_ids)) <> cardinality(v_ids) then
      raise exception 'Atividade da matriz inexistente.' using errcode = 'P0001';
    end if;
    select * into v_m from public.matriz_contratacao where id = any(v_ids) order by ordem limit 1;
    select app.forma_legal_mais_rigorosa(array_agg(forma_legal)) into v_forma from public.matriz_contratacao where id = any(v_ids);
  end if;
  if p_valor is not null and p_valor <= 0 then raise exception 'Valor Orçamento inválido.' using errcode = 'P0001'; end if;
  if p_negociacao not in ('obra', 'suprimentos') then raise exception 'Escolha quem negocia.' using errcode = 'P0001'; end if;
  if p_negociacao = 'obra' and p_valor is not null and p_valor >= v_limite then
    raise exception '%', 'A partir de R$ ' || replace(to_char(v_limite, 'FM999G999G990'), ',', '.') || ' do orçamento, a negociação é de Suprimentos.'
      using errcode = 'P0001';
  end if;
  if coalesce(p_aditivo, false) then
    if v_original is null then raise exception 'Informe o nº do contrato original no Sienge.' using errcode = 'P0001'; end if;
    perform app.conferir_codigo_sienge(p_obra, v_original);
  else
    v_original := null;
  end if;
  -- Item da planilha: segue as datas dela (marca "fora do prazo" se a obra pediu depois da data que deveria). Sem item: calendário.
  if p_planejamento_item is not null then
    perform 1 from public.planejamento_itens where id = p_planejamento_item and obra_id = p_obra and contratacao_id is null and situacao_obra = 'pendente' for update;
    if not found then raise exception 'Item da planilha inválido, já usado em outra contratação ou já atendido.' using errcode = 'P0001'; end if;
    select data_solicitar into v_solicitar from public.planejamento_calculado where id = p_planejamento_item;
    v_inicio := v_hoje;
    v_fora := v_solicitar is not null and v_hoje > v_solicitar;
  else
    select c.inicio into v_inicio from public.ciclo_do_pedido(v_hoje) c;
  end if;
  insert into public.contratacoes (codigo, obra_id, servico, pacote, matriz_id, forma_legal, valor_orcado, tipo, negociacao, contrato_original, prazos, limite_obra, fluxo_versao, planejamento_item_id, negociacao_a_partir_de, fora_do_prazo, fora_da_matriz)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico),
    case when v_fora_matriz is not null then left('Não consta na matriz: ' || v_fora_matriz, 120)
      else left(coalesce(nullif(btrim(p_escopo), ''), coalesce(v_m.subgrupo_codigo, v_m.grupo_codigo) || ' ' || v_m.atividade), 120) end,
    v_m.id, v_forma, p_valor,
    case when coalesce(p_aditivo, false) then 'aditivo' else 'contrato' end::public.tipo_contratacao,
    p_negociacao, v_original,
    -- A autorização é a etapa 5 no fluxo 2: ela herda o prazo que o gerente tinha na etapa 6.
    jsonb_set(v_prazos, '{5}', coalesce(v_prazos -> '5', v_prazos -> '6', 'null'::jsonb)),
    v_limite, v_versao, p_planejamento_item, v_inicio, v_fora, v_fora_matriz
  ) returning id into v_id;
  insert into public.contratacao_atividades (contratacao_id, matriz_id) select v_id, x from unnest(v_ids) as x;
  if p_planejamento_item is not null then
    update public.planejamento_itens set contratacao_id = v_id, data_real_obra = v_hoje, situacao_obra = 'feito' where id = p_planejamento_item;
  end if;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = v_versao;
  update public.contratacao_etapas set situacao = 'concluida', iniciada_em = now(), concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = v_id and etapa = app.etapa_da_chave(v_id, 'solicitacao');
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

revoke all on function public.abrir_contratacao(uuid, text, uuid[], text, numeric, boolean, text, text, uuid, text) from public, anon;
grant execute on function public.abrir_contratacao(uuid, text, uuid[], text, numeric, boolean, text, text, uuid, text) to authenticated;
