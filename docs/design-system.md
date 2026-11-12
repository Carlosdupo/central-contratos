# Nexo: padrões visuais

Referência visual: [docs/prototipo/nexo-maquete.html](prototipo/nexo-maquete.html) (tela "Padrões visuais"). Os tokens moram em `app/globals.css`; nenhum componente deve usar cor fixa.

## Cores (tokens)

| Token (CSS) | Uso | Claro | Escuro |
|---|---|---|---|
| `--fundo` | Fundo da página | `#F4F6F9` | `#0C0F14` |
| `--superficie` | Cartões, menu, campos | `#FFFFFF` | `#151A22` |
| `--preenchimento` | Superfície 2 (hover, listas) | `#EEF1F6` | `#1C222C` |
| `--texto` | Texto principal | `#101827` | `#E8ECF3` |
| `--cinza` | Texto de apoio | `#5B6678` | `#9AA5B6` |
| `--separador` | Linhas divisórias | `#DDE2EA` | `#262D39` |
| `--separador-forte` | Bordas de campos, botões e filtros (≥ 3:1) | `#778296` | `#66738A` |
| `--azul` | Destaque: ação principal, item atual, links | `#1D5FE0` | `#5B8DFF` |
| `--azul-tinta` | Texto sobre o destaque | `#FFFFFF` | `#0A1226` |
| `--azul-suave` | Fundo do item atual, anel de foco do campo | `#E4EDFD` | `#17274A` |
| `--ok` / `--ok-soft` | Liberado, aprovado, no prazo | `#0E7A4B` / `#DDF3E8` | `#4CD39A` / `#10301F` |
| `--warn` / `--warn-soft` | Atenção: vence em até 30 dias, aguardando | `#8A5A00` / `#FBEBC8` | `#F2BD52` / `#382A0A` |
| `--hot` / `--hot-soft` | Urgente: aguarda você, vence em até 15 dias | `#B4410A` / `#FCE3D3` | `#FF9A62` / `#3A1F10` |
| `--bad` / `--bad-soft` | Bloqueado, vencido, reprovado, erro | `#B42318` / `#FCE0DD` | `#FF8A80` / `#3B1815` |

No Tailwind: `text-primary`, `bg-primary-soft`, `text-ok`/`bg-ok-soft`, `text-warn`, `text-hot`, `text-bad`, `border-sep`, `border-sep-strong`, `text-muted-foreground`.

**Regras:** verde, amarelo, laranja e vermelho são só de situação. Cor nunca é o único sinal: toda situação tem texto, e ícone quando couber.

## Tipografia
Fonte do sistema (San Francisco / Segoe UI), por decisão do protótipo e do briefing (a maquete usa Space Grotesk e Inter; mantivemos a do sistema, sem carregar fonte externa). Títulos de página 28 px, títulos de bloco 16–17 px, corpo 14 px, apoio 13 px, rótulo 11 px em maiúsculas. Números em colunas com algarismos de largura fixa (`tabular-nums`).

## Espaçamento e cantos
Escala 4, 8, 12, 16, 24, 32 px. Cantos: 10 px (`--raio-campo`: campos e botões), 14 px (`--raio-cartao`: cartões), pílula (etiquetas).

## Componentes (classes em `app/globals.css`)
- `.botao`, `.botao-primario`, `.botao-ok`, `.botao-perigo`, `.botao-pequeno`: altura mínima 40 px (44 px em tela de toque). Nome sempre com verbo e objeto ("Autorizar contratação").
- `.campo`: borda forte, foco com anel; `aria-invalid="true"` deixa a borda vermelha. Rótulo sempre visível.
- `.selo` + `-ok`, `-alerta`, `-urgente`, `-erro`, `-info`, `-neutro`: etiqueta de situação com texto.
- `.painel`: cartão. `.lista-agrupada`: lista com divisórias. `.tabela`: tabela com cabeçalho em maiúsculas.
- `Logo` e `Marca` em `components/app/logo.tsx`.

## Acessibilidade (WCAG 2.1 AA)
Contraste de texto ≥ 4,5:1 e de bordas ≥ 3:1; foco visível (anel de 2 px); alvos de 44 px em toque; ícones decorativos com `aria-hidden`; `prefers-reduced-motion` respeitado; `lang="pt-BR"`.
