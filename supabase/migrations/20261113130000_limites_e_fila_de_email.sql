-- Revisão de segurança, lote 2:
-- 1) limite de tentativas (login e recuperação de senha), contado no banco para valer entre instâncias serverless;
-- 2) fila de e-mails com reserva atômica (sem envio duplicado) e recuperação de reservas esquecidas.

-- 1) Limite de tentativas ------------------------------------------------------------------
-- A chave já chega com hash (nunca guardamos IP nem e-mail em claro). Janela fixa.
create table public.limites_tentativas (
  chave text not null,
  janela timestamptz not null,
  contagem int not null default 1 check (contagem > 0),
  primary key (chave, janela)
);
alter table public.limites_tentativas enable row level security; -- sem políticas: só o service_role acessa
revoke all on public.limites_tentativas from anon, authenticated;
create index limites_tentativas_janela_idx on public.limites_tentativas (janela);

-- Conta mais uma tentativa e diz se ainda está dentro do limite.
create function public.consumir_limite(p_chave text, p_max int, p_janela_seg int) returns boolean
language plpgsql security definer set search_path = '' as $$
declare
  v_janela timestamptz;
  v_conta int;
begin
  if p_chave is null or length(p_chave) > 200 or p_max < 1 or p_janela_seg < 1 then
    raise exception 'Parâmetros inválidos.' using errcode = '22023';
  end if;
  v_janela := to_timestamp(floor(extract(epoch from now()) / p_janela_seg) * p_janela_seg);
  insert into public.limites_tentativas as l (chave, janela) values (p_chave, v_janela)
  on conflict (chave, janela) do update set contagem = l.contagem + 1
  returning l.contagem into v_conta;
  -- Limpeza ocasional das janelas antigas.
  if random() < 0.02 then
    delete from public.limites_tentativas where janela < now() - interval '1 day';
  end if;
  return v_conta <= p_max;
end $$;
revoke all on function public.consumir_limite(text, int, int) from public, anon, authenticated;
grant execute on function public.consumir_limite(text, int, int) to service_role;

-- 2) Fila de e-mails --------------------------------------------------------------------------
alter type public.situacao_notificacao add value if not exists 'enviando';
alter table public.notificacoes add column reservado_em timestamptz;

-- Reserva (atomicamente) os próximos avisos a enviar. Dois processos ao mesmo tempo nunca pegam o mesmo aviso.
-- A tentativa é contada na reserva: se o processo cair no meio, o aviso volta à fila depois de 10 minutos
-- e, depois de p_max_tentativas, deixa de ser reenviado.
create function public.reservar_notificacoes(p_limite int, p_max_tentativas int default 5) returns setof public.notificacoes
language plpgsql security definer set search_path = '' as $$
begin
  return query
  with alvo as (
    select id from public.notificacoes
    where tentativas < p_max_tentativas
      and (situacao in ('pendente', 'erro') or (situacao = 'enviando' and reservado_em < now() - interval '10 minutes'))
    order by criado_em
    limit greatest(p_limite, 0)
    for update skip locked
  )
  update public.notificacoes n
  set situacao = 'enviando', reservado_em = now(), tentativas = n.tentativas + 1
  from alvo
  where n.id = alvo.id
  returning n.*;
end $$;
revoke all on function public.reservar_notificacoes(int, int) from public, anon, authenticated;
grant execute on function public.reservar_notificacoes(int, int) to service_role;
