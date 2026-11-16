-- migration: 20261116140000_escopo_por_pacote.sql
-- Escopo da contratação por pacote da matriz: lista de atividades, forma legal mais rigorosa calculada no banco.
begin;
create extension if not exists pgtap with schema extensions;
select plan(19);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000008c1', 'coorda8@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000008c2', 'coordb8@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000008c1', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000008c2', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-0000000008aa', 'OBR-8A', 'Obra 8A', 'Chapecó', 'SC'),
  ('00000000-0000-0000-0000-0000000008bb', 'OBR-8B', 'Obra 8B', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-0000000008c1', '00000000-0000-0000-0000-0000000008aa'),
  ('00000000-0000-0000-0000-0000000008c2', '00000000-0000-0000-0000-0000000008bb');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;
-- Uma atividade de cada forma legal, escolhidas da matriz de verdade
insert into ids select 'edital', id from public.matriz_contratacao where forma_legal = 'Contrato + Edital' order by ordem limit 1;
insert into ids select 'contrato', id from public.matriz_contratacao where forma_legal = 'Contrato' order by ordem limit 1;
insert into ids select 'generico', id from public.matriz_contratacao where forma_legal = 'Contrato genérico' order by ordem limit 1;
insert into ids select 'proposta', id from public.matriz_contratacao where forma_legal = 'Proposta comercial assinada' order by ordem limit 1;
insert into ids select 'pedido', id from public.matriz_contratacao where forma_legal = 'Pedido' order by ordem limit 1;
insert into ids select 'excel', id from public.matriz_contratacao where forma_legal = 'Medição excel' order by ordem limit 1;

-- A regra em si (função interna, chamada como dono)
select is(app.forma_legal_mais_rigorosa(array['Pedido', 'Contrato genérico', 'Medição excel']), 'Contrato genérico', 'A mais rigorosa entre as formas');
select is(app.forma_legal_mais_rigorosa(array['Medição excel', 'Contrato + Edital', 'Contrato']), 'Contrato + Edital', 'Contrato + Edital vence tudo');
select is(app.forma_legal_mais_rigorosa(array['Outra coisa', 'Pedido']), 'Pedido', 'Forma desconhecida conta como a menos rigorosa');
select is(app.forma_legal_mais_rigorosa(array[]::text[]), null, 'Lista vazia não tem forma');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'c1', public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'Elétrica toda', array[(select id from ids where nome = 'pedido'), (select id from ids where nome = 'contrato'), (select id from ids where nome = 'pedido')], '21.1 Elétrica (2 de 2 atividades)', 100000, false, 'suprimentos') $$, 'Abre com várias atividades (uma repetida)');
select is((select forma_legal from public.contratacoes where id = (select id from ids where nome = 'c1')), 'Contrato', 'Forma legal = a mais rigorosa entre as atividades (Pedido e Contrato)');
select is((select count(*)::int from public.contratacao_atividades where contratacao_id = (select id from ids where nome = 'c1')), 2, 'As atividades do escopo ficam gravadas (sem repetir)');
select is((select pacote from public.contratacoes where id = (select id from ids where nome = 'c1')), '21.1 Elétrica (2 de 2 atividades)', 'O rótulo do escopo vira o pacote');
select lives_ok($$ insert into ids select 'c2', public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'Pacote misto', array[(select id from ids where nome = 'excel'), (select id from ids where nome = 'proposta'), (select id from ids where nome = 'pedido'), (select id from ids where nome = 'edital')], null, 100000, false, 'suprimentos') $$, 'Abre com quatro formas diferentes');
select is((select forma_legal from public.contratacoes where id = (select id from ids where nome = 'c2')), 'Contrato + Edital', 'Entre quatro formas, vale Contrato + Edital');
select is((select matriz_id from public.contratacoes where id = (select id from ids where nome = 'c2')),
  (select id from public.matriz_contratacao where id in (select id from ids where nome in ('excel', 'proposta', 'pedido', 'edital')) order by ordem limit 1),
  'matriz_id fica com a primeira atividade pela ordem da matriz (compatibilidade)');
select lives_ok($$ insert into ids select 'c3', public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'Uma atividade só', array[(select id from ids where nome = 'generico')], null, 100000, false, 'suprimentos') $$, 'Uma atividade só continua funcionando, sem rótulo de escopo');
select is((select forma_legal from public.contratacoes where id = (select id from ids where nome = 'c3')), 'Contrato genérico', 'Uma atividade: a forma dela');

-- Recusas
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'x', array['00000000-0000-0000-0000-00000000ffff'::uuid], null, 1000, false, 'suprimentos') $$, 'P0001', 'Atividade da matriz inexistente.', 'Atividade inexistente é recusada');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'x', array[]::uuid[], null, 1000, false, 'suprimentos') $$, 'P0001', 'Escolha pelo menos uma atividade da matriz.', 'Lista vazia é recusada');
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'x', null::uuid[], null, 1000, false, 'suprimentos') $$, 'P0001', 'Escolha pelo menos uma atividade da matriz.', 'Lista nula é recusada');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000008c2", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.abrir_contratacao('00000000-0000-0000-0000-0000000008aa', 'x', array[(select id from ids where nome = 'pedido')], null, 1000, false, 'suprimentos') $$, '42501', null, 'Coordenador de outra obra não abre');

-- Leitura segue a obra; escrita só pelas funções
select is((select count(*)::int from public.contratacao_atividades where contratacao_id = (select id from ids where nome = 'c1')), 0, 'Coordenador de outra obra não vê as atividades do escopo');
select throws_ok($$ insert into public.contratacao_atividades (contratacao_id, matriz_id) values ((select id from ids where nome = 'c1'), (select id from ids where nome = 'edital')) $$, '42501', null, 'Ninguém grava as atividades direto');

select * from finish();
rollback;
