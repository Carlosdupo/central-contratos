-- F2: pessoas (CPF único, histórico entre empresas), vínculos, alocação por obra (A4), visitas e busca (A3).

create function app.sem_acento(texto text) returns text
language sql immutable parallel safe set search_path = '' as $$
  select lower(extensions.unaccent('extensions.unaccent'::regdictionary, coalesce(texto, '')))
$$;

create type public.tipo_vinculo as enum ('funcionario', 'socio_diario', 'socio_esporadico');
create type public.situacao_alocacao as enum ('rascunho', 'em_analise', 'pendente', 'aguardando_empresa', 'integracao_agendada', 'liberado', 'bloqueado');
create type public.situacao_visita as enum ('solicitada', 'aprovada', 'recusada');

create table public.pessoas (
  id uuid primary key default gen_random_uuid(),
  cpf char(11) not null unique check (cpf ~ '^\d{11}$'),
  nome text not null check (length(btrim(nome)) between 3 and 120),
  telefone text check (telefone is null or length(telefone) <= 30),
  foto_path text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid()
);
create index pessoas_nome_trgm on public.pessoas using gin (app.sem_acento(nome) extensions.gin_trgm_ops);

create table public.vinculos (
  id uuid primary key default gen_random_uuid(),
  pessoa_id uuid not null references public.pessoas (id),
  empresa_id uuid not null references public.empresas_terceiras (id) on delete cascade,
  tipo public.tipo_vinculo not null,
  funcao text not null check (length(btrim(funcao)) between 2 and 80),
  eletricidade boolean not null default false,
  ativo boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  unique (pessoa_id, empresa_id)
);
create index vinculos_empresa_idx on public.vinculos (empresa_id);

create table public.alocacoes (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculos (id) on delete cascade,
  obra_id uuid not null references public.obras (id),
  situacao public.situacao_alocacao not null default 'rascunho',
  integracao_data date,
  liberado_em timestamptz,
  bloqueio_motivo text,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (vinculo_id, obra_id)
);

create table public.visitas (
  id uuid primary key default gen_random_uuid(),
  vinculo_id uuid not null references public.vinculos (id) on delete cascade,
  obra_id uuid not null references public.obras (id),
  data date not null,
  documento_foto_path text not null,
  documento_foto_nome text not null,
  situacao public.situacao_visita not null default 'solicitada',
  decidido_por uuid references public.usuarios (id),
  decidido_em timestamptz,
  motivo text,
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid()
);

alter table public.documentos add constraint documentos_vinculo_fk foreign key (vinculo_id) references public.vinculos (id) on delete cascade;
alter table public.envios_analise add constraint envios_vinculo_fk foreign key (vinculo_id) references public.vinculos (id) on delete cascade;
create index documentos_vinculo_idx on public.documentos (vinculo_id);

create trigger pessoas_updated_at before update on public.pessoas for each row execute function app.tocar_updated_at();
create trigger vinculos_updated_at before update on public.vinculos for each row execute function app.tocar_updated_at();
create trigger alocacoes_updated_at before update on public.alocacoes for each row execute function app.tocar_updated_at();
create trigger auditar_pessoas after insert or update or delete on public.pessoas for each row execute function app.auditar();
create trigger auditar_vinculos after insert or update or delete on public.vinculos for each row execute function app.auditar();
create trigger auditar_alocacoes after insert or update or delete on public.alocacoes for each row execute function app.auditar();
create trigger auditar_visitas after insert or update or delete on public.visitas for each row execute function app.auditar();

-- Arquivos de pessoa: a empresa dona do vínculo também pode abrir.
create or replace function app.pode_abrir_documento(p_documento uuid) returns boolean
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

-- RLS ----------------------------------------------------------------------------------------
alter table public.pessoas enable row level security;
alter table public.vinculos enable row level security;
alter table public.alocacoes enable row level security;
alter table public.visitas enable row level security;
revoke all on public.pessoas, public.vinculos, public.alocacoes, public.visitas from anon;

-- CPF não sai por consulta direta (LGPD): só pelas funções, mascarado.
revoke select, insert, update, delete, truncate on public.pessoas from authenticated;
grant select (id, nome, telefone, foto_path, created_at) on public.pessoas to authenticated;
create policy pessoas_ler on public.pessoas for select to authenticated
  using (
    app.usuario_interno_ativo()
    or exists (select 1 from public.vinculos v where v.pessoa_id = pessoas.id and app.usuario_externo_da_empresa(v.empresa_id))
  );

create policy vinculos_ler on public.vinculos for select to authenticated
  using (app.usuario_interno_ativo() or app.usuario_externo_da_empresa(empresa_id));
create policy alocacoes_ler on public.alocacoes for select to authenticated
  using (
    app.usuario_interno_ativo()
    or exists (select 1 from public.vinculos v where v.id = alocacoes.vinculo_id and app.usuario_externo_da_empresa(v.empresa_id))
  );
create policy visitas_ler on public.visitas for select to authenticated
  using (
    app.usuario_interno_ativo()
    or exists (select 1 from public.vinculos v where v.id = visitas.vinculo_id and app.usuario_externo_da_empresa(v.empresa_id))
  );
revoke insert, update, delete, truncate on public.vinculos, public.alocacoes, public.visitas from authenticated;

-- RPCs ----------------------------------------------------------------------------------------

-- Cadastro de pessoa pela empresa. O CPF identifica a pessoa entre empresas; o nome já cadastrado é mantido.
create function public.cadastrar_pessoa(
  p_empresa uuid, p_cpf text, p_nome text, p_telefone text, p_tipo public.tipo_vinculo,
  p_funcao text, p_eletricidade boolean, p_obra uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_pessoa uuid;
  v_vinculo uuid;
begin
  if not app.usuario_externo_da_empresa(p_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_cpf !~ '^\d{11}$' then
    raise exception 'CPF inválido.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.empresa_obras where empresa_id = p_empresa and obra_id = p_obra and ativo) then
    raise exception 'Obra não liberada para esta empresa.' using errcode = 'P0001';
  end if;

  insert into public.pessoas (cpf, nome, telefone) values (p_cpf, btrim(p_nome), nullif(btrim(p_telefone), ''))
  on conflict (cpf) do update set telefone = coalesce(excluded.telefone, public.pessoas.telefone)
  returning id into v_pessoa;

  if exists (select 1 from public.vinculos where pessoa_id = v_pessoa and empresa_id = p_empresa) then
    raise exception 'Esta pessoa já está cadastrada na empresa.' using errcode = 'P0001';
  end if;

  insert into public.vinculos (pessoa_id, empresa_id, tipo, funcao, eletricidade)
  values (v_pessoa, p_empresa, p_tipo, btrim(p_funcao), p_tipo = 'funcionario' and coalesce(p_eletricidade, false))
  returning id into v_vinculo;

  if p_tipo <> 'socio_esporadico' then
    insert into public.alocacoes (vinculo_id, obra_id) values (v_vinculo, p_obra);
  end if;
  return v_vinculo;
end $$;

create function app.empresa_do_vinculo(p_vinculo uuid) returns uuid
language sql stable security definer set search_path = '' as $$
  select empresa_id from public.vinculos where id = p_vinculo
$$;

create function public.registrar_arquivo_pessoa(
  p_vinculo uuid, p_tipo text, p_storage_path text, p_nome text, p_mime text, p_tamanho bigint, p_sha256 text,
  p_data_emissao date default null, p_data_validade date default null
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
  v_tipo public.tipos_documento;
  v_doc public.documentos;
  v_arquivo uuid;
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  select * into v_tipo from public.tipos_documento where codigo = p_tipo and ativo and escopo = 'pessoa';
  if not found then
    raise exception 'Tipo de documento inválido.' using errcode = 'P0001';
  end if;
  if p_storage_path not like 'empresas/' || v_empresa || '/vinculos/' || p_vinculo || '/' || p_tipo || '/%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'meses_apos_emissao' and (p_data_emissao is null or p_data_emissao > current_date) then
    raise exception 'Informe a data de emissão (não pode ser futura).' using errcode = 'P0001';
  end if;
  if v_tipo.regra_validade = 'data_informada' and (p_data_validade is null or p_data_validade < current_date) then
    raise exception 'Informe uma data de validade futura.' using errcode = 'P0001';
  end if;

  select * into v_doc from public.documentos where tipo_documento = p_tipo and vinculo_id = p_vinculo and competencia is null;
  if found and v_doc.situacao in ('enviado', 'aprovado') then
    raise exception 'Este documento está em análise ou já foi aprovado.' using errcode = 'P0001';
  end if;
  if not found then
    insert into public.documentos (tipo_documento, empresa_id, vinculo_id, situacao)
    values (p_tipo, v_empresa, p_vinculo, 'anexado') returning * into v_doc;
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

create function public.registrar_foto_pessoa(p_vinculo uuid, p_storage_path text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if p_storage_path not like 'empresas/' || v_empresa || '/vinculos/' || p_vinculo || '/foto/%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  update public.pessoas set foto_path = p_storage_path
  where id = (select pessoa_id from public.vinculos where id = p_vinculo);
end $$;

-- Manda os documentos anexados da pessoa para o RH e coloca as alocações em análise.
create function public.enviar_documentos_pessoa(p_vinculo uuid) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
  v_envio uuid;
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.documentos where vinculo_id = p_vinculo and situacao = 'anexado') then
    raise exception 'Não há documentos novos para enviar.' using errcode = 'P0001';
  end if;
  if exists (select 1 from public.envios_analise where vinculo_id = p_vinculo and situacao = 'aberto') then
    raise exception 'Já existe um envio em análise para esta pessoa.' using errcode = 'P0001';
  end if;
  update public.documentos set situacao = 'enviado' where vinculo_id = p_vinculo and situacao = 'anexado';
  insert into public.envios_analise (empresa_id, vinculo_id) values (v_empresa, p_vinculo) returning id into v_envio;
  update public.alocacoes set situacao = 'em_analise'
  where vinculo_id = p_vinculo and situacao in ('rascunho', 'pendente', 'bloqueado');
  return v_envio;
end $$;

-- Sócio esporádico: pede a visita com a antecedência do parâmetro e anexa um documento com foto.
create function public.solicitar_visita(p_vinculo uuid, p_obra uuid, p_data date, p_storage_path text, p_nome text) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid := app.empresa_do_vinculo(p_vinculo);
  v_antecedencia int := coalesce((select (valor #>> '{}')::int from public.parametros where chave = 'antecedencia_visita_dias'), 1);
  v_visita uuid;
begin
  if v_empresa is null or not app.usuario_externo_da_empresa(v_empresa) then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if (select tipo from public.vinculos where id = p_vinculo) <> 'socio_esporadico' then
    raise exception 'Pedido de visita é só para sócio com acesso esporádico.' using errcode = 'P0001';
  end if;
  if not exists (select 1 from public.empresa_obras where empresa_id = v_empresa and obra_id = p_obra and ativo) then
    raise exception 'Obra não liberada para esta empresa.' using errcode = 'P0001';
  end if;
  if p_data < (now() at time zone 'America/Sao_Paulo')::date + v_antecedencia then
    raise exception 'A visita precisa ser pedida com % dia(s) de antecedência.', v_antecedencia using errcode = 'P0001';
  end if;
  if p_storage_path not like 'empresas/' || v_empresa || '/vinculos/' || p_vinculo || '/visita/%' then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  insert into public.visitas (vinculo_id, obra_id, data, documento_foto_path, documento_foto_nome)
  values (p_vinculo, p_obra, p_data, p_storage_path, left(p_nome, 200)) returning id into v_visita;
  return v_visita;
end $$;

-- Consulta por nome ou CPF (A3): só situação, sem arquivos; CPF mascarado.
create function public.buscar_pessoas(p_termo text)
returns table (vinculo_id uuid, nome text, cpf_mascarado text, empresa text, tipo public.tipo_vinculo, funcao text, obra text, situacao public.situacao_alocacao, integracao_data date)
language plpgsql stable security definer set search_path = '' as $$
declare
  v_digitos text := regexp_replace(coalesce(p_termo, ''), '\D', '', 'g');
  v_texto text := app.sem_acento(btrim(coalesce(p_termo, '')));
begin
  if not app.usuario_interno_ativo() then
    raise exception 'Acesso negado.' using errcode = '42501';
  end if;
  if length(v_texto) < 3 and length(v_digitos) < 11 then
    return;
  end if;
  return query
    select v.id, p.nome, '***.' || substr(p.cpf, 4, 3) || '.' || substr(p.cpf, 7, 3) || '-**',
           e.razao_social, v.tipo, v.funcao, o.nome, a.situacao, a.integracao_data
    from public.pessoas p
    join public.vinculos v on v.pessoa_id = p.id
    join public.empresas_terceiras e on e.id = v.empresa_id
    left join public.alocacoes a on a.vinculo_id = v.id
    left join public.obras o on o.id = a.obra_id
    where (length(v_digitos) = 11 and p.cpf = v_digitos)
       or (length(v_digitos) < 11 and app.sem_acento(p.nome) like '%' || v_texto || '%')
    order by p.nome
    limit 50;
end $$;

-- CPF mascarado de pessoas que a pessoa logada pode ver (para telas).
create function public.cpf_mascarado(p_pessoa uuid) returns text
language sql stable security definer set search_path = '' as $$
  select '***.' || substr(p.cpf, 4, 3) || '.' || substr(p.cpf, 7, 3) || '-**'
  from public.pessoas p
  where p.id = p_pessoa and (
    app.usuario_interno_ativo()
    or exists (select 1 from public.vinculos v where v.pessoa_id = p.id and app.usuario_externo_da_empresa(v.empresa_id))
  )
$$;

revoke all on function public.cadastrar_pessoa(uuid, text, text, text, public.tipo_vinculo, text, boolean, uuid),
  public.registrar_arquivo_pessoa(uuid, text, text, text, text, bigint, text, date, date),
  public.registrar_foto_pessoa(uuid, text), public.enviar_documentos_pessoa(uuid),
  public.solicitar_visita(uuid, uuid, date, text, text), public.buscar_pessoas(text), public.cpf_mascarado(uuid) from public, anon;
grant execute on function public.cadastrar_pessoa(uuid, text, text, text, public.tipo_vinculo, text, boolean, uuid),
  public.registrar_arquivo_pessoa(uuid, text, text, text, text, bigint, text, date, date),
  public.registrar_foto_pessoa(uuid, text), public.enviar_documentos_pessoa(uuid),
  public.solicitar_visita(uuid, uuid, date, text, text), public.buscar_pessoas(text), public.cpf_mascarado(uuid) to authenticated;
revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
