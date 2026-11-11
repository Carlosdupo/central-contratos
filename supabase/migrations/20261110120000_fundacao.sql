-- F0 Fundação: usuários, papéis, obras, parâmetros, feriados e auditoria.
-- Regras: RLS em toda tabela; escrita administrativa exige papel admin com MFA (aal2);
-- auditoria só recebe inserção, por trigger.

create extension if not exists pgcrypto with schema extensions;
create extension if not exists unaccent with schema extensions;
create extension if not exists pg_trgm with schema extensions;

create schema if not exists app;
revoke all on schema app from public;
grant usage on schema app to authenticated;

-- Tipos -----------------------------------------------------------------------
create type public.papel as enum (
  'admin', 'coordenador_obra', 'suprimentos', 'gerente_suprimentos', 'contratos', 'direcao', 'rh', 'sst'
);
create type public.tipo_usuario as enum ('interno', 'externo');
create type public.abrangencia_feriado as enum ('nacional', 'estadual', 'municipal');

-- Tabelas ---------------------------------------------------------------------
create table public.usuarios (
  id uuid primary key references auth.users (id) on delete cascade,
  nome text not null check (length(btrim(nome)) between 2 and 120),
  email text not null unique,
  tipo public.tipo_usuario not null default 'interno',
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table public.usuario_papeis (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  papel public.papel not null,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  primary key (usuario_id, papel)
);

create table public.obras (
  id uuid primary key default gen_random_uuid(),
  codigo text not null unique check (length(btrim(codigo)) between 1 and 20),
  nome text not null check (length(btrim(nome)) between 2 and 120),
  cidade text not null check (length(btrim(cidade)) between 2 and 80),
  uf char(2) not null check (uf ~ '^[A-Z]{2}$'),
  ativa boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid()
);

create table public.usuario_obras (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  obra_id uuid not null references public.obras (id) on delete cascade,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  primary key (usuario_id, obra_id)
);

create table public.parametros (
  chave text primary key check (chave ~ '^[a-z][a-z0-9_]*$'),
  valor jsonb not null,
  descricao text not null,
  updated_at timestamptz not null default now(),
  updated_by uuid references public.usuarios (id)
);

create table public.feriados (
  id uuid primary key default gen_random_uuid(),
  data date not null,
  descricao text not null check (length(btrim(descricao)) between 2 and 120),
  abrangencia public.abrangencia_feriado not null,
  uf char(2) check (uf is null or uf ~ '^[A-Z]{2}$'),
  cidade text,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  check (abrangencia = 'nacional' or uf is not null),
  check (abrangencia <> 'municipal' or cidade is not null),
  unique nulls not distinct (data, abrangencia, uf, cidade)
);

create table public.auditoria (
  id bigint generated always as identity primary key,
  em timestamptz not null default now(),
  ator uuid default auth.uid(),
  acao text not null check (acao in ('INSERT', 'UPDATE', 'DELETE')),
  tabela text not null,
  registro_id text,
  antes jsonb,
  depois jsonb
);
create index auditoria_tabela_registro_idx on public.auditoria (tabela, registro_id);
create index auditoria_em_idx on public.auditoria (em desc);

-- Funções de apoio (usadas pela RLS) ----------------------------------------
create function app.aal2() returns boolean
language sql stable set search_path = '' as $$
  select coalesce(auth.jwt() ->> 'aal', 'aal1') = 'aal2'
$$;

create function app.usuario_interno_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.ativo and u.tipo = 'interno'
  )
$$;

create function app.tem_papel(p public.papel) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuario_papeis up
    join public.usuarios u on u.id = up.usuario_id
    where up.usuario_id = auth.uid() and up.papel = p and u.ativo and u.tipo = 'interno'
  )
$$;

-- Admin só age com a verificação em duas etapas concluída.
create function app.admin_verificado() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel('admin') and app.aal2()
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;

-- Triggers --------------------------------------------------------------------
create function app.tocar_updated_at() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  return new;
end $$;

create trigger usuarios_updated_at before update on public.usuarios for each row execute function app.tocar_updated_at();
create trigger obras_updated_at before update on public.obras for each row execute function app.tocar_updated_at();

create function app.tocar_parametro() returns trigger
language plpgsql set search_path = '' as $$
begin
  new.updated_at := now();
  new.updated_by := auth.uid();
  return new;
end $$;
create trigger parametros_tocar before update on public.parametros for each row execute function app.tocar_parametro();

-- Auditoria genérica: grava antes/depois de cada alteração.
create function app.auditar() returns trigger
language plpgsql security definer set search_path = '' as $$
declare
  v_antes jsonb := case when tg_op in ('UPDATE', 'DELETE') then to_jsonb(old) end;
  v_depois jsonb := case when tg_op in ('INSERT', 'UPDATE') then to_jsonb(new) end;
begin
  insert into public.auditoria (acao, tabela, registro_id, antes, depois)
  values (tg_op, tg_table_name, coalesce(v_depois ->> 'id', v_antes ->> 'id', v_depois ->> 'chave', v_antes ->> 'chave', v_depois ->> 'usuario_id', v_antes ->> 'usuario_id'), v_antes, v_depois);
  return coalesce(new, old);
end $$;

create trigger auditar_usuarios after insert or update or delete on public.usuarios for each row execute function app.auditar();
create trigger auditar_usuario_papeis after insert or update or delete on public.usuario_papeis for each row execute function app.auditar();
create trigger auditar_obras after insert or update or delete on public.obras for each row execute function app.auditar();
create trigger auditar_usuario_obras after insert or update or delete on public.usuario_obras for each row execute function app.auditar();
create trigger auditar_parametros after insert or update or delete on public.parametros for each row execute function app.auditar();
create trigger auditar_feriados after insert or update or delete on public.feriados for each row execute function app.auditar();

-- Cada usuário criado no Auth (sempre por convite; cadastro aberto desligado) ganha a linha em usuarios.
-- O tipo vem de app_metadata, que só o servidor consegue definir.
create function app.criar_usuario_do_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios (id, email, nome, tipo)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    coalesce((new.raw_app_meta_data ->> 'tipo')::public.tipo_usuario, 'interno')
  );
  return new;
end $$;
create trigger ao_criar_usuario_auth after insert on auth.users for each row execute function app.criar_usuario_do_auth();

-- Nunca deixar o sistema sem administrador ativo.
create function app.existe_outro_admin(p_usuario uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.usuario_papeis up join public.usuarios u on u.id = up.usuario_id
    where up.papel = 'admin' and u.ativo and u.tipo = 'interno' and up.usuario_id <> p_usuario
  )
$$;

create function app.proteger_ultimo_admin_papel() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.papel = 'admin' and not app.existe_outro_admin(old.usuario_id) then
    raise exception 'Não é possível remover o último administrador ativo.' using errcode = 'P0001';
  end if;
  return old;
end $$;
create trigger proteger_ultimo_admin before delete on public.usuario_papeis for each row execute function app.proteger_ultimo_admin_papel();

create function app.proteger_ultimo_admin_usuario() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if old.ativo and not new.ativo
     and exists (select 1 from public.usuario_papeis where usuario_id = old.id and papel = 'admin')
     and not app.existe_outro_admin(old.id) then
    raise exception 'Não é possível desativar o último administrador ativo.' using errcode = 'P0001';
  end if;
  if new.tipo <> old.tipo then
    raise exception 'O tipo do usuário não pode ser alterado.' using errcode = 'P0001';
  end if;
  return new;
end $$;
create trigger proteger_ultimo_admin before update on public.usuarios for each row execute function app.proteger_ultimo_admin_usuario();

-- RLS -------------------------------------------------------------------------
alter table public.usuarios enable row level security;
alter table public.usuario_papeis enable row level security;
alter table public.obras enable row level security;
alter table public.usuario_obras enable row level security;
alter table public.parametros enable row level security;
alter table public.feriados enable row level security;
alter table public.auditoria enable row level security;

-- Nada é acessível sem login.
revoke all on all tables in schema public from anon;
alter default privileges in schema public revoke all on tables from anon;

-- usuarios: cada um vê a si mesmo; internos ativos veem os demais (para atribuir responsáveis).
create policy usuarios_ler on public.usuarios for select to authenticated
  using (id = auth.uid() or app.usuario_interno_ativo());
create policy usuarios_admin_alterar on public.usuarios for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());

-- usuario_papeis
create policy papeis_ler on public.usuario_papeis for select to authenticated
  using (usuario_id = auth.uid() or app.admin_verificado());
create policy papeis_admin_incluir on public.usuario_papeis for insert to authenticated
  with check (app.admin_verificado());
create policy papeis_admin_excluir on public.usuario_papeis for delete to authenticated
  using (app.admin_verificado());

-- obras: internos ativos leem; só admin cria e altera (desativar em vez de excluir).
create policy obras_ler on public.obras for select to authenticated
  using (app.usuario_interno_ativo());
create policy obras_admin_incluir on public.obras for insert to authenticated
  with check (app.admin_verificado());
create policy obras_admin_alterar on public.obras for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());

-- usuario_obras (escopo do coordenador)
create policy usuario_obras_ler on public.usuario_obras for select to authenticated
  using (usuario_id = auth.uid() or app.admin_verificado());
create policy usuario_obras_admin_incluir on public.usuario_obras for insert to authenticated
  with check (app.admin_verificado());
create policy usuario_obras_admin_excluir on public.usuario_obras for delete to authenticated
  using (app.admin_verificado());

-- parametros: qualquer usuário logado lê (a empresa terceirizada precisa ver o prazo do RH); só admin altera.
create policy parametros_ler on public.parametros for select to authenticated using (true);
create policy parametros_admin_alterar on public.parametros for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());

-- feriados
create policy feriados_ler on public.feriados for select to authenticated using (true);
create policy feriados_admin_incluir on public.feriados for insert to authenticated
  with check (app.admin_verificado());
create policy feriados_admin_alterar on public.feriados for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());
create policy feriados_admin_excluir on public.feriados for delete to authenticated
  using (app.admin_verificado());

-- auditoria: só admin lê; ninguém altera ou apaga (inserção só pelo trigger).
create policy auditoria_admin_ler on public.auditoria for select to authenticated
  using (app.admin_verificado());
revoke insert, update, delete, truncate on public.auditoria from authenticated;

-- Parâmetros de negócio aprovados (editáveis pelo admin; cada alteração fica na auditoria).
insert into public.parametros (chave, valor, descricao) values
  ('fuso_horario', '"America/Sao_Paulo"', 'Fuso usado em prazos, dias úteis e horário de corte.'),
  ('limite_escolha_obra_reais', '4000', 'Abaixo deste valor orçado, a obra pode escolher fornecedor e valor (etapa 3). P2 pendente: orçado x cotação.'),
  ('prazo_analise_rh', '{"dias": 2, "uteis": true}', 'Prazo do RH para conferir cada envio de documentos.'),
  ('horario_corte_integracao', '18', 'Aprovado até esta hora entra na integração do próximo dia útil; depois, no seguinte.'),
  ('antecedencia_visita_dias', '1', 'Antecedência mínima do pedido de visita de sócio esporádico.'),
  ('validade_documentos_meses', '{"aso": 12, "nr": 24, "rg_cnh": 120}', 'Validade a partir da data de emissão.'),
  ('prazos_etapas', '{"7": {"dias": 7, "uteis": false}, "9": {"dias": 3, "uteis": false}, "10": {"dias": 2, "uteis": true}, "11": {"dias": 2, "uteis": true}}',
   'Prazos das etapas da contratação. Etapas 1-6, 8 e 12 sem prazo (P1). Corridos ou úteis nas etapas 7 e 9 a confirmar (P3).');

-- Feriados nacionais 2026-2027. Estaduais e municipais dependem da P27.
insert into public.feriados (data, descricao, abrangencia) values
  ('2026-01-01', 'Confraternização Universal', 'nacional'),
  ('2026-04-03', 'Paixão de Cristo', 'nacional'),
  ('2026-04-21', 'Tiradentes', 'nacional'),
  ('2026-05-01', 'Dia do Trabalho', 'nacional'),
  ('2026-09-07', 'Independência do Brasil', 'nacional'),
  ('2026-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2026-11-02', 'Finados', 'nacional'),
  ('2026-11-15', 'Proclamação da República', 'nacional'),
  ('2026-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2026-12-25', 'Natal', 'nacional'),
  ('2027-01-01', 'Confraternização Universal', 'nacional'),
  ('2027-03-26', 'Paixão de Cristo', 'nacional'),
  ('2027-04-21', 'Tiradentes', 'nacional'),
  ('2027-05-01', 'Dia do Trabalho', 'nacional'),
  ('2027-09-07', 'Independência do Brasil', 'nacional'),
  ('2027-10-12', 'Nossa Senhora Aparecida', 'nacional'),
  ('2027-11-02', 'Finados', 'nacional'),
  ('2027-11-15', 'Proclamação da República', 'nacional'),
  ('2027-11-20', 'Dia Nacional de Zumbi e da Consciência Negra', 'nacional'),
  ('2027-12-25', 'Natal', 'nacional');
