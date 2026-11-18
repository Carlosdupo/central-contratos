-- migration: 20261118090000_mfa_opcional_rh_sst.sql
-- 18/11: duas etapas opcional para RH e Segurança; quem configurou o autenticador continua precisando do código. Admin segue obrigatório.
begin;
create extension if not exists pgtap with schema extensions;
select plan(5);

insert into auth.users (id, email, raw_user_meta_data) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f4', 'sst@teste.local', '{}'),
  ('00000000-0000-0000-0000-0000000000f1', 'admin@teste.local', '{}');
insert into public.usuario_papeis (usuario_id, papel) values
  ('00000000-0000-0000-0000-0000000000f3', 'rh'), ('00000000-0000-0000-0000-0000000000f4', 'sst'), ('00000000-0000-0000-0000-0000000000f1', 'admin');
insert into auth.mfa_factors (id, user_id, factor_type, status, created_at, updated_at) values
  (gen_random_uuid(), '00000000-0000-0000-0000-0000000000f4', 'totp', 'verified', now(), now());

set local role authenticated;
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal1"}', true);
select ok(app.rh_verificado(), 'RH sem autenticador configurado age só com a senha');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal1"}', true);
select ok(not app.sst_verificado(), 'Segurança que configurou o autenticador precisa do código');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f4", "role": "authenticated", "aal": "aal2"}', true);
select ok(app.sst_verificado(), 'Segurança com o código age normalmente');

select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f1", "role": "authenticated", "aal": "aal1"}', true);
select ok(not app.admin_verificado(), 'Admin continua obrigado a usar as duas etapas');
select set_config('request.jwt.claims', '{"sub": "00000000-0000-0000-0000-0000000000f3", "role": "authenticated", "aal": "aal1"}', true);
select ok(not app.sst_verificado(), 'RH não vira Segurança por não ter autenticador');

select * from finish();
rollback;
