-- Dados de DEMONSTRAÇÃO do Nexo: uma obra, 3 empresas, pessoas e contratações em várias situações,
-- para cada área ver a própria tela "cheia". Tudo leva "(demo)" ou "[Demo]" no nome.
-- Roda numa transação só e apaga a demonstração anterior antes (pode rodar de novo).
-- Os arquivos de documento são só registros: não há PDF de verdade, então "Abrir arquivo" não abre.
--
-- Uso:   npx supabase db query --remote --yes -f supabase/demo/criar-demo.sql
-- Apagar: npx supabase db query --remote --yes -f supabase/demo/apagar-demo.sql
--
-- Rode antes o scripts/usuarios-teste.mjs para os coordenadores de teste enxergarem a obra demo.

begin;

-- 0) Limpa a demonstração anterior --------------------------------------------------------------
delete from public.contratacoes where obra_id in (select id from public.obras where codigo = 'DEMO-01');
delete from public.empresas_terceiras where cnpj in ('98765431000143', '98765432000198', '98765433000132');
delete from public.pessoas where cpf in ('90000001147', '90000001228', '90000001309', '90000001490', '90000001570', '90000001651', '90000001732', '90000001813', '90000001902', '90000002038');
delete from public.obras where codigo = 'DEMO-01';

-- Funções temporárias (somem no fim da sessão) ---------------------------------------------------
create function pg_temp.demo_doc(
  p_empresa uuid, p_vinculo uuid, p_tipo text, p_situacao text, p_autor uuid,
  p_emissao date default null, p_validade date default null, p_motivo text default null
) returns uuid language plpgsql as $$
declare
  v_doc uuid;
  v_arq uuid;
  v_path text;
  v_regra text;
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
begin
  select regra_validade::text into v_regra from public.tipos_documento where codigo = p_tipo;
  insert into public.documentos (tipo_documento, empresa_id, vinculo_id, competencia, situacao, data_emissao, data_validade, valor_texto, motivo_reprovacao, analisado_em)
  values (
    p_tipo, p_empresa, p_vinculo,
    case when v_regra = 'mensal' then date_trunc('month', v_hoje)::date end,
    p_situacao::public.situacao_documento,
    case when v_regra = 'meses_apos_emissao' then coalesce(p_emissao, v_hoje - 60) end,
    case when v_regra = 'data_informada' then coalesce(p_validade, v_hoje + 300) end,
    case when p_tipo = 'contabilidade' then 'Contabilidade Exemplo (demo) · (49) 3300-0000' end,
    p_motivo,
    case when p_situacao in ('aprovado', 'reprovado', 'vencido') then now() - interval '2 days' end
  ) returning id into v_doc;
  v_path := 'empresas/' || p_empresa
    || case when p_vinculo is null then '/empresa/' || p_tipo else '/vinculos/' || p_vinculo || '/' || p_tipo end
    || '/' || gen_random_uuid() || '.pdf';
  insert into public.documento_arquivos (documento_id, storage_path, nome_original, mime, tamanho, sha256, enviado_por)
  values (v_doc, v_path, p_tipo || '-demo.pdf', 'application/pdf', 2048, encode(extensions.digest(v_path, 'sha256'), 'hex'), p_autor)
  returning id into v_arq;
  update public.documentos set arquivo_atual_id = v_arq where id = v_doc;
  return v_doc;
end $$;

-- Pessoa (funcionário) com os 11 documentos; p_aso sobrescreve a situação do ASO.
create function pg_temp.demo_pessoa(
  p_empresa uuid, p_obra uuid, p_autor uuid, p_cpf text, p_nome text, p_funcao text,
  p_alocacao text, p_docs text, p_integracao date default null, p_liberado timestamptz default null,
  p_aso text default null, p_aso_emissao date default null, p_motivo text default null
) returns uuid language plpgsql as $$
declare
  v_pessoa uuid;
  v_vinculo uuid;
  t text;
begin
  insert into public.pessoas (cpf, nome, telefone) values (p_cpf, p_nome, '(49) 99999-0000') returning id into v_pessoa;
  insert into public.vinculos (pessoa_id, empresa_id, tipo, funcao) values (v_pessoa, p_empresa, 'funcionario', p_funcao) returning id into v_vinculo;
  insert into public.alocacoes (vinculo_id, obra_id, situacao, integracao_data, liberado_em, bloqueio_motivo)
  values (v_vinculo, p_obra, p_alocacao::public.situacao_alocacao, p_integracao, p_liberado,
          case when p_alocacao = 'bloqueado' then 'ASO vencido' end);
  if p_docs is not null then
    foreach t in array array['aso', 'rg_cnh', 'contrato_trabalho', 'esocial', 'ficha_registro', 'ordem_servico', 'ficha_epi', 'nr06', 'nr12', 'nr18', 'nr35'] loop
      perform pg_temp.demo_doc(p_empresa, v_vinculo, t,
        case when t = 'aso' and p_aso is not null then p_aso else p_docs end, p_autor,
        case when t = 'aso' then p_aso_emissao end, null,
        case when t = 'aso' then p_motivo end);
    end loop;
  end if;
  return v_vinculo;
end $$;

-- Envio aberto para o RH (empresa: p_vinculo nulo).
create function pg_temp.demo_envio(p_empresa uuid, p_vinculo uuid, p_autor uuid, p_quando timestamptz) returns void language plpgsql as $$
declare v_envio uuid;
begin
  insert into public.envios_analise (empresa_id, vinculo_id, enviado_em, enviado_por) values (p_empresa, p_vinculo, p_quando, p_autor) returning id into v_envio;
  insert into public.envio_itens (envio_id, documento_id, arquivo_id)
  select v_envio, d.id, d.arquivo_atual_id from public.documentos d
  where d.empresa_id = p_empresa and d.vinculo_id is not distinct from p_vinculo and d.situacao = 'enviado';
end $$;

-- Contratação com as 12 etapas. p_etapas: 12 letras, uma por etapa (c concluída, s pulada, a em andamento, p pendente).
create function pg_temp.demo_contratacao(
  p_obra uuid, p_autor uuid, p_codigo text, p_servico text, p_tipo text, p_negociacao text, p_orcado numeric,
  p_etapas text, p_dias_parada int, p_situacao text default 'em_andamento',
  p_fornecedor text default null, p_cnpj text default null, p_final numeric default null, p_empresa uuid default null
) returns uuid language plpgsql as $$
declare
  v_id uuid;
  i int;
  s char;
begin
  insert into public.contratacoes (codigo, obra_id, servico, valor_orcado, tipo, negociacao, situacao, prazos, limite_obra, criado_por,
                                   fornecedor_nome, fornecedor_cnpj, valor_negociado, empresa_id, sienge_solicitacao, created_at)
  values (p_codigo, p_obra, p_servico, p_orcado, p_tipo::public.tipo_contratacao, p_negociacao, p_situacao::public.situacao_contratacao,
          coalesce((select valor from public.parametros where chave = 'prazos_etapas'), '{}'), 4000, p_autor,
          p_fornecedor, p_cnpj, p_final, p_empresa,
          case when substr(p_etapas, 4, 1) in ('c', 's') then '15' || substr(p_codigo, 9, 2) end,
          now() - make_interval(days => p_dias_parada + 10))
  returning id into v_id;
  for i in 1..12 loop
    s := substr(p_etapas, i, 1);
    insert into public.contratacao_etapas (contratacao_id, etapa, situacao, iniciada_em, concluida_em, concluida_por)
    values (v_id, i,
      case s when 'c' then 'concluida' when 's' then 'pulada' when 'a' then 'em_andamento' else 'pendente' end::public.situacao_etapa,
      case when s in ('c', 's') then now() - make_interval(days => p_dias_parada + 10 - i) when s = 'a' then now() - make_interval(days => p_dias_parada) end,
      case when s in ('c', 's') then now() - make_interval(days => p_dias_parada + 9 - i) end,
      case when s in ('c', 's') then p_autor end);
  end loop;
  -- Itens das etapas concluídas ficam marcados (o gatilho cria o checklist desmarcado).
  update public.etapa_checklist k set marcado = true, marcado_por = p_autor, marcado_em = now()
  from public.contratacao_etapas e
  where e.contratacao_id = v_id and k.contratacao_id = v_id and k.etapa = e.etapa and e.situacao in ('concluida', 'pulada');
  -- Cotações a partir da etapa 2 concluída.
  if substr(p_etapas, 2, 1) in ('c', 'a') then
    insert into public.cotacoes (contratacao_id, fornecedor, cnpj, valor, prazo_dias, escolhida)
    select v_id, f, c, v, 30, coalesce(p_cnpj = c, false)
    from (values
      (coalesce(p_fornecedor, 'Fornecedor A (demo)'), coalesce(p_cnpj, '98765433000132'), coalesce(p_final, 98000) * 1.04),
      ('Fornecedor B (demo)', '11222333000181', coalesce(p_final, 98000) * 1.12),
      ('Fornecedor C (demo)', '11444777000161', coalesce(p_final, 98000) * 1.20)
    ) as x(f, c, v)
    where substr(p_etapas, 2, 1) = 'c' or c <> '11444777000161'; -- etapa 2 em andamento: só 2 das 3 cotações
  end if;
  return v_id;
end $$;

-- 1) Dados --------------------------------------------------------------------------------------
do $$
declare
  v_hoje date := (now() at time zone 'America/Sao_Paulo')::date;
  v_obra uuid;
  v_alfa uuid;
  v_beta uuid;
  v_gama uuid;
  v_ext uuid := coalesce(
    (select id from public.usuarios where email = 'empresa.teste@example.com'),
    (select id from public.usuarios where tipo = 'externo' order by created_at limit 1),
    (select id from public.usuarios order by created_at limit 1));
  v_int uuid := coalesce(
    (select id from public.usuarios where email = 'coordenador.teste@example.com'),
    (select u.id from public.usuarios u join public.usuario_papeis p on p.usuario_id = u.id where p.papel = 'coordenador_obra' order by u.created_at limit 1),
    (select id from public.usuarios where tipo = 'interno' order by created_at limit 1));
  v_vinc uuid;
  v_ct uuid;
  t text;
begin
  if v_int is null then raise exception 'Nenhum usuário interno cadastrado.'; end if;

  insert into public.obras (codigo, nome, cidade, uf) values ('DEMO-01', 'Obra Demonstração', 'Chapecó', 'SC') returning id into v_obra;
  -- Coordenadores de obra enxergam a obra demo.
  insert into public.usuario_obras (usuario_id, obra_id)
  select distinct usuario_id, v_obra from public.usuario_papeis where papel = 'coordenador_obra';

  -- Empresa ALFA: documentos da empresa enviados, esperando o RH (há 1 dia) ------------------------
  insert into public.empresas_terceiras (cnpj, razao_social, email, telefone, situacao)
  values ('98765431000143', 'Alfa Elétrica (demo)', 'contato@alfa-demo.example.com', '(49) 3300-1111', 'em_analise') returning id into v_alfa;
  insert into public.empresa_obras (empresa_id, obra_id) values (v_alfa, v_obra);
  foreach t in array array['cnd_federal', 'fgts', 'inss', 'contabilidade', 'pcmso', 'pgr', 'ltcat'] loop
    perform pg_temp.demo_doc(v_alfa, null, t, 'enviado', v_ext);
  end loop;
  perform pg_temp.demo_envio(v_alfa, null, v_ext, now() - interval '1 day');
  -- Um eletricista da Alfa com documentos enviados há 4 dias (fora do prazo do RH).
  v_vinc := pg_temp.demo_pessoa(v_alfa, v_obra, v_ext, '90000001147', 'Lucas Eletricista (demo)', 'Eletricista', 'em_analise', 'enviado');
  perform pg_temp.demo_envio(v_alfa, v_vinc, v_ext, now() - interval '4 days');

  -- Empresa BETA: aprovada, equipe em todas as situações ------------------------------------------
  insert into public.empresas_terceiras (cnpj, razao_social, email, telefone, situacao)
  values ('98765432000198', 'Beta Construções (demo)', 'contato@beta-demo.example.com', '(49) 3300-2222', 'aprovada') returning id into v_beta;
  insert into public.empresa_obras (empresa_id, obra_id) values (v_beta, v_obra);
  foreach t in array array['cnd_federal', 'fgts', 'inss', 'contabilidade', 'pgr', 'ltcat'] loop
    perform pg_temp.demo_doc(v_beta, null, t, 'aprovado', v_ext);
  end loop;
  perform pg_temp.demo_doc(v_beta, null, 'pcmso', 'aprovado', v_ext, null, v_hoje + 20); -- vence em 20 dias

  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001228', 'Ana Liberada (demo)', 'Pedreira', 'liberado', 'aprovado', null, now() - interval '5 days');
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001309', 'Bruno Integração Hoje (demo)', 'Servente', 'integracao_agendada', 'aprovado', v_hoje);
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001490', 'Carla Integração Amanhã (demo)', 'Carpinteira', 'integracao_agendada', 'aprovado', v_hoje + 1);
  v_vinc := pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001570', 'Diego Em Análise (demo)', 'Armador', 'em_analise', 'enviado');
  perform pg_temp.demo_envio(v_beta, v_vinc, v_ext, now());
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001651', 'Elisa Documento Devolvido (demo)', 'Pintora', 'pendente', 'aprovado', null, null,
                              'reprovado', null, 'ASO ilegível. Envie uma cópia nítida, com carimbo do médico.');
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001732', 'Fábio Bloqueado (demo)', 'Ajudante', 'bloqueado', 'aprovado', null, null,
                              'vencido', v_hoje - 400);
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001813', 'Gabi Em Cadastro (demo)', 'Eletricista', 'rascunho', null);
  perform pg_temp.demo_pessoa(v_beta, v_obra, v_ext, '90000001902', 'Hugo ASO Vence Logo (demo)', 'Encanador', 'liberado', 'aprovado', null, now() - interval '30 days',
                              'aprovado', v_hoje - 350);
  -- Sócio esporádico pedindo visita para amanhã.
  insert into public.pessoas (cpf, nome) values ('90000002038', 'Igor Sócio (demo)') returning id into v_vinc;
  insert into public.vinculos (pessoa_id, empresa_id, tipo, funcao) values (v_vinc, v_beta, 'socio_esporadico', 'Sócio') returning id into v_vinc;
  insert into public.visitas (vinculo_id, obra_id, data, documento_foto_path, documento_foto_nome, created_by)
  values (v_vinc, v_obra, v_hoje + 1, 'empresas/' || v_beta || '/vinculos/' || v_vinc || '/visita/' || gen_random_uuid() || '.jpg', 'cnh-demo.jpg', v_ext);

  -- Empresa GAMA: convidada, ainda sem documentos ------------------------------------------------
  insert into public.empresas_terceiras (cnpj, razao_social, email, situacao)
  values ('98765433000132', 'Gama Pinturas (demo)', 'contato@gama-demo.example.com', 'convidada') returning id into v_gama;
  insert into public.empresa_obras (empresa_id, obra_id) values (v_gama, v_obra);

  -- 2) Contratações, uma em cada fase ------------------------------------------------------------
  -- Obra: cotação em andamento (2 de 3 cotações).
  perform pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-01', '[Demo] Pintura das fachadas', 'contrato', 'obra', 180000, 'capppppppppp', 2);
  -- Suprimentos: validar e negociar, parada há 6 dias (atrasada).
  perform pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-02', '[Demo] Impermeabilização das lajes', 'contrato', 'suprimentos', 95000, 'ccscappppppp', 6);
  -- Gerente de suprimentos: autorizar, fornecedor novo (Gama).
  perform pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-03', '[Demo] Pintura interna das áreas comuns', 'contrato', 'suprimentos', 60000, 'ccsccapppppp', 1,
                                   'em_andamento', 'Gama Pinturas (demo)', '98765433000132', 57500, v_gama);
  update public.contratacoes set fornecedor_email = 'contato@gama-demo.example.com' where codigo = 'CT-DEMO-03';
  -- Contratos: contrato no Sienge, com a documentação do RH em paralelo.
  perform pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-04', '[Demo] Instalações elétricas da torre B', 'contrato', 'suprimentos', 240000, 'ccscccappapp', 2,
                                   'em_andamento', 'Alfa Elétrica (demo)', '98765431000143', 231000, v_alfa);
  -- Assinaturas: o coordenador já assinou, é a vez de Suprimentos; RH conferindo a equipe.
  v_ct := pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-05', '[Demo] Estrutura de concreto do bloco 2', 'contrato', 'suprimentos', 520000, 'ccsccccca' || 'app', 1,
                                   'em_andamento', 'Beta Construções (demo)', '98765432000198', 498000, v_beta);
  insert into public.assinaturas (contratacao_id, ordem, assinado_por) values (v_ct, 1, v_int);
  update public.contratacoes set sienge_contrato = 'CT/DM0005' where id = v_ct;
  -- Liberada para a obra.
  v_ct := pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-06', '[Demo] Alvenaria de vedação', 'contrato', 'obra', 3500, 'cccccccccccc', 0,
                                   'liberada', 'Beta Construções (demo)', '98765432000198', 3400, v_beta);
  insert into public.assinaturas (contratacao_id, ordem, assinado_por) select v_ct, ordem, v_int from public.assinantes_fluxo;
  update public.contratacoes set sienge_contrato = 'CT/DM0006' where id = v_ct;
  -- Cancelada.
  perform pg_temp.demo_contratacao(v_obra, v_int, 'CT-DEMO-07', '[Demo] Paisagismo (cancelada)', 'unico', 'obra', 2800, 'capppppppppp', 3, 'cancelada');
  update public.contratacoes set cancelamento_motivo = 'Serviço retirado do escopo (demo).' where codigo = 'CT-DEMO-07';
end $$;

commit;
