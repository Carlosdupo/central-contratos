# Fase 6: panorama novo

**Esta branch (`fase-6-panorama`) parte da `fase-5-suprimentos`.** Abrir este pull request depois do da Fase 5. **Não há migration nesta fase** (nada a aplicar no banco): a tela lê as tabelas que já existem.

## O que mudou
Troca da tabela larga com barra de arrastar por uma tela compacta, conforme a maquete aprovada (`docs/prototipo/nexus-panorama-maquete.html`):
- **Resumo no topo:** em andamento (e em quantas obras), com atraso, urgentes, vencem hoje e liberadas, para a obra escolhida ou todas.
- **"Com quem estão as contratações em andamento":** uma faixa por área (Obra, Suprimentos, Contratos, Assinaturas, RH, Segurança) com a contagem e quantas estão atrasadas; tocar numa área filtra a lista.
- **Filtros:** por obra, por situação (todas, em andamento, com atraso, urgentes, liberadas, com contagem em cada) e busca por serviço, fornecedor, código ou nº do Sienge (sem diferenciar acento).
- **Uma linha compacta por contratação, agrupada por obra:** serviço e código, selos (Urgente, Aditivo de…, Pedido fora do prazo), **trilha de etapas** (7 blocos em vez de 12 colunas), com quem está e o prazo, fornecedor, valor e contrato no Sienge. As atrasadas e urgentes vêm primeiro. Sem rolagem lateral: no celular cada linha vira um bloco.
- **Detalhe ao clicar** (janela lateral do UI SDK): avisos (urgência, etapa devolvida com quem e quando, pedido fora do prazo, empresa já liberada), dados da contratação e as etapas com situação, data de conclusão e prazo; botão "Abrir contratação".
- **Acessibilidade:** a trilha tem texto para leitor de tela ("Etapa 5 de 11: Negociação, com Suprimentos. Atrasada 2 dias úteis.") e **não depende só de cor**: concluída é cheia, atual é mais alta, atual com atraso é listrada, ainda não chegou é só o contorno, não se aplica é tracejada; há legenda escrita. Os controles têm nome e a lista anuncia mudanças de filtro.
- **Consulta única** (`modules/contratacoes/panorama.ts`): contratações, etapas, devoluções e obra numa só consulta, limitada pela RLS às obras que a pessoa vê (cada um só vê as obras a que tem acesso). Mostra as 500 mais recentes; se a lista crescer além disso, o próximo passo é paginar por obra. Etapas e nomes seguem a versão do fluxo de cada contratação (fluxo 1, 2 ou aditivo).
- A regra do panorama (áreas, trilha, filtros, resumo, ordem) está em `lib/panorama.ts`, sem depender da tela, e tem testes próprios.

## Como foi testado
- `npm run lint`, `npm run typecheck` e `npm test` (134 testes): passam.
- Unitários (`tests/unit/panorama.test.ts`): área pelo papel, estado de cada segmento da trilha, blocos, texto da trilha (inclusive etapas em paralelo), texto do prazo, filtros, resumo, contagem por área e ordem na lista.
- Tela (`tests/ui/fase-6.test.tsx`): resumo e áreas, texto da trilha, filtros por obra, situação e busca, lista vazia, detalhe com etapas e aviso de urgência, e o teste de agente (todo controle tem nome).

## Atenção
- **Não consegui abrir o site no navegador nem rodar `next build`** nesta cópia de trabalho (a build do Next não resolve o `node_modules` ligado por atalho). Falta a conferência visual com dados reais e dos contrastes nos dois temas; os estilos usam só os tokens do Nexus (`app/globals.css`, bloco "Panorama das obras").
- A maquete usa 11 etapas; o sistema mostra as etapas reais de cada contratação (11 no fluxo 2, 12 no fluxo 1, 10 no aditivo).
- A função antiga `panoramaDasContratacoes` continua existindo porque o painel de Suprimentos ainda a usa.
