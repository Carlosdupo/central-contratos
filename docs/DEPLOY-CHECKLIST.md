# Checklist de deploy: revisão de segurança (migrations 20261113120000 a 20261113140000)

Serve para este lote e como modelo para os próximos. Stack: Vercel (app) + Supabase (banco/Auth/Storage) + Resend (e-mail) + GitHub Actions (CI).

**Ordem: banco primeiro, app depois.** As migrations são compatíveis com o app antigo (o app antigo continua funcionando com o banco novo). O app novo exige o banco novo (chama `consumir_limite` e `reservar_notificacoes`).

## Antes
- [ ] CI verde no PR (lint, tipos, Vitest, build, pgTAP). Os testes novos: `revisao_seguranca.test.sql` (31) e `csp.test.ts`, `seguranca.test.ts`.
- [ ] Rodar `git rm -r --cached supabase/.temp` no seu computador (o `.gitignore` já ignora; isso só tira a pasta do histórico futuro).
- [ ] Conferir as variáveis na Vercel (Production e Preview): `CRON_SECRET` (32+ caracteres), `SUPABASE_SECRET_KEY`, `RESEND_API_KEY`, `EMAIL_REMETENTE`, `NEXT_PUBLIC_SITE_URL`.
- [ ] No Supabase (Authentication → Rate Limits): ver o limite de e-mails por hora. O `config.toml` local diz 2/h; sem SMTP próprio o plano gratuito é muito baixo. Ligar o SMTP do Resend antes de divulgar o sistema.
- [ ] Backup: Supabase → Database → Backups (ou `pg_dump`) antes de aplicar as migrations.
- [ ] Preview da Vercel: abrir `/login` com o console do navegador aberto e ver que **não aparece** erro de "Content Security Policy". Se aparecer, anotar a diretiva e a origem bloqueada.

## Deploy
1. [ ] `npm run db:push` (aplica as 3 migrations; demora segundos). Conferir: `select count(*) from pg_policies where schemaname='public'` continua igual ao de antes.
2. [ ] `npm run db:tipos` e ver o diff de `lib/supabase/tipos.ts` (deve ser só formatação).
3. [ ] Merge na `main`; a Vercel faz o deploy. Acompanhar o build.
4. [ ] `npm run test:db:remoto` (opcional, roda os testes no projeto ligado; cada arquivo desfaz tudo no fim).

## Testes de fumaça (10 minutos)
- [ ] Login com usuário comum: entra. Errar a senha 9 vezes seguidas: aparece "Muitas tentativas" (espere 15 min ou use outro e-mail para testar).
- [ ] `/login?proximo=/%09/evil.com`: depois de entrar vai para `/`, não para outro site.
- [ ] Esqueci minha senha com e-mail cadastrado e com e-mail inexistente: mesma mensagem, mesma rapidez; só o cadastrado recebe o e-mail.
- [ ] Portal da empresa: enviar um PDF, um JPG e uma foto; abrir o arquivo pela tela do RH.
- [ ] Cadastrar uma pessoa com CPF **novo** (funciona) e com CPF que já existe em outra empresa com nome errado (recusa) e com o nome certo (liga).
- [ ] RH aprova um envio: o e-mail chega uma vez só (conferir `select situacao, tentativas from notificacoes order by criado_em desc limit 10`).
- [ ] Admin: convidar um usuário e desativar outro; conferir que o desativado não consegue entrar.
- [ ] Chamar `/api/cron/notificacoes` com e sem o `Authorization: Bearer <CRON_SECRET>`: 200 e 401.

## Depois
- [ ] 15 min olhando Vercel → Logs: procurar `[limites]`, `[notificacoes]`, `[recuperar-senha]` e erros 500.
- [ ] Anotar no `docs/ANOTACOES-FUTURAS.md` o que ficou para depois (ver `docs/DIVIDA-TECNICA.md`).
- [ ] Avisar os usuários que o login agora bloqueia por alguns minutos depois de várias senhas erradas.

## Gatilhos de volta (decidir antes, não durante)
- Mais de 5% das tentativas de login legítimas barradas por "Muitas tentativas" na primeira hora → aumentar os limites em `modules/acesso/acoes.ts` (8 → 15 por IP+e-mail) e republicar.
- Qualquer tela do sistema em branco ou formulário que não responde, com erro de CSP no console → voltar o app pelo **Instant Rollback da Vercel** (Deployments → versão anterior → Promote). O banco novo funciona com o app antigo.
- Aviso de e-mail repetido ou travado em `enviando` por mais de 15 min → ver `select * from notificacoes where situacao='enviando'`; a reserva se desfaz sozinha em 10 min.
- Erro 500 em cadastro de pessoa ou upload → rollback do app e abrir o chamado com a mensagem do log.

## Desfazer só o banco (último recurso)
Não há perda de dados. Rodar no SQL Editor, na ordem:
```sql
-- 20261113140000 (RLS): voltar as políticas exige o texto antigo; usar o backup ou as migrations anteriores.
-- 20261113130000
drop function if exists public.reservar_notificacoes(int, int);
drop function if exists public.consumir_limite(text, int, int);
drop table if exists public.limites_tentativas;
alter table public.notificacoes drop column if exists reservado_em;
update public.notificacoes set situacao = 'erro' where situacao::text = 'enviando'; -- o valor "enviando" do enum permanece (Postgres não remove valor de enum)
-- 20261113120000
drop trigger if exists caminho_valido on public.documento_arquivos;
drop trigger if exists caminho_valido on public.pessoas;
drop trigger if exists caminho_valido on public.visitas;
drop function if exists app.exigir_caminho_valido();
drop function if exists app.caminho_arquivo_valido(text);
```
Para `cadastrar_pessoa` e `app.pode_ver_obra`, recriar as versões das migrations `terceiros_pessoas` e `contratacoes` (não é recomendado: a versão antiga tem a falha de vazamento).
