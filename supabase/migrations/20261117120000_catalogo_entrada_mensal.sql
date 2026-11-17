-- Fase RH-1: catálogo conforme o "Procedimento para Terceiros" rev. 02.
-- Cada tipo diz em que etapa entra (entrada ou mensal) e quem aprova (RH ou Segurança do Trabalho).
-- Os tipos mensais novos ficam fora da matriz (ativo = false) até a etapa mensal existir.

alter table public.tipos_documento
  add column etapa text not null default 'entrada' check (etapa in ('entrada', 'mensal')),
  add column responsavel text not null default 'rh' check (responsavel in ('rh', 'sst'));

update public.tipos_documento set etapa = 'mensal' where regra_validade = 'mensal';

update public.tipos_documento set responsavel = 'sst'
where codigo in ('aso', 'ficha_epi', 'ordem_servico', 'nr05', 'nr06', 'nr10', 'nr12', 'nr18', 'nr35', 'formacao_eletrica', 'pgr', 'pcmso', 'ltcat');

insert into public.tipos_documento (codigo, nome, escopo, regra_validade, chave_validade, sensivel, aceita_texto, observacao, ordem, etapa, responsavel) values
  ('cnd_municipal', 'CND municipal', 'empresa', 'data_informada', null, false, false, null, 11, 'entrada', 'rh'),
  ('cnd_estadual', 'CND estadual', 'empresa', 'data_informada', null, false, false, null, 12, 'entrada', 'rh'),
  ('cnd_trabalhista', 'CND trabalhista', 'empresa', 'data_informada', null, false, false, null, 13, 'entrada', 'rh'),
  ('crf_fgts', 'CRF do FGTS', 'empresa', 'data_informada', null, false, false, 'Certificado de Regularidade do FGTS.', 14, 'entrada', 'rh'),
  ('contrato_social', 'Contrato social (última alteração)', 'empresa', 'sem_validade', null, false, false, null, 15, 'entrada', 'rh'),
  ('cartao_cnpj', 'Cartão CNPJ', 'empresa', 'sem_validade', null, false, false, null, 16, 'entrada', 'rh'),
  ('carteira_vacina', 'Carteira de vacinas', 'pessoa', 'sem_validade', null, true, false, 'Com a vacina do tétano válida.', 115, 'entrada', 'sst'),
  ('folha_pagamento', 'Folha de pagamento assinada', 'empresa', 'mensal', null, false, false, null, 300, 'mensal', 'rh'),
  ('folha_comprovante', 'Folha de pagamento: comprovante', 'empresa', 'mensal', null, false, false, null, 301, 'mensal', 'rh'),
  ('simples_guia', 'Simples Nacional: guia', 'empresa', 'mensal', null, false, false, 'Só para optantes do Simples.', 310, 'mensal', 'rh'),
  ('simples_comprovante', 'Simples Nacional: comprovante de pagamento', 'empresa', 'mensal', null, false, false, 'Só para optantes do Simples.', 311, 'mensal', 'rh'),
  ('fgts_digital_alocacao', 'Relatório do FGTS Digital com alocação da obra', 'empresa', 'mensal', null, false, false, null, 320, 'mensal', 'rh'),
  ('dctfweb', 'DCTFWeb: declaração completa', 'empresa', 'mensal', null, false, false, null, 330, 'mensal', 'rh'),
  ('relacao_funcionarios_obra', 'Relação de funcionários que estiveram na obra', 'empresa', 'mensal', null, false, false, null, 340, 'mensal', 'rh'),
  ('ficha_epi_mensal', 'Ficha de EPI atualizada', 'pessoa', 'mensal', null, false, false, null, 400, 'mensal', 'sst'),
  ('cartao_ponto', 'Cartão ponto assinado', 'pessoa', 'mensal', null, false, false, null, 410, 'mensal', 'rh'),
  ('cartao_ponto_comprovante', 'Cartão ponto: comprovante de pagamento', 'pessoa', 'mensal', null, false, false, null, 411, 'mensal', 'rh');

insert into public.matriz_documental (tipo_documento, aplica_a, condicao) values
  ('cnd_municipal', 'empresa', 'sempre'), ('cnd_estadual', 'empresa', 'sempre'), ('cnd_trabalhista', 'empresa', 'sempre'),
  ('crf_fgts', 'empresa', 'sempre'), ('contrato_social', 'empresa', 'sempre'), ('cartao_cnpj', 'empresa', 'sempre'),
  ('carteira_vacina', 'funcionario', 'sempre'), ('carteira_vacina', 'socio_diario', 'sempre');

insert into public.matriz_documental (tipo_documento, aplica_a, condicao, ativo) values
  ('folha_pagamento', 'empresa', 'sempre', false), ('folha_comprovante', 'empresa', 'sempre', false),
  ('simples_guia', 'empresa', 'sempre', false), ('simples_comprovante', 'empresa', 'sempre', false),
  ('fgts_digital_alocacao', 'empresa', 'sempre', false), ('dctfweb', 'empresa', 'sempre', false),
  ('relacao_funcionarios_obra', 'empresa', 'sempre', false),
  ('ficha_epi_mensal', 'funcionario', 'sempre', false), ('cartao_ponto', 'funcionario', 'sempre', false),
  ('cartao_ponto_comprovante', 'funcionario', 'sempre', false);
