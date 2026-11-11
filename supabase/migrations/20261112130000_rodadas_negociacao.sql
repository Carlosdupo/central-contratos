-- Rodadas de negociação: cada nova proposta de um fornecedor atualiza o valor da cotação
-- e guarda o valor anterior no histórico (1ª, 2ª, 3ª...). Nas etapas 3 (obra) e 5 (Suprimentos).

create table public.cotacao_propostas (
  id uuid primary key default gen_random_uuid(),
  cotacao_id uuid not null references public.cotacoes (id) on delete cascade,
  rodada smallint not null check (rodada >= 1),
  valor numeric(14, 2) not null check (valor > 0),
  created_at timestamptz not null default now(),
  created_by uuid references public.usuarios (id) default auth.uid(),
  unique (cotacao_id, rodada)
);
alter table public.cotacao_propostas enable row level security;
create policy cotacao_propostas_ler on public.cotacao_propostas for select to authenticated using (
  exists (select 1 from public.cotacoes q join public.contratacoes c on c.id = q.contratacao_id
          where q.id = cotacao_id and app.pode_ver_obra(c.obra_id))
);
create trigger auditar_cotacao_propostas after insert or update or delete on public.cotacao_propostas
  for each row execute function app.auditar();

create function public.nova_proposta(p_cotacao uuid, p_valor numeric) returns smallint
language plpgsql security definer set search_path = '' as $$
declare
  v_cot public.cotacoes;
  v_c public.contratacoes;
  v_etapa smallint;
  v_rodada smallint;
begin
  select * into v_cot from public.cotacoes where id = p_cotacao for update;
  if not found then raise exception 'Cotação não encontrada.' using errcode = 'P0001'; end if;
  select * into v_c from public.contratacoes where id = v_cot.contratacao_id;
  v_etapa := case when exists (
    select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = 3 and situacao = 'em_andamento'
  ) then 3 else 5 end;
  if not exists (select 1 from public.contratacao_etapas where contratacao_id = v_c.id and etapa = v_etapa and situacao = 'em_andamento') then
    raise exception 'Nova proposta só durante a negociação (etapa 3 ou 5).' using errcode = 'P0001';
  end if;
  perform app.exigir_etapa_em_andamento(v_c.id, v_etapa);
  if p_valor is null or p_valor <= 0 then raise exception 'Informe o valor da nova proposta.' using errcode = 'P0001'; end if;
  if p_valor = v_cot.valor then raise exception 'O valor é igual ao da proposta atual.' using errcode = 'P0001'; end if;
  -- A primeira rodada é o valor da cotação original.
  if not exists (select 1 from public.cotacao_propostas where cotacao_id = p_cotacao) then
    insert into public.cotacao_propostas (cotacao_id, rodada, valor, created_at, created_by)
    values (p_cotacao, 1, v_cot.valor, v_cot.created_at, v_cot.created_by);
  end if;
  select max(rodada) + 1 into v_rodada from public.cotacao_propostas where cotacao_id = p_cotacao;
  insert into public.cotacao_propostas (cotacao_id, rodada, valor) values (p_cotacao, v_rodada, p_valor);
  update public.cotacoes set valor = p_valor where id = p_cotacao;
  return v_rodada;
end $$;
revoke all on function public.nova_proposta(uuid, numeric) from public, anon;
grant execute on function public.nova_proposta(uuid, numeric) to authenticated;
