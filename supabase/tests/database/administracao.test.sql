-- F0b: permissões das telas de administração (parâmetros, feriados, obras do coordenador, desativação).
begin;
create extension if not exists pgtap with schema extensions;
select plan(10);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin2@teste.local', '{"nome": "Admin Dois"}'),
  ('00000000-0000-0000-0000-0000000000c2', 'coord2@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000d2', 'rh2@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000a2', 'admin'),
  ('00000000-0000-0000-0000-0000000000c2', 'coordenador_obra'),
  ('00000000-0000-0000-0000-0000000000d2', 'rh');
insert into public.obras (id, codigo, nome, cidade, uf) values
  ('00000000-0000-0000-0000-00000000000b', 'OBR-TESTE', 'Obra Teste', 'Chapecó', 'SC');
insert into public.usuario_obras (usuario_id, obra_id) values
  ('00000000-0000-0000-0000-0000000000c2', '00000000-0000-0000-0000-00000000000b');
update public.parametros set valor = '4000' where chave = 'limite_escolha_obra_reais';

set local role authenticated;

-- Coordenador
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000c2", "role": "authenticated", "aal": "aal1"}', true);
select is((select count(*)::int from public.usuario_obras), 1, 'Coordenador vê as obras ligadas a ele');
update public.parametros set valor = '1' where chave = 'limite_escolha_obra_reais';
select is((select valor::text from public.parametros where chave = 'limite_escolha_obra_reais'), '4000', 'Coordenador não altera parâmetros');
select throws_ok(
  $$ insert into public.feriados (data, descricao, abrangencia, uf, cidade) values ('2030-01-02', 'Teste', 'municipal', 'SC', 'Chapecó') $$,
  '42501', null, 'Coordenador não cadastra feriado');
select throws_ok(
  $$ insert into public.usuario_obras (usuario_id, obra_id) values ('00000000-0000-0000-0000-0000000000d2', '00000000-0000-0000-0000-00000000000b') $$,
  '42501', null, 'Coordenador não liga obra a outro usuário');
update public.usuarios set ativo = false where id = '00000000-0000-0000-0000-0000000000d2';
select is((select ativo from public.usuarios where id = '00000000-0000-0000-0000-0000000000d2'), true, 'Coordenador não desativa usuário');

-- RH
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000d2", "role": "authenticated", "aal": "aal2"}', true);
select is((select count(*)::int from public.usuario_obras), 0, 'RH não vê as obras ligadas a outros usuários');

-- Admin com verificação em duas etapas
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000a2", "role": "authenticated", "aal": "aal2"}', true);
update public.parametros set valor = '5000' where chave = 'limite_escolha_obra_reais';
select is((select valor::text from public.parametros where chave = 'limite_escolha_obra_reais'), '5000', 'Admin altera parâmetro');
select lives_ok(
  $$ insert into public.feriados (data, descricao, abrangencia, uf, cidade) values ('2030-01-02', 'Teste', 'municipal', 'SC', 'Chapecó') $$,
  'Admin cadastra feriado municipal');
select throws_ok(
  $$ update public.usuarios set tipo = 'externo' where id = '00000000-0000-0000-0000-0000000000c2' $$,
  'P0001', null, 'Ninguém muda o tipo do usuário (interno/externo)');

reset role;
select is(
  (select (depois ->> 'updated_by') from public.auditoria where tabela = 'parametros' and registro_id = 'limite_escolha_obra_reais' order by id desc limit 1),
  '00000000-0000-0000-0000-0000000000a2',
  'Alteração de parâmetro registra quem alterou');

select * from finish();
rollback;
