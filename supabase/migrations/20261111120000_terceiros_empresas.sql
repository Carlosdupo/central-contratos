-- F1: empresas terceirizadas, portal, documentos da empresa e arquivos.
-- Escrita em documentos só por funções (RPC) que conferem quem chama; leitura por RLS.

-- Tipo do usuário: no convite de empresa, o servidor manda tipo=externo nos metadados.
-- Seguro porque o cadastro aberto está desligado: só o servidor cria usuários.
create or replace function app.criar_usuario_do_auth() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  insert into public.usuarios (id, email, nome, tipo)
  values (
    new.id,
    lower(new.email),
    coalesce(nullif(btrim(new.raw_user_meta_data ->> 'nome'), ''), split_part(new.email, '@', 1)),
    coalesce(
      (new.raw_app_meta_data ->> 'tipo')::public.tipo_usuario,
      (new.raw_user_meta_data ->> 'tipo')::public.tipo_usuario,
      'interno'
    )
  );
  return new;
end $$;

-- Tipos ---------------------------------------------------------------------------
create type public.situacao_empresa as enum ('convidada', 'cadastro_incompleto', 'em_analise', 'pendente', 'aprovada', 'bloqueada');
create type public.escopo_documento as enum ('empresa', 'pessoa');
create type public.regra_validade as enum ('meses_apos_emissao', 'data_informada', 'sem_validade', 'mensal');
create type public.aplica_a_documento as enum ('empresa', 'funcionario', 'socio_diario');
create type public.condicao_documento as enum ('sempre', 'eletricidade', 'mais_de_5_na_obra');
create type public.situacao_documento as enum ('anexado', 'enviado', 'aprovado', 'reprovado', 'vencido');

-- Empresas ----------------------------------------------------------------------------
create table public.empresas_terceiras (
  id uuid primary key default gen_random_uuid(),
  cnpj char(14) not null unique check (cnpj ~ '^\d{14}$'),
  razao_social text not null check (length(btrim(razao_social)) between 2 and 160),
  email text not null check (email ~ '^\S+@\S+\.\S+$'),
  telefone text,
  situacao public.situacao_empresa not null default 'convidada',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid()
);
create index empresas_razao_trgm on public.empresas_terceiras using gin (razao_social extensions.gin_trgm_ops);

create table public.empresa_obras (
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  obra_id uuid not null references public.obras (id),
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  primary key (empresa_id, obra_id)
);

create table public.empresa_usuarios (
  usuario_id uuid not null references public.usuarios (id) on delete cascade,
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  responsavel boolean not null default true,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  primary key (usuario_id, empresa_id)
);

-- Catálogo de documentos ------------------------------------------------------------
create table public.tipos_documento (
  codigo text primary key check (codigo ~ '^[a-z][a-z0-9_]*$'),
  nome text not null,
  escopo public.escopo_documento not null,
  regra_validade public.regra_validade not null,
  chave_validade text check (chave_validade in ('aso', 'nr', 'rg_cnh')), -- meses vêm de parametros.validade_documentos_meses
  sensivel boolean not null default false, -- dado de saúde (LGPD): só RH, SST e a própria empresa abrem
  aceita_texto boolean not null default false,
  observacao text,
  ordem int not null default 0,
  ativo boolean not null default true,
  check (regra_validade <> 'meses_apos_emissao' or chave_validade is not null)
);

create table public.matriz_documental (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null references public.tipos_documento (codigo),
  aplica_a public.aplica_a_documento not null,
  condicao public.condicao_documento not null default 'sempre',
  ativo boolean not null default true,
  unique (tipo_documento, aplica_a, condicao)
);

-- Documentos e arquivos -----------------------------------------------------------------
create table public.documentos (
  id uuid primary key default gen_random_uuid(),
  tipo_documento text not null references public.tipos_documento (codigo),
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  vinculo_id uuid, -- documentos de pessoa (FK criada na F2)
  competencia date check (competencia is null or extract(day from competencia) = 1),
  situacao public.situacao_documento not null default 'anexado',
  data_emissao date,
  data_validade date,
  valor_texto text check (valor_texto is null or length(valor_texto) <= 300),
  arquivo_atual_id uuid,
  motivo_reprovacao text,
  analisado_por uuid references public.usuarios (id),
  analisado_em timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique nulls not distinct (tipo_documento, empresa_id, vinculo_id, competencia)
);
create index documentos_empresa_idx on public.documentos (empresa_id);

create table public.documento_arquivos (
  id uuid primary key default gen_random_uuid(),
  documento_id uuid not null references public.documentos (id) on delete cascade,
  storage_path text not null unique,
  nome_original text not null check (length(nome_original) <= 200),
  mime text not null check (mime in ('application/pdf', 'image/jpeg', 'image/png')),
  tamanho bigint not null check (tamanho > 0 and tamanho <= 10485760),
  sha256 char(64) not null check (sha256 ~ '^[0-9a-f]{64}$'),
  enviado_por uuid not null references public.usuarios (id) default auth.uid(),
  enviado_em timestamptz not null default now()
);
alter table public.documentos add constraint documentos_arquivo_atual_fk foreign key (arquivo_atual_id) references public.documento_arquivos (id);

-- LGPD: quem abriu cada arquivo.
create table public.acessos_documentos (
  id bigint generated always as identity primary key,
  arquivo_id uuid not null references public.documento_arquivos (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) default auth.uid(),
  em timestamptz not null default now()
);

create type public.situacao_envio as enum ('aberto', 'concluido');
create table public.envios_analise (
  id uuid primary key default gen_random_uuid(),
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  vinculo_id uuid,
  enviado_em timestamptz not null default now(),
  enviado_por uuid not null references public.usuarios (id) default auth.uid(),
  situacao public.situacao_envio not null default 'aberto',
  concluido_em timestamptz,
  concluido_por uuid references public.usuarios (id)
);
create index envios_abertos_idx on public.envios_analise (situacao, enviado_em);

-- Funções de apoio --------------------------------------------------------------------
create function app.usuario_externo_da_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.empresa_usuarios eu join public.usuarios u on u.id = eu.usuario_id
    where eu.usuario_id = auth.uid() and eu.empresa_id = p_empresa and u.ativo and u.tipo = 'externo'
  )
$$;

-- Quem convida e cadastra empresas.
create function app.pode_gerir_terceiros() returns boolean
language sql stable set search_path = '' as $$
  select app.admin_verificado() or app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos') or app.tem_papel('contratos')
$$;

-- Quem abre arquivos de documentos (matriz de permissões, seção 5 do plano).
create function app.pode_abrir_documento(p_documento uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documentos d join public.tipos_documento t on t.codigo = d.tipo_documento
    where d.id = p_documento and (
      app.usuario_externo_da_empresa(d.empresa_id)
      or ((app.tem_papel('rh') or app.tem_papel('sst')) and app.aal2())
      or (not t.sensivel and (app.admin_verificado() or app.tem_papel('suprimentos') or app.tem_papel('contratos')))
    )
  )
$$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;

-- Triggers ------------------------------------------------------------------------------
create trigger empresas_updated_at before update on public.empresas_terceiras for each row execute function app.tocar_updated_at();
create trigger documentos_updated_at before update on public.documentos for each row execute function app.tocar_updated_at();

create trigger auditar_empresas after insert or update or delete on public.empresas_terceiras for each row execute function app.auditar();
create trigger auditar_empresa_obras after insert or update or delete on public.empresa_obras for each row execute function app.auditar();
create trigger auditar_empresa_usuarios after insert or update or delete on public.empresa_usuarios for each row execute function app.auditar();
create trigger auditar_tipos_documento after insert or update or delete on public.tipos_documento for each row execute function app.auditar();
create trigger auditar_matriz after insert or update or delete on public.matriz_documental for each row execute function app.auditar();
create trigger auditar_documentos after insert or update or delete on public.documentos for each row execute function app.auditar();
create trigger auditar_documento_arquivos after insert or update or delete on public.documento_arquivos for each row execute function app.auditar();
create trigger auditar_envios after insert or update or delete on public.envios_analise for each row execute function app.auditar();

-- RLS -------------------------------------------------------------------------------------
alter table public.empresas_terceiras enable row level security;
alter table public.empresa_obras enable row level security;
alter table public.empresa_usuarios enable row level security;
alter table public.tipos_documento enable row level security;
alter table public.matriz_documental enable row level security;
alter table public.documentos enable row level security;
alter table public.documento_arquivos enable row level security;
alter table public.acessos_documentos enable row level security;
alter table public.envios_analise enable row level security;
revoke all on all tables in schema public from anon;

create policy empresas_ler on public.empresas_terceiras for select to authenticated
  using (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(id));
create policy empresas_incluir on public.empresas_terceiras for insert to authenticated
  with check (app.pode_gerir_terceiros());
create policy empresas_alterar on public.empresas_terceiras for update to authenticated
  using (app.pode_gerir_terceiros()) with check (app.pode_gerir_terceiros());

create policy empresa_obras_ler on public.empresa_obras for select to authenticated
  using (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(empresa_id));
create policy empresa_obras_incluir on public.empresa_obras for insert to authenticated
  with check (app.pode_gerir_terceiros());
create policy empresa_obras_alterar on public.empresa_obras for update to authenticated
  using (app.pode_gerir_terceiros()) with check (app.pode_gerir_terceiros());

create policy empresa_usuarios_ler on public.empresa_usuarios for select to authenticated
  using (app.usuario_interno_ativo() or usuario_id = auth.uid());
create policy empresa_usuarios_incluir on public.empresa_usuarios for insert to authenticated
  with check (app.pode_gerir_terceiros());
create policy empresa_usuarios_excluir on public.empresa_usuarios for delete to authenticated
  using (app.pode_gerir_terceiros());

create policy tipos_documento_ler on public.tipos_documento for select to authenticated using (true);
create policy tipos_documento_admin on public.tipos_documento for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());
create policy matriz_ler on public.matriz_documental for select to authenticated using (true);
create policy matriz_admin_incluir on public.matriz_documental for insert to authenticated with check (app.admin_verificado());
create policy matriz_admin_alterar on public.matriz_documental for update to authenticated
  using (app.admin_verificado()) with check (app.admin_verificado());

-- Situação dos documentos: todo interno vê (sem o arquivo); a empresa vê os seus.
create policy documentos_ler on public.documentos for select to authenticated
  using (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(empresa_id));
-- Arquivos: só quem pode abrir (dado de saúde só RH/SST com verificação em duas etapas).
create policy arquivos_ler on public.documento_arquivos for select to authenticated
  using (app.pode_abrir_documento(documento_id));
create policy acessos_admin_ler on public.acessos_documentos for select to authenticated
  using (app.admin_verificado());
create policy envios_ler on public.envios_analise for select to authenticated
  using (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(empresa_id));
revoke insert, update, delete, truncate on public.documentos, public.documento_arquivos, public.acessos_documentos, public.envios_analise from authenticated;
revoke update, delete, truncate on public.auditoria from authenticated;

-- RPCs (gravação controlada) ----------------------------------------------------------------

-- Primeiro acesso da empresa ao portal: sai de "convidada".
create function public.registrar_primeiro_acesso(p_empresa uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  update public.empresas_terceiras set situacao = 'cadastro_incompleto'
  where id = p_empresa and situacao = 'convidada';
end $$;

-- Grava um arquivo já enviado ao Storage (caminho gerado pelo servidor) e marca o documento como anexado.
create function public.registrar_arquivo_empresa(
  p_empresa uuid, p_tipo text, p_storage_path text, p_nome text, p_mime text, p_tamanho bigint, p_sha256 text,
  p_data_emissao date default null, p_data_validade date default null, p_competencia date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_tipo public.tipos_documento;
  v_doc public.documentos;
  v_arquivo uuid;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  select * into v_tipo from public.tipos_documento where codigo = p_tipo and ativo and escopo = 'empresa';
  if not found or v_tipo.aceita_texto then
    raise exception 'Tipo de documento inválido.' using errcode = 'P0001';
  end if;
  if p_storage_path not like 'empresas/' || p_empresa || '/empresa/' || p_tipo || '/%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'mensal' and p_competencia is null then
    raise exception 'Informe a competência.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'meses_apos_emissao' and p_data_emissao is null then
    raise exception 'Informe a data de emissão.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'data_informada' and (p_data_validade is null or p_data_validade < current_date) then
    raise exception 'Informe uma data de validade futura.' using errcode = 'P0001';
  end if;

  select * into v_doc from public.documentos
  where tipo_documento = p_tipo and empresa_id = p_empresa and vinculo_id is null
    and competencia is not distinct from (case when v_tipo.regra_validade = 'mensal' then p_competencia end);
  if found and v_doc.situacao in ('enviado', 'aprovado') then
    raise exception 'Este documento está em análise ou já foi aprovado.' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.documentos (tipo_documento, empresa_id, competencia, situacao)
    values (p_tipo, p_empresa, case when v_tipo.regra_validade = 'mensal' then p_competencia end, 'anexado')
    returning * into v_doc;
  end if;

  insert into public.documento_arquivos (documento_id, storage_path, nome_original, mime, tamanho, sha256)
  values (v_doc.id, p_storage_path, left(p_nome, 200), p_mime, p_tamanho, p_sha256)
  returning id into v_arquivo;

  update public.documentos set
    situacao = 'anexado', arquivo_atual_id = v_arquivo, motivo_reprovacao = null,
    data_emissao = case when v_tipo.regra_validade = 'meses_apos_emissao' then p_data_emissao end,
    data_validade = case when v_tipo.regra_validade = 'data_informada' then p_data_validade end
  where id = v_doc.id;
  return v_doc.id;
end $$;

-- Documento de texto (ex.: contabilidade: nome e telefone).
create function public.salvar_texto_empresa(p_empresa uuid, p_tipo text, p_texto text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_doc public.documentos;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.tipos_documento where codigo = p_tipo and ativo and escopo = 'empresa' and aceita_texto) then
    raise exception 'Tipo de documento inválido.' using errcode = 'P0001';
  end if;
  if length(btrim(coalesce(p_texto, ''))) < 3 then
    raise exception 'Preencha o campo.' using errcode = 'P0001';
  end if;
  select * into v_doc from public.documentos where tipo_documento = p_tipo and empresa_id = p_empresa and vinculo_id is null and competencia is null;
  if found and v_doc.situacao in ('enviado', 'aprovado') then
    raise exception 'Este documento está em análise ou já foi aprovado.' using errcode = 'P0001';
  end if;
  insert into public.documentos (tipo_documento, empresa_id, situacao, valor_texto)
  values (p_tipo, p_empresa, 'anexado', btrim(p_texto))
  on conflict (tipo_documento, empresa_id, vinculo_id, competencia)
  do update set valor_texto = excluded.valor_texto, situacao = 'anexado', motivo_reprovacao = null
  returning * into v_doc;
  return v_doc.id;
end $$;

-- Manda os documentos anexados da empresa para a análise do RH.
-- A conferência de que nada obrigatório falta é feita antes, no servidor (modules/terceiros/dominio).
create function public.enviar_documentos_empresa(p_empresa uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_envio uuid;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado') then
    raise exception 'Não há documentos novos para enviar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.envios_analise where empresa_id = p_empresa and vinculo_id is null and situacao = 'aberto') then
    raise exception 'Já existe um envio em análise.' using errcode = 'P0001';
  end if;
  update public.documentos set situacao = 'enviado' where empresa_id = p_empresa and vinculo_id is null and situacao = 'anexado';
  insert into public.envios_analise (empresa_id) values (p_empresa) returning id into v_envio;
  update public.empresas_terceiras set situacao = 'em_analise' where id = p_empresa;
  return v_envio;
end $$;

-- Registra a abertura de um arquivo (LGPD) e devolve o caminho no Storage, se a pessoa puder abrir.
create function public.registrar_acesso_arquivo(p_arquivo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_path text;
  v_documento uuid;
begin
  select storage_path, documento_id into v_path, v_documento from public.documento_arquivos where id = p_arquivo;
  if not found or not app.pode_abrir_documento(v_documento) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  insert into public.acessos_documentos (arquivo_id, usuario_id) values (p_arquivo, auth.uid());
  return v_path;
end $$;

revoke all on function public.registrar_primeiro_acesso(uuid), public.registrar_arquivo_empresa(uuid, text, text, text, text, bigint, text, date, date, date),
  public.salvar_texto_empresa(uuid, text, text), public.enviar_documentos_empresa(uuid), public.registrar_acesso_arquivo(uuid) from public, anon;
grant execute on function public.registrar_primeiro_acesso(uuid), public.registrar_arquivo_empresa(uuid, text, text, text, text, bigint, text, date, date, date),
  public.salvar_texto_empresa(uuid, text, text), public.enviar_documentos_empresa(uuid), public.registrar_acesso_arquivo(uuid) to authenticated;

-- Storage: bucket privado. Upload e download só por URL assinada gerada no servidor
-- depois de conferir a permissão; nenhuma política de acesso direto.
insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values ('documentos', 'documentos', false, 10485760, array['application/pdf', 'image/jpeg', 'image/png'])
on conflict (id) do nothing;

-- Catálogo (lista aprovada pelo usuário em 05/11/2026) -------------------------------------
insert into public.tipos_documento (codigo, nome, escopo, regra_validade, chave_validade, sensivel, aceita_texto, observacao, ordem) values
  ('cnd_federal', 'CND federal', 'empresa', 'data_informada', null, false, false, 'Se houver pendências, envie a certidão positiva com efeito de negativa.', 10),
  ('fgts', 'FGTS: guia e comprovante de pagamento', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 20),
  ('inss', 'INSS: guia e comprovante de pagamento', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 30),
  ('contabilidade', 'Contabilidade: nome e telefone', 'empresa', 'sem_validade', null, false, true, null, 40),
  ('pcmso', 'PCMSO válido e assinado', 'empresa', 'data_informada', null, false, false, null, 50),
  ('pgr', 'PGR válido e assinado', 'empresa', 'data_informada', null, false, false, null, 60),
  ('ltcat', 'LTCAT válido e assinado', 'empresa', 'data_informada', null, false, false, null, 70),
  ('nr05', 'Certificado NR-05 (CIPA)', 'empresa', 'meses_apos_emissao', 'nr', false, false, 'Exigido quando a empresa tem mais de 5 pessoas na obra.', 80),
  ('aso', 'ASO (Atestado de Saúde Ocupacional)', 'pessoa', 'meses_apos_emissao', 'aso', true, false, null, 110),
  ('rg_cnh', 'RG ou CNH', 'pessoa', 'meses_apos_emissao', 'rg_cnh', false, false, null, 120),
  ('contrato_trabalho', 'Contrato de trabalho ou de experiência assinado', 'pessoa', 'sem_validade', null, false, false, null, 130),
  ('esocial', 'Registro no eSocial', 'pessoa', 'sem_validade', null, false, false, null, 140),
  ('ficha_registro', 'Ficha de registro assinada', 'pessoa', 'sem_validade', null, false, false, null, 150),
  ('ordem_servico', 'Ordem de serviço atualizada e assinada', 'pessoa', 'sem_validade', null, false, false, null, 160),
  ('ficha_epi', 'Ficha de EPI atualizada e assinada', 'pessoa', 'sem_validade', null, false, false, null, 170),
  ('nr06', 'Certificado NR-06', 'pessoa', 'meses_apos_emissao', 'nr', false, false, null, 180),
  ('nr12', 'Certificado NR-12', 'pessoa', 'meses_apos_emissao', 'nr', false, false, null, 190),
  ('nr18', 'Certificado NR-18', 'pessoa', 'meses_apos_emissao', 'nr', false, false, null, 200),
  ('nr35', 'Certificado NR-35', 'pessoa', 'meses_apos_emissao', 'nr', false, false, null, 210),
  ('nr10', 'Certificado NR-10', 'pessoa', 'meses_apos_emissao', 'nr', false, false, 'Trabalho com eletricidade.', 220),
  ('formacao_eletrica', 'Formação técnica em eletricidade', 'pessoa', 'sem_validade', null, false, false, 'Trabalho com eletricidade.', 230);

insert into public.matriz_documental (tipo_documento, aplica_a, condicao) values
  ('cnd_federal', 'empresa', 'sempre'), ('fgts', 'empresa', 'sempre'), ('inss', 'empresa', 'sempre'),
  ('contabilidade', 'empresa', 'sempre'), ('pcmso', 'empresa', 'sempre'), ('pgr', 'empresa', 'sempre'),
  ('ltcat', 'empresa', 'sempre'), ('nr05', 'empresa', 'mais_de_5_na_obra'),
  ('aso', 'funcionario', 'sempre'), ('rg_cnh', 'funcionario', 'sempre'), ('contrato_trabalho', 'funcionario', 'sempre'),
  ('esocial', 'funcionario', 'sempre'), ('ficha_registro', 'funcionario', 'sempre'), ('ordem_servico', 'funcionario', 'sempre'),
  ('ficha_epi', 'funcionario', 'sempre'), ('nr06', 'funcionario', 'sempre'), ('nr12', 'funcionario', 'sempre'),
  ('nr18', 'funcionario', 'sempre'), ('nr35', 'funcionario', 'sempre'),
  ('nr10', 'funcionario', 'eletricidade'), ('formacao_eletrica', 'funcionario', 'eletricidade'),
  ('aso', 'socio_diario', 'sempre'), ('rg_cnh', 'socio_diario', 'sempre'), ('ficha_epi', 'socio_diario', 'sempre'),
  ('nr06', 'socio_diario', 'sempre'), ('nr12', 'socio_diario', 'sempre'), ('nr18', 'socio_diario', 'sempre'),
  ('nr35', 'socio_diario', 'sempre');
