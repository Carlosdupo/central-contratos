# ADR 0005: Integração e vencimentos (F4 e F5)

Data: 11/11/2026 · Situação: aceita

1. **Integração (F4)**: só a segurança do trabalho, com verificação em duas etapas (`app.sst_verificado()`), registra presença ou falta. **Presença** libera a pessoa para aquela obra. **Falta** remarca para o próximo dia útil (calculado no servidor, com feriados). As duas geram aviso para a empresa.
2. **Vencimentos (F5)**: `processar_vencimentos(hoje)` roda todo dia pela tarefa agendada `/api/cron/vencimentos` (só a chave de servidor executa; usuários logados não conseguem).
   - documento aprovado que passou da validade → **vencido**;
   - pessoa com documento vencido → **bloqueada** na obra, com o motivo (A5);
   - documento **da empresa** vencido → empresa pendente e equipe liberada bloqueada;
   - avisos a **30, 15 e 0 dias** do vencimento, um por marco, sem repetir se rodar de novo (`avisos_vencimento`).
3. **Renovação**: o documento vencido volta a aceitar arquivo. Depois de reaprovado, quem **já tinha feito a integração volta direto para liberado**. Reintegração periódica depende da **P5**.
4. **Pendentes**:
   - **P12**: quem recebe os avisos de vencimento além da empresa (RH? coordenador?);
   - **P11**: consequência do atraso das guias mensais de FGTS/INSS (hoje só aparece como pendência no portal, sem bloqueio);
   - **renovação antecipada**: trocar um documento ainda válido antes de vencer, sem bloquear a pessoa. Hoje só é possível depois de vencer. Precisa de decisão de negócio.
