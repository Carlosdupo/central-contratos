-- Correções da revisão de segurança:
-- 1) cadastrar_pessoa não vaza nem altera dados de pessoa já cadastrada por outra empresa;
-- 2) caminhos de arquivo do Storage só no formato gerado pelo servidor (sem "..").

-- 1) CPF já existente: só liga o vínculo se o nome informado conferir; nunca altera a pessoa;
--    a mensagem de erro é a mesma para "CPF não existe" e "nome não confere" (sem oráculo de CPF).
create or replace function public.cadastrar_pessoa(
  p_empresa uuid, p_cpf text, p_nome text, p_telefone text, p_tipo public.tipo_vinculo,
  p_funcao text, p_eletricidade boolean, p_obra uuid
) returns uuid
language plpgsql security definer set search_path = '' as $$
declare
  v_pessoa uuid;
  v_nome_atual text;
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
  on conflict (cpf) do nothing
  returning id into v_pessoa;

  if v_pessoa is null then
    select id, nome into v_pessoa, v_nome_atual from public.pessoas where cpf = p_cpf;
    -- Compara sem acento, sem diferença de maiúsculas e de espaços repetidos.
    if regexp_replace(app.sem_acento(btrim(v_nome_atual)), '\s+', ' ', 'g') <> regexp_replace(app.sem_acento(btrim(p_nome)), '\s+', ' ', 'g') then
      raise exception 'Não foi possível cadastrar. Confira o CPF e o nome completo.' using errcode = 'P0001';
    end if;
  end if;

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

-- 2) Formato único de caminho: empresas/<uuid>/(empresa/<tipo> | vinculos/<uuid>/<tipo>)/<uuid>.(pdf|jpg|png)
create function app.caminho_arquivo_valido(p_caminho text) returns boolean
language sql immutable set search_path = '' as $$
  select p_caminho ~ ('^empresas/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/'
    || '(empresa/[a-z][a-z0-9_]*|vinculos/[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}/[a-z][a-z0-9_]*)/'
    || '[0-9a-f]{8}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{4}-[0-9a-f]{12}\.(pdf|jpg|png)$')
$$;

create function app.exigir_caminho_valido() returns trigger
language plpgsql set search_path = '' as $$
declare
  v_caminho text := to_jsonb(new) ->> tg_argv[0];
begin
  if v_caminho is not null and not app.caminho_arquivo_valido(v_caminho) then
    raise exception 'Caminho de arquivo inválido.' using errcode = 'P0001';
  end if;
  return new;
end $$;

revoke all on all functions in schema app from public;
grant execute on all functions in schema app to authenticated;
-- Volta a fechar o que só roda por dentro de outras funções (o grant acima reabriria).
revoke all on function app.ligar_fornecedor(uuid) from public, authenticated;

create trigger caminho_valido before insert or update of storage_path on public.documento_arquivos
  for each row execute function app.exigir_caminho_valido('storage_path');
create trigger caminho_valido before insert or update of foto_path on public.pessoas
  for each row execute function app.exigir_caminho_valido('foto_path');
create trigger caminho_valido before insert or update of documento_foto_path on public.visitas
  for each row execute function app.exigir_caminho_valido('documento_foto_path');

-- Índices que faltavam (FKs sem índice).
create index if not exists documento_arquivos_documento_idx on public.documento_arquivos (documento_id);
create index if not exists acessos_documentos_arquivo_idx on public.acessos_documentos (arquivo_id);
