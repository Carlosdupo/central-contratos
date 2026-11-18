-- 18/11/2026: verificação em duas etapas opcional para RH e Segurança do Trabalho (continua obrigatória para o admin).
-- Quem configurou o aplicativo autenticador precisa estar com a sessão verificada (aal2); quem não configurou entra com a senha.

create function app.verificacao_ok() returns boolean
language sql stable security definer set search_path = '' as $$
  select app.aal2() or not exists (
    select 1 from auth.mfa_factors f where f.user_id = auth.uid() and f.status = 'verified'
  )
$$;
revoke all on function app.verificacao_ok() from public, anon;
grant execute on function app.verificacao_ok() to authenticated;

create or replace function app.rh_verificado() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel('rh') and app.verificacao_ok()
$$;

create or replace function app.sst_verificado() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel('sst') and app.verificacao_ok()
$$;

create or replace function app.pode_abrir_documento(p_documento uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.documentos d join public.tipos_documento t on t.codigo = d.tipo_documento
    where d.id = p_documento and (
      app.usuario_externo_da_empresa(d.empresa_id)
      or ((app.tem_papel('rh') or app.tem_papel('sst')) and app.verificacao_ok())
      or (not t.sensivel and (app.admin_verificado() or app.tem_papel('suprimentos') or app.tem_papel('contratos')))
    )
  )
$$;

create or replace function app.pode_agir_como(p_papel public.papel, p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select case
    when p_papel = 'coordenador_obra' then app.tem_papel('coordenador_obra') and exists (select 1 from public.usuario_obras where usuario_id = auth.uid() and obra_id = p_obra and nivel = 'coordenador')
    when p_papel in ('rh', 'sst') then app.tem_papel(p_papel) and app.verificacao_ok()
    when p_papel = 'suprimentos' then app.tem_papel('suprimentos') or app.tem_papel('gerente_suprimentos')
    else app.tem_papel(p_papel)
  end
$$;
