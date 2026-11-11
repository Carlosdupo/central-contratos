-- F6: fluxo de contratação de empreiteiros (aba "CONTRATAÇÃO REV FINAL", versão 1).
-- O desenho do fluxo fica em etapas_fluxo (versão 1); toda mudança de etapa passa por funções que conferem papel e regra.

create type public.situacao_contratacao as enum ('em_andamento', 'liberada', 'cancelada');
create type public.tipo_contratacao as enum ('unico', 'contrato', 'aditivo');
create type public.situacao_etapa as enum ('pendente', 'em_andamento', 'concluida', 'pulada');

create table public.etapas_fluxo (
  versao int not null default 1,
  etapa smallint not null check (etapa between 1 and 12),
  nome text not null,
  trilha text not null check (trilha in ('negociacao', 'contrato', 'documentacao', 'liberacao')),
  papel public.papel,              -- null na etapa 9 (assinaturas: cada assinante na sua vez)
  responsavel text not null,
  dependencias smallint[] not null default '{}',
  itens text[] not null default '{}',
  pode_pular boolean not null default false,
  primary key (versao, etapa)
);

insert into public.etapas_fluxo (etapa, nome, trilha, papel, responsavel, dependencias, itens, pode_pular) values
  (1, 'Escopo do serviço', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{}',
   array['Escopo atende a um pacote do planejamento', 'Valor orçado informado (orçamento da obra)', 'Tipo de contrato definido'], false),
  (2, 'Cotação com 3 fornecedores', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{1}',
   array['Escopo enviado aos 3 fornecedores', 'Cotações recebidas e assinadas'], false),
  (3, 'Equalização e 1ª negociação', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{2}',
   array['Primeira negociação feita', 'Planilha de equalização atualizada', 'Planilha de importação atualizada'], true),
  (4, 'Solicitação de serviço no Sienge', 'negociacao', 'coordenador_obra', 'Coordenador de obra', '{3}',
   array['Solicitação lançada no Sienge', 'Equalização e importação anexadas'], false),
  (5, 'Validação e negociação', 'negociacao', 'suprimentos', 'Suprimentos', '{4}',
   array['Escopo e necessidades entendidos', 'Fornecedor validado', 'Proposta atualizada recebida', 'Cartão CNPJ recebido', 'Contrato social recebido', 'Solicitação atualizada com os valores negociados', 'Documentos do terceiro anexados'], false),
  (6, 'Autorização do gerente de suprimentos', 'negociacao', 'gerente_suprimentos', 'Gerente de suprimentos', '{5}', '{}', false),
  (7, 'Contrato no Sienge e minuta', 'contrato', 'contratos', 'Contratos', '{6}',
   array['Contrato lançado no Sienge (medição)', 'Minuta emitida e enviada'], false),
  (8, 'Aprovação de alçada', 'contrato', 'coordenador_obra', 'Coordenador de obra', '{7}', array['Alçada aprovada no Sienge'], false),
  (9, 'Assinaturas do contrato', 'contrato', null, '5 assinantes, em ordem', '{8}', '{}', false),
  (10, 'Documentação dos funcionários', 'documentacao', 'rh', 'RH', '{6}', array['Documentação conferida', 'Integração agendada'], false),
  (11, 'Integração de segurança', 'documentacao', 'sst', 'Segurança do trabalho', '{10}', array['Integração realizada', 'Lista de presença anexada'], false),
  (12, 'Liberação para a obra', 'liberacao', 'rh', 'RH', '{9,11}', array['Nomes liberados para a obra'], false);

create table public.assinantes_fluxo (
  ordem smallint primary key check (ordem between 1 and 5),
  rotulo text not null,
  papel public.papel not null
);
insert into public.assinantes_fluxo values
  (1, 'Coordenador de obra', 'coordenador_obra'), (2, 'Suprimentos', 'suprimentos'),
  (3, 'Fornecedor (registrado por Contratos)', 'contratos'), (4, 'Direção', 'direcao'), (5, 'RH', 'rh');

create sequence public.contratacoes_numero;

create table public.contratacoes (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique,
  obra_id uuid not null references public.obras (id),
  servico text not null check (length(btrim(servico)) between 3 and 200),
  pacote text check (pacote is null or length(pacote) <= 120),
  valor_orcado numeric(14, 2) not null check (valor_orcado > 0),
  tipo public.tipo_contratacao not null,
  situacao public.situacao_contratacao not null default 'em_andamento',
  empresa_id uuid references public.empresas_terceiras (id),
  fornecedor_nome text,
  fornecedor_cnpj char(14) check (fornecedor_cnpj is null or fornecedor_cnpj ~ '^\d{14}$'),
  valor_negociado numeric(14, 2) check (valor_negociado is null or valor_negociado > 0),
  sienge_solicitacao text check (sienge_solicitacao is null or length(sienge_solicitacao) <= 40),
  sienge_contrato text check (sienge_contrato is null or length(sienge_contrato) <= 40),
  negociacao_pulada boolean not null default false,
  fluxo_versao int not null default 1,
  prazos jsonb not null default '{}',     -- prazos vigentes na abertura (A7)
  limite_obra numeric(14, 2) not null,     -- limite de R$ vigente na abertura (P2)
  cancelamento_motivo text,
  criado_por uuid not null references public.usuarios (id) default auth.uid(),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);
create index contratacoes_obra_idx on public.contratacoes (obra_id);

create table public.contratacao_etapas (
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  etapa smallint not null check (etapa between 1 and 12),
  situacao public.situacao_etapa not null default 'pendente',
  iniciada_em timestamptz,
  concluida_em timestamptz,
  concluida_por uuid references public.usuarios (id),
  primary key (contratacao_id, etapa)
);

create table public.etapa_checklist (
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  etapa smallint not null,
  item smallint not null,
  marcado boolean not null default false,
  marcado_por uuid references public.usuarios (id),
  marcado_em timestamptz,
  primary key (contratacao_id, etapa, item)
);

create table public.cotacoes (
  id uuid primary key default gen_random_uuid(),
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  fornecedor text not null check (length(btrim(fornecedor)) between 2 and 160),
  cnpj char(14) not null check (cnpj ~ '^\d{14}$'),
  valor numeric(14, 2) not null check (valor > 0),
  prazo_dias int check (prazo_dias is null or prazo_dias between 1 and 3650),
  escolhida boolean not null default false,
  escolhida_por uuid references public.usuarios (id),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  unique (contratacao_id, cnpj)
);

create table public.assinaturas (
  contratacao_id uuid not null references public.contratacoes (id) on delete cascade,
  ordem smallint not null references public.assinantes_fluxo (ordem),
  assinado_por uuid not null references public.usuarios (id),
  assinado_em timestamptz not null default now(),
  primary key (contratacao_id, ordem)
);

create trigger contratacoes_updated_at before update on public.contratacoes for each row execute function app.tocar_updated_at();
create trigger auditar_contratacoes after insert or update or delete on public.contratacoes for each row execute function app.auditar();
create trigger auditar_contratacao_etapas after insert or update or delete on public.contratacao_etapas for each row execute function app.auditar();
create trigger auditar_cotacoes after insert or update or delete on public.cotacoes for each row execute function app.auditar();
create trigger auditar_assinaturas after insert or update or delete on public.assinaturas for each row execute function app.auditar();

-- Quem vê: todos os internos, menos o coordenador, que vê só as obras dele (A8).
create function app.pode_ver_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select app.usuario_interno_ativo() and (
    app.admin_verificado()
    or app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos') or app.tem_papel('contratos')
    or app.tem_papel('direcao') or app.tem_papel('rh') or app.tem_papel('sst')
    or (app.tem_papel('coordenador_obra') and exists (select 1 from public.usuario_obras where usuario_id = auth.uid() and obra_id = p_obra))
  )
$$;

-- Quem age numa etapa: o papel da etapa (coordenador só nas obras dele; RH e SST com verificação em duas etapas).
create function app.pode_agir_como(p_papel public.papel, p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_papel = 'coordenador_obra' then app.tem_papel('coordenador_obra') and exists (select 1 from public.usuario_obras where usuario_id = auth.uid() and obra_id = p_obra)
    when p_papel in ('rh', 'sst') then app.tem_papel(p_papel) and app.aal2()
    when p_papel = 'suprimentos' then app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos')
    else app.tem_papel(p_papel)
  end
$$;

alter table public.etapas_fluxo enable row level security;
alter table public.assinantes_fluxo enable row level security;
alter table public.contratacoes enable row level security;
alter table public.contratacao_etapas enable row level security;
alter table public.etapa_checklist enable row level security;
alter table public.cotacoes enable row level security;
alter table public.assinaturas enable row level security;
revoke all on public.etapas_fluxo, public.assinantes_fluxo, public.contratacoes, public.contratacao_etapas, public.etapa_checklist, public.cotacoes, public.assinaturas from anon;
revoke insert, update, delete, truncate on public.etapas_fluxo, public.assinantes_fluxo, public.contratacoes, public.contratacao_etapas, public.etapa_checklist, public.cotacoes, public.assinaturas from authenticated;
revoke usage, select on sequence public.contratacoes_numero from authenticated, anon;

create policy etapas_fluxo_ler on public.etapas_fluxo for select to authenticated using (app.usuario_interno_ativo());
create policy assinantes_ler on public.assinantes_fluxo for select to authenticated using (app.usuario_interno_ativo());
create policy contratacoes_ler on public.contratacoes for select to authenticated using (app.pode_ver_obra(obra_id));
create policy contratacao_etapas_ler on public.contratacao_etapas for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));
create policy checklist_ler on public.etapa_checklist for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));
create policy cotacoes_ler on public.cotacoes for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));
create policy assinaturas_ler on public.assinaturas for select to authenticated
  using (exists (select 1 from public.contratacoes c where c.id = contratacao_id and app.pode_ver_obra(c.obra_id)));

-- Funções de transição ------------------------------------------------------------------------

-- Inicia as etapas cujas dependências terminaram; fecha a contratação quando a etapa 12 termina.
create function app.liberar_etapas(p_contratacao uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  update public.contratacao_etapas ce set situacao = 'em_andamento', iniciada_em = now()
  from public.etapas_fluxo f
  where ce.contratacao_id = p_contratacao and ce.situacao = 'pendente' and f.versao = 1 and f.etapa = ce.etapa
    and not exists (
      select 1 from unnest(f.dependencias) dep
      join public.contratacao_etapas d on d.contratacao_id = p_contratacao and d.etapa = dep
      where d.situacao not in ('concluida', 'pulada')
    );
  update public.contratacoes set situacao = 'liberada'
  where id = p_contratacao and situacao = 'em_andamento'
    and exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = 12 and situacao = 'concluida');
end $$;

-- Abertura pela obra (A6: só coordenador da obra).
create function public.abrir_contratacao(p_obra uuid, p_servico text, p_pacote text, p_valor numeric, p_tipo public.tipo_contratacao) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
  v_ano text := to_char(now() at time zone 'America/Sao_Paulo', 'YYYY');
begin
  if not app.pode_agir_como('coordenador_obra', p_obra) then
    raise exception 'Só o coordenador da obra abre contratação.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra inválida.' using errcode = 'P0001';
  end if;
  insert into public.contratacoes (codigo, obra_id, servico, pacote, valor_orcado, tipo, prazos, limite_obra)
  values (
    'CT-' || v_ano || '-' || lpad(nextval('public.contratacoes_numero')::text, 3, '0'),
    p_obra, btrim(p_servico), nullif(btrim(p_pacote), ''), p_valor, p_tipo,
    coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}'),
    coalesce((select (valor #>> '{}')::numeric from public.parametros where chave = 'limite_escolha_obra_reais'), 4000)
  ) returning id into v_id;
  insert into public.contratacao_etapas (contratacao_id, etapa) select v_id, etapa from public.etapas_fluxo where versao = 1;
  insert into public.etapa_checklist (contratacao_id, etapa, item)
  select v_id, f.etapa, i from public.etapas_fluxo f, generate_series(1, coalesce(array_length(f.itens, 1), 0)) i where f.versao = 1;
  -- Na abertura, valor e tipo já estão informados (itens 2 e 3 da etapa 1).
  update public.etapa_checklist set marcado = true, marcado_por = auth.uid(), marcado_em = now()
  where contratacao_id = v_id and etapa = 1 and item in (2, 3);
  perform app.liberar_etapas(v_id);
  return v_id;
end $$;

-- Confere se quem chama pode agir na etapa, em andamento.
create function app.exigir_etapa_em_andamento(p_contratacao uuid, p_etapa smallint) returns public.contratacoes
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_papel public.papel;
begin
  select * into v_c from public.contratacoes where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou encerrada.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = p_etapa and situacao = 'em_andamento') then
    raise exception 'Esta etapa não está em andamento.' using errcode = 'P0001';
  end if;
  select papel into v_papel from public.etapas_fluxo where versao = v_c.fluxo_versao and etapa = p_etapa;
  if v_papel is null or not app.pode_agir_como(v_papel, v_c.obra_id) then
    raise exception 'Esta etapa é de outra área.' using errcode = '42501';
  end if;
  return v_c;
end $$;

create function public.marcar_item(p_contratacao uuid, p_etapa smallint, p_item smallint, p_marcado boolean) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
  update public.etapa_checklist set marcado = p_marcado, marcado_por = auth.uid(), marcado_em = now()
  where contratacao_id = p_contratacao and etapa = p_etapa and item = p_item;
end $$;

-- Campos das etapas 4 (nº da solicitação), 5 (valor negociado) e 7 (código do contrato).
create function public.salvar_campo_etapa(p_contratacao uuid, p_etapa smallint, p_valor text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, p_etapa);
  if p_etapa = 4 then
    update public.contratacoes set sienge_solicitacao = nullif(btrim(p_valor), '') where id = p_contratacao;
  elsif p_etapa = 7 then
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

create function public.registrar_cotacao(p_contratacao uuid, p_fornecedor text, p_cnpj text, p_valor numeric, p_prazo int) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_id uuid;
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, 2::smallint);
  if (select count(*) from public.cotacoes where contratacao_id = p_contratacao) >= 3 then
    raise exception 'Já há 3 cotações.' using errcode = 'P0001';
  end if;
  insert into public.cotacoes (contratacao_id, fornecedor, cnpj, valor, prazo_dias)
  values (p_contratacao, btrim(p_fornecedor), p_cnpj, p_valor, p_prazo) returning id into v_id;
  return v_id;
end $$;

-- Escolha do fornecedor: abaixo do limite, a obra escolhe na etapa 3; a partir dele, Suprimentos na etapa 5.
create function public.escolher_fornecedor(p_cotacao uuid) returns void
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

create function public.pular_negociacao(p_contratacao uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  perform app.exigir_etapa_em_andamento(p_contratacao, 3::smallint);
  update public.contratacao_etapas set situacao = 'pulada', concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = p_contratacao and etapa = 3;
  update public.contratacoes set negociacao_pulada = true where id = p_contratacao;
  perform app.liberar_etapas(p_contratacao);
end $$;

create function public.concluir_etapa(p_contratacao uuid, p_etapa smallint) returns void
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
  if p_etapa = 7 and v_c.sienge_contrato is null then
    raise exception 'Informe o código do contrato no Sienge.' using errcode = 'P0001';
  end if;
  update public.contratacao_etapas set situacao = 'concluida', concluida_em = now(), concluida_por = auth.uid()
  where contratacao_id = p_contratacao and etapa = p_etapa;
  perform app.liberar_etapas(p_contratacao);
end $$;

-- Assinatura na ordem; a última conclui a etapa 9.
create function public.assinar_contrato(p_contratacao uuid, p_ordem smallint) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_c public.contratacoes;
  v_proxima smallint;
  v_papel public.papel;
begin
  select * into v_c from public.contratacoes where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou encerrada.' using errcode = 'P0001'; end if;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = p_contratacao and etapa = 9 and situacao = 'em_andamento') then
    raise exception 'O contrato ainda não está na fase de assinaturas.' using errcode = 'P0001';
  end if;
  select min(a.ordem) into v_proxima from public.assinantes_fluxo a
  where not exists (select 1 from public.assinaturas s where s.contratacao_id = p_contratacao and s.ordem = a.ordem);
  if v_proxima is distinct from p_ordem then
    raise exception 'Não é a vez deste assinante.' using errcode = 'P0001';
  end if;
  select papel into v_papel from public.assinantes_fluxo where ordem = p_ordem;
  if not app.pode_agir_como(v_papel, v_c.obra_id) then
    raise exception 'Esta assinatura é de outra área.' using errcode = '42501';
  end if;
  insert into public.assinaturas (contratacao_id, ordem, assinado_por) values (p_contratacao, p_ordem, auth.uid());
  if p_ordem = 5 then
    update public.contratacao_etapas set situacao = 'concluida', concluida_em = now(), concluida_por = auth.uid()
    where contratacao_id = p_contratacao and etapa = 9;
    perform app.liberar_etapas(p_contratacao);
  end if;
end $$;

-- Cancelamento (A9): só admin, com motivo (fica na auditoria).
create function public.cancelar_contratacao(p_contratacao uuid, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.admin_verificado() then raise exception 'Só o administrador cancela contratação.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo do cancelamento.' using errcode = 'P0001'; end if;
  update public.contratacoes set situacao = 'cancelada', cancelamento_motivo = btrim(p_motivo)
  where id = p_contratacao and situacao = 'em_andamento';
  if not found then raise exception 'Contratação não encontrada ou já encerrada.' using errcode = 'P0001'; end if;
end $$;

-- Reabertura de etapa concluída (A9): só admin, com motivo; volta a etapa para em andamento.
create function public.reabrir_etapa(p_contratacao uuid, p_etapa smallint, p_motivo text) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.admin_verificado() then raise exception 'Só o administrador reabre etapa.' using errcode = '42501'; end if;
  if length(btrim(coalesce(p_motivo, ''))) < 5 then raise exception 'Escreva o motivo da reabertura.' using errcode = 'P0001'; end if;
  update public.contratacao_etapas set situacao = 'em_andamento', concluida_em = null, concluida_por = null, iniciada_em = now()
  where contratacao_id = p_contratacao and etapa = p_etapa and situacao in ('concluida', 'pulada');
  if not found then raise exception 'Etapa não está concluída.' using errcode = 'P0001'; end if;
  -- Registro do motivo na auditoria (a mudança de etapa já é auditada pelo trigger).
  insert into public.auditoria (acao, tabela, registro_id, depois)
  values ('UPDATE', 'reabertura_etapa', p_contratacao::text, jsonb_build_object('etapa', p_etapa, 'motivo', btrim(p_motivo)));
end $$;

do $$
declare f text;
begin
  foreach f in array array[
    'abrir_contratacao(uuid, text, text, numeric, public.tipo_contratacao)', 'marcar_item(uuid, smallint, smallint, boolean)',
    'salvar_campo_etapa(uuid, smallint, text)', 'registrar_cotacao(uuid, text, text, numeric, int)', 'escolher_fornecedor(uuid)',
    'pular_negociacao(uuid)', 'concluir_etapa(uuid, smallint)', 'assinar_contrato(uuid, smallint)',
    'cancelar_contratacao(uuid, text)', 'reabrir_etapa(uuid, smallint, text)'
  ] loop
    execute format('revoke all on function public.%s from public, anon', f);
    execute format('grant execute on function public.%s to authenticated', f);
  end loop;
end $$;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
