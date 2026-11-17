-- migration: 20261117120000_catalogo_entrada_mensal.sql
-- Catálogo do procedimento rev. 02: etapa (entrada/mensal), responsável (RH/SST) e documentos novos.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

select is(
  (select array_agg(tipo_documento order by tipo_documento) from public.matriz_documental
    where aplica_a = 'empresa' and ativo and tipo_documento in ('cnd_municipal', 'cnd_estadual', 'cnd_trabalhista', 'crf_fgts', 'contrato_social', 'cartao_cnpj')),
  array['cartao_cnpj', 'cnd_estadual', 'cnd_municipal', 'cnd_trabalhista', 'contrato_social', 'crf_fgts'],
  'a empresa passa a entregar as CNDs, CRF, contrato social e cartão CNPJ'
);
select ok(
  (select bool_and(ativo) from public.matriz_documental where tipo_documento = 'carteira_vacina' and aplica_a in ('funcionario', 'socio_diario')),
  'funcionário e sócio diário entregam a carteira de vacinas'
);
select is((select sensivel from public.tipos_documento where codigo = 'carteira_vacina'), true, 'carteira de vacinas é dado de saúde');
select is((select count(*)::int from public.tipos_documento where regra_validade = 'mensal' and etapa <> 'mensal'), 0, 'todo tipo mensal fica na etapa mensal');
select is((select etapa from public.tipos_documento where codigo = 'aso'), 'entrada', 'ASO é da entrada');
select is(
  (select array_agg(distinct responsavel) from public.tipos_documento where codigo in ('aso', 'nr35', 'ficha_epi', 'pgr', 'ficha_epi_mensal', 'carteira_vacina')),
  array['sst'],
  'saúde e segurança ficam com a SST'
);
select is(
  (select array_agg(distinct responsavel) from public.tipos_documento where codigo in ('cnd_federal', 'esocial', 'rg_cnh', 'fgts_guia', 'dctfweb', 'cartao_ponto')),
  array['rh'],
  'fiscais, trabalhistas e cadastrais ficam com o RH'
);
select is(
  (select count(*)::int from public.matriz_documental m join public.tipos_documento t on t.codigo = m.tipo_documento
    where m.ativo and t.etapa = 'mensal' and t.codigo not in ('fgts_guia', 'fgts_comprovante', 'inss_guia', 'inss_comprovante')),
  0,
  'mensais novos só entram na matriz quando a etapa mensal existir'
);
select throws_ok(
  $$update public.tipos_documento set responsavel = 'financeiro' where codigo = 'aso'$$,
  '23514', null, 'responsável só pode ser RH ou SST'
);
select throws_ok(
  $$update public.tipos_documento set etapa = 'anual' where codigo = 'aso'$$,
  '23514', null, 'etapa só pode ser entrada ou mensal'
);

select * from finish();
rollback;
