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
5. **Configurar o Auth no painel do Supabase** (o `config.toml` só vale para o ambiente local):
   - Authentication → Sign In / Providers: desligar **Allow new users to sign up**.
   - Authentication → Policies de senha: mínimo de 10 caracteres, com maiúsculas, minúsculas e números; ligar a proteção contra senhas vazadas (planos pagos).
   - Authentication → Multi-Factor: ligar **TOTP**.
   - Authentication → URL Configuration: Site URL = endereço do sistema; Redirect URLs = `<endereço>/auth/confirmar`.
   - Authentication → Email Templates, em **Invite user** e **Reset password**, troque o link por:
     `{{ .SiteURL }}/auth/confirmar?token_hash={{ .TokenHash }}&type=invite&proximo=/definir-senha`
     (no modelo de recuperação use `type=recovery`).
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
| `npm run test:db` | Testes do banco e da RLS (precisa de Docker; roda no CI) |
| `npm run db:push` | Aplica as migrations no projeto Supabase ligado (nuvem) |

## Regras do repositório
- Toda mudança de banco é uma **migration nova** em `supabase/migrations`. Nunca altere o banco pelo painel.
- Toda tabela nova precisa de **RLS** e de teste pgTAP; o CI falha se alguma tabela ficar sem RLS.
- Toda gravação passa por Server Action que chama `exigirPapel(...)` e valida com Zod.
- `lib/supabase/admin.ts` (ignora a RLS) só pode ser usado no servidor, em convites do admin e em tarefas agendadas.
- Mudança de regra de negócio só com justificativa registrada e aprovação (docs/adr).
