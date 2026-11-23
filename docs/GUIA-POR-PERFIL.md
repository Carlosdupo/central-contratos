# Nexus: guia rápido por perfil

Uma página por perfil: o que a pessoa faz, onde e o que recebe de aviso. Vale para o fluxo novo (versão 2). Contratações abertas antes da publicação seguem no fluxo antigo até terminar.

**Para todos**
- O **sino** no topo mostra os avisos. Tem opção de tocar som e de receber e-mail (só chegada de etapa e devolução vão por e-mail; o resto fica no sino).
- **Panorama das obras** (menu Obras): onde está cada contratação, com quem e se o prazo está em dia. Clique numa linha para ver o detalhe.
- **Linha do tempo** e o botão **Devolver para ajuste** estão na tela de cada contratação. Quem é responsável pela etapa atual pode devolver para uma etapa anterior, sempre com motivo.
- Menu **Apoio**: Calendário de suprimentos, Planilhas MO e MAT, Matriz de contratação.

## Coordenador da obra
1. **Nova contratação:** escolha a obra e a **atividade da matriz** (a forma legal aparece ao lado). Informe o escopo e o Valor Orçamento (o campo põe pontos e vírgula sozinho). Se o serviço está na planilha de suprimentos, escolha o **item da planilha**; senão a tela mostra "será negociado a partir de dd/mm" pelo calendário.
2. Marque **aditivo** quando o fornecedor já tem contrato (peça o nº do contrato original no Sienge: prefixo da obra + 4 números, ex.: CT/BL0083). Marque **urgente** com motivo e data de necessidade quando a obra precisa antes do prazo; o prazo do Suprimentos não muda e o gerente é avisado.
3. A abertura já conclui a etapa 1. Você registra as **cotações** (pelo menos uma, até 3), a negociação (se o orçamento é menor que R$ 4.000 a obra pode negociar), a **solicitação no Sienge** e a **alçada**.
4. Aditivo: não há cotações; informe o fornecedor e o valor negociado.
5. **Mais ações → Cancelar contratação** (administrador e coordenador): pede o motivo.
6. **Apoio → Solicitação Sienge** (coordenador e auxiliar): crie a solicitação (ex.: BL0087), abra os serviços da EAP, escreva os itens (descrição, código do serviço, quantidade, unidade, preço de mão de obra e de material; **Repetir por pavimento** cria um item por andar) e clique em **Baixar CSV do Sienge** para importar. A unidade construtiva e a conta financeira ficam no topo e são lembradas na próxima solicitação; o código do serviço é lembrado por serviço da EAP. Outras áreas só veem e baixam.

## Auxiliar de obra
- Vê a obra, abre a solicitação e faz as etapas até a 3 (cotações e primeira negociação). A etapa 4 em diante é só do coordenador. Não cancela nem assina. Aparece no menu como "Ana - Auxiliar Block". Quem cadastra: administrador, em Usuários.

## Suprimentos (comprador)
- **Negociação e autorização** (etapa única): escolha o fornecedor e o valor final, registre novas propostas e informe o e-mail do fornecedor para o portal. **Quem autoriza é o gerente.**
- **Planilhas MO e MAT:** importe o CSV (Excel: Salvar como CSV), edite prazos, responsável e início do pacote na própria linha. Itens sem ID de pacote têm a data digitada à mão. O cronograma é reimportado na administração da obra.

## Gerente de suprimentos
- **Autoriza a contratação:** preencha permuta, faturamento direto, sinal e caução e use o botão único **Autorizar contratação** (confirma antes).
- **Calendário de suprimentos:** define o ano inteiro, dois ciclos por mês (limite para a obra solicitar e início da negociação). Preencha janeiro e copie o padrão. Vale só para o que não está na planilha.
- Recebe o aviso de **urgência**. A urgência é só uma marca; não precisa aceitar nem responder.

## Contratos
- **Contrato no Sienge e minuta:** informe o código do contrato (prefixo + 4 números). No **aditivo**, marque se cabe em **contrato guarda-chuva** (a assinatura não se aplica) ou se precisa de **contrato novo**.

## Assinantes
- Assinam na ordem. A etapa de assinaturas termina com a última assinatura.

## RH
- **Documentação:** a tela mostra "7 de 10 aprovados" e quem falta. **O RH decide e fecha** a etapa, depois de conferir em Análise do RH. Se a empresa já estava liberada na obra, documentação, integração e liberação ficam "Não se aplica".
- **Liberação** para a obra ao final.

## Segurança do trabalho
- **Integração:** agenda e confirma a integração das pessoas da empresa.

## Administrador
- Cadastra obras (inclusive o **prefixo do contrato no Sienge**), usuários, perfis e o nível por obra (coordenador ou auxiliar), importa a EAP e o **cronograma** da obra, e ajusta os parâmetros (prazos, feriados).
- **Reabrir etapa:** reabre uma etapa concluída (com motivo) e refaz as seguintes. Fica na auditoria.
