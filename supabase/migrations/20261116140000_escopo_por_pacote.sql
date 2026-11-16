-- Escopo da contratação por pacote da matriz (grupo, subgrupo ou atividade). Só acrescenta; as contratações antigas ficam como estão.
--
-- A obra contrata pacotes globais (ex.: toda a elétrica com uma empresa) e a matriz é quebrada em atividades. A abertura passa a
-- receber a LISTA de atividades do escopo. A forma legal da contratação é a mais rigorosa entre elas, na ordem:
-- Contrato + Edital > Contrato > Contrato genérico > Proposta comercial assinada > Pedido > Medição excel. O banco calcula (não confia na tela).

create table public.contratacao_atividades (
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  matriz_id uuid not null references public.matriz_contratacao (id),
  primary key (contratacao_id, matriz_id)
);
create index contratacao_atividades_matriz_idx on public.contratacao_atividades (matriz_id);
alter table public.contratacao_atividades enable row level security;
revoke all on public.contratacao_atividades from anon;
revoke insert, update, delete, truncate on public.contratacao_atividades from authenticated;
create policy contratacao_atividades_ler on public.contratacao_atividades for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));

-- As contratações que já existem têm uma atividade só: ficam com ela (compatibilidade; nada muda na forma legal delas).
insert into public.contratacao_atividades (contratacao_id, matriz_id)
select id, matriz_id from public.contratacoes where matriz_id is not null
on conflict do nothing;

-- Forma legal mais rigorosa de uma lista. Forma desconhecida conta como a menos rigorosa.
create function app.forma_legal_mais_rigorosa(p_formas text[]) returns text
language sql immutable set search_path = '' as $$
  select f from unnest(p_formas) as f
  order by coalesce(array_position(array['contrato + edital', 'contrato', 'contrato genérico', 'proposta comercial assinada', 'pedido', 'medição excel'], lower(btrim(f))), 99), f
  limit 1
$$;
revoke all on function app.forma_legal_mais_rigorosa(text[]) from public, anon, authenticated;

-- Abertura com a lista de atividades do escopo (p_escopo é o rótulo, ex.: "21.1 Elétrica (13 de 14 atividades)").
drop function public.abrir_contratacao(uuid, text, uuid, numeric, boolean, text, text, uuid);
create function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_atividades uuid[], p_escopo text, p_valor numeric, p_aditivo boolean, p_negociacao text,
  p_contrato_original text default null, p_planejamento_item uuid default null
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
begin
  if not app.pode_na_obra(p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  -- Escopo: pelo menos uma atividade, todas existentes. A primeira (pela ordem da matriz) fica em matriz_id, por compatibilidade.
  select array_agg(distinct x) into v_ids from unnest(coalesce(p_atividades, '{}')) as x where x is not null;
  if v_ids is null or cardinality(v_ids) = 0 then raise exception 'Escolha pelo menos uma atividade da matriz.' using errcode = 'P0001'; end if;
  if cardinality(v_ids) > 100 then raise exception 'Escopo grande demais (até 100 atividades).' using errcode = 'P0001'; end if;
  if (select count(*) from public.matriz_contratacao where id = any(v_ids)) <> cardinality(v_ids) then
    raise exception 'Atividade da matriz inexistente.' using errcode = 'P0001';
  end if;
  select * into v_m from public.matriz_contratacao where id = any(v_ids) order by ordem limit 1;
  select app.forma_legal_mais_rigorosa(array_agg(forma_legal)) into v_forma from public.matriz_contratacao where id = any(v_ids);
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
  insert into public.contratacoes (codigo, obra_id, servico, pacote, matriz_id, forma_legal, valor_orcado, tipo, negociacao, contrato_original, prazos, limite_obra, fluxo_versao, planejamento_item_id, negociacao_a_partir_de, fora_do_prazo)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico),
    left(coalesce(nullif(btrim(p_escopo), ''), coalesce(v_m.subgrupo_codigo, v_m.grupo_codigo) || ' ' || v_m.atividade), 120),
    v_m.id, v_forma, p_valor,
    case when coalesce(p_aditivo, false) then 'aditivo' else 'contrato' end::public.tipo_contratacao,
    p_negociacao, v_original,
    -- A autorização é a etapa 5 no fluxo 2: ela herda o prazo que o gerente tinha na etapa 6.
    jsonb_set(v_prazos, '{5}', coalesce(v_prazos -> '5', v_prazos -> '6', 'null'::jsonb)),
    v_limite, v_versao, p_planejamento_item, v_inicio, v_fora
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

revoke all on function public.abrir_contratacao(uuid, text, uuid[], text, numeric, boolean, text, text, uuid) from public, anon;
grant execute on function public.abrir_contratacao(uuid, text, uuid[], text, numeric, boolean, text, text, uuid) to authenticated;
