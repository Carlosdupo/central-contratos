-- Revisão de segurança/desempenho, lote 2: RLS mais barata.
-- 1) As funções sem argumento usadas nas políticas (papel do usuário, auth.uid()) passam a ser chamadas
--    como (select ...). Assim o Postgres calcula uma vez por consulta (InitPlan) em vez de uma vez por linha.
--    O resultado é o mesmo: as funções são STABLE e dependem só da sessão. Só o texto das políticas muda.
-- 2) app.pode_ver_obra deixa de chamar tem_papel() seis vezes (cada uma com join) e faz uma consulta só.

-- 2) Mesma regra de antes, numa consulta só:
--    interno ativo E (admin com 2FA, ou RH/SST/suprimentos/gerente/contratos/direção, ou coordenador da obra).
create or replace function app.pode_ver_obra(p_obra uuid) returns boolean
language sql stable security definer set search_path = '' as $$
  select exists (
    select 1
    from public.usuarios u
    join public.usuario_papeis up on up.usuario_id = u.id
    where u.id = (select auth.uid()) and u.ativo and u.tipo = 'interno'
      and (
        up.papel in ('suprimentos', 'gerente_suprimentos', 'contratos', 'direcao', 'rh', 'sst')
        or (up.papel = 'admin' and app.aal2())
        or (up.papel = 'coordenador_obra' and exists (
              select 1 from public.usuario_obras uo where uo.usuario_id = u.id and uo.obra_id = p_obra))
      )
  )
$$;

-- 1) Políticas (texto idêntico ao anterior, só com as chamadas sem argumento dentro de select):

alter policy acessos_admin_ler on public.acessos_documentos
  using ((select app.admin_verificado()));

alter policy alocacoes_ler on public.alocacoes
  using (((select app.usuario_interno_ativo()) OR (EXISTS ( SELECT 1 FROM public.vinculos v WHERE ((v.id = alocacoes.vinculo_id) AND app.usuario_externo_da_empresa(v.empresa_id))))));

alter policy assinantes_ler on public.assinantes_fluxo
  using ((select app.usuario_interno_ativo()));

alter policy auditoria_admin_ler on public.auditoria
  using ((select app.admin_verificado()));

alter policy avisos_vencimento_admin on public.avisos_vencimento
  using ((select app.admin_verificado()));

alter policy documentos_ler on public.documentos
  using (((select app.usuario_interno_ativo()) OR app.usuario_externo_da_empresa(empresa_id)));

alter policy empresa_obras_alterar on public.empresa_obras
  using ((select app.pode_gerir_terceiros()))
  with check ((select app.pode_gerir_terceiros()));

alter policy empresa_obras_incluir on public.empresa_obras
  with check ((select app.pode_gerir_terceiros()));

alter policy empresa_obras_ler on public.empresa_obras
  using (((select app.usuario_interno_ativo()) OR app.usuario_externo_da_empresa(empresa_id)));

alter policy empresa_usuarios_excluir on public.empresa_usuarios
  using ((select app.pode_gerir_terceiros()));

alter policy empresa_usuarios_incluir on public.empresa_usuarios
  with check ((select app.pode_gerir_terceiros()));

alter policy empresa_usuarios_ler on public.empresa_usuarios
  using (((select app.usuario_interno_ativo()) OR (usuario_id = (select auth.uid()))));

alter policy empresas_alterar on public.empresas_terceiras
  using ((select app.pode_gerir_terceiros()))
  with check ((select app.pode_gerir_terceiros()));

alter policy empresas_incluir on public.empresas_terceiras
  with check ((select app.pode_gerir_terceiros()));

alter policy empresas_ler on public.empresas_terceiras
  using (((select app.usuario_interno_ativo()) OR app.usuario_externo_da_empresa(id)));

alter policy envio_itens_ler on public.envio_itens
  using (((select app.usuario_interno_ativo()) OR (EXISTS ( SELECT 1 FROM public.envios_analise e WHERE ((e.id = envio_itens.envio_id) AND app.usuario_externo_da_empresa(e.empresa_id))))));

alter policy envios_ler on public.envios_analise
  using (((select app.usuario_interno_ativo()) OR app.usuario_externo_da_empresa(empresa_id)));

alter policy etapas_fluxo_ler on public.etapas_fluxo
  using ((select app.usuario_interno_ativo()));

alter policy feriados_admin_alterar on public.feriados
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy feriados_admin_excluir on public.feriados
  using ((select app.admin_verificado()));

alter policy feriados_admin_incluir on public.feriados
  with check ((select app.admin_verificado()));

alter policy matriz_admin_alterar on public.matriz_documental
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy matriz_admin_incluir on public.matriz_documental
  with check ((select app.admin_verificado()));

alter policy notificacoes_ler on public.notificacoes
  using (((select app.admin_verificado()) OR (select app.rh_verificado()) OR app.usuario_externo_da_empresa(empresa_id)));

alter policy obra_eap_ler on public.obra_eap
  using ((select app.usuario_interno_ativo()));

alter policy obras_admin_alterar on public.obras
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy obras_admin_incluir on public.obras
  with check ((select app.admin_verificado()));

alter policy obras_ler on public.obras
  using ((select app.usuario_interno_ativo()));

alter policy parametros_admin_alterar on public.parametros
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy pessoas_ler on public.pessoas
  using (((select app.usuario_interno_ativo()) OR (EXISTS ( SELECT 1 FROM public.vinculos v WHERE ((v.pessoa_id = pessoas.id) AND app.usuario_externo_da_empresa(v.empresa_id))))));

alter policy tipos_documento_admin on public.tipos_documento
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy usuario_obras_admin_excluir on public.usuario_obras
  using ((select app.admin_verificado()));

alter policy usuario_obras_admin_incluir on public.usuario_obras
  with check ((select app.admin_verificado()));

alter policy usuario_obras_ler on public.usuario_obras
  using (((usuario_id = (select auth.uid())) OR (select app.admin_verificado())));

alter policy papeis_admin_excluir on public.usuario_papeis
  using ((select app.admin_verificado()));

alter policy papeis_admin_incluir on public.usuario_papeis
  with check ((select app.admin_verificado()));

alter policy papeis_ler on public.usuario_papeis
  using (((usuario_id = (select auth.uid())) OR (select app.admin_verificado())));

alter policy usuarios_admin_alterar on public.usuarios
  using ((select app.admin_verificado()))
  with check ((select app.admin_verificado()));

alter policy usuarios_ler on public.usuarios
  using (((id = (select auth.uid())) OR (select app.usuario_interno_ativo())));

alter policy vinculos_ler on public.vinculos
  using (((select app.usuario_interno_ativo()) OR app.usuario_externo_da_empresa(empresa_id)));

alter policy visitas_ler on public.visitas
  using (((select app.usuario_interno_ativo()) OR (EXISTS ( SELECT 1 FROM public.vinculos v WHERE ((v.id = visitas.vinculo_id) AND app.usuario_externo_da_empresa(v.empresa_id))))));
