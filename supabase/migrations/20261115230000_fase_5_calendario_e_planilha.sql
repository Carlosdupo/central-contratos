-- Fase 5: Suprimentos (calendário, planilha de planejamento e prazos). Só acrescenta; nada é apagado.
--
-- Regras (decididas em 15/11):
--  * Calendário de suprimentos: um só para todas as obras, dois ciclos por mês, definido pelo gerente de suprimentos.
--    Cada ciclo tem a data-limite para a obra solicitar e o início da negociação. O pedido entra no primeiro ciclo
--    cujo limite ainda não passou. O calendário vale só para o que NÃO está na planilha.
--  * Planilha (mão de obra e materiais, por obra): os itens seguem as datas dela, calculadas pelo cronograma:
--      início do pacote            = cronograma (por ID do pacote) ou data digitada à mão (itens sem ID)
--      data que a obra deve solicitar = início − prazo de compras − prazo até chegar na obra
--      data para iniciar estudo       = data que a obra deve solicitar − 30 dias
--      data para compras fechar       = início − prazo até chegar na obra
--      data em que compras deveria fechar = data real da obra + prazo de compras
--    A data real da obra (abertura da contratação) e a data real de compras (autorização do gerente) são gravadas pelo fluxo.

-- Calendário ---------------------------------------------------------------------------------------
create table public.calendario_suprimentos (
  id uuid primary key default gen_random_uuid(),
  ano int not null check (ano between 2020 and 2100),
  mes smallint not null check (mes between 1 and 12),
  ciclo smallint not null check (ciclo in (1, 2)),
  limite date not null,
  inicio date not null,
  check (inicio > limite),
  unique (ano, mes, ciclo)
);
alter table public.calendario_suprimentos enable row level security;
revoke all on public.calendario_suprimentos from anon;
revoke insert, update, delete, truncate on public.calendario_suprimentos from authenticated;
create policy calendario_ler on public.calendario_suprimentos for select to authenticated using (app.usuario_interno_ativo());
create trigger auditar_calendario after insert or update or delete on public.calendario_suprimentos for each row execute function app.auditar();

-- O gerente de suprimentos grava o ano inteiro de uma vez: [{mes, ciclo, limite, inicio}, ...] (até 24 ciclos).
create function public.salvar_calendario(p_ano int, p_ciclos jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd int;
begin
  if not app.tem_papel('gerente_suprimentos') then raise exception 'Só o gerente de suprimentos define o calendário.' using errcode = '42501'; end if;
  if p_ano is null or p_ano not between 2020 and 2100 then raise exception 'Ano inválido.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_ciclos) <> 'array' or jsonb_array_length(p_ciclos) > 24 then raise exception 'Calendário inválido (até 24 ciclos).' using errcode = 'P0001'; end if;
  begin
    perform 1 from jsonb_to_recordset(p_ciclos) as t(mes int, ciclo int, limite date, inicio date)
    where t.mes not between 1 and 12 or t.ciclo not in (1, 2) or t.limite is null or t.inicio is null or t.inicio <= t.limite
      or extract(year from t.limite) not between p_ano - 1 and p_ano;
    if found then raise exception 'Confira os ciclos: o início da negociação vem depois do limite, no ano escolhido.' using errcode = 'P0001'; end if;
  exception when invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Confira as datas do calendário.' using errcode = 'P0001';
  end;
  delete from public.calendario_suprimentos where ano = p_ano;
  insert into public.calendario_suprimentos (ano, mes, ciclo, limite, inicio)
  select p_ano, t.mes, t.ciclo, t.limite, t.inicio from jsonb_to_recordset(p_ciclos) as t(mes int, ciclo int, limite date, inicio date);
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

-- Em que ciclo o pedido de hoje entra: o primeiro cujo limite ainda não passou.
create function public.ciclo_do_pedido(p_dia date) returns table (limite date, inicio date)
language sql stable security definer set search_path = '' as $$
  select c.limite, c.inicio from public.calendario_suprimentos c
  where app.usuario_interno_ativo() and c.limite >= p_dia order by c.limite limit 1
$$;

-- Planejamento (planilhas de suprimentos) ------------------------------------------------------------
create table public.cronograma_pacotes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  id_pacote text not null check (length(btrim(id_pacote)) between 1 and 40),
  inicio date not null,
  unique (obra_id, id_pacote)
);

create table public.planejamento_itens (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id) on delete cascade,
  tipo text not null check (tipo in ('MO', 'MAT')),
  ordem int not null default 0,
  fase text check (fase is null or length(fase) <= 80),
  id_pacote text check (id_pacote is null or length(btrim(id_pacote)) between 1 and 40),
  pacote_vinculado text check (pacote_vinculado is null or length(pacote_vinculado) <= 120),
  local text check (local is null or length(local) <= 120),
  responsavel text check (responsavel is null or length(responsavel) <= 120),
  descricao text not null check (length(btrim(descricao)) between 1 and 200),
  prazo_compras_dias int check (prazo_compras_dias is null or prazo_compras_dias between 0 and 3650),
  prazo_chegada_dias int check (prazo_chegada_dias is null or prazo_chegada_dias between 0 and 3650),
  inicio_manual date,
  sienge_solicitacao text check (sienge_solicitacao is null or length(sienge_solicitacao) <= 40),
  data_real_obra date,
  data_real_compras date,
  -- Na planilha, "ok" na data real quer dizer feito (sem a data) e "NA"/"não tem" quer dizer que não se aplica; "_" é pendente.
  situacao_obra text not null default 'pendente' check (situacao_obra in ('pendente', 'feito', 'feito_sem_data', 'nao_se_aplica')),
  situacao_compras text not null default 'pendente' check (situacao_compras in ('pendente', 'feito', 'feito_sem_data', 'nao_se_aplica')),
  observacao text check (observacao is null or length(observacao) <= 500),
  contratacao_id uuid unique references public.contratacoes (id) on delete set null
);
create index planejamento_itens_obra_idx on public.planejamento_itens (obra_id, tipo, ordem);

alter table public.cronograma_pacotes enable row level security;
alter table public.planejamento_itens enable row level security;
revoke all on public.cronograma_pacotes, public.planejamento_itens from anon;
revoke insert, update, delete, truncate on public.cronograma_pacotes, public.planejamento_itens from authenticated;
create policy cronograma_ler on public.cronograma_pacotes for select to authenticated using (app.pode_ver_obra(obra_id));
create policy planejamento_ler on public.planejamento_itens for select to authenticated using (app.pode_ver_obra(obra_id));
create trigger auditar_planejamento after insert or update or delete on public.planejamento_itens for each row execute function app.auditar();
create trigger auditar_cronograma after insert or update or delete on public.cronograma_pacotes for each row execute function app.auditar();

-- Datas calculadas (a view respeita a RLS de quem consulta).
create view public.planejamento_calculado with (security_invoker = true) as
select i.*, x.inicio_pacote,
  case when x.inicio_pacote is not null and i.prazo_compras_dias is not null and i.prazo_chegada_dias is not null
       then x.inicio_pacote - i.prazo_compras_dias - i.prazo_chegada_dias end as data_solicitar,
  case when x.inicio_pacote is not null and i.prazo_compras_dias is not null and i.prazo_chegada_dias is not null
       then x.inicio_pacote - i.prazo_compras_dias - i.prazo_chegada_dias - 30 end as data_estudo,
  case when x.inicio_pacote is not null and i.prazo_chegada_dias is not null
       then x.inicio_pacote - i.prazo_chegada_dias end as data_compras_fechar,
  case when i.data_real_obra is not null and i.prazo_compras_dias is not null
       then i.data_real_obra + i.prazo_compras_dias end as data_deveria_fechar
from public.planejamento_itens i
left join public.cronograma_pacotes c on c.obra_id = i.obra_id and c.id_pacote = i.id_pacote
cross join lateral (select coalesce(c.inicio, i.inicio_manual) as inicio_pacote) x;

-- Quem mexe na planilha: Suprimentos (comprador e gerente).
create function app.pode_planejar() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos')
$$;

-- Importação (substitui os itens ainda sem contratação da obra e do tipo): [{descricao, fase, id_pacote, ...}]
create function public.importar_planejamento(p_obra uuid, p_tipo text, p_itens jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd int;
begin
  if not (app.pode_planejar() or app.admin_verificado()) then raise exception 'Só Suprimentos importa a planilha.' using errcode = '42501'; end if;
  if p_tipo not in ('MO', 'MAT') then raise exception 'Tipo da planilha inválido.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.obras where id = p_obra) then raise exception 'Obra inválida.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_itens) <> 'array' or jsonb_array_length(p_itens) = 0 then raise exception 'Nenhum item encontrado na planilha.' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_itens) > 1000 then raise exception 'Planilha grande demais (até 1.000 itens).' using errcode = 'P0001'; end if;
  begin
    delete from public.planejamento_itens where obra_id = p_obra and tipo = p_tipo and contratacao_id is null;
    insert into public.planejamento_itens (obra_id, tipo, ordem, fase, id_pacote, pacote_vinculado, local, responsavel, descricao,
      prazo_compras_dias, prazo_chegada_dias, inicio_manual, sienge_solicitacao, data_real_obra, data_real_compras, situacao_obra, situacao_compras, observacao)
    select p_obra, p_tipo, (row_number() over ())::int, nullif(btrim(t.fase), ''), nullif(btrim(t.id_pacote), ''), nullif(btrim(t.pacote_vinculado), ''), nullif(btrim(t.local), ''),
      nullif(btrim(t.responsavel), ''), btrim(t.descricao), t.prazo_compras_dias, t.prazo_chegada_dias,
      case when nullif(btrim(t.id_pacote), '') is null then t.inicio_manual end,
      nullif(btrim(t.sienge_solicitacao), ''), t.data_real_obra, t.data_real_compras,
      case when t.data_real_obra is not null then 'feito' else coalesce(nullif(btrim(t.situacao_obra), ''), 'pendente') end,
      case when t.data_real_compras is not null then 'feito' else coalesce(nullif(btrim(t.situacao_compras), ''), 'pendente') end,
      nullif(btrim(t.observacao), '')
    from jsonb_to_recordset(p_itens) as t(fase text, id_pacote text, pacote_vinculado text, local text, responsavel text, descricao text,
      prazo_compras_dias int, prazo_chegada_dias int, inicio_manual date, sienge_solicitacao text, data_real_obra date, data_real_compras date, situacao_obra text, situacao_compras text, observacao text)
    where nullif(btrim(t.descricao), '') is not null;
  exception when check_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format or numeric_value_out_of_range then
    raise exception 'Confira a planilha: há data, prazo ou texto fora do formato.' using errcode = 'P0001';
  end;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

-- Reimportação do cronograma (aba PREVISION): [{id_pacote, inicio}]. Administração da obra (ou o gerente de suprimentos).
create function public.importar_cronograma(p_obra uuid, p_pacotes jsonb) returns int
language plpgsql security definer set search_path = '' as $$
declare
  v_qtd int;
begin
  if not (app.admin_verificado() or app.tem_papel('gerente_suprimentos')) then raise exception 'Só o administrador ou o gerente de suprimentos importa o cronograma.' using errcode = '42501'; end if;
  if not exists (select 1 from public.obras where id = p_obra) then raise exception 'Obra inválida.' using errcode = 'P0001'; end if;
  if jsonb_typeof(p_pacotes) <> 'array' or jsonb_array_length(p_pacotes) = 0 then raise exception 'Nenhum pacote encontrado no cronograma.' using errcode = 'P0001'; end if;
  if jsonb_array_length(p_pacotes) > 10000 then raise exception 'Cronograma grande demais (até 10.000 linhas).' using errcode = 'P0001'; end if;
  begin
    delete from public.cronograma_pacotes where obra_id = p_obra;
    insert into public.cronograma_pacotes (obra_id, id_pacote, inicio)
    select p_obra, btrim(t.id_pacote), min(t.inicio) from jsonb_to_recordset(p_pacotes) as t(id_pacote text, inicio date)
    where nullif(btrim(t.id_pacote), '') is not null and t.inicio is not null group by btrim(t.id_pacote);
  exception when check_violation or invalid_text_representation or datetime_field_overflow or invalid_datetime_format then
    raise exception 'Confira o cronograma: há data ou ID fora do formato.' using errcode = 'P0001';
  end;
  get diagnostics v_qtd = row_count;
  return v_qtd;
end $$;

-- Edição na linha. Item sem ID de pacote: a data de início é digitada à mão; com ID, ela vem do cronograma.
create function public.editar_planejamento_item(
  p_id uuid, p_responsavel text, p_prazo_compras int, p_prazo_chegada int, p_inicio_manual date, p_observacao text
) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_i public.planejamento_itens;
begin
  if not app.pode_planejar() then raise exception 'Só Suprimentos edita a planilha.' using errcode = '42501'; end if;
  select * into v_i from public.planejamento_itens where id = p_id;
  if not found then raise exception 'Item não encontrado.' using errcode = 'P0001'; end if;
  if v_i.id_pacote is not null and p_inicio_manual is not null then
    raise exception 'Este item usa a data do cronograma (ID do pacote). Reimporte o cronograma para mudar.' using errcode = 'P0001';
  end if;
  update public.planejamento_itens set
    responsavel = nullif(btrim(coalesce(p_responsavel, '')), ''),
    prazo_compras_dias = p_prazo_compras, prazo_chegada_dias = p_prazo_chegada,
    inicio_manual = p_inicio_manual, observacao = nullif(btrim(coalesce(p_observacao, '')), '')
  where id = p_id;
exception when check_violation then
  raise exception 'Prazo ou texto fora do limite.' using errcode = 'P0001';
end $$;

-- Indicadores do mês (obra pediu no prazo; Suprimentos fechou no prazo), uma linha por obra.
-- "Feito sem data" conta como feito (no prazo); "não se aplica" fica fora da conta.
create function public.indicadores_planejamento(p_ano int, p_mes int) returns table (
  obra_id uuid, obra text, previstos_obra int, obra_no_prazo int, obra_atrasada int, previstos_compras int, compras_no_prazo int, compras_atrasada int
)
language sql stable set search_path = '' as $$
  with hoje as (select (now() at time zone 'America/Sao_Paulo')::date as d),
  base as (
    select p.*,
      (p.situacao_obra <> 'nao_se_aplica' and extract(year from p.data_solicitar) = p_ano and extract(month from p.data_solicitar) = p_mes) as conta_obra,
      (p.situacao_compras <> 'nao_se_aplica' and extract(year from p.data_deveria_fechar) = p_ano and extract(month from p.data_deveria_fechar) = p_mes) as conta_compras
    from public.planejamento_calculado p
  )
  select o.id, o.nome,
    count(*) filter (where b.conta_obra)::int,
    count(*) filter (where b.conta_obra and (b.situacao_obra = 'feito_sem_data' or b.data_real_obra <= b.data_solicitar))::int,
    count(*) filter (where b.conta_obra and b.situacao_obra <> 'feito_sem_data'
      and (b.data_real_obra > b.data_solicitar or (b.data_real_obra is null and b.data_solicitar < (select d from hoje))))::int,
    count(*) filter (where b.conta_compras)::int,
    count(*) filter (where b.conta_compras and (b.situacao_compras = 'feito_sem_data' or b.data_real_compras <= b.data_deveria_fechar))::int,
    count(*) filter (where b.conta_compras and b.situacao_compras <> 'feito_sem_data'
      and (b.data_real_compras > b.data_deveria_fechar or (b.data_real_compras is null and b.data_deveria_fechar < (select d from hoje))))::int
  from base b join public.obras o on o.id = b.obra_id
  group by o.id, o.nome
  having count(*) filter (where b.conta_obra) > 0 or count(*) filter (where b.conta_compras) > 0
  order by o.nome
$$;

-- Contratação ligada ao item e ao calendário ----------------------------------------------------------
alter table public.contratacoes
  add column planejamento_item_id uuid references public.planejamento_itens (id) on delete set null,
  add column negociacao_a_partir_de date,
  add column fora_do_prazo boolean not null default false;
comment on column public.contratacoes.negociacao_a_partir_de is 'Item da planilha: a data da abertura. Fora da planilha: início do ciclo do calendário em que o pedido entrou.';
comment on column public.contratacoes.fora_do_prazo is 'Item da planilha: a obra solicitou depois da data que deveria solicitar.';

-- A autorização do gerente grava a data real de compras; o nº da solicitação no Sienge vai para a planilha.
create function app.sincronizar_planejamento_etapa() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if new.situacao = 'concluida' and exists (
    select 1 from public.contratacoes c join public.etapas_fluxo f on f.versao = c.fluxo_versao and f.etapa = new.etapa
    where c.id = new.contratacao_id and f.chave = 'autorizacao'
  ) then
    update public.planejamento_itens set data_real_compras = (now() at time zone 'America/Sao_Paulo')::date, situacao_compras = 'feito'
    where contratacao_id = new.contratacao_id;
  end if;
  return null;
end $$;
create trigger sincronizar_planejamento after update of situacao on public.contratacao_etapas
  for each row when (old.situacao is distinct from new.situacao) execute function app.sincronizar_planejamento_etapa();

create function app.sincronizar_planejamento_sienge() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  update public.planejamento_itens set sienge_solicitacao = new.sienge_solicitacao where contratacao_id = new.id;
  return null;
end $$;
create trigger sincronizar_planejamento_sienge after update of sienge_solicitacao on public.contratacoes
  for each row when (old.sienge_solicitacao is distinct from new.sienge_solicitacao) execute function app.sincronizar_planejamento_sienge();

-- Abertura: item da planilha opcional. Com item, segue as datas da planilha; sem item, o calendário diz quando começa a negociação.
drop function public.abrir_contratacao(uuid, text, uuid, numeric, boolean, text, text);
create function public.abrir_contratacao(
  p_obra uuid, p_servico text, p_matriz uuid, p_valor numeric, p_aditivo boolean, p_negociacao text,
  p_contrato_original text default null, p_planejamento_item uuid default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
  v_limite numeric := coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000);
  v_m public.matriz_contratacao;
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
    p_obra, btrim(p_servico), left(coalesce(v_m.subgrupo_codigo, v_m.grupo_codigo) || ' ' || v_m.atividade, 120),
    v_m.id, v_m.forma_legal, p_valor,
    case when coalesce(p_aditivo, false) then 'aditivo' else 'contrato' end::public.tipo_contratacao,
    p_negociacao, v_original,
    -- A autorização é a etapa 5 no fluxo 2: ela herda o prazo que o gerente tinha na etapa 6.
    jsonb_set(v_prazos, '{5}', coalesce(v_prazos -> '5', v_prazos -> '6', 'null'::jsonb)),
    v_limite, v_versao, p_planejamento_item, v_inicio, v_fora
  ) returning id into v_id;
  if p_planejamento_item is not null then
    update public.planejamento_itens set contratacao_id = v_id, data_real_obra = v_hoje, situacao_obra = 'feito' where id = p_planejamento_item;
  end if;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = v_versao;
  update public.contratacao_etapas set situacao = 'concluida', iniciada_em = now(), concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = v_id and etapa = app.etapa_da_chave(v_id, 'solicitacao');
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

revoke all on function app.pode_planejar() from public, anon, authenticated;
revoke all on function app.sincronizar_planejamento_etapa() from public, anon, authenticated;
revoke all on function app.sincronizar_planejamento_sienge() from public, anon, authenticated;
do $$
declare f text;
begin
  foreach f in array array[
    'public.ciclo_do_pedido(date)',
    'public.indicadores_planejamento(int, int)',
    'public.salvar_calendario(int, jsonb)',
    'public.importar_planejamento(uuid, text, jsonb)',
    'public.importar_cronograma(uuid, jsonb)',
    'public.editar_planejamento_item(uuid, text, int, int, date, text)',
    'public.abrir_contratacao(uuid, text, uuid, numeric, boolean, text, text, uuid)'
  ] loop
    execute format('revoke all on function %s from public, anon', f);
    execute format('grant execute on function %s to authenticated', f);
  end loop;
end $$;
