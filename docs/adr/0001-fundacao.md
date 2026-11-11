# ADR 0001: Decisões da Fundação (F0)

Data: 11/11/2026 · Situação: aceita

## Contexto
Plano aprovado em `docs/ETAPA-0-arquitetura.md`. Ao criar o projeto, algumas escolhas concretas precisaram ser feitas.

## Decisões
1. **Next.js 16.4 (versão estável atual) com App Router.** No Next 16 o `middleware.ts` passou a se chamar `proxy.ts`; o projeto usa `proxy.ts` só para renovar a sessão e mandar para o login quem não está autenticado. A autorização por papel fica no servidor (`modules/acesso/sessao.ts`) e na RLS.
2. **Cache Components desligado** (`cacheComponents: false`). Todas as telas dependem do usuário logado e da RLS, e não queremos dado de terceiros (CPF, ASO) em cache do servidor. Pode ser revisto para telas públicas no futuro.
3. **Chaves novas do Supabase:** `sb_publishable_…` (pública) e `sb_secret_…` (só servidor), no lugar de `anon` e `service_role`.
4. **Sessão verificada com `getClaims()`**, que valida a assinatura do JWT, e nunca com `getSession()`.
5. **Verificação em duas etapas (TOTP)** obrigatória para admin, RH e SST (P22). Reforço no banco: o admin só escreve com `aal2` no JWT (`app.admin_verificado()`).
6. **Cadastro aberto desligado.** Usuários só entram por convite. O tipo (`interno`/`externo`) vem de `app_metadata`, que só o servidor define, e não pode ser alterado depois (trigger).
7. **Senha:** mínimo de 10 caracteres, com maiúscula, minúscula e número (no Supabase Auth e na validação Zod).
8. **Ambiente local sem Docker:** o desenvolvimento usa o projeto *dev* na nuvem; os testes pgTAP rodam no CI do GitHub.
9. **shadcn/ui** será instalado na F0b, junto com as primeiras telas de formulário (admin). Os tokens visuais do protótipo já estão em `app/globals.css`.
10. **Datas:** funções próprias com `Intl` no fuso America/Sao_Paulo (`lib/datas`), sem biblioteca externa.
