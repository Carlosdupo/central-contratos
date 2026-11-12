-- Apaga os dados de demonstração do Nexo (criados por supabase/demo/criar-demo.sql).
-- Só mexe no que é da demonstração: obra DEMO-01, as 3 empresas "(demo)" e as pessoas de CPF 900000....
-- Uso: npx supabase db query --remote --yes -f supabase/demo/apagar-demo.sql
begin;
delete from public.contratacoes where obra_id in (select id from public.obras where codigo = 'DEMO-01');
delete from public.empresas_terceiras where cnpj in ('98765431000143', '98765432000198', '98765433000132');
delete from public.pessoas where cpf in ('90000001147', '90000001228', '90000001309', '90000001490', '90000001570', '90000001651', '90000001732', '90000001813', '90000001902', '90000002038');
delete from public.obras where codigo = 'DEMO-01';
commit;
