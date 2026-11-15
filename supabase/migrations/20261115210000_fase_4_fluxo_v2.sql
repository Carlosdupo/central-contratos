-- Fase 4: fluxo versão 2. Contratações já abertas continuam no fluxo 1 até terminar; as novas entram no fluxo 2
-- (versão 2: contratação normal; versão 3: aditivo). Só acrescenta; nada é apagado.
--
-- Cada etapa ganha uma CHAVE (ex.: autorizacao, contrato): as regras passam a ler a etapa pela chave, e o número é só a posição
-- (na versão 2 o número de uma etapa não muda; a etapa 6 simplesmente não existe).
--
--   Normal (versão 2): 1 solicitacao (a abertura já conclui) · 2 cotacao · 3 negociacao_obra · 4 solicitacao_sienge ·
--     5 autorizacao (negociação e autorização de Suprimentos: o comprador preenche, só o gerente autoriza) ·
--     7 contrato · 8 alcada · 9 assinaturas · 10 documentacao · 11 integracao · 12 liberacao
--   Aditivo (versão 3): 1 solicitacao · 2 fornecedor_valor (sem 3 cotações) · 4 solicitacao_sienge · 5 autorizacao ·
--     7 contrato_aditivo (lança no Sienge; Contratos marca guarda-chuva ou contrato novo; guarda-chuva pula a assinatura) ·
--     8 alcada · 9 assinaturas · 10 · 11 · 12
--   Empresa já liberada na obra (aprovada e ligada à obra antes desta contratação): 10, 11 e 12 ficam "não se aplica".
--   Documentação (10) e liberação (12) são do RH, que decide e fecha; a tela mostra quantos da equipe estão aprovados.

-- Chaves das etapas -----------------------------------------------------------------------------
alter table public.etapas_fluxo add column chave text;
update public.etapas_fluxo set chave = case etapa
  when 1 then 'escopo' when 2 then 'cotacao' when 3 then 'negociacao_obra' when 4 then 'solicitacao_sienge'
  when 5 then 'negociacao' when 6 then 'autorizacao' when 7 then 'contrato' when 8 then 'alcada'
  when 9 then 'assinaturas' when 10 then 'documentacao' when 11 then 'integracao' when 12 then 'liberacao' end
where versao = 1;
alter table public.etapas_fluxo alter column chave set not null;
alter table public.etapas_fluxo add constraint etapas_fluxo_chave_unica unique (versao, chave);

-- Fluxo 2 (contratação normal)
insert into public.etapas_fluxo (versao, etapa, chave, nome, trilha, papel, responsavel, dependencias, itens, pode_pular)
select 2, etapa, chave, nome, trilha, papel, responsavel,
  case etapa when 7 then '{5}'::smallint[] when 10 then '{5}'::smallint[] when 12 then '{8,9,11}'::smallint[] else dependencias end,
  case etapa when 10 then '{}'::text[] else itens end,
  pode_pular
from public.etapas_fluxo where versao = 1 and etapa in (2, 3, 4, 7, 8, 9, 10, 11, 12);
insert into public.etapas_fluxo (versao, etapa, chave, nome, trilha, papel, responsavel, dependencias, itens, pode_pular) values
  (2, 1, 'solicitacao', 'Solicitação da obra', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{}', '{}', false),
  (2, 5, 'autorizacao', 'Negociação e autorização de Suprimentos', 'negociacao', 'suprimentos', 'Suprimentos e gerente de suprimentos', '{4}',
    (select itens from public.etapas_fluxo where versao = 1 and etapa = 5), false);

-- Fluxo 2 do aditivo
insert into public.etapas_fluxo (versao, etapa, chave, nome, trilha, papel, responsavel, dependencias, itens, pode_pular)
select 3, etapa, chave, nome, trilha, papel, responsavel,
  case etapa when 10 then '{5}'::smallint[] when 12 then '{8,9,11}'::smallint[] else dependencias end,
  case etapa when 10 then '{}'::text[] else itens end,
  false
from public.etapas_fluxo where versao = 1 and etapa in (8, 9, 10, 11, 12);
update public.etapas_fluxo set dependencias = '{7}' where versao = 3 and etapa = 8;
update public.etapas_fluxo set dependencias = '{8}' where versao = 3 and etapa = 9;
update public.etapas_fluxo set dependencias = '{10}' where versao = 3 and etapa = 11;
insert into public.etapas_fluxo (versao, etapa, chave, nome, trilha, papel, responsavel, dependencias, itens, pode_pular) values
  (3, 1, 'solicitacao', 'Solicitação da obra', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{}', '{}', false),
  (3, 2, 'fornecedor_valor', 'Fornecedor e valor negociado', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{1}', '{}', false),
  (3, 4, 'solicitacao_sienge', 'Solicitação de serviço no Sienge', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{2}',
    (select itens from public.etapas_fluxo where versao = 1 and etapa = 4), false),
  (3, 5, 'autorizacao', 'Negociação e autorização de Suprimentos', 'negociacao', 'suprimentos', 'Suprimentos e gerente de suprimentos', '{4}',
    (select itens from public.etapas_fluxo where versao = 1 and etapa = 5), false),
  (3, 7, 'contrato_aditivo', 'Aditivo no Sienge e contrato', 'contrato', 'contratos', 'Contratos', '{5}',
    array['Aditivo lançado no Sienge (medição)', 'Verificado se cabe em contrato guarda-chuva'], false);

alter table public.contratacoes
  add column empresa_ja_liberada boolean not null default false,
  add column aditivo_destino text check (aditivo_destino is null or aditivo_destino in ('guarda_chuva', 'contrato_novo'));
comment on column public.contratacoes.empresa_ja_liberada is 'Fluxo 2: a empresa já estava aprovada e ligada à obra ao autorizar; documentação, integração e liberação não se aplicam.';

-- Posição (número) de uma etapa na versão da contratação, pela chave.
create function app.etapa_da_chave(p_contratacao uuid, p_chave text) returns smallint
language sql stable security definer set search_path = '' as $$
  select f.etapa from public.etapas_fluxo f join public.contratacoes c on c.id = p_contratacao and f.versao = c.fluxo_versao where f.chave = p_chave
$$;

-- Checklist de cada etapa segue a versão da contratação.
create or replace function app.criar_checklist_da_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.etapa_checklist (contratacao_id, etapa, item)
  select new.contratacao_id, new.etapa, i
  from public.etapas_fluxo f
  join public.contratacoes c on c.id = new.contratacao_id and f.versao = c.fluxo_versao
  cross join lateral generate_series(1, coalesce(array_length(f.itens, 1), 0)) i
  where f.etapa = new.etapa
  on conflict do nothing;
  return new;
end $$;

-- Liberação das etapas: segue a versão; no fluxo 2, empresa já liberada pula documentação, integração e liberação.
create or replace function app.liberar_etapas(p_contratacao uuid) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
begin
  select * into v_c from public.contratacoes where id = p_contratacao;
  if v_c.empresa_ja_liberada then
    update public.contratacao_etapas ce set situacao = 'pulada', concluida_em = now()
    from public.etapas_fluxo f
    where ce.contratacao_id = p_contratacao and f.versao = v_c.fluxo_versao and f.etapa = ce.etapa
      and f.chave in ('documentacao', 'integracao') and ce.situacao in ('pendente', 'em_andamento');
  end if;
  update public.contratacao_etapas ce set situacao = 'em_andamento', iniciada_em = now()
  from public.etapas_fluxo f
  where ce.contratacao_id = p_contratacao and ce.situacao = 'pendente' and f.versao = v_c.fluxo_versao and f.etapa = ce.etapa
    and not exists (
      select 1 from unnest(f.dependencias) dep
      join public.contratacao_etapas d on d.contratacao_id = p_contratacao and d.etapa = dep
      where d.situacao not in ('concluida', 'pulada')
    );
  if v_c.empresa_ja_liberada then
    update public.contratacao_etapas ce set situacao = 'pulada', concluida_em = now()
    from public.etapas_fluxo f
    where ce.contratacao_id = p_contratacao and f.versao = v_c.fluxo_versao and f.etapa = ce.etapa
      and f.chave = 'liberacao' and ce.situacao = 'em_andamento';
  end if;
  update public.contratacoes set situacao = 'liberada'
  where id = p_contratacao and situacao = 'em_andamento'
    and exists (
      select 1 from public.contratacao_etapas ce join public.etapas_fluxo f on f.versao = fluxo_versao and f.etapa = ce.etapa
      where ce.contratacao_id = p_contratacao and f.chave = 'liberacao' and ce.situacao in ('concluida', 'pulada')
    );
end $$;

-- Condições do gerente (etapa de autorização, em qualquer versão): só o gerente de suprimentos.
create or replace function public.salvar_condicoes_gerente(
  p_contratacao uuid,
  p_permuta boolean, p_permuta_valor numeric, p_permuta_formato text,
  p_fat_direto boolean, p_fat_direto_valor numeric, p_fat_direto_percentual numeric,
  p_sinal boolean, p_sinal_valor numeric,
  p_caucao text
) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, app.etapa_da_chave(p_contratacao, 'autorizacao'));
  if not app.tem_papel('gerente_suprimentos') then raise exception 'Só o gerente de suprimentos define as condições e autoriza.' using errcode = '42501'; end if;
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

-- Botão único da autorização.
create or replace function public.autorizar_contratacao(
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
  perform public.concluir_etapa(p_contratacao, app.etapa_da_chave(p_contratacao, 'autorizacao'));
end $$;

-- Conclusão pela chave da etapa. Fluxo 1: as mesmas regras de antes. Fluxo 2: autorização só pelo gerente, aditivo com destino.
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
  if v_chave = 'cotacao' and (select count(*) from public.cotacoes where contratacao_id = p_contratacao) < 3 then
    raise exception 'Registre as 3 cotações.' using errcode = 'P0001';
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

-- Aditivo: fornecedor e valor negociado (sem 3 cotações). Coordenador ou auxiliar da obra.
create function public.definir_fornecedor_aditivo(p_contratacao uuid, p_nome text, p_cnpj text, p_valor numeric) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_cnpj text := regexp_replace(coalesce(p_cnpj, ''), '\D', '', 'g');
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, app.etapa_da_chave(p_contratacao, 'fornecedor_valor'));
  if length(btrim(coalesce(p_nome, ''))) < 2 or length(p_nome) > 160 then raise exception 'Informe o fornecedor.' using errcode = 'P0001'; end if;
  if length(v_cnpj) <> 14 then raise exception 'Informe o CNPJ do fornecedor.' using errcode = 'P0001'; end if;
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor negociado.' using errcode = 'P0001'; end if;
  update public.contratacoes set
    fornecedor_nome = btrim(p_nome), fornecedor_cnpj = v_cnpj, valor_negociado = p_valor,
    empresa_id = (select id from public.empresas_terceiras where cnpj = v_cnpj)
  where id = p_contratacao;
end $$;

-- Aditivo: Contratos marca se cabe em contrato guarda-chuva (pula a assinatura) ou se precisa de contrato novo.
create function public.definir_destino_aditivo(p_contratacao uuid, p_destino text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, app.etapa_da_chave(p_contratacao, 'contrato_aditivo'));
  if p_destino not in ('guarda_chuva', 'contrato_novo') then raise exception 'Escolha guarda-chuva ou contrato novo.' using errcode = 'P0001'; end if;
  update public.contratacoes set aditivo_destino = p_destino where id = p_contratacao;
end $$;

-- Avisos: autorizada e liberada pela chave da etapa (e a liberação pulada também avisa a obra).
create or replace function app.avisar_mudanca_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_nome text;
  v_chave text;
begin
  select * into v_c from public.contratacoes where id = new.contratacao_id;
  select nome, chave into v_nome, v_chave from public.etapas_fluxo where versao = v_c.fluxo_versao and etapa = new.etapa;
  if new.situacao = 'em_andamento' and coalesce(current_setting('app.devolucao', true), '') <> '1' then
    perform app.avisar(
      array(select app.destinatarios_da_etapa(v_c.obra_id, new.etapa, v_c.fluxo_versao)),
      'etapa', v_c.codigo || ': chegou a etapa ' || new.etapa || ' (' || v_nome || ') para a sua área', null, v_c.id,
      'etapa:' || v_c.id || ':' || new.etapa || ':' || extract(epoch from coalesce(new.iniciada_em, now()))::bigint);
  elsif new.situacao = 'concluida' and v_chave = 'autorizacao' then
    perform app.avisar(
      array(select u.id from public.usuario_obras uo join public.usuarios u on u.id = uo.usuario_id and u.ativo and u.tipo = 'interno' where uo.obra_id = v_c.obra_id),
      'autorizada', v_c.codigo || ': contratação autorizada pelo gerente de suprimentos', null, v_c.id, 'autorizada:' || v_c.id);
  elsif new.situacao in ('concluida', 'pulada') and v_chave = 'liberacao' then
    perform app.avisar(
      array(select u.id from public.usuario_obras uo join public.usuarios u on u.id = uo.usuario_id and u.ativo and u.tipo = 'interno' where uo.obra_id = v_c.obra_id),
      'liberada', v_c.codigo || ': empresa liberada para a obra', null, v_c.id, 'liberada:' || v_c.id);
  end if;
  return null;
end $$;

-- Abertura: a contratação nova entra no fluxo 2 (aditivo: versão 3); a abertura já conclui a etapa 1.
create or replace function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_matriz uuid, p_valor numeric, p_aditivo boolean, p_negociacao text,
  p_contrato_original text default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_m public.matriz_contratacao;
  v_original text := nullif(btrim(coalesce(p_contrato_original, '')), '');
  v_versao int := case when coalesce(p_aditivo, false) then 3 else 2 end;
  v_prazos jsonb := coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}');
begin
  if not app.pode_na_obra(p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  select * into v_m from public.matriz_contratacao where id = p_matriz;
  if not found then raise exception 'Escolha a atividade da matriz.' using errcode = 'P0001'; end if;
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
  insert into public.contratacoes (codigo, obra_id, servico, pacote, matriz_id, forma_legal, valor_orcado, tipo, negociacao, contrato_original, prazos, limite_obra, fluxo_versao)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico), left(coalesce(v_m.subgrupo_codigo, v_m.grupo_codigo) || ' ' || v_m.atividade, 120),
    v_m.id, v_m.forma_legal, p_valor,
    case when coalesce(p_aditivo, false) then 'aditivo' else 'contrato' end::public.tipo_contratacao,
    p_negociacao, v_original,
    -- A autorização é a etapa 5 no fluxo 2: ela herda o prazo que o gerente tinha na etapa 6.
    jsonb_set(v_prazos, '{5}', coalesce(v_prazos -> '5', v_prazos -> '6', 'null'::jsonb)),
    v_limite, v_versao
  ) returning id into v_id;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = v_versao;
  update public.contratacao_etapas set situacao = 'concluida', iniciada_em = now(), concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = v_id and etapa = app.etapa_da_chave(v_id, 'solicitacao');
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

revoke all on function app.etapa_da_chave(uuid, text) from public, anon, authenticated;
revoke all on function app.avisar_mudanca_etapa() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.definir_fornecedor_aditivo(uuid, text, text, numeric)',
    'public.definir_destino_aditivo(uuid, text)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
