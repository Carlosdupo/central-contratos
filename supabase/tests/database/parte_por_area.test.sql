-- Cada área vale sozinha: os documentos do RH ficam aprovados quando o RH termina, sem esperar a Segurança.
begin;
create extension if not exists pgtap with schema extensions;
select plan(7);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'sst@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f4', 'sst');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-T9', 'Obra T9', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values
  ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.pessoas (id, cpf, nome) values ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Pessoa Teste');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro');
insert into public.alocacoes (vinculo_id, obra_id, situacao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'em_analise');
insert into public.documentos (id, tipo_documento, empresa_id, vinculo_id, situacao) values
  ('00000000-0000-0000-0000-0000000000d1', 'aso', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado'),
  ('00000000-0000-0000-0000-0000000000d2', 'rg_cnh', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', 'enviado');
insert into public.envios_analise (id, empresa_id, vinculo_id, enviado_por) values
  ('00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-00000000aaaa', '00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000e1');
insert into public.envio_itens (id, envio_id, documento_id) values
  ('00000000-0000-0000-0000-000000000011', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d1'),
  ('00000000-0000-0000-0000-000000000012', '00000000-0000-0000-0000-0000000000b1', '00000000-0000-0000-0000-0000000000d2');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000012', 'aprovado') $$, 'RH aprova o RG, o último item dele');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d2'), 'aprovado', 'RG já aparece aprovado, sem esperar a Segurança');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'enviado', 'ASO continua em análise com a Segurança');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal2"}', true);
select lives_ok($$ select public.decidir_documento('00000000-0000-0000-0000-000000000011', 'reprovado', 'Ilegível') $$, 'Segurança devolve o ASO');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'reprovado', 'ASO já aparece devolvido');

-- A empresa troca o arquivo antes da conclusão: a decisão antiga não pode voltar por cima.
reset role;
insert into public.documento_arquivos (id, documento_id, storage_path, nome_original, mime, tamanho, sha256, enviado_por) values
  ('00000000-0000-0000-0000-0000000000f9', '00000000-0000-0000-0000-0000000000d1',
   'empresas/00000000-0000-0000-0000-00000000aaaa/vinculos/00000000-0000-0000-0000-0000000000a1/aso/00000000-0000-0000-0000-0000000000f9.pdf',
   'aso.pdf', 'application/pdf', 100, repeat('a', 64), '00000000-0000-0000-0000-0000000000e1');
update public.documentos set situacao = 'anexado', arquivo_atual_id = '00000000-0000-0000-0000-0000000000f9' where id = '00000000-0000-0000-0000-0000000000d1';
set local role authenticated;
select is(public.concluir_envio('00000000-0000-0000-0000-0000000000b1', (now() at time zone 'America/Sao_Paulo')::date + 1, 'a', 'b'),
  'pessoa_pendente', 'Segurança conclui com o ASO devolvido');
select is((select situacao::text from public.documentos where id = '00000000-0000-0000-0000-0000000000d1'), 'anexado', 'Arquivo novo da empresa continua pronto para enviar');

select * from finish();
rollback;
