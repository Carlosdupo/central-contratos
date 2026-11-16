-- Auditoria da senha provisória: só administrador com verificação em duas etapas; grava os dois nomes e nunca a senha.
begin;
create extension if not exists pgtap with schema extensions;
select plan(14);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000007a1', 'admin7@teste.local', '{"nome": "Sicrano Admin"}'),
  ('00000000-0000-0000-0000-0000000007b1', 'alvo7@teste.local', '{"nome": "Fulano Alvo"}'),
  ('00000000-0000-0000-0000-0000000007c1', 'coord7@teste.local', '{"nome": "Coordenador"}');
insert into public.obras (id, codigo, nome, cidade, uf) values ('00000000-0000-0000-0000-0000000007aa', 'OBR-7', 'Obra 7', 'Chapecó', 'SC');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000007a1', 'admin'),
  ('00000000-0000-0000-0000-0000000007c1', 'coordenador_obra');

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007c1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.registrar_senha_provisoria('00000000-0000-0000-0000-0000000007b1') $$, '42501', null, 'Quem não é administrador não registra');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007a1", "role": "authenticated", "aal": "aal1"}', true);
select throws_ok($$ select public.registrar_senha_provisoria('00000000-0000-0000-0000-0000000007b1') $$, '42501', null, 'Administrador sem verificação em duas etapas não registra');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007a1", "role": "authenticated", "aal": "aal2"}', true);
select throws_ok($$ select public.registrar_senha_provisoria('00000000-0000-0000-0000-0000000007ff') $$, 'P0001', 'Usuário não encontrado.', 'Usuário inexistente é recusado');
select lives_ok($$ select public.registrar_senha_provisoria('00000000-0000-0000-0000-0000000007b1', false) $$, 'Administrador verificado registra a senha provisória');
select lives_ok($$ select public.registrar_senha_provisoria('00000000-0000-0000-0000-0000000007b1', true) $$, 'Registra também a conta nova');

select is((select depois ->> 'descricao' from public.auditoria where tabela = 'senha_provisoria' and registro_id = '00000000-0000-0000-0000-0000000007b1' and (depois ->> 'conta_nova')::boolean = false),
  'Senha provisória gerada para Fulano Alvo por Sicrano Admin', 'A auditoria diz para quem e por quem');
select is((select count(*)::int from public.auditoria where tabela = 'senha_provisoria' and depois::text ~* '(senha[^,]*":|password|segredo)' and depois::text !~ 'descricao'), 0, 'A auditoria não guarda campo de senha');
select is((select count(*)::int from public.auditoria where tabela = 'senha_provisoria' and registro_id = '00000000-0000-0000-0000-0000000007b1' and ator = '00000000-0000-0000-0000-0000000007a1'), 2, 'Cada registro guarda quem fez (ator)');
select ok(not has_function_privilege('anon', 'public.registrar_senha_provisoria(uuid, boolean)', 'execute'), 'Visitante sem login não executa');

-- Troca obrigatória também no banco: token com app_metadata.trocar_senha não lê nada
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007c1", "role": "authenticated", "aal": "aal1"}', true);
select is(app.usuario_interno_ativo(), true, 'Sem a marca, o usuário interno ativo é reconhecido');
select ok((select count(*) from public.obras) >= 1, 'Sem a marca, lê as obras');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000007c1", "role": "authenticated", "aal": "aal1", "app_metadata": {"trocar_senha": true}}', true);
select is(app.usuario_interno_ativo(), false, 'Com a senha provisória ainda não trocada, deixa de ser reconhecido como usuário ativo');
select is(app.tem_papel('coordenador_obra'), false, 'Com a senha provisória ainda não trocada, não tem papel nenhum');
select is((select count(*)::int from public.obras), 0, 'Com a senha provisória ainda não trocada, não lê dado nenhum');

select * from finish();
rollback;
