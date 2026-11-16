-- Acesso por senha provisória (entrar sem depender de e-mail).
--
-- 1) Auditoria de "senha provisória gerada para fulano por sicrano".
-- A senha NUNCA passa por aqui: a função só recebe quem é o usuário e grava os dois nomes. Só administrador com verificação
-- em duas etapas (aal2) registra. O servidor chama esta função ANTES de trocar a senha de um usuário existente (se a auditoria
-- falhar, a senha não muda) e logo depois de criar a conta nova (se falhar, a conta é desfeita).
create function public.registrar_senha_provisoria(p_usuario uuid, p_conta_nova boolean default false) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_alvo text;
  v_ator text;
begin
  if not app.admin_verificado() then raise exception 'Só o administrador com verificação em duas etapas gera senha provisória.' using errcode = '42501'; end if;
  select nome into v_alvo from public.usuarios where id = p_usuario;
  if not found then raise exception 'Usuário não encontrado.' using errcode = 'P0001'; end if;
  select nome into v_ator from public.usuarios where id = auth.uid();
  insert into public.auditoria (acao, tabela, registro_id, depois)
  values ('UPDATE', 'senha_provisoria', p_usuario::text, jsonb_build_object(
    'descricao', 'Senha provisória gerada para ' || v_alvo || ' por ' || coalesce(v_ator, 'administrador'),
    'para', p_usuario, 'por', auth.uid(), 'conta_nova', coalesce(p_conta_nova, false)));
end $$;

revoke all on function public.registrar_senha_provisoria(uuid, boolean) from public, anon;
grant execute on function public.registrar_senha_provisoria(uuid, boolean) to authenticated;

-- 2) Troca obrigatória também no banco. Quem entrou com senha provisória tem app_metadata.trocar_senha = true no token (só o
-- servidor grava app_metadata). O app já manda essa pessoa para /definir-senha; aqui o banco também não a reconhece como usuária
-- ativa enquanto a marca existir, então um token de senha provisória não lê dado nenhum (nem por chamada direta à API).
-- Ao definir a senha nova o servidor tira a marca e renova a sessão. Mesmas funções de antes, com uma condição a mais.
create or replace function app.usuario_interno_ativo() returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'trocar_senha', '') <> 'true' and exists (
    select 1 from public.usuarios u
    where u.id = auth.uid() and u.ativo and u.tipo = 'interno'
  )
$$;

create or replace function app.tem_papel(p public.papel) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'trocar_senha', '') <> 'true' and exists (
    select 1 from public.usuario_papeis up
    join public.usuarios u on u.id = up.usuario_id
    where up.usuario_id = auth.uid() and up.papel = p and u.ativo and u.tipo = 'interno'
  )
$$;

create or replace function app.usuario_externo_da_empresa(p_empresa uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce(auth.jwt() -> 'app_metadata' ->> 'trocar_senha', '') <> 'true' and exists (
    select 1 from public.empresa_usuarios eu join public.usuarios u on u.id = eu.usuario_id
    where eu.usuario_id = auth.uid() and eu.empresa_id = p_empresa and u.ativo and u.tipo = 'externo'
  )
$$;
