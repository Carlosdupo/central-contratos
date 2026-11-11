# ADR 0002: Empresas terceirizadas e documentos (F1)

Data: 11/11/2026 · Situação: aceita

## Decisões
1. **Gravação de documentos só por funções do banco (RPC)**: `registrar_arquivo_empresa`, `salvar_texto_empresa`, `enviar_documentos_empresa`, `registrar_acesso_arquivo`, `registrar_primeiro_acesso`. O usuário não tem INSERT/UPDATE direto nas tabelas `documentos`, `documento_arquivos`, `acessos_documentos` e `envios_analise`. Cada função confere se quem chama é da empresa.
2. **Arquivos**: bucket privado `documentos` (PDF/JPG/PNG, até 10 MB). O navegador envia direto ao Storage por URL assinada, gerada no servidor num caminho fixo: `empresas/{empresa}/empresa/{tipo}/{uuid}.{ext}`. Depois o servidor baixa o arquivo, confere a **assinatura dos primeiros bytes** (o conteúdo real tem que ser PDF/JPG/PNG), calcula o SHA-256 e só então registra a versão. Se algo falhar, o arquivo é apagado.
3. **Abrir arquivo**: link temporário de 60 segundos, gerado depois de `registrar_acesso_arquivo` (confere a permissão e grava em `acessos_documentos`).
4. **Quem abre arquivos**: a própria empresa; RH e SST com verificação em duas etapas; admin, Suprimentos e Contratos só os **não sensíveis**. ASO é marcado como sensível. Coordenador, Direção e Gerente de suprimentos veem a situação, não o arquivo (A10).
5. **Tipo do usuário externo**: no convite de empresa, o servidor envia `tipo: externo` nos metadados do usuário. O trigger aceita esse valor só na criação; é seguro porque o cadastro aberto está desligado e o tipo não pode ser alterado depois.
6. **Competência dos documentos mensais (FGTS/INSS)**: o mês anterior ao atual. Decisão provisória até a resposta da **P11**.
7. **CIPA (NR-05)**: a regra "mais de 5 pessoas na obra" está na matriz, mas só passa a contar quando o cadastro de pessoas existir (F2).
8. **Termos de uso no primeiro acesso**: o mecanismo de aceite aguarda o texto jurídico (**P18**).
