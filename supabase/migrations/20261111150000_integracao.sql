-- F4: integração de segurança (presença/falta) e liberação por obra.

create function app.sst_verificado() returns boolean
language sql stable set search_path = '' as $$
  select app.tem_papel('sst') and app.aal2()
$$;
revoke all on function app.sst_verificado() from public;
grant execute on function app.sst_verificado() to authenticated;

-- Presença: libera a pessoa para a obra. Falta: remarca para a nova data (calculada no servidor).
create function public.registrar_integracao(p_alocacao uuid, p_presente boolean, p_nova_data date, p_assunto text, p_texto text) returns void
language plpgsql security definer set search_path = '' as $$
declare
  v_empresa uuid;
  v_email text;
begin
  if not app.sst_verificado() then
    raise exception 'Só a segurança do trabalho, com verificação em duas etapas, registra a integração.' using errcode = '42501';
  end if;
  if not p_presente and (p_nova_data is null or p_nova_data <= (now() at time zone 'America/Sao_Paulo')::date) then
    raise exception 'Nova data inválida.' using errcode = 'P0001';
  end if;

  update public.alocacoes set
    situacao = case when p_presente then 'liberado' else 'integracao_agendada' end::public.situacao_alocacao,
    liberado_em = case when p_presente then now() end,
    integracao_data = case when p_presente then integracao_data else p_nova_data end
  where id = p_alocacao and situacao = 'integracao_agendada'
  returning app.empresa_do_vinculo(vinculo_id) into v_empresa;
  if v_empresa is null then
    raise exception 'Pessoa não está agendada para integração.' using errcode = 'P0001';
  end if;

  select email into v_email from public.empresas_terceiras where id = v_empresa;
  insert into public.notificacoes (empresa_id, destinatario, assunto, texto) values (v_empresa, v_email, left(p_assunto, 200), left(p_texto, 4000));
end $$;

revoke all on function public.registrar_integracao(uuid, boolean, date, text, text) from public, anon;
grant execute on function public.registrar_integracao(uuid, boolean, date, text, text) to authenticated;
