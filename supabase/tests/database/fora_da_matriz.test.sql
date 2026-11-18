-- Atividade que não consta na matriz: abre sem atividades e sem forma legal, com a descrição.
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000009c1', 'coorda9@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values ('00000000-0000-0000-0000-0000000009c1', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-0000000009aa', 'OBR-9A', 'Obra 9A', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values ('00000000-0000-0000-0000-0000000009c1', '00000000-0000-0000-0000-0000000009aa');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;
insert into ids select 'ativ', id from public.matriz_contratacao order by ordem limit 1;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000009c1", "role": "authenticated", "aal": "aal1"}', true);
select lives_ok($$ insert into ids select 'f1', public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-0000000009aa', p_servico => 'Limpeza de fachada', p_atividades => array[]::uuid[], p_escopo => '', p_valor => 1000, p_aditivo => false, p_negociacao => 'suprimentos', p_fora_matriz => '  Limpeza de fachada com balancim  ') $$, 'Abre com atividade que não consta na matriz');
select is((select fora_da_matriz from public.contratacoes where id = (select id from ids where nome = 'f1')), 'Limpeza de fachada com balancim', 'Guarda a descrição (sem espaços nas pontas)');
select is((select pacote from public.contratacoes where id = (select id from ids where nome = 'f1')), 'Não consta na matriz: Limpeza de fachada com balancim', 'Pacote diz que não consta na matriz');
select is((select forma_legal from public.contratacoes where id = (select id from ids where nome = 'f1')), null, 'Sem forma legal (Suprimentos define)');
select is((select matriz_id from public.contratacoes where id = (select id from ids where nome = 'f1')), null, 'Sem atividade da matriz');
select is((select count(*)::int from public.contratacao_atividades where contratacao_id = (select id from ids where nome = 'f1')), 0, 'Nenhuma atividade gravada');
select throws_ok($$ select public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-0000000009aa', p_servico => 'x', p_atividades => array[(select id from ids where nome = 'ativ')], p_escopo => '', p_valor => 1000, p_aditivo => false, p_negociacao => 'suprimentos', p_fora_matriz => 'Outra coisa') $$, 'P0001', 'Escolha atividades da matriz ou marque que não consta, não os dois.', 'Não aceita atividades e "não consta" juntos');
select throws_ok($$ select public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-0000000009aa', p_servico => 'x', p_atividades => array[]::uuid[], p_escopo => '', p_valor => 1000, p_aditivo => false, p_negociacao => 'suprimentos', p_fora_matriz => ' ab ') $$, 'P0001', 'Descreva a atividade que não consta na matriz.', 'Descrição curta é recusada');
select throws_ok($$ select public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-0000000009aa', p_servico => 'x', p_atividades => array[]::uuid[], p_escopo => '', p_valor => 1000, p_aditivo => false, p_negociacao => 'suprimentos', p_fora_matriz => '   ') $$, 'P0001', 'Escolha pelo menos uma atividade da matriz.', 'Sem atividade e sem descrição continua recusado');
select lives_ok($$ insert into ids select 'n1', public.abrir_contratacao(p_obra => '00000000-0000-0000-0000-0000000009aa', p_servico => 'Normal', p_atividades => array[(select id from ids where nome = 'ativ')], p_escopo => '', p_valor => 1000, p_aditivo => false, p_negociacao => 'suprimentos') $$, 'Abertura normal (sem p_fora_matriz) segue igual');

select * from finish();
rollback;
