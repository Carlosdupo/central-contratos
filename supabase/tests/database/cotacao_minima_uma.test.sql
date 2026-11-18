-- Etapa de cotação: basta uma cotação para concluir (antes eram 3).
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values ('00000000-0000-0000-0000-00000000b0c1', 'coordcot@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values ('00000000-0000-0000-0000-00000000b0c1', 'coordenador_obra');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-00000000b0aa', 'OBR-CT', 'Obra CT', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values ('00000000-0000-0000-0000-00000000b0c1', '00000000-0000-0000-0000-00000000b0aa');
create temp table ids (nome text primary key, id uuid);
grant all on ids to authenticated;

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-00000000b0c1", "role": "authenticated", "aal": "aal1"}', true);
insert into ids select 'c', public.abrir_contratacao('00000000-0000-0000-0000-00000000b0aa', 'Pintura', array[(select id from public.matriz_contratacao order by ordem limit 1)], null, 100000, false, 'suprimentos');
select lives_ok(format($$ select public.marcar_item(%L, 2::smallint, i::smallint, true) from generate_series(1, 2) i $$, (select id from ids where nome = 'c')), 'Marca os itens da cotação');
select throws_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'c')), 'P0001', 'Registre pelo menos uma cotação.', 'Sem cotação não conclui');
select lives_ok(format($$ select public.registrar_cotacao(%L, 'Fornecedor A', '11222333000181', 97000, 45) $$, (select id from ids where nome = 'c')), 'Registra uma cotação');
select lives_ok(format($$ select public.concluir_etapa(%L, 2::smallint) $$, (select id from ids where nome = 'c')), 'Conclui com uma cotação só');
select is((select nome from public.etapas_fluxo where versao = 2 and chave = 'cotacao'), 'Cotação com fornecedores', 'Nome da etapa sem o 3');

select * from finish();
rollback;
