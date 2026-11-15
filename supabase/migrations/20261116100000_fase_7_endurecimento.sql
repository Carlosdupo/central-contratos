-- Fase 7: endurecimento do schema app (revisão de segurança das fases 1 a 6). Só tira permissões; nenhum dado muda.
--
-- Os "grant execute on all functions in schema app to authenticated" das primeiras migrations deixaram muitas funções internas
-- executáveis por qualquer usuário logado. O schema app não é exposto pela API (config.toml: schemas = public, graphql_public),
-- então não havia como chamá-las pela internet, mas a regra certa é o mínimo: só ficam para "authenticated" as funções que as
-- políticas de RLS (ou outras funções de quem consulta) chamam como a própria pessoa. As demais rodam só dentro de funções
-- SECURITY DEFINER e de gatilhos, que não pedem essa permissão.

do $$
declare
  f record;
begin
  for f in
    select p.oid::regprocedure as assinatura
    from pg_proc p
    where p.pronamespace = 'app'::regnamespace
      and p.proname in (
        'liberar_etapas', 'exigir_etapa_em_andamento', 'conferir_codigo_sienge', 'criar_checklist_da_etapa', 'criar_usuario_do_auth',
        'auditar', 'proteger_ultimo_admin_papel', 'proteger_ultimo_admin_usuario', 'existe_outro_admin', 'empresa_do_vinculo',
        'validade_documento', 'tocar_parametro', 'pode_agir_como', 'pode_agir_na_etapa', 'pode_na_obra'
      )
  loop
    execute format('revoke all on function %s from public, anon, authenticated', f.assinatura);
  end loop;
end $$;

-- A matriz de contratação (fase 1B) só tinha RLS sem política de escrita: nada gravava, mas a permissão da tabela era larga.
-- Agora a tabela também não dá permissão de escrita ao usuário logado nem leitura ao visitante.
revoke insert, update, delete, truncate on public.matriz_contratacao from authenticated;
revoke all on public.matriz_contratacao from anon;
