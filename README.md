# Central de Contratos

Contratação de empreiteiros e gestão de terceiros (documentos, análise do RH e integração).

- Plano técnico aprovado: [docs/ETAPA-0-arquitetura.md](docs/ETAPA-0-arquitetura.md)
- Regras de negócio: [docs/BRIEFING-sistema-contratos.md](docs/BRIEFING-sistema-contratos.md)
- Protótipo de referência (visual e regras): [docs/prototipo/prototipo-contratacao.html](docs/prototipo/prototipo-contratacao.html)
- Decisões técnicas: [docs/adr](docs/adr)

## Stack
Next.js 16 (App Router) · React 19 · TypeScript · Tailwind CSS 4 · Supabase (Postgres, Auth, Storage) · Zod · Vitest · pgTAP · Vercel · GitHub Actions

## Estrutura
```
app/            telas e rotas: (publico) login, (conta) senha/verificação, (interno) área da empresa
modules/        regras por assunto (acesso; depois terceiros, contratacoes, documentos, notificacoes)
lib/            supabase (clientes), datas (fuso e dias úteis), env (variáveis validadas)
components/app/ layout e componentes com o visual do protótipo
supabase/       config.toml, migrations versionadas e testes do banco (tests/database)
tests/unit/     testes das regras (Vitest)
```

## Primeira configuração

1. **Node.js 22 ou mais novo.** Depois, na pasta do projeto: `npm install`
2. **Projeto no Supabase** (plano gratuito para desenvolvimento), região **South America (São Paulo)**.
3. Copie `.env.example` para `.env.local` e preencha com a URL e as chaves do projeto (Project Settings → API Keys). Nunca faça commit desse arquivo.
4. **Aplicar o banco:**
   ```bash
   npx supabase login
   npx supabase link --project-ref SEU_PROJECT_REF
   npm run db:push
   ```
5. **Configurar o Auth:** as configurações de `supabase/config.toml` (cadastro aberto desligado, TOTP, regra de senha) são enviadas ao projeto com:
   ```bash
   npx supabase config diff
   npx supabase config push
   ```
   No painel, em Authentication → URL Configuration: Site URL = endereço do sistema; Redirect URLs = `<endereço>/auth/confirmar`.
   **Modelos de e-mail:** o plano gratuito sem SMTP próprio não deixa trocar os modelos. O sistema aceita o link padrão do Supabase (`components/app/processar-link-acesso.tsx` e `/auth/confirmar?code=`). Os modelos em português estão em `supabase/templates` e serão ligados no `config.toml` quando o envio pelo Resend estiver configurado.
6. **Primeiro administrador:** em Authentication → Users → *Invite user*, convide o seu e-mail. Depois, no SQL Editor:
   ```sql
   insert into public.usuario_papeis (usuario_id, papel)
   select id, 'admin' from public.usuarios where email = 'seu-email@dominio.com';
   ```
   Abra o link do convite, crie a senha e cadastre a verificação em duas etapas.
7. `npm run dev` e acesse http://localhost:3000

## Comandos
| Comando | O que faz |
|---|---|
| `npm run dev` | Sobe o sistema em modo de desenvolvimento |
| `npm run lint` / `npm run typecheck` | Padrões de código e tipos |
| `npm test` | Testes das regras (Vitest) |
| `npm run test:db` | Testes do banco e da RLS no Supabase local (precisa de Docker; roda no CI) |
| `npm run test:db:remoto` | Os mesmos testes no projeto ligado, sem Docker (cada arquivo roda em transação desfeita no fim) |
| `npm run db:tipos` | Gera `lib/supabase/tipos.ts` a partir do banco |
| `npm run db:push` | Aplica as migrations no projeto Supabase ligado (nuvem) |

## Administração
O menu **Administração** (só admin com verificação em duas etapas) tem: usuários (convite, perfis, obras do coordenador, desativar), obras, parâmetros de negócio, feriados e auditoria.

## Tarefas agendadas (Vercel Cron, `vercel.json`)
| Rota | Quando | O que faz |
|---|---|---|
| `/api/cron/vencimentos` | todo dia, 06h (Brasília) | Marca vencidos, bloqueia quem ficou irregular, enfileira avisos de 30/15/0 dias |
| `/api/cron/notificacoes` | todo dia, 08h (Brasília) | Reenvia por e-mail os avisos que ficaram na fila |

As duas exigem o cabeçalho `Authorization: Bearer <CRON_SECRET>` (a Vercel envia sozinha quando `CRON_SECRET` está configurado).

## Regras do repositório
- Toda mudança de banco é uma **migration nova** em `supabase/migrations`. Nunca altere o banco pelo painel.
- Toda tabela nova precisa de **RLS** e de teste pgTAP; o CI falha se alguma tabela ficar sem RLS.
- Toda gravação passa por Server Action que chama `exigirPapel(...)` e valida com Zod.
- `lib/supabase/admin.ts` (ignora a RLS) só pode ser usado no servidor, em convites do admin e em tarefas agendadas.
- Mudança de regra de negócio só com justificativa registrada e aprovação (docs/adr).
