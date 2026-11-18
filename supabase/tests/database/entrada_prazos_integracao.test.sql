-- migration: 20261117160000_entrada_prazos_integracao.sql
-- RH-3: prazos de 3 e 2 dias úteis, integração segunda/quarta/sexta, envio marcado como reapresentação.
begin;
create extension if not exists pgtap with schema extensions;
select plan(6);

select is((select valor from public.parametros where chave = 'prazo_analise_rh'), '{"dias": 3, "uteis": true}'::jsonb, 'primeira análise: 3 dias úteis');
select is((select valor from public.parametros where chave = 'prazo_reapresentacao'), '{"dias": 2, "uteis": true}'::jsonb, 'reapresentação: 2 dias úteis');
select is((select valor from public.parametros where chave = 'dias_integracao'), '[1, 3, 5]'::jsonb, 'integração segunda, quarta e sexta');

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'em_analise');
insert into public.documentos (id, tipo_documento, empresa_id, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'cnd_federal', '00000000-0000-0000-0000-00000000aaaa', 'reprovado');
insert into public.envios_analise (id, empresa_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000e1');
select is((select reapresentacao from public.envios_analise where id = '00000000-0000-0000-0000-0000000000b1'), false, 'primeiro envio não é reapresentação');

insert into public.envio_itens (envio_id, documento_id, decisao, motivo) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1', 'reprovado', 'ilegível');
update public.envios_analise set situacao = 'concluido', concluido_em = now() where id = '00000000-0000-0000-0000-0000000000b1';

insert into public.envios_analise (id, empresa_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b2', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000e1');
select is((select reapresentacao from public.envios_analise where id = '00000000-0000-0000-0000-0000000000b2'), true, 'depois de pendência, o novo envio é reapresentação');

-- b2 é analisado e aprovado: o envio seguinte volta a ter o prazo normal.
update public.envios_analise set situacao = 'concluido', concluido_em = now() + interval '1 minute' where id = '00000000-0000-0000-0000-0000000000b2';
insert into public.envios_analise (id, empresa_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b3', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000e1');
select is((select reapresentacao from public.envios_analise where id = '00000000-0000-0000-0000-0000000000b3'), false, 'depois de uma análise sem pendência, volta ao prazo normal');

select * from finish();
rollback;
