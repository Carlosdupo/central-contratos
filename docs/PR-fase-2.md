# Fase 2: Auxiliar de Obra e devolução de etapa

**Esta branch (`fase-2-auxiliar-devolucao`) parte da `fase-1b-matriz`** (já com a 1A). As migrations 1A e 1B já estão no banco de desenvolvimento; por isso saíram dos testes as linhas `-- migration:` delas. A única migration pendente é a desta fase.

## O que mudou
- **Auxiliar de obra.** Em vez de um novo valor no enum de papéis, o nível fica em `usuario_obras.nivel` (`coordenador`, padrão, ou `auxiliar`). Motivos: é por obra (a mesma pessoa pode coordenar uma obra e ser auxiliar em outra) e dá para testar no banco sem aplicar nada (um valor novo de enum não pode ser usado na mesma transação em que nasce). O usuário continua com o papel `coordenador_obra`.
  - O auxiliar vê a obra, **abre a solicitação** e age nas **etapas 1 a 3**. Da etapa 4 em diante é só do coordenador. Não cancela e não assina (`app.pode_agir_como` passou a exigir nível coordenador; `app.pode_agir_na_etapa` libera o auxiliar até a etapa 3; `app.exigir_etapa_em_andamento` e `abrir_contratacao` usam isso).
  - Tela de usuários (admin): em cada obra há "Auxiliar em …" ao lado da obra marcada.
  - No menu, quem é auxiliar em todas as obras aparece como "Ana - Auxiliar Block". O painel e o contador do menu não mostram ao auxiliar as etapas 4 em diante da obra dele.
- **Devolver para ajuste.** Botão na etapa em andamento (para quem é responsável por ela): janela com a etapa de destino e o motivo (obrigatório, 5+ letras). `devolver_etapa(contratacao, de, para, motivo)`: só vale para uma etapa anterior já concluída da qual a atual depende; a etapa escolhida reabre com o **prazo recomeçando**; as etapas que **dependem** dela voltam a pendente (inclusive as paralelas), com checklist limpo e, se for o caso, as assinaturas desfeitas.
- **Histórico.** Tabela `contratacao_devolucoes` (quem, quando, de qual etapa, para qual, motivo; leitura pelas mesmas regras de visibilidade da obra). Na etapa devolvida aparece a faixa "Devolvida por Fulano: motivo". A tela da contratação ganhou a **linha do tempo** (abertura, etapas concluídas, devoluções e reaberturas).
- **Reabrir etapa (administrador)** passa pela mesma função (`reabrir_etapa` → `app.recuar_para_etapa`): agora também recua as etapas seguintes, e fica no histórico como "reabertura".

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (87 testes): passam.
- Banco: teste novo `supabase/tests/database/fase_2_auxiliar_e_devolucao.test.sql` (24 asserções): auxiliar abre e conclui a etapa 1; não cancela; auxiliar de outra obra não age nem abre; auxiliar não age na etapa 4 e o coordenador sim; só o responsável pela etapa devolve; motivo curto e destino inválido são recusados; a devolução reabre a etapa, limpa o checklist, recomeça o prazo e grava o histórico; a reabertura do administrador recua as etapas dependentes e as paralelas e desfaz as assinaturas. Também rodei os testes de contratações, acesso do fornecedor, autorização, 1A, 1B, administração e revisão de segurança **com esta migration aplicada dentro da transação**: todos passam.
- Testes de tela (`tests/ui/fase-2.test.tsx`): janela de devolução e linha do tempo, com o teste de agente. Unitário: nome do auxiliar no menu.

## Atenção
- **A migration `20261115170000_fase_2_auxiliar_e_devolucao.sql` AINDA NÃO FOI APLICADA.** Aplicar só depois da revisão e junto da publicação deste código. Depois de aplicar, apagar a linha `-- migration:` do topo do teste da fase 2.
- O aviso ao responsável (notificação e e-mail) **não está nesta fase**: entra na Fase 3 (notificações). Por enquanto o responsável vê a faixa na etapa e o contador do painel.
- Se alguém precisar do auxiliar como valor próprio no enum de papéis, dá para migrar depois; a regra no banco está concentrada em `app.pode_agir_como` / `app.pode_agir_na_etapa`.
- `lib/supabase/tipos.ts` atualizado à mão (sem `db:tipos`).
