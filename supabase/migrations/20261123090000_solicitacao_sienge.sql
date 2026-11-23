-- Solicitação para o Sienge: a obra (coordenador e auxiliar) monta os itens pelos serviços da EAP e baixa o CSV de importação.
-- Os itens ficam numa lista JSON (o app valida o formato); quem vê as contratações da obra também vê as solicitações.

create table public.solicitacoes_sienge (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id),
  titulo text not null check (char_length(btrim(titulo)) between 1 and 80),
  unidade_construtiva text check (char_length(unidade_construtiva) <= 20),
  conta_financeira text check (char_length(conta_financeira) <= 40),
  itens jsonb not null default '[]'::jsonb check (jsonb_typeof(itens) = 'array' and jsonb_array_length(itens) <= 2000),
  criado_por uuid not null default auth.uid() references public.usuarios (id),
  criado_em timestamptz not null default now(),
  atualizado_por uuid references public.usuarios (id),
  atualizado_em timestamptz not null default now()
);
create index solicitacoes_sienge_obra_idx on public.solicitacoes_sienge (obra_id, atualizado_em desc);
comment on table public.solicitacoes_sienge is 'Solicitação montada pela obra sobre a EAP; vira o CSV de importação do Sienge. itens: [{id, referencia, descricao, codigo_servico, complemento, codigo_auxiliar, quantidade, unidade, preco_mo, preco_mat, observacao, conta_financeira}].';

alter table public.solicitacoes_sienge enable row level security;
revoke all on public.solicitacoes_sienge from anon, authenticated;
grant select, delete on public.solicitacoes_sienge to authenticated;
grant insert (obra_id, titulo, unidade_construtiva, conta_financeira, itens) on public.solicitacoes_sienge to authenticated;
grant update (titulo, unidade_construtiva, conta_financeira, itens) on public.solicitacoes_sienge to authenticated;

create policy solicitacoes_sienge_ler on public.solicitacoes_sienge for select to authenticated using ((select app.pode_ver_obra(obra_id)));
create policy solicitacoes_sienge_incluir on public.solicitacoes_sienge for insert to authenticated with check ((select app.pode_na_obra(obra_id)));
create policy solicitacoes_sienge_alterar on public.solicitacoes_sienge for update to authenticated
  using ((select app.pode_na_obra(obra_id))) with check ((select app.pode_na_obra(obra_id)));
create policy solicitacoes_sienge_excluir on public.solicitacoes_sienge for delete to authenticated using ((select app.pode_na_obra(obra_id)));

create function app.solicitacoes_sienge_conferir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
    new.criado_em := now();
  elsif new.obra_id <> old.obra_id or new.criado_por <> old.criado_por then
    raise exception 'Não é possível trocar a obra ou o autor da solicitação.' using errcode = '42501';
  end if;
  new.atualizado_por := auth.uid();
  new.atualizado_em := now();
  return new;
end;
$$;
revoke execute on function app.solicitacoes_sienge_conferir() from public, anon, authenticated;

create trigger solicitacoes_sienge_conferir before insert or update on public.solicitacoes_sienge
  for each row execute function app.solicitacoes_sienge_conferir();
