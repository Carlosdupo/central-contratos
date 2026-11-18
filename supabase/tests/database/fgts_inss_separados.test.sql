-- FGTS e INSS separados em guia e comprovante; envios antigos viram guia.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is(
  (select array_agg(tipo_documento order by tipo_documento) from public.matriz_documental
    where aplica_a = 'empresa' and ativo and (tipo_documento like 'fgts%' or tipo_documento like 'inss%') and tipo_documento <> 'fgts_digital_alocacao'),
  array['fgts_comprovante', 'fgts_guia', 'inss_comprovante', 'inss_guia'],
  'a matriz da empresa pede guia e comprovante de FGTS e INSS'
);
select is((select count(*)::int from public.tipos_documento where codigo in ('fgts', 'inss') and ativo), 0, 'tipos antigos ficam inativos');
select is((select count(*)::int from public.tipos_documento where codigo in ('fgts', 'inss')), 2, 'tipos antigos continuam no catálogo (histórico)');
select is((select regra_validade::text from public.tipos_documento where codigo = 'fgts_comprovante'), 'mensal', 'comprovante é mensal');
select is((select count(*)::int from public.documentos where tipo_documento in ('fgts', 'inss')), 0, 'nenhum documento ficou no tipo antigo');
select is((select nome from public.tipos_documento where codigo = 'inss_guia'), 'INSS: guia', 'nome da guia do INSS');

select * from finish();
rollback;
