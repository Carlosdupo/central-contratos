-- FGTS e INSS passam a pedir dois arquivos cada: a guia e o comprovante de pagamento.
-- Os tipos antigos (fgts, inss) ficam inativos para manter o histórico; os documentos já
-- enviados viram "guia" (decisão do usuário em 16/11/2026: separar já, inclusive 10/2026).

insert into public.tipos_documento (codigo, nome, escopo, regra_validade, chave_validade, sensivel, aceita_texto, observacao, ordem) values
  ('fgts_guia', 'FGTS: guia', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 20),
  ('fgts_comprovante', 'FGTS: comprovante de pagamento', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 21),
  ('inss_guia', 'INSS: guia', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 30),
  ('inss_comprovante', 'INSS: comprovante de pagamento', 'empresa', 'mensal', null, false, false, 'Enviar todo mês até o fim do contrato.', 31)
on conflict (codigo) do nothing;

insert into public.matriz_documental (tipo_documento, aplica_a, condicao) values
  ('fgts_guia', 'empresa', 'sempre'), ('fgts_comprovante', 'empresa', 'sempre'),
  ('inss_guia', 'empresa', 'sempre'), ('inss_comprovante', 'empresa', 'sempre')
on conflict (tipo_documento, aplica_a, condicao) do nothing;

update public.matriz_documental set ativo = false where tipo_documento in ('fgts', 'inss');
update public.tipos_documento set ativo = false where codigo in ('fgts', 'inss');

-- O arquivo único que já chegou passa a valer como a guia do mês.
update public.documentos set tipo_documento = 'fgts_guia' where tipo_documento = 'fgts';
update public.documentos set tipo_documento = 'inss_guia' where tipo_documento = 'inss';
