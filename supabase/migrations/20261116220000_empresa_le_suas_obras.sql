-- Portal: a empresa terceirizada não conseguia ler o nome das obras liberadas para ela
-- (a política de obras só deixava usuários internos), e a lista "Obra" vinha em branco
-- ao adicionar pessoa (caso Plumber, 16/11/2026). Agora ela lê só as obras ligadas a ela.

create policy obras_ler_empresa on public.obras for select to authenticated
  using (exists (
    select 1 from public.empresa_obras eo
    where eo.obra_id = obras.id and eo.ativo and app.usuario_externo_da_empresa(eo.empresa_id)
  ));
