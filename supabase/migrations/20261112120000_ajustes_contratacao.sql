-- Ajustes da contratação pedidos pelo usuário (2026-11-11):
-- EAP da obra; coordenador escolhe quem negocia (obra ou Suprimentos); valor orçado opcional;
-- escolha do fornecedor junto com o valor final; condições do gerente (permuta, faturamento direto,
-- sinal, caução); prazo de 2 dias úteis para o gerente; etapas sem checklist obrigatório.

-- EAP da obra -------------------------------------------------------------------------------
create table public.obra_eap (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  referencia text not null check (referencia ~ '^\d+(\.\d+)*$'),
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  nivel smallint not null check (nivel between 1 and 6),
  ordem int not null,
  unique (obra_id, referencia)
);
create index obra_eap_obra_idx on public.obra_eap (obra_id, ordem);
alter table public.obras add column eap_importada_em timestamptz;

alter table public.obra_eap enable row level security;
create policy obra_eap_ler on public.obra_eap for select to authenticated using (app.usuario_interno_ativo());

-- Troca a EAP inteira da obra (importação do PDF). Só admin. Itens: [{referencia, descricao, nivel}].
create function public.importar_eap(p_obra uuid, p_itens jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd int;
begin
  if not app.admin_verificado() then raise exception 'Só o administrador importa a EAP.' using errcode = '42501'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then
    raise exception 'Nenhum item da EAP encontrado no arquivo.' using errcode = 'P0001';
  end if;
  if jsonb_array_length(p_itens) > 5000 then raise exception 'EAP grande demais.' using errcode = 'P0001'; end if;
  if exists (select 1 from public.contratacoes c join public.obra_eap e on e.id = c.eap_item_id where e.obra_id = p_obra)
     and exists (
       select 1 from public.contratacoes c join public.obra_eap e on e.id = c.eap_item_id
       where e.obra_id = p_obra and not exists (
         select 1 from jsonb_array_elements(p_itens) i where i ->> 'referencia' = e.referencia
       )
     ) then
    raise exception 'A nova EAP não tem itens já usados em contratações desta obra.' using errcode = 'P0001';
  end if;
  -- Mantém os itens de mesma referência (contratações continuam ligadas); atualiza a descrição e o resto.
  delete from public.obra_eap e where e.obra_id = p_obra
    and not exists (select 1 from jsonb_array_elements(p_itens) i where i ->> 'referencia' = e.referencia);
  insert into public.obra_eap (obra_id, referencia, descricao, nivel, ordem)
  select p_obra, i ->> 'referencia', btrim(i ->> 'descricao'), (i ->> 'nivel')::smallint, n::int
  from jsonb_array_elements(p_itens) with ordinality as t(i, n)
  on conflict (obra_id, referencia) do update set descricao = excluded.descricao, nivel = excluded.nivel, ordem = excluded.ordem;
  get diagnostics v_qtd = row_count;
  update public.obras set eap_importada_em = now() where id = p_obra;
  insert into public.auditoria (acao, tabela, registro_id, depois)
  values ('UPDATE', 'importacao_eap', p_obra::text, jsonb_build_object('itens', jsonb_array_length(p_itens)));
  return v_qtd;
end $$;

-- Contratação ------------------------------------------------------------------------------
alter table public.contratacoes alter column valor_orcado drop not null;  -- "não informar / não se aplica"
alter table public.contratacoes
  add column negociacao text not null default 'suprimentos' check (negociacao in ('obra', 'suprimentos')),
  add column eap_item_id uuid references public.obra_eap (id) on delete set null,
  add column permuta boolean,
  add column permuta_valor numeric(14, 2) check (permuta_valor is null or permuta_valor > 0),
  add column permuta_formato text check (permuta_formato is null or length(permuta_formato) <= 160),
  add column fat_direto boolean,
  add column fat_direto_valor numeric(14, 2) check (fat_direto_valor is null or fat_direto_valor > 0),
  add column fat_direto_percentual numeric(5, 2) check (fat_direto_percentual is null or fat_direto_percentual between 0 and 100),
  add column sinal boolean,
  add column sinal_valor numeric(14, 2) check (sinal_valor is null or sinal_valor > 0),
  add column caucao text check (caucao is null or caucao in ('3', '5', 'na'));
update public.contratacoes set negociacao = case when valor_orcado < limite_obra then 'obra' else 'suprimentos' end;

-- Etapas sem checklist obrigatório: os itens viram orientação ("o que fazer nesta etapa").
update public.etapas_fluxo set itens = '{}' where versao = 1 and etapa = 1;
update public.etapas_fluxo set itens = array_remove(itens, 'Documentos do terceiro anexados') where versao = 1 and etapa = 5;

-- Prazo do gerente de suprimentos: 2 dias úteis (vale para as contratações abertas a partir de agora).
update public.parametros set valor = valor || '{"6": {"dias": 2, "uteis": true}}'::jsonb where chave = 'prazos_etapas';

-- Abertura: item da EAP (obrigatório se a obra tem EAP), valor opcional e quem negocia.
drop function public.abrir_contratacao(uuid, text, text, numeric, public.tipo_contratacao);
create function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_eap_item uuid, p_valor numeric, p_tipo public.tipo_contratacao, p_negociacao text
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_pacote text;
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
  if p_valor is not null and p_valor <= 0 then raise exception 'Valor orçado inválido.' using errcode = 'P0001'; end if;
  if p_negociacao not in ('obra', 'suprimentos') then raise exception 'Escolha quem negocia.' using errcode = 'P0001'; end if;
  if p_negociacao = 'obra' and p_valor is not null and p_valor >= v_limite then
    raise exception '%', 'A partir de R$ ' || replace(to_char(v_limite, 'FM999G999G990'), ',', '.') || ' do orçamento, a negociação é de Suprimentos.'
      using errcode = 'P0001';
  end if;
  insert into public.contratacoes (codigo, obra_id, servico, pacote, eap_item_id, valor_orcado, tipo, negociacao, prazos, limite_obra)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico), v_pacote, p_eap_item, p_valor, p_tipo, p_negociacao,
    coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}'),
    v_limite
  ) returning id into v_id;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = 1;
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

-- Escolha do fornecedor com o valor final. Negociação pela obra: etapa 3 (a obra escolhe; em 5,
-- Suprimentos só ajusta o valor). Negociação por Suprimentos (ou obra que pulou): etapa 5.
drop function public.escolher_fornecedor(uuid);
create function public.definir_fornecedor(p_cotacao uuid, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cot public.cotacoes;
  v_c public.contratacoes;
  v_etapa smallint;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao;
  if not found then raise exception 'Cotação não encontrada.' using errcode = 'P0001'; end if;
  select * into v_c from public.contratacoes where id = v_cot.contratacao_id;
  v_etapa := case when exists (
    select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = 3 and situacao = 'em_andamento'
  ) then 3 else 5 end;
  if v_etapa = 3 and v_c.negociacao <> 'obra' then
    raise exception 'A negociação desta contratação é de Suprimentos, na etapa 5.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = v_etapa and situacao = 'em_andamento') then
    raise exception 'A escolha do fornecedor é feita na negociação (etapa 3 ou 5).' using errcode = 'P0001';
  end if;
  perform app.exigir_etapa_em_andamento(v_c.id, v_etapa);
  if v_etapa = 5 and v_c.negociacao = 'obra' and not v_c.negociacao_pulada
     and v_c.fornecedor_cnpj is not null and v_c.fornecedor_cnpj <> v_cot.cnpj then
    raise exception 'A obra negociou e escolheu o fornecedor; aqui só se ajusta o valor final.' using errcode = 'P0001';
  end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor final negociado.' using errcode = 'P0001'; end if;
  update public.cotacoes set escolhida = (id = p_cotacao), escolhida_por = case when id = p_cotacao then auth.uid() end
  where contratacao_id = v_c.id;
  update public.contratacoes set
    fornecedor_nome = v_cot.fornecedor, fornecedor_cnpj = v_cot.cnpj, valor_negociado = p_valor,
    empresa_id = (select id from public.empresas_terceiras where cnpj = v_cot.cnpj)
  where id = v_c.id;
end $$;

-- Condições do gerente de suprimentos (etapa 6).
create function public.salvar_condicoes_gerente(
  p_contratacao uuid,
  p_permuta boolean, p_permuta_valor numeric, p_permuta_formato text,
  p_fat_direto boolean, p_fat_direto_valor numeric, p_fat_direto_percentual numeric,
  p_sinal boolean, p_sinal_valor numeric,
  p_caucao text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, 6::smallint);
  if p_permuta is null or p_fat_direto is null or p_sinal is null or p_caucao is null then
    raise exception 'Responda permuta, faturamento direto, sinal e caução.' using errcode = 'P0001';
  end if;
  if p_caucao not in ('3', '5', 'na') then raise exception 'Caução inválida.' using errcode = 'P0001'; end if;
  if p_permuta and (p_permuta_valor is null or length(btrim(coalesce(p_permuta_formato, ''))) = 0) then
    raise exception 'Permuta: informe o valor e o formato.' using errcode = 'P0001';
  end if;
  if p_fat_direto and (p_fat_direto_valor is null or p_fat_direto_percentual is null) then
    raise exception 'Faturamento direto: informe o valor e o percentual.' using errcode = 'P0001';
  end if;
  if p_sinal and p_sinal_valor is null then raise exception 'Sinal: informe o valor.' using errcode = 'P0001'; end if;
  update public.contratacoes set
    permuta = p_permuta,
    permuta_valor = case when p_permuta then p_permuta_valor end,
    permuta_formato = case when p_permuta then btrim(p_permuta_formato) end,
    fat_direto = p_fat_direto,
    fat_direto_valor = case when p_fat_direto then p_fat_direto_valor end,
    fat_direto_percentual = case when p_fat_direto then p_fat_direto_percentual end,
    sinal = p_sinal,
    sinal_valor = case when p_sinal then p_sinal_valor end,
    caucao = p_caucao
  where id = p_contratacao;
end $$;

-- Conclusão: sem checklist obrigatório; regras de negociação e condições do gerente.
create or replace function public.concluir_etapa(p_contratacao uuid, p_etapa smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  if p_etapa = 9 then raise exception 'A etapa de assinaturas termina com a última assinatura.' using errcode = 'P0001'; end if;
  v_c := app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
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
  -- Negociação por Suprimentos: a etapa 3 (negociação da obra) não se aplica.
  if p_etapa = 2 and v_c.negociacao = 'suprimentos' then
    update public.contratacao_etapas set situacao = 'pulada', concluida_em = now(), concluida_por = auth.uid()
    where contratacao_id = p_contratacao and etapa = 3 and situacao = 'pendente';
  end if;
  if p_etapa = 6 then perform app.ligar_fornecedor(p_contratacao); end if;
  perform app.liberar_etapas(p_contratacao);
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'importar_eap(uuid, jsonb)',
    'abrir_contratacao(uuid, text, uuid, numeric, public.tipo_contratacao, text)',
    'definir_fornecedor(uuid, numeric)',
    'salvar_condicoes_gerente(uuid, boolean, numeric, text, boolean, numeric, numeric, boolean, numeric, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
