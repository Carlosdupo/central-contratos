-- Fase RH-5: perfil Financeiro (só vê a liberação para pagamento). Valor novo de enum fica numa migration própria:
-- o Postgres não deixa usar o valor na mesma transação em que foi criado.
alter type public.papel add value if not exists 'financeiro';
