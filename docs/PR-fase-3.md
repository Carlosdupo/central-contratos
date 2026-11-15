# Fase 3: avisos internos (sino e e-mail) e urgência

**Esta branch (`fase-3-notificacoes`) parte da `fase-2-auxiliar-devolucao`.** Abrir este pull request depois do da Fase 2 (a migration da Fase 2 já está no banco de desenvolvimento, por isso saiu a linha `-- migration:` dela dos testes da Fase 2 e da Fase 3). A única migration pendente é a desta fase.

## O que mudou
- **Sino no topo** (Popover do UI SDK): contador, lista dos últimos 20 avisos com link para a contratação, "Marcar todos como lidos" e duas chaves (Switch do UI SDK): tocar som e receber por e-mail, por pessoa. O aviso **nunca depende só do som**: aparece escrito na lista, o botão diz "Avisos, N não lidos" e a chegada de aviso novo é anunciada ao leitor de tela. O som é curto e gerado na hora, só toca com o sistema aberto e depois de um clique na página, e só se a pessoa não silenciou. A tela busca avisos novos a cada 60 segundos.
- **Avisos gerados no banco** (trigger em `contratacao_etapas`, então vale para qualquer caminho): chegou etapa para a sua área (quem age nela; o auxiliar da obra nas etapas 1 a 3), devolução e reabertura (com o motivo no sino), contratação autorizada (etapa 6, avisa a obra), empresa liberada (etapa 12, avisa a obra) e urgência (avisa o gerente de suprimentos).
- **Prazo vencendo ou vencido:** tarefa diária nova (`/api/cron/prazos`, 10h UTC em `vercel.json`) que avisa quem age na etapa quando o prazo vence hoje, amanhã ou já venceu, usando a mesma conta de prazo da tela (dias úteis e feriados). O banco guarda um aviso por pessoa, etapa, tipo e dia, então repetir a tarefa não duplica.
- **E-mail** pela fila que já existe (`notificacoes`), **só para chegada de etapa e devolução/reabertura** (decisão de 15/11); urgência, prazo, autorizada e liberada ficam só no sino. Leva só o código da contratação e o link. O motivo fica só no sino. Limite de 20 e-mails por pessoa por hora; passou disso, o aviso fica só no sino. O envio sai logo depois da ação (`after`) e a tarefa diária repete o que falhar.
- **Urgência:** na abertura (marcar, motivo e data de necessidade) e na tela da contratação (marcar ou tirar, para coordenador e auxiliar da obra). `marcar_urgencia` exige motivo (5+ letras) e data. Não muda o prazo e o gerente não precisa aceitar. Selo "Urgente" na lista, no panorama, no topo da contratação e **no topo da fila de Suprimentos** (a fila também passa a ordenar urgentes primeiro).
- Privacidade: cada pessoa só lê os próprios avisos (RLS); ninguém grava aviso direto; `gerar_aviso_prazo` só o servidor executa.

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test` (95 testes): passam.
- Banco: teste novo `supabase/tests/database/fase_3_avisos_e_urgencia.test.sql` (28 asserções): aviso de chegada para coordenador e auxiliar da obra, ninguém de outra obra; cada um lê só os seus e ninguém grava direto; e-mail só com código e link; sem e-mail para quem desligou; urgência (motivo e data obrigatórios, auxiliar marca, quem não é da obra não marca, gerente avisado com o motivo); devolução avisa com o motivo e não gera também o aviso de chegada; etapa 6 avisa a obra; `gerar_aviso_prazo` fechado para usuário logado. Os testes das fases anteriores (contratações, fornecedor, autorização, 1A, 1B, administração, revisão de segurança, análise do RH, integração e vencimentos) também passam **com esta migration aplicada dentro da transação**.
- Testes de tela (`tests/ui/fase-3.test.tsx`): sino (contador, lista, ler tudo, preferências, anúncio por escrito, teste de agente), campos de urgência na abertura e selo. Unitário: regra do aviso de prazo.

## Atenção
- **A migration `20261115190000_fase_3_avisos_e_urgencia.sql` AINDA NÃO FOI APLICADA.** Aplicar só depois da revisão e junto da publicação deste código. Depois, apagar a linha `-- migration:` do topo do teste da Fase 3.
- O endereço usado nos e-mails (`https://nexus-terceiros.vercel.app`) está na função `app.url_site()`; mudar o domínio exige uma migration.
- Ficou fora (decidido no plano): a marca automática "fora do prazo do calendário" entra na Fase 5; a etapa 9 (assinaturas) não gera aviso de chegada porque não tem um papel único; "empresa liberada" avisa a obra, não a empresa (o convite do portal continua como antes).
- `lib/supabase/tipos.ts` atualizado à mão (sem `db:tipos`).
