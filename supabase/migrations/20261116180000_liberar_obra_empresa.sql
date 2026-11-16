-- Liberar uma obra para a empresa sem contratação autorizada (pedido do usuário em 16/11/2026):
-- a empresa já pode cadastrar a equipe e enviar os documentos para aquela obra.
-- Quem pode: admin, Suprimentos, gerente de Suprimentos, Contratos e RH.

create function public.liberar_obra_empresa(p_empresa uuid, p_obra uuid) returns void
language plpgsql security definer set search_path = '' as $$
begin
  if not (app.pode_gerir_terceiros() or app.tem_papel('rh')) then
    raise exception 'Sem permissão para liberar obra.' using errcode = '42501';
  end if;
  if not exists (select 1 from public.empresas_terceiras where id = p_empresa) then
    raise exception 'Empresa não encontrada.' using errcode = 'P0002';
  end if;
  if not exists (select 1 from public.obras where id = p_obra and ativa) then
    raise exception 'Obra não encontrada ou inativa.' using errcode = 'P0002';
  end if;
  insert into public.empresa_obras (empresa_id, obra_id, ativo, created_by)
  values (p_empresa, p_obra, true, auth.uid())
  on conflict (empresa_id, obra_id) do update set ativo = true;
end $$;

revoke all on function public.liberar_obra_empresa(uuid, uuid) from public, anon;
grant execute on function public.liberar_obra_empresa(uuid, uuid) to authenticated;
