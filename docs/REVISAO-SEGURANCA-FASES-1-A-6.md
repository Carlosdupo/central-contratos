# Revisão de segurança das fases 1 a 6

Feita na Fase 7, com a **conferência automática** que ficou como teste (`supabase/tests/database/fase_7_seguranca.test.sql`, 18 asserções) para vigiar as próximas migrations.

## O que foi conferido e como
| Item | Como | Resultado |
|---|---|---|
| Toda tabela do schema `public` tem RLS ligada | consulta ao catálogo (teste) | ok |
| Toda função `SECURITY DEFINER` tem `search_path` fixo | catálogo (teste) | ok |
| Visitante sem login não executa nenhuma função | catálogo (teste) | ok |
| Funções do schema `app` executáveis por usuário logado | catálogo (teste, lista permitida) | **achado 1** |
| Tabelas novas: usuário logado só lê, quem grava são as funções; visitante não lê | privilégios (teste) | **achado 2** |
| Funções que só o servidor chama (`gerar_aviso_prazo`, `consumir_limite`, `reservar_notificacoes`) | privilégios (teste) | ok |
| Funções das fases 1 a 6: `SECURITY DEFINER`, abertas ao logado, fechadas ao visitante | catálogo (teste) | ok |
| Avisos e preferências: cada pessoa só lê os seus; planilha segue a regra de quem vê a obra | políticas (teste) | ok |

## Achados e correções (migration `20261116100000_fase_7_endurecimento.sql`, só tira permissões)
1. **15 funções internas do schema `app` executáveis por qualquer usuário logado** (`liberar_etapas`, `exigir_etapa_em_andamento`, `conferir_codigo_sienge`, `criar_checklist_da_etapa`, `criar_usuario_do_auth`, `auditar`, `proteger_ultimo_admin_*`, `existe_outro_admin`, `empresa_do_vinculo`, `validade_documento`, `tocar_parametro`, `pode_agir_como`, `pode_agir_na_etapa`, `pode_na_obra`). Vinham dos `grant execute on all functions in schema app` das primeiras migrations (o mesmo vício que reabriu `ligar_fornecedor` na Fase 1A, já corrigido). O schema `app` **não é exposto pela API** (`config.toml`: só `public`), então não havia chamada pela internet, mas a regra é o mínimo. Agora só ficam abertas as 14 que as políticas de RLS chamam como a própria pessoa; o teste falha se uma migration futura reabrir qualquer outra.
2. **`matriz_contratacao` com permissão de escrita ampla** (a RLS barrava a escrita, mas a permissão da tabela era larga) e leitura para visitante. Revogado.

## O que cada fase já fazia (resumo para a revisão)
- **1A/1B:** `cancelar_contratacao` mantém admin verificado ou coordenador **da obra**, motivo de 5+ letras e `search_path` fixo; botão único da autorização reaproveita as funções que conferem permissão; código do Sienge conferido no banco (`conferir_codigo_sienge`); matriz só leitura.
- **2:** auxiliar só nas etapas 1 a 3 da própria obra (`app.pode_agir_na_etapa`), não cancela nem assina; devolução só pelo responsável da etapa atual, com motivo; histórico em tabela só-leitura para o cliente.
- **3:** cada pessoa só lê os próprios avisos; e-mail só com código e link, só para chegada e devolução, com limite de 20 por hora por pessoa; avisos de prazo só pelo servidor.
- **4:** só o gerente autoriza (conferido na conclusão e nas condições); só o RH fecha a documentação; aditivo só pelo papel de cada etapa.
- **5:** só o gerente define o calendário; só Suprimentos importa e edita a planilha; cronograma só administrador ou gerente; CSV com limite de 1,5 MB, tipo conferido, e a leitura só aceita datas e números válidos (o banco confere de novo); tudo fica na auditoria.
- **6:** sem migration; o panorama lê com a RLS de quem consulta (cada um só vê as obras que pode ver).

## Pontos em aberto (não bloqueiam, mas ficam registrados)
- `components/app/documentos.tsx` (envio de documentos do portal, anterior a estas fases) ainda usa um campo de arquivo comum, com nome acessível; migrar para o `CampoArquivo` quando mexer nele.
- `app.url_site()` (endereço nos e-mails) está fixo em `https://nexus-terceiros.vercel.app`; mudar o domínio exige uma migration.
- Pendências antigas do roadmap: banco de produção em São Paulo antes de dados reais, e-mail com domínio da empresa (Resend) e Clicksign. O e-mail com domínio próprio pesa mais agora, com os avisos internos.
- As telas novas foram conferidas em jsdom, com teste de agente e contraste dos tokens nos dois temas; **falta a passada visual no navegador, com dados reais e leitor de tela**, que deve ser feita no teste com um usuário de cada perfil antes de liberar.
