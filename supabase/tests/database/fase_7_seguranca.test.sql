-- Fase 7: revisão de segurança do conjunto. Vigia o que não pode voltar a acontecer nas próximas migrations.
begin;
create extension if not exists pgtap with schema extensions;
select plan(18);

-- Toda tabela do schema public tem RLS ligada
select is((select string_agg(c.relname, ', ') from pg_class c where c.relnamespace = 'public'::regnamespace and c.relkind = 'r' and not c.relrowsecurity), null, 'Toda tabela do schema public tem RLS ligada');

-- Função SECURITY DEFINER sempre com search_path fixo
select is((
  select string_agg(n.nspname || '.' || p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prosecdef
    and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
), null, 'Toda função SECURITY DEFINER tem search_path fixo');

-- Visitante sem login não executa nenhuma função
select is((
  select string_agg(n.nspname || '.' || p.proname, ', ') from pg_proc p join pg_namespace n on n.oid = p.pronamespace
  where n.nspname in ('public', 'app') and p.prokind = 'f' and has_function_privilege('anon', p.oid, 'execute')
    and not exists (select 1 from pg_depend d where d.objid = p.oid and d.deptype = 'e')
), null, 'Visitante sem login não executa função do sistema');

-- Funções do schema app que o usuário logado pode executar: só as que as políticas chamam como a própria pessoa
select is((
  select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
  where p.pronamespace = 'app'::regnamespace and has_function_privilege('authenticated', p.oid, 'execute')
    and p.proname <> all (array['aal2', 'admin_verificado', 'caminho_arquivo_valido', 'exigir_caminho_valido', 'pode_abrir_documento', 'pode_gerir_terceiros',
      'pode_ver_financeiro', 'pode_ver_obra', 'rh_verificado', 'sem_acento', 'sst_verificado', 'tem_papel', 'tem_papel_financeiro', 'tocar_updated_at', 'usuario_externo_da_empresa', 'usuario_interno_ativo'])
), null, 'Só as funções de política ficam executáveis pelo usuário logado no schema app');

-- Funções internas fechadas de propósito
select ok(not has_function_privilege('authenticated', 'app.ligar_fornecedor(uuid)', 'execute'), 'ligar_fornecedor fechada para o usuário logado');
select ok(not has_function_privilege('authenticated', 'app.liberar_etapas(uuid)', 'execute'), 'liberar_etapas fechada para o usuário logado');
select ok(not has_function_privilege('authenticated', 'app.exigir_etapa_em_andamento(uuid, smallint)', 'execute'), 'exigir_etapa_em_andamento fechada para o usuário logado');
select ok(not has_function_privilege('authenticated', 'app.recuar_para_etapa(uuid, smallint, smallint, text, text)', 'execute'), 'recuar_para_etapa fechada para o usuário logado');
select ok(not has_function_privilege('authenticated', 'app.avisar(uuid[], text, text, text, uuid, text)', 'execute'), 'avisar fechada para o usuário logado');
select ok(not has_function_privilege('authenticated', 'public.gerar_aviso_prazo(uuid, smallint, text, date)', 'execute'), 'gerar_aviso_prazo só para o servidor');
select ok(not has_function_privilege('authenticated', 'public.consumir_limite(text, int, int)', 'execute'), 'consumir_limite só para o servidor');
select ok(not has_function_privilege('authenticated', 'public.reservar_notificacoes(int, int)', 'execute'), 'reservar_notificacoes só para o servidor');

-- Tabelas novas: o usuário logado só lê; quem grava são as funções (SECURITY DEFINER)
select is((
  select string_agg(t.nome || ':' || pr.privilegio, ', ') from (values
    ('matriz_contratacao'), ('calendario_suprimentos'), ('planejamento_itens'), ('cronograma_pacotes'),
    ('avisos_internos'), ('preferencias_aviso'), ('contratacao_devolucoes')
  ) as t(nome)
  cross join (values ('insert'), ('update'), ('delete')) as pr(privilegio)
  where has_table_privilege('authenticated', 'public.' || t.nome, pr.privilegio)
), null, 'O usuário logado não grava direto nas tabelas das fases 1 a 6');
select is((
  select string_agg(t.nome, ', ') from (values
    ('matriz_contratacao'), ('calendario_suprimentos'), ('planejamento_itens'), ('cronograma_pacotes'),
    ('avisos_internos'), ('preferencias_aviso'), ('contratacao_devolucoes')
  ) as t(nome) where has_table_privilege('anon', 'public.' || t.nome, 'select')
), null, 'Visitante sem login não lê as tabelas das fases 1 a 6');

-- As funções públicas das fases 1 a 6 que mexem em dados conferem quem chama (todas SECURITY DEFINER com permissão só para logado)
select is((
  select string_agg(p.proname, ', ' order by p.proname) from pg_proc p
  where p.pronamespace = 'public'::regnamespace and p.proname = any(array[
    'abrir_contratacao', 'cancelar_contratacao', 'autorizar_contratacao', 'devolver_etapa', 'reabrir_etapa', 'marcar_urgencia', 'marcar_avisos_lidos',
    'salvar_preferencias_aviso', 'definir_fornecedor_aditivo', 'definir_destino_aditivo', 'salvar_calendario', 'importar_planejamento', 'importar_cronograma',
    'editar_planejamento_item', 'concluir_etapa', 'salvar_condicoes_gerente'])
    and (not p.prosecdef or not has_function_privilege('authenticated', p.oid, 'execute') or has_function_privilege('anon', p.oid, 'execute'))
), null, 'As funções das fases 1 a 6 são SECURITY DEFINER, abertas ao usuário logado e fechadas ao visitante');

-- Cada pessoa só lê os próprios avisos e preferências (a política olha o dono)
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'avisos_internos' and qual like '%usuario_id%auth.uid()%'), 1, 'Política de avisos olha o dono');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'preferencias_aviso' and qual like '%usuario_id%auth.uid()%'), 1, 'Política de preferências olha o dono');
select is((select count(*)::int from pg_policies where schemaname = 'public' and tablename = 'planejamento_itens' and qual like '%pode_ver_obra%'), 1, 'Planilha segue a regra de quem vê a obra');

select * from finish();
rollback;
