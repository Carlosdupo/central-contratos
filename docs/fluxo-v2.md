# Fluxo versão 2

Contratações já abertas seguem no **fluxo 1** (12 etapas) até terminar. As novas entram no **fluxo 2**: versão 2 para contratação normal, versão 3 para aditivo. Cada etapa tem uma **chave**; o número é só a posição (no fluxo 2 a etapa 6 não existe e a régua mostra 1, 2, 3...).

## Contratação normal (versão 2)

| Chave | Etapa | Quem | Depende de |
|---|---|---|---|
| `solicitacao` (1) | Solicitação da obra. **A abertura já conclui**; sem itens para marcar | Coordenador / auxiliar | |
| `cotacao` (2) | Cotação com 3 fornecedores | Coordenador / auxiliar | 1 |
| `negociacao_obra` (3) | Equalização e 1ª negociação (pode pular; some quando Suprimentos negocia) | Coordenador / auxiliar | 2 |
| `solicitacao_sienge` (4) | Solicitação no Sienge | Coordenador | 3 |
| `autorizacao` (5) | **Negociação e autorização de Suprimentos**: o comprador preenche fornecedor e valor final; **só o gerente autoriza** (condições + botão único) | Suprimentos; autoriza o gerente | 4 |
| `contrato` (7) | Contrato no Sienge e minuta | Contratos | 5 |
| `alcada` (8) | Aprovação de alçada | Coordenador | 7 |
| `assinaturas` (9) | Assinaturas em ordem | Assinantes | 8 |
| `documentacao` (10) | Documentação da equipe: a tela mostra "7 de 10 aprovados" e quem falta; **o RH decide e fecha** | RH | 5 |
| `integracao` (11) | Integração de segurança | SST | 10 |
| `liberacao` (12) | Liberação para a obra | RH | 8, 9, 11 |

## Aditivo (versão 3)

- `fornecedor_valor` (2): **sem 3 cotações**. A obra informa o fornecedor do contrato e o valor negociado e conclui.
- `solicitacao_sienge` (4) e `autorizacao` (5): como no fluxo normal.
- `contrato_aditivo` (7): Contratos lança no Sienge para medição e marca **cabe em contrato guarda-chuva** ou **precisa de contrato novo**. Guarda-chuva: a assinatura (9) fica "não se aplica". Contrato novo: segue para a assinatura.
- `alcada` (8) continua (lembrar de aprovar no Sienge).

## Empresa já liberada na obra

Conta como "já liberada" a empresa que, ao autorizar, **já estava aprovada (situação `aprovada`) e ligada à obra (ativa)**. Nesse caso documentação, integração e liberação ficam **"Não se aplica: a empresa já está liberada nesta obra"**; a contratação é liberada quando contrato e assinaturas terminam. A conferência acontece uma vez, na autorização (`empresa_ja_liberada`).

## Prazos

O prazo da autorização (etapa 5 do fluxo 2) é o que o gerente tinha na etapa 6; é copiado na abertura. Os demais prazos seguem o número da etapa.
