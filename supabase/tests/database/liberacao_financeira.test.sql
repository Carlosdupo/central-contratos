-- migration: 20261117231000_liberacao_financeira.sql
-- RH-5: liberação automática para o financeiro quando a documentação mensal fica toda aprovada.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000e1', 'empresa-a@teste.local', '{"tipo": "externo"}'),
  ('00000000-0000-0000-0000-0000000000f5', 'financeiro@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f2', 'coord@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f5', 'financeiro'), ('00000000-0000-0000-0000-0000000000f2', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000000b', 'OBR-F5', 'Obra F5', 'Chapecó', 'SC');
insert into public.empresas_terceiras (id, cnpj, razao_social, email, situacao) values
  ('00000000-0000-0000-0000-00000000aaaa', '11222333000181', 'Empresa A Teste', 'a@teste.local', 'aprovada');
insert into public.empresa_usuarios (usuario_id, empresa_id) values ('00000000-0000-0000-0000-0000000000e1', '00000000-0000-0000-0000-00000000aaaa');
insert into public.pessoas (id, cpf, nome) values ('00000000-0000-0000-0000-0000000000c1', '52998224725', 'Liberado Teste');
insert into public.vinculos (id, pessoa_id, empresa_id, tipo, funcao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-0000000000c1', '00000000-0000-0000-0000-00000000aaaa', 'funcionario', 'Pedreiro');
insert into public.alocacoes (vinculo_id, obra_id, situacao) values
  ('00000000-0000-0000-0000-0000000000a1', '00000000-0000-0000-0000-00000000000b', 'liberado');

-- Todos os mensais exigidos, enviados (9 da empresa + 3 do funcionário).
insert into public.documentos (tipo_documento, empresa_id, vinculo_id, competencia, situacao)
  select t.codigo, '00000000-0000-0000-0000-00000000aaaa', case when m.aplica_a = 'funcionario' then '00000000-0000-0000-0000-0000000000a1'::uuid end, '2026-10-01', 'enviado'
from public.matriz_documental m join public.tipos_documento t on t.codigo = m.tipo_documento
where m.ativo and t.ativo and t.etapa = 'mensal' and not t.so_optante_simples and m.aplica_a in ('empresa', 'funcionario');

select is((select exigidos || '/' || em_analise from app.situacao_mensal('00000000-0000-0000-0000-00000000aaaa', '2026-10-01')), '12/12', '12 exigidos, todos em análise');
select is((select count(*)::int from public.liberacoes_financeiras), 0, 'em análise ainda não libera');

update public.documentos set situacao = 'aprovado' where competencia = '2026-10-01' and tipo_documento <> 'dctfweb';
select is((select count(*)::int from public.liberacoes_financeiras), 0, 'falta um aprovado: não libera');
update public.documentos set situacao = 'aprovado' where competencia = '2026-10-01' and tipo_documento = 'dctfweb';
select is((select count(*)::int from public.liberacoes_financeiras where revogada_em is null), 1, 'último aprovado: liberada automaticamente');
select is((select count(*)::int from public.avisos_internos where usuario_id = '00000000-0000-0000-0000-0000000000f5' and tipo = 'financeiro'), 1, 'financeiro recebe aviso no sino');
select is((select count(*)::int from public.notificacoes where destinatario = 'financeiro@teste.local'), 0, 'e-mail não sai na hora (só no resumo)');

select is(public.resumo_financeiro((now() at time zone 'America/Sao_Paulo')::date + 1), 1, 'no dia seguinte, o resumo vai por e-mail');

update public.documentos set situacao = 'anexado' where competencia = '2026-10-01' and tipo_documento = 'dctfweb';
select is((select count(*)::int from public.liberacoes_financeiras where revogada_em is null), 0, 'documento reaberto desfaz a liberação');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f5", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.painel_financeiro('2026-10-01') where empresa_id = '00000000-0000-0000-0000-00000000aaaa'), 1, 'financeiro vê a empresa no quadro');
select is((select count(*)::int from public.liberacoes_financeiras), 1, 'financeiro lê o histórico de liberações');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select * from public.painel_financeiro('2026-10-01') $$, '42501', null, 'coordenador de obra não vê o quadro do financeiro');

select * from finish();
rollback;
