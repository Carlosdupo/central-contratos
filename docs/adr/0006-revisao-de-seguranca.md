# ADR 0006: Revisão de segurança e desempenho (nov/2026)

Data: 13/11/2026 · Situação: aceita · Decisores: Carlos (dono do sistema)

## Contexto
Uma revisão do código e do banco achou pontos a corrigir sem mudar nenhuma regra de negócio. Os mais sérios: dados de pessoas vazando entre empresas terceirizadas pelo cadastro por CPF, caminho de arquivo do Storage validado só por prefixo, redirecionamento aberto no login, e-mails de acesso sem limite, CSP sem proteção contra XSS, fila de e-mails sujeita a envio duplicado e RLS com custo por linha.

## Decisões

1. **CPF entre empresas (`cadastrar_pessoa`)**. Se o CPF já existe, o vínculo só é criado quando o nome informado confere (sem acento e sem diferença de maiúsculas). A pessoa nunca é alterada por outra empresa (o `on conflict do update` do telefone foi removido). Nome diferente devolve uma mensagem única.
   - *Risco que fica*: tentar um CPF com um nome qualquer ainda revela que o CPF existe (a recusa é o sinal). Não revela nome nem telefone. Fica coberto pelo cadastro só para empresas convidadas e pelo registro em auditoria; um limite de tentativas no cadastro é item da [dívida técnica](../DIVIDA-TECNICA.md).
2. **Caminho de arquivo**. Um formato único, `empresas/<uuid>/(empresa/<tipo>|vinculos/<uuid>/<tipo>)/<uuid>.(pdf|jpg|png)`, conferido no servidor (`lib/caminho-arquivo.ts`) **e** por trigger no banco (`app.caminho_arquivo_valido`) em `documento_arquivos`, `pessoas.foto_path` e `visitas`. Motivo: `..` passava pelo `startsWith`/`LIKE` e o Storage pode normalizar o caminho.
3. **Redirecionamento pós-login**. `lib/destino-seguro.ts` aceita só caminho interno, sem `//`, `\` e caracteres de controle (a tabulação virava `//host` no parser de URL).
4. **Limite de tentativas no banco** (`consumir_limite`), não em memória.
   - *Alternativas*: (a) memória da função, descartada porque a Vercel usa várias instâncias e o contador não é compartilhado; (b) Upstash/Redis, descartada por criar mais um serviço, uma chave e um custo para o volume deste sistema; (c) firewall da Vercel, boa como camada extra, mas não distingue e-mail e depende do plano.
   - Chave com hash (nunca IP nem e-mail em claro), janela fixa, só o `service_role` executa. Login: 8 por IP+e-mail e 40 por IP em 15 min. Recuperação de senha: 3 por e-mail por hora e 10 por IP em 15 min; passou do limite, a resposta continua igual e nada é enviado.
   - Se o banco falhar, o limite libera (registra no log) para não trancar todos os usuários.
5. **Recuperação de senha sem vazamento**. Resposta sempre igual e imediata; a consulta e o envio rodam em `after()`. Some o vazamento por tempo e a mensagem "Muitos e-mails" que denunciava conta existente.
6. **CSP com nonce** gerada no `proxy.ts` (`lib/csp.ts`): `script-src 'self' 'nonce-…' 'strict-dynamic'`, sem `unsafe-inline` nem `unsafe-eval` em produção. Exige renderização dinâmica, então o layout raiz tem `dynamic = "force-dynamic"` (as páginas já dependiam do usuário). O Zod é colocado em modo `jitless` no navegador porque testava `new Function()`. O atributo `style=""` segue liberado (`style-src-attr`) por causa das barras de progresso.
7. **Fila de e-mails**. `reservar_notificacoes` reserva os avisos com `for update skip locked` e marca `enviando`; a tentativa conta na reserva e uma reserva esquecida volta à fila após 10 minutos. O envio passou a ter `Idempotency-Key` no Resend e a rodar de 5 em 5 em paralelo. Os disparos dentro das ações do RH/SST usam `after()`.
8. **RLS mais barata**. 41 políticas passaram a chamar as funções sem argumento como `(select …)` (calculadas uma vez por consulta) e `app.pode_ver_obra` virou uma consulta só. Resultado idêntico em 4.096 combinações de papel, 2FA, obra, tipo e situação; uma leitura de 30 mil usuários caiu de ~190 ms para ~3 ms.
9. **Administração**. Desativar usuário desfaz a marcação se o bloqueio no Auth falhar; convite cujos perfis não gravaram é desfeito.
10. **Higiene**. `shadcn` (CLI) foi para `devDependencies` (zerou as 6 vulnerabilidades do `npm audit` de produção); Dependabot semanal; `supabase/.temp/` no `.gitignore`.

## Consequências
- Mais fácil: auditar o formato do arquivo, saber quem fez o quê, subir o volume de usuários sem pesar a RLS, reenviar e-mails com segurança.
- Mais difícil: toda página é dinâmica (já era na prática); uma biblioteca nova que use `eval` ou script inline precisa de nonce ou ajuste na CSP; as fixtures de teste precisam usar caminhos no formato real.
- O limite de recuperação por e-mail (3 por hora) pode ser usado por um terceiro para atrasar a recuperação de outra pessoa por até 1 hora; o admin continua podendo reenviar o acesso pela tela do usuário, que não tem esse limite.
- A tabela `limites_tentativas` cresce com o uso; a limpeza é feita ocasionalmente dentro da própria função.
- `lib/supabase/tipos.ts` foi ajustado à mão para as duas funções novas, a coluna `reservado_em` e o valor `enviando`; rodar `npm run db:tipos` depois do `db:push` e conferir que o diff é só de formatação.

## Fora desta decisão
Captcha (Turnstile) na recuperação de senha e no login: precisa de chaves da Cloudflare, do widget na tela e de ligar o captcha no painel do Supabase; o limite de tentativas já cobre o abuso comum. Ver a dívida técnica.
