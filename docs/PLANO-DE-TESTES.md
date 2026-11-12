# Plano de testes

## Pirâmide deste sistema
```
            E2E (navegador)            poucos, lentos     → hoje: nenhum (lacuna)
        Ações do servidor + banco       alguns             → hoje: nenhum (lacuna)
   Banco/RLS (pgTAP)  ·  Regras (Vitest)   muitos, rápidos → hoje: 173 + 55
```
A regra de acesso mora no banco (RLS e RPCs), então o pgTAP é a camada mais valiosa: um teste de negação ali protege mesmo que alguém chame o PostgREST direto, sem passar pelo app.

## O que testar e como
| Área | Tipo | Onde | Estado | Meta |
|---|---|---|---|---|
| RLS: cada tabela, por papel (admin sem/com 2FA, RH, SST, suprimentos, coordenador, externo, anon) | pgTAP | `supabase/tests/database` | boa | 100% das tabelas com 1 teste de "pode" e 1 de "não pode" |
| RPCs: autorização, validação e efeito | pgTAP | idem | **11 sem teste de negação → cobertas em `autorizacao_rpcs.test.sql`** | 100% das RPCs com pelo menos 1 negação |
| Formato de dados (caminho de arquivo, CPF, limites) | pgTAP + Vitest | `revisao_seguranca.test.sql`, `tests/unit` | nova | manter junto de cada regra nova |
| Regras puras (datas úteis, matriz documental, papéis, EAP, CSP, destino seguro) | Vitest | `tests/unit` | boa | ≥ 90% das linhas de `lib/` e `modules/*/dominio` |
| Ações do servidor (`modules/*/acoes.ts`): limite de login, rollback de convite, erro do ban, envio de e-mail | Vitest com Supabase local ou dublê do cliente | `tests/integration` | **lacuna** | fluxos críticos: login, recuperar senha, convidar, desativar, upload |
| Telas e CSP | Playwright | `tests/e2e` | **lacuna** (a verificação de CSP foi feita à mão, ver abaixo) | 6 a 8 fluxos de fumaça |
| Migrations idempotentes e sem divergência | CI (`supabase db diff`) | `.github/workflows/ci.yml` | existe | manter |

## Casos de exemplo (para escrever em seguida)
**Ações do servidor (Vitest, cliente Supabase simulado)**
- `entrar`: a 9ª tentativa em 15 min com o mesmo IP+e-mail devolve "Muitas tentativas" sem chamar `signInWithPassword`.
- `entrar`: se `consumir_limite` falha (erro de rede), a tentativa passa e há `console.error`.
- `pedirNovaSenha`: conta inexistente, conta ativa e limite estourado devolvem exatamente a mesma mensagem; só a conta ativa dentro do limite chama `reenviarAcesso`.
- `convidarUsuario`: se o insert de papéis falha, `deleteUser` é chamado e a mensagem diz que o convite foi desfeito; se o `deleteUser` também falha, a mensagem antiga.
- `alterarSituacaoUsuario`: erro no `updateUserById` reverte `ativo`.
- `despacharPendentes`: aviso com falha volta como `erro` com `reservado_em` nulo; mesmo aviso reservado por duas chamadas só é enviado uma vez.

**E2E (Playwright)**
- `/login` carrega sem nenhuma violação de CSP e o formulário responde.
- `/login?proximo=/%09/evil.com` termina em `/`.
- Empresa envia PDF, RH abre o arquivo pelo link de 60 s, link expira.
- Coordenador só vê as obras dele nas contratações.

**Banco (pgTAP) a acrescentar**
- Toda RPC `security definer` tem `search_path = ''` (consulta em `pg_proc.proconfig`).
- Toda tabela com `empresa_id` tem política de externo restrita à própria empresa.
- `auditoria` não aceita `update`/`delete` por nenhum papel, nem admin.

## Como a CSP foi verificada nesta revisão (virar teste automático)
Build de produção (`next build` + `next start`), Chromium com `securitypolicyviolation` registrado: (1) `/login` e `/recuperar-senha` sem violações; (2) envio do formulário de login funciona (hidratação e Server Action sob a política); (3) HTML injetado com `onerror`/`onload` não executa e imagem de outro domínio é bloqueada (`script-src-attr` e `img-src`). Para virar teste: Playwright com `webServer: next start` e as mesmas asserções.

## Rotina
- Antes do merge: `npm run lint`, `npm run typecheck`, `npm test`, `npm run test:db`.
- Toda RPC nova nasce com um teste de "pode" e um de "não pode" no mesmo PR.
- Todo bug de segurança vira teste que falha antes da correção (como em `revisao_seguranca.test.sql`: 4 testes falham com a função antiga de `cadastrar_pessoa`).
- A cada migration: conferir que `autorizacao_rpcs.test.sql` continua verde (ele pega função nova esquecida sem `revoke` para `anon`).
