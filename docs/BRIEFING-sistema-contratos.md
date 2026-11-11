# Briefing: Central de Contratos de Obra

Documento de contexto para continuar o projeto com outra pessoa ou outra IA.
Atualizado em 10/11/2026.

## 1. O que é

Sistema web próprio de uma construtora (Santa Maria Imóveis aparece nos links internos) para:

1. **Contratação de empreiteiros:** da solicitação da obra até a liberação da equipe na obra.
2. **Gestão de terceiros:** portal onde a empresa terceirizada envia os documentos da empresa e dos funcionários. O RH confere, e a segurança do trabalho faz a integração.

Hoje o processo roda em planilha compartilhada, e-mail, Google Drive, Zoho e Sienge (ERP). O sistema **não substitui o Sienge**: ele organiza o fluxo em volta dele, e o lançamento no Sienge vira uma etapa marcada no sistema.

**Fora do escopo por enquanto:** o fluxo de medição (decisão do usuário em 10/11/2026). Pode voltar no futuro.

## 2. Referências de mercado analisadas

| Site | O que aproveitar |
|---|---|
| ergopass.com.br | Melhor referência. Fluxo em 5 passos (matriz, contrato, envio, análise, acesso), portal da contratada sem custo para ela, avisos de vencimento, consulta de portaria, passaporte com QR code, trilha de auditoria, LGPD |
| bmtcloud.com.br/produtos/vega | Dois portais (empresa e fornecedor), documentos mensais recorrentes, aprovação por área, histórico do trabalhador pelo CPF, controle de máquinas, integração com catraca e assinatura eletrônica |
| 4f.eng.br | Plataforma ampla para construção (SST, obras, RH, terceiros, planejamento). Análise documental com IA |

Nenhum código foi copiado. O sistema é construído do zero.

## 3. Arquivos

- `sistema-contratos/prototipo-contratacao.html`: protótipo clicável (HTML, CSS e JavaScript num arquivo único, sem servidor). Os dados de exemplo ficam salvos no localStorage do navegador.
- Versão publicada: https://claude.ai/artifact/VCwXJjmoFB8Fithony9V8a
- Fluxo original da empresa: `FLUXO - CT E MED REV08.xlsx`. As abas "CONTRATAÇÃO REV FINAL" e "OBS SOLICITAÇÃO" são as que valem.

## 4. Perfis (quem usa)

Coordenador de obra · Suprimentos (e gerente de suprimentos) · Contratos (Pamela) · Direção · RH (Taiana e Elaine) · Segurança do trabalho (Elaine) · Empresa terceirizada (portal externo).

## 5. Fluxo de contratação (12 etapas)

**Abertura obrigatória pela obra:** obra, serviço/escopo, pacote do planejamento, valor orçado, tipo de contrato (1. serviço único sem medição · 2. serviço para contrato · 3. aditivo). Anexos: planilha de importação do Sienge e planilha de solicitação (modelo RH).

| # | Etapa | Área | Prazo | Regras |
|---|---|---|---|---|
| 1 | Escopo do serviço | Obra | a definir | Escopo atende um pacote do planejamento |
| 2 | Cotação com 3 fornecedores | Obra | a definir | 3 cotações assinadas |
| 3 | Equalização e 1ª negociação | Obra | a definir | **A obra pode pular** ("deixar para Suprimentos"). **Abaixo de R$ 4.000** (valor orçado), a obra pode escolher fornecedor e valor |
| 4 | Solicitação de serviço no Sienge | Obra | a definir | Anexar planilhas de equalização e importação; registrar o nº da solicitação |
| 5 | Validação e negociação | Suprimentos | a definir | **A partir de R$ 4.000, Suprimentos define fornecedor e valor.** Pede proposta atualizada, cartão CNPJ e contrato social; registra o valor negociado |
| 6 | Autorização do gerente de suprimentos | Suprimentos | a definir | **Só um botão "Autorizar"**. A data fica registrada sozinha (antes ia para a planilha compartilhada) |
| 7 | Contrato no Sienge e minuta | Contratos (Pamela) | 7 dias | Registrar o código do contrato no Sienge |
| 8 | Aprovação de alçada | Obra (coordenador) | a definir | No Sienge |
| 9 | Assinaturas | 5 assinantes | 3 dias | Ordem fixa: Coordenador → Suprimentos → Fornecedor → Direção → RH |
| 10 | Documentação dos funcionários | RH | **2 dias úteis** | Corre **em paralelo** às etapas 7 a 9; usa o portal de terceiros |
| 11 | Integração de segurança | Segurança do trabalho | 2 dias úteis | |
| 12 | Liberação para a obra | RH | a definir | Só depois das etapas 9 e 11 |

Painel: etapas em aberto com responsável, dias parados e situação do prazo (no prazo, vence hoje, atrasada), além da carga de etapas por área.

## 6. Gestão de terceiros

### 6.1 Entrada da empresa
- Suprimentos ou Contratos **convida** a empresa (razão social, CNPJ, e-mail, telefone, obra). Não há cadastro aberto.
- Primeiro acesso pelo link do convite: confirma o telefone e cria a senha. O restante do cadastro é feito depois, com uma tela "o que falta".
- Nenhum funcionário é liberado enquanto os documentos da empresa não forem aprovados.

### 6.2 Documentos da empresa
- CND federal válida (se houver pendência, aceita a positiva com efeito de negativa)
- FGTS e INSS: guias e comprovantes de pagamento, **todo mês** até o fim do contrato
- Nome e telefone da contabilidade
- PCMSO, PGR e LTCAT válidos e assinados
- NR-05 (CIPA): exigido automaticamente quando a empresa tem **mais de 5 pessoas na obra**

### 6.3 Documentos por pessoa
| Documento | Funcionário | Sócio com acesso diário | Validade |
|---|---|---|---|
| ASO | ✓ | ✓ | **1 ano** |
| RG ou CNH | ✓ | ✓ | 10 anos |
| Contrato de trabalho/experiência assinado | ✓ | | |
| eSocial | ✓ | | |
| Ficha de registro assinada | ✓ | | |
| Ordem de serviço atualizada e assinada | ✓ | | |
| Ficha de EPI atualizada e assinada | ✓ | ✓ | |
| NR-06, NR-12, NR-18, NR-35 | ✓ | ✓ | 2 anos |
| NR-10 + formação técnica | só para eletricidade | | 2 anos |

Outros certificados específicos da função: a definir na matriz.

**Sócio com acesso esporádico:** não envia documentação. Pede a visita com no mínimo 1 dia de antecedência e anexa um documento com foto (substitui o e-mail para terceiros@santamaria.com.br). O RH aprova a visita.

### 6.4 Cadastro de pessoa
Nome, CPF (identificador único, guarda o histórico entre empresas), telefone, foto, tipo (funcionário, sócio diário, sócio esporádico), função e se trabalha com eletricidade. Ao salvar, a lista de documentos certa abre sozinha. Cada documento pede o arquivo e a data de emissão (ou de validade), e o sistema calcula o vencimento. Documento vencido não é aceito.

### 6.5 Análise do RH
- A empresa clica em "Enviar para análise" (só fica ativo com tudo anexado) e começa o prazo de **2 dias úteis** do RH.
- O RH aprova ou reprova **documento por documento**. Reprovar exige o motivo.
- Ao concluir, a empresa recebe um aviso: "Funcionário X aprovado para entrar na obra Y. Integração em dd/mm" ou a lista do que está pendente, com os motivos.
- Canal: **e-mail na primeira versão**. O WhatsApp fica para depois (API oficial do WhatsApp Business, paga por conversa, com mensagens aprovadas antes).

### 6.6 Integração
- Quem o RH aprova **até as 18h** entra na lista de integração do **próximo dia útil**. Depois das 18h, vai para o dia útil seguinte. Sem fins de semana (os feriados ainda faltam).
- A segurança do trabalho marca "Presente" (a pessoa fica liberada para a obra e a empresa é avisada) ou "Não compareceu" (remarca para o dia útil seguinte).

### 6.7 Vencimentos (para a versão real)
Avisos 30 dias antes, 15 dias antes e no dia. No vencimento, a pessoa é bloqueada automaticamente. Documentos mensais geram uma pendência todo mês.

## 7. Decisões já tomadas

- Valor de corte de R$ 4.000 para a obra escolher fornecedor e valor (considerado sobre o valor orçado; confirmar).
- A obra pode pular a negociação.
- O gerente de suprimentos só autoriza.
- O prazo do RH é de 2 dias úteis. O ASO vale 1 ano. O corte da integração é às 18h.
- A medição fica fora por enquanto.
- O visual segue o estilo Apple (macOS/iOS): fonte do sistema, listas agrupadas, cartões brancos sobre fundo cinza-claro, azul como cor principal, temas claro e escuro.

## 8. Em aberto

1. Prazos das etapas 1 a 6, 8 e 12 da contratação.
2. Se os R$ 4.000 valem sobre o valor orçado ou sobre o valor da cotação.
3. Matriz de certificados por função (além do NR-10 para eletricidade).
4. Calendário de feriados e quantas vagas por dia na integração.
5. Portaria e crachá com QR code: escopo e quando entram.
6. Integração com o Sienge via API: quando e o quê (lançar solicitação e contrato automaticamente?).
7. Quem administra os cadastros (obras, usuários, perfis).

## 9. Sugestão técnica para a versão real

- **Front-end:** Next.js (React) com o mesmo visual do protótipo.
- **Back-end e dados:** Supabase (Postgres, login, armazenamento de arquivos, regras de acesso por linha, para que cada empresa veja só os próprios dados).
- **E-mail:** um serviço como Resend ou Amazon SES.
- **Tarefas agendadas:** avisos de vencimento e virada do mês.
- **Hospedagem:** Vercel ou similar.
- **LGPD:** o ASO é dado de saúde. Exige acesso restrito, registro de quem abriu cada documento, termos de uso e política de privacidade, e contrato de operador de dados.

Ordem sugerida do MVP: login e perfis → módulo de terceiros (portal, RH, integração, e-mail) → fluxo de contratação → vencimentos automáticos → portaria/QR code → integração com o Sienge.
