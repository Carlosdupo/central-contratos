# Dívida técnica: levantamento de 13/11/2026

Pontuação: **prioridade = (impacto + risco) × (6 − esforço)**, cada nota de 1 a 5 (esforço 1 = rápido). O que já foi resolvido na revisão está no [ADR 0006](adr/0006-revisao-de-seguranca.md).

| # | Item | Tipo | Impacto | Risco | Esforço | Prioridade |
|---|---|---|---|---|---|---|
| 1 | Nada avisa se a tarefa agendada (`/api/cron/*`) parar de rodar | Infraestrutura | 4 | 4 | 2 | **32** |
| 2 | Backup e restauração do Supabase não testados (a confirmar o plano contratado) | Infraestrutura | 5 | 3 | 2 | **32** |
| 3 | Registro de arquivo aceita tipo, tamanho e hash declarados pelo cliente | Arquitetura | 3 | 4 | 3 | **21** |
| 4 | Cadastro de pessoa sem limite de tentativas (CPF existente é detectável) | Código | 2 | 3 | 2 | **20** |
| 5 | Só `console.error`, sem monitoramento de erros nem alertas | Infraestrutura | 3 | 3 | 3 | **18** |
| 6 | Dígito verificador de CPF/CNPJ só no TypeScript | Código | 2 | 2 | 2 | **16** |
| 7 | "Todos os documentos anexados" só conferido no servidor | Arquitetura | 2 | 3 | 3 | **15** |
| 8 | Auditoria cresce sem limite e guarda a linha inteira | Arquitetura | 2 | 3 | 3 | **15** |
| 9 | `lib/supabase/tipos.ts` ajustado à mão neste lote | Código | 1 | 2 | 1 | **15** |
| 10 | Sem testes das ações do servidor e sem teste de ponta a ponta | Testes | 4 | 3 | 4 | **14** |
| 11 | Captcha no login e na recuperação de senha | Segurança | 2 | 2 | 3 | **12** |
| 12 | 13 alertas moderados no `npm audit` só de desenvolvimento | Dependências | 1 | 1 | 1 | **10** |

## Detalhe e por que importa

1. **Cron sem alarme.** `CRON_SECRET` é opcional no esquema (`lib/env.ts`): se faltar na Vercel, as duas rotas respondem 401 e ninguém vê. Sem o `processar_vencimentos`, documentos vencidos não bloqueiam ninguém e os avisos de 30/15/0 dias não saem. *Fazer:* tornar obrigatório em produção; gravar a hora da última execução (`parametros` ou tabela própria) e mostrar um aviso vermelho no painel do admin quando passar de 26 horas; opcionalmente um monitor externo (ex.: Healthchecks.io) chamado no fim da rota.
2. **Backup.** Os documentos do RH (ASO, contratos) e a trilha de auditoria vivem só neste banco. *Fazer:* confirmar no painel o plano, o período de backup e se há recuperação em ponto no tempo; fazer **uma restauração de teste** em projeto separado e anotar o passo a passo em `docs/`. No plano gratuito do Supabase os projetos podem pausar por inatividade; conferir.
3. **Registro de arquivo.** `registrar_arquivo_empresa` e `registrar_arquivo_pessoa` são chamáveis direto pelo navegador (a chave publicável é pública). `mime`, `tamanho` e `sha256` são os que o cliente disser; a conferência dos primeiros bytes só existe em `confirmarArquivo`. Um usuário de empresa mal-intencionado pode registrar um arquivo sem passar por ela. *Fazer:* a função passa a exigir que o objeto exista em `storage.objects` (e usar `metadata->>'size'`), ou a gravação passa a ser feita só pelo servidor (`service_role`, recebendo o usuário como parâmetro). Não dá para checar bytes em SQL; o segundo caminho é o completo.
4. **Cadastro de pessoa.** Depois do ADR 0006 o cadastro não vaza nome nem telefone, mas "recusado" ainda significa "CPF existe". *Fazer:* `dentroDoLimite("cadastro-pessoa", empresaId, 30, 3600)` em `cadastrarPessoa` e registrar tentativas recusadas na auditoria.
5. **Observabilidade.** Os logs de `[limites]`, `[notificacoes]` e `[recuperar-senha]` ficam só nos logs da Vercel. *Fazer:* Sentry (ou o monitor de erros da própria Vercel) com alerta por e-mail para erros 500 e para falhas de cron.
6. **CPF/CNPJ.** `cpfValido` e `cnpjValido` vivem em `lib/documentos-br.ts`; o banco só confere 11 ou 14 dígitos. Qualquer chamada direta passa um CPF inválido. *Fazer:* função `app.cpf_valido` com o mesmo cálculo e um `check` na tabela `pessoas`/`empresas_terceiras` (`not valid` primeiro, para não quebrar dado antigo).
7. **Envio completo.** `enviar_documentos_empresa` e `enviar_documentos_pessoa` só exigem "pelo menos um anexado". A regra da matriz documental (nada obrigatório faltando) está em `modules/terceiros/dominio`. Impacto baixo (o RH reprova), mas é regra de negócio fora do banco. *Fazer:* mover `documentosExigidos` para uma função SQL ou repetir a checagem na RPC.
8. **Auditoria.** O gatilho grava `antes` e `depois` completos em toda alteração, para sempre. *Fazer:* decidir retenção (ex.: 5 anos), índice por `(tabela, em)`, e rotina de arquivamento; revisar se alguma tabela guarda dado pessoal que não precise ir inteiro para a auditoria.
9. **tipos.ts.** Rodar `npm run db:tipos` depois do `db:push` e commitar. O CI pode comparar (`git diff --exit-code lib/supabase/tipos.ts`) para ninguém esquecer.
10. **Testes.** Hoje: 55 testes de regras (Vitest) e 173 do banco (pgTAP); nenhum cobre `modules/*/acoes.ts` (limite, rollback de convite, ban) nem o navegador. Ver [PLANO-DE-TESTES.md](PLANO-DE-TESTES.md).
11. **Captcha.** Cloudflare Turnstile (gratuito): ligar no painel do Supabase (Authentication → Attack Protection), colocar o widget nos formulários de login e recuperação e passar `captchaToken` em `signInWithPassword` e `resetPasswordForEmail`. A CSP precisa liberar `https://challenges.cloudflare.com` em `script-src`/`frame-src`/`connect-src`.
12. **Dev-only.** Vêm do `shadcn` (já em `devDependencies`). Com o Dependabot semanal tende a sumir sozinho.

## Plano em fases (junto com o trabalho normal)
- **Fase 1, esta semana** (itens 1, 2, 9): cron obrigatório e com alarme, backup testado, tipos conferidos no CI. Meio dia de trabalho, retorno alto.
- **Fase 2, próximas 2 a 3 semanas** (3, 4, 6, 5): registro de arquivo seguro, limite no cadastro, CPF/CNPJ no banco, monitor de erros.
- **Fase 3, quando houver folga** (7, 8, 10, 11): regra de envio completo no banco, retenção da auditoria, testes das ações e e2e, captcha.

## O que NÃO é dívida (decisões deliberadas)
Sem cache de dados do usuário no servidor (ADR 0001); fonte do sistema no lugar de fonte web (visual do protótipo); `service_role` só em cron, convite e URLs assinadas.
