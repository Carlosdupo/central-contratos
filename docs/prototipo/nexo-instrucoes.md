# Nexo: ajustes visuais e de acessibilidade

Cole este arquivo inteiro no Claude Code, na pasta do repositório `central-contratos`. Coloque também o arquivo `nexo-maquete.html` (enviado junto) em `docs/prototipo/nexo-maquete.html`. Ele é a referência visual. Abra no navegador para ver cada tela.

## Contexto

O sistema se chama agora **Nexo** (antes "Central de Contratos"). Ele organiza a contratação de empreiteiros e a gestão de terceiros de uma construtora: documentos, análise do RH, integração de segurança e liberação para a obra. O briefing está em `docs/BRIEFING-sistema-contratos.md` e as decisões técnicas em `docs/adr`.

Stack (conforme o README): Next.js 16 com App Router, React 19, TypeScript, Tailwind CSS 4, Supabase, Zod, Vitest, Vercel.

Este trabalho é **só de interface**: nome, logo, cores, menu, telas, textos e acessibilidade.

## Limites (leia antes de começar)

- Não crie migrations, não altere tabelas, RLS, funções do banco nem o fluxo de autenticação.
- Não altere regras de negócio (prazos, alçadas, valor de corte, bloqueios). Se algo parecer regra de negócio, pare e me pergunte.
- Toda gravação continua passando por Server Action com `exigirPapel(...)` e validação com Zod. Não abra exceção.
- Não adicione dependência nova sem justificar no PR. Prefira o que já existe.
- Não mexa em dados de teste do banco. Eu limpo depois pelo painel.
- Mantenha `npm run lint`, `npm run typecheck` e `npm test` passando a cada etapa.

## Como trabalhar

1. Antes de editar, **explore o código e me mostre um plano curto**: quais arquivos de layout, menu, tokens e telas você achou, e em que ordem vai mexer. Eu não vi o código, então os caminhos citados abaixo são suposições. Confirme cada um.
2. Crie uma branch `nexo-visual`. Faça **um commit por etapa**, com mensagem em português.
3. Ao fim de cada etapa, abra a tela no navegador em **1280 px e 400 px**, nos temas **claro e escuro**, e confirme que não há rolagem lateral na página.
4. Abra um pull request em português com a lista do que mudou e capturas de tela antes e depois.

## Etapa 1: Nome Nexo

- Procure todas as ocorrências de "Central de Contratos" (`grep -ri "central de contratos"`) e troque por **Nexo** onde for nome do produto: título das abas, logo, tela de entrada, modelos de e-mail em `supabase/templates`, README.
- Título das páginas no formato `Painel · Nexo` (use `metadata.title.template` no layout raiz).
- Subtítulo da marca: **Contratação e liberação de terceiros**.
- Não renomeie o repositório, o pacote npm nem variáveis de ambiente.

## Etapa 2: Logo e ícones

Crie o componente `Logo` (provavelmente em `components/app/`) com este SVG. As cores vêm de tokens, não de valores fixos:

```svg
<svg viewBox="0 0 40 40" aria-hidden="true">
  <rect width="40" height="40" rx="11" fill="currentColor" />
  <path d="M12 28V12M28 28V12M12 12l16 16" fill="none" stroke="#fff" stroke-width="2.6" stroke-linecap="round" />
  <circle cx="12" cy="12" r="3" fill="#fff" />
  <circle cx="28" cy="28" r="3" fill="#fff" />
</svg>
```

- O quadrado usa a cor de destaque (`--accent`). O desenho interno usa `--accent-ink`.
- Versão horizontal: logo + a palavra **NEXO** em maiúsculas com espaçamento entre letras (`letter-spacing: .14em`) + o subtítulo em letra pequena.
- Ícone da aba: `app/icon.svg` (use a mesma arte com as cores já resolvidas). `app/apple-icon.png` com 180×180. Se não for possível gerar o PNG sem dependência nova, deixe só o SVG e me avise.
- Use o `Logo` no menu lateral, na tela de entrada e nos modelos de e-mail.

## Etapa 3: Tokens de design

Concentre as cores em um só lugar (`@theme` no arquivo de estilos global, provavelmente `app/globals.css`) e troque os valores fixos de cor espalhados pelos componentes por tokens. Valores da maquete:

| Token | Claro | Escuro |
|---|---|---|
| fundo | `#F4F6F9` | `#0C0F14` |
| superfície | `#FFFFFF` | `#151A22` |
| superfície 2 | `#EEF1F6` | `#1C222C` |
| texto | `#101827` | `#E8ECF3` |
| texto de apoio | `#5B6678` | `#9AA5B6` |
| linha (separadores) | `#DDE2EA` | `#262D39` |
| **linha forte (bordas de campos e botões)** | `#778296` | `#66738A` |
| destaque | `#1D5FE0` | `#5B8DFF` |
| texto sobre destaque | `#FFFFFF` | `#0A1226` |
| destaque suave | `#E4EDFD` | `#17274A` |
| liberado / fundo | `#0E7A4B` / `#DDF3E8` | `#4CD39A` / `#10301F` |
| atenção / fundo | `#8A5A00` / `#FBEBC8` | `#F2BD52` / `#382A0A` |
| urgente / fundo | `#B4410A` / `#FCE3D3` | `#FF9A62` / `#3A1F10` |
| bloqueado / fundo | `#B42318` / `#FCE0DD` | `#FF8A80` / `#3B1815` |

Escala de espaçamento: 4, 8, 12, 16, 24, 32 px. Cantos: 10 px (campos e botões), 14 px (cartões), pílula (etiquetas).

Regras de cor: verde, amarelo, laranja e vermelho são **só de situação**. Cor nunca é o único sinal: toda situação tem texto, e ícone quando couber.

Fontes: títulos em Space Grotesk, texto em Inter (use `next/font`). Se o projeto já usa a fonte do sistema por decisão do briefing, mantenha e me avise.

A tela "Padrões visuais" da maquete documenta tudo isso. Não precisa virar rota no sistema, mas pode virar `docs/design-system.md`.

## Etapa 4: Menu lateral

Troque a barra horizontal com rolagem por menu lateral (provavelmente em `components/app/`).

- **Desktop (a partir de 860 px):** menu fixo à esquerda com 232 a 248 px, em três grupos:
  - **Obras:** Painel, Contratações, Panorama das obras
  - **Terceiros:** Empresas, Consultar pessoas, Análise do RH, Integração
  - **Sistema:** Administração
- Item atual com fundo suave, cor de destaque e `aria-current="page"`.
- Contador de pendências ao lado de "Painel" (só número, sem bolinha).
- Rodapé do menu com nome e perfil da pessoa.
- **Mostre só os itens que o perfil da pessoa pode usar**, com a mesma regra de papéis que já existe no código. Não crie regra nova de permissão.
- **Celular (abaixo de 860 px):** barra no topo com logo e botão "Menu". O menu abre como gaveta. Fechado, **não pode ser focado pelo teclado**. Esc fecha e devolve o foco ao botão. Ao abrir, o foco vai para o primeiro item.
- Link "Ir para o conteúdo" como primeiro item da página, e o `<main>` com `id="conteudo"`.
- Ao trocar de página, mova o foco para o título (`h1`).

## Etapa 5: Painel

- Saudação com o primeiro nome da pessoa ("Bom dia, Carlos"), não o nome de usuário.
- No topo, o bloco **"O que precisa de você hoje"**: até 3 itens, cada um com título, contexto, situação e um botão com verbo e objeto ("Autorizar contratação", "Abrir cotação", "Ver lista de integração"). A barra lateral colorida do item indica urgência.
- Os números (KPIs) vêm depois. **Zero fica em cinza e com menos peso.** Só o que exige ação ganha cor.
- "Etapas em aberto" e "Minhas pendências" repetem a mesma informação. Junte em uma lista só, com filtro "só minhas".
- Troque o rótulo "Ainda na obra (vão chegar)" por "Em preparação na obra".
- Cada contratação em andamento mostra a régua das 12 etapas e o texto visível "Etapa 10 de 12 · Documentação RH".
- Pessoas com vários perfis: separe as áreas (Suprimentos, RH, Segurança) em abas, em vez de empilhar tudo.

## Etapa 6: Panorama das obras

- Primeira coluna fixa (título e código da contratação) durante a rolagem lateral.
- Células com ícone e data: ✓ com "11/11" (liberou), selo **Agora** (está com a área), traço (ainda não chegou). Cada célula precisa de texto para leitor de tela: "Liberado em 11/11", "Está com esta área: Agora", "Ainda não chegou".
- Legenda **acima** da tabela, não no fim. Remova a dica "passe o mouse", que não funciona em tela de toque.
- Tabela com `<caption>` (pode ser só para leitor de tela), `scope="col"` nos cabeçalhos e `scope="row"` no título da linha. O contêiner de rolagem precisa de `tabindex="0"`, `role="region"` e `aria-label`.
- Opcional, se o tempo permitir: no celular, cada contratação vira um cartão com a régua das etapas em vez de tabela.

## Etapa 7: Contratações

- Título da contratação em no máximo 2 linhas, com reticências.
- Adicione busca por texto e filtros por obra e por etapa, além de ordenação por prazo. Só use dados que a tela já carrega.
- **Investigue antes de mudar:** a lista mostra CT-2026-052 com R$ 1.000.000,00 e o Panorama mostra R$ 1.400.000,00 (e CT-2026-027: R$ 100.000,00 contra R$ 1.400.000,00). Pode ser valor orçado contra valor contratado, ou pode ser erro. Descubra a origem de cada número, me conte, e rotule com clareza ("Orçado", "Contratado") só se forem mesmo valores diferentes. Se parecer erro de dado ou de cálculo, **não corrija sozinho**: relate.

## Etapa 8: Formulários em janela lateral

Em **Empresas** e **Administração > Usuários**, o formulário de convite fica no fim da página. Troque por um botão "+ Convidar empresa" (ou "+ Convidar pessoa") que abre uma janela lateral.

- Use `<dialog>` ou o componente que o projeto já tiver. A janela precisa prender o foco, fechar com Esc, devolver o foco ao botão e ter título ligado por `aria-labelledby`.
- Máscara e validação de CNPJ e telefone, com a mensagem de erro ligada ao campo.
- A lista de empresas mostra também quantas pessoas e quantos documentos pendentes cada uma tem, se esses dados já estiverem disponíveis. Se exigirem consulta nova ao banco, deixe para depois e me avise.
- A Server Action de convite não muda.

## Etapa 9: Consultar pessoas

- A tela abre com uma lista inicial (não vazia), com filtros: **Todas, Liberadas, Aguardando, Bloqueadas**.
- Cada pessoa tem um selo grande de situação com ícone e texto: **LIBERADA**, **INTEGRAÇÃO 12/11**, **BLOQUEADO**, e uma linha de motivo ("ASO vencido em 05/11. A empresa precisa enviar um novo e o RH aprovar.").
- Dica abaixo da busca: "Para buscar pelo CPF, digite os 11 números."
- Anuncie a quantidade de resultados com `role="status"` e `aria-live="polite"`.
- Respeite a regra atual de privacidade: o CPF continua sendo buscado completo.

## Etapa 10: Análise do RH e Integração

- **Análise do RH:** o aviso "O envio de e-mail ainda não está configurado… quando o Resend for configurado" deve aparecer **só para administradores**. Para o RH, mostre algo como "Os avisos aparecem no portal da empresa."
- **Integração:** "1 pessoa(s)" vira "1 pessoa" (plural correto). O botão **Presente** ganha mais peso visual (verde); **Não compareceu** fica mais discreto. Mostre o lembrete do horário de corte das 18h.

## Etapa 11: Tela de entrada

- Duas colunas no desktop: formulário à esquerda e painel de destaque à direita com a frase **"Ninguém entra na obra sem estar em dia."** e os três itens da maquete. No celular, o painel vai para baixo do formulário.
- Título "Acesse sua conta" e botão "Entrar".
- Campo de senha com botão de mostrar e ocultar (com `aria-pressed` e nome que muda).
- Texto de ajuda: "Use o e-mail cadastrado no convite. Depois da senha, o sistema pede o código de verificação em duas etapas."
- Erros de validação em texto, ligados ao campo, anunciados com `role="alert"`, e o foco vai para o campo com problema:
  - E-mail vazio ou inválido: "Digite o e-mail cadastrado no convite, como nome@empresa.com.br."
  - Senha vazia: "Digite sua senha. Se não lembra, use "Esqueci minha senha"."
- Não altere o fluxo de login nem a verificação em duas etapas. Só a interface.

## Etapa 12: Acessibilidade (WCAG 2.1 AA)

Aplique em todas as telas e confirme no fim:

- Texto com contraste de pelo menos 4,5:1. **Bordas de campos, botões e filtros com pelo menos 3:1** (por isso existe o token "linha forte").
- Alvos de toque de pelo menos 44 px em telas de toque (`@media (pointer: coarse)`).
- Foco visível em tudo que se pode acionar (anel de 2 a 3 px).
- Todo campo com rótulo sempre visível. Ícones decorativos com `aria-hidden="true"`.
- Nada de informação só por cor.
- `prefers-reduced-motion` respeitado.
- Verifique que o `<html>` tem `lang="pt-BR"`.

## Etapa 13: Textos

Padrões de escrita:

- Botões com verbo e objeto: "Autorizar contratação", "Abrir cotação", "Convidar empresa". Evite "OK", "Enviar" e "Abrir" sozinhos.
- Erros dizem o que houve e como corrigir.
- Estados vazios dizem o que a área mostra e como começar.
- "Sua vez" vira "Aguarda você".
- O mesmo termo para a mesma coisa em todo o sistema (por exemplo, sempre "contratação", nunca alternar com "solicitação" na mesma tela).

## Entrega

No fim, me diga em português:

1. O que foi feito em cada etapa e em que arquivos.
2. O que você **não** fez e por quê.
3. O resultado de `npm run lint`, `npm run typecheck` e `npm test`.
4. A origem dos valores diferentes da Etapa 7.
5. Qualquer ponto em que a maquete conflita com o código existente.
