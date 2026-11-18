-- 18/11/2026: RH e Segurança baixam a foto do funcionário para cadastrar na catraca.
-- Foto do rosto é dado biométrico (LGPD, dado sensível): só RH/SST e cada download fica registrado.

create table public.downloads_fotos (
  id bigint generated always as identity primary key,
  pessoa_id uuid not null references public.pessoas (id) on delete cascade,
  usuario_id uuid not null references public.usuarios (id) default auth.uid(),
  em timestamptz not null default now()
);
create index downloads_fotos_pessoa_idx on public.downloads_fotos (pessoa_id, em desc);
alter table public.downloads_fotos enable row level security;
revoke all on public.downloads_fotos from anon;
revoke insert, update, delete, truncate on public.downloads_fotos from authenticated;
create policy downloads_fotos_admin_ler on public.downloads_fotos for select to authenticated using ((select app.admin_verificado()));

-- Confere o perfil, registra o download e devolve o caminho da foto (o servidor gera o link temporário).
create function public.registrar_download_foto(p_vinculo uuid) returns text
language plpgsql security definer set search_path = '' as $$
declare
  v_pessoa uuid;
  v_caminho text;
begin
  if not (app.rh_verificado() or app.sst_verificado()) then
    raise exception 'Só RH ou Segurança do Trabalho baixam a foto.' using errcode = '42501';
  end if;
  select p.id, p.foto_path into v_pessoa, v_caminho
  from public.vinculos v join public.pessoas p on p.id = v.pessoa_id where v.id = p_vinculo;
  if v_caminho is null then
    raise exception 'Esta pessoa ainda não tem foto.' using errcode = 'P0001';
  end if;
  insert into public.downloads_fotos (pessoa_id) values (v_pessoa);
  return v_caminho;
end $$;
revoke all on function public.registrar_download_foto(uuid) from public, anon;
grant execute on function public.registrar_download_foto(uuid) to authenticated;
