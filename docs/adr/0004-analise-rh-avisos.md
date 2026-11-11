# ADR 0004: Análise do RH e avisos (F3)

Data: 11/11/2026 · Situação: aceita

1. **Análise documento por documento**: cada envio guarda os itens (documento e versão do arquivo) em `envio_itens`. O RH aprova ou reprova cada um, com motivo obrigatório para reprovar. Só o RH com verificação em duas etapas consegue (`app.rh_verificado()`, conferido no banco).
2. **Conclusão atômica** (`concluir_envio`): aplica as decisões nos documentos e atualiza a situação da empresa ou da pessoa na obra:
   - pessoa com reprovação → pendente;
   - pessoa aprovada com a empresa aprovada → integração agendada;
   - pessoa aprovada com a empresa ainda não aprovada → aguardando a empresa;
   - empresa aprovada → quem aguardava entra na integração.
3. **Data da integração**: calculada no servidor (`modules/terceiros/dominio/integracao.ts`): até o horário de corte (parâmetro, 18h), o próximo dia útil; depois, o dia útil seguinte. Pula fins de semana e feriados. O banco recusa datas no passado.
4. **Avisos (outbox)**: `concluir_envio` e `decidir_visita` gravam o aviso em `notificacoes` na mesma transação. O envio pelo Resend é feito logo depois (melhor esforço) e repetido pela tarefa agendada `/api/cron/notificacoes` (protegida por `CRON_SECRET`). E-mails sem dado de saúde, só o resultado e o link do portal.
5. **Pendente (P20)**: sem `RESEND_API_KEY` e `EMAIL_REMETENTE` (domínio verificado no Resend), os avisos ficam na fila e aparecem no portal, em "Avisos recebidos". A tela do RH avisa que o e-mail não está configurado.
6. **Tarefa agendada**: no plano gratuito da Vercel, só uma execução por dia (`vercel.json`). No plano Pro, dá para passar a cada 10 minutos.
7. **Documento com foto da visita**: aberto por link de 60 s, só para o RH. Ainda não grava em `acessos_documentos`, porque não é um documento do catálogo. Fica para a F7 (revisão de LGPD).
