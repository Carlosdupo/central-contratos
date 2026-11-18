-- Fase RH-3 (procedimento rev. 02): 3 dias úteis na 1ª análise, 2 na reapresentação de pendências,
-- integração só às segundas, quartas e sextas.

update public.parametros set valor = '{"dias": 3, "uteis": true}', descricao = 'Prazo para conferir o primeiro envio de documentos (RH e Segurança).'
where chave = 'prazo_analise_rh';

insert into public.parametros (chave, valor, descricao) values
  ('prazo_reapresentacao', '{"dias": 2, "uteis": true}', 'Prazo para conferir documentos reapresentados depois de pendência.'),
  ('dias_integracao', '[1, 3, 5]', 'Dias da semana com integração de segurança (1 = segunda ... 5 = sexta).')
on conflict (chave) do nothing;

update public.parametros set descricao = 'Aprovado até esta hora vale a partir do próximo dia útil; depois, do seguinte. A integração cai no primeiro dia de integração a partir daí.'
where chave = 'horario_corte_integracao';

-- Reapresentação: a última análise concluída da mesma empresa (ou da mesma pessoa) teve documento reprovado.
alter table public.envios_analise add column reapresentacao boolean not null default false;

create function app.envio_eh_reapresentacao(p_empresa uuid, p_vinculo uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select coalesce((
    select exists (select 1 from public.envio_itens i where i.envio_id = e.id and i.decisao = 'reprovado')
    from public.envios_analise e
    where e.empresa_id = p_empresa and e.vinculo_id is not distinct from p_vinculo and e.situacao = 'concluido'
    order by e.concluido_em desc
    limit 1
  ), false)
$$;

create function app.marcar_reapresentacao() returns trigger
language plpgsql security definer set search_path = '' as $$
begin
  new.reapresentacao := app.envio_eh_reapresentacao(new.empresa_id, new.vinculo_id);
  return new;
end $$;
create trigger marcar_reapresentacao before insert on public.envios_analise
  for each row execute function app.marcar_reapresentacao();

update public.envios_analise set reapresentacao = app.envio_eh_reapresentacao(empresa_id, vinculo_id) where situacao = 'aberto';

revoke execute on function app.envio_eh_reapresentacao(uuid, uuid), app.marcar_reapresentacao() from public, anon;
