-- Quadro de negociações da obra: o que a obra precisa negociar e o que já negociou e ainda falta virar contratação.
-- A obra (coordenador e auxiliar) anota e move os cartões; quem vê as contratações da obra vê o quadro (Suprimentos, Direção...).
-- "Contratação aberta" só pela abertura da contratação a partir do cartão (o app grava o vínculo depois de abrir).

create table public.negociacoes (
  id uuid primary key default gen_random_uuid(),
  obra_id uuid not null references public.obras (id),
  titulo text not null check (char_length(btrim(titulo)) between 3 and 200),
  coluna text not null default 'a_negociar' check (coluna in ('a_negociar', 'em_negociacao', 'falta_contrato', 'contratacao_aberta')),
  tipo text not null default 'nova' check (tipo in ('nova', 'aditivo')),
  atividades text check (char_length(atividades) <= 300),
  fora_da_matriz boolean not null default false,
  empresa text check (char_length(empresa) <= 160),
  valor_estimado numeric check (valor_estimado > 0),
  valor_negociado numeric check (valor_negociado > 0),
  observacao text check (char_length(observacao) <= 600),
  contratacao_id uuid references public.contratacoes (id) on delete set null,
  criado_por uuid not null default auth.uid() references public.usuarios (id),
  criado_em timestamptz not null default now(),
  movido_em timestamptz not null default now(),
  check (coluna <> 'contratacao_aberta' or contratacao_id is not null)
);
create index negociacoes_obra_idx on public.negociacoes (obra_id, coluna);
comment on table public.negociacoes is 'Quadro de negociações da obra (kanban). movido_em: quando entrou na coluna atual (lembrete de contrato parado).';

alter table public.negociacoes enable row level security;
revoke all on public.negociacoes from anon, authenticated;
grant select, delete on public.negociacoes to authenticated;
grant insert (obra_id, titulo, coluna, tipo, atividades, fora_da_matriz, empresa, valor_estimado, valor_negociado, observacao) on public.negociacoes to authenticated;
grant update (titulo, coluna, tipo, atividades, fora_da_matriz, empresa, valor_estimado, valor_negociado, observacao, contratacao_id) on public.negociacoes to authenticated;

-- As políticas abaixo chamam app.pode_na_obra como a própria pessoa (regra da fase 7: só fica executável o que a RLS usa).
grant execute on function app.pode_na_obra(uuid) to authenticated;

create policy negociacoes_ler on public.negociacoes for select to authenticated using ((select app.pode_ver_obra(obra_id)));
create policy negociacoes_incluir on public.negociacoes for insert to authenticated
  with check ((select app.pode_na_obra(obra_id)) and coluna <> 'contratacao_aberta' and contratacao_id is null);
create policy negociacoes_alterar on public.negociacoes for update to authenticated
  using ((select app.pode_na_obra(obra_id))) with check ((select app.pode_na_obra(obra_id)));
create policy negociacoes_excluir on public.negociacoes for delete to authenticated
  using ((select app.pode_na_obra(obra_id)) and coluna <> 'contratacao_aberta');

-- Regras que a política não alcança: criado_por e obra não mudam; contratação só da mesma obra, e prende o cartão em "Contratação aberta".
create function app.negociacoes_conferir() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  if tg_op = 'INSERT' then
    new.criado_por := auth.uid();
    new.criado_em := now();
    new.movido_em := now();
    return new;
  end if;
  if new.obra_id <> old.obra_id or new.criado_por <> old.criado_por then
    raise exception 'Não é possível trocar a obra ou o autor do item.' using errcode = '42501';
  end if;
  if old.contratacao_id is not null and new.contratacao_id is distinct from old.contratacao_id then
    raise exception 'O item já virou contratação.' using errcode = 'P0001';
  end if;
  if old.coluna = 'contratacao_aberta' and new.coluna <> old.coluna then
    raise exception 'O item já virou contratação.' using errcode = 'P0001';
  end if;
  if new.contratacao_id is not null then
    if not exists (select 1 from public.contratacoes where id = new.contratacao_id and obra_id = new.obra_id) then
      raise exception 'Contratação de outra obra.' using errcode = 'P0001';
    end if;
    new.coluna := 'contratacao_aberta';
  elsif new.coluna = 'contratacao_aberta' then
    raise exception 'Para virar contratação, abra a contratação pelo item.' using errcode = 'P0001';
  end if;
  if new.coluna <> old.coluna then new.movido_em := now(); end if;
  return new;
end $$;
revoke all on function app.negociacoes_conferir() from public, anon, authenticated;
create trigger negociacoes_conferir before insert or update on public.negociacoes
  for each row execute function app.negociacoes_conferir();
