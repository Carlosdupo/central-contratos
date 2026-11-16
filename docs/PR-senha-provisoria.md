# Acesso por senha provisória (sem depender de e-mail)

Motivo: o filtro antispam do e-mail corporativo da Santa Maria recusa os convites pelo conteúdo (links do Supabase e da Vercel). Agora o administrador pode dar o acesso sem e-mail. **Parte da `main` (fases 1 a 7).** Tem uma migration nova (só funções; nada de dados).

## O que mudou
- **Administração > Usuários > "Novo usuário"** (janela lateral com duas abas): **"Enviar convite por e-mail"** (como antes) e **"Gerar senha provisória"**. Na segunda, o servidor cria o usuário já confirmado (`auth.admin.createUser` com `email_confirm: true`) com uma senha de **16 caracteres gerada por `crypto.randomInt`** (maiúscula, minúscula e número, sem 0/O/1/l/I e sem símbolos, para ditar ou mandar pelo WhatsApp). A tela mostra a senha **uma vez**, com botão **Copiar senha** e o aviso "Passe esta senha pessoalmente ou pelo WhatsApp; ela não aparece de novo."
- **Tela de um usuário existente > "Senha provisória" > "Gerar nova senha provisória"**, para quem esqueceu a senha e não recebe e-mail. Pede confirmação (AlertDialog com `data-agent-confirm`) e mostra a senha uma vez. Não vale para a própria senha do administrador nem para usuário desativado.
- **Troca obrigatória:** a conta fica marcada com `app_metadata.trocar_senha = true` (só o servidor grava `app_metadata`; o `user_metadata` a própria pessoa consegue alterar). Enquanto a marca existir, **toda página interna e o portal mandam para `/definir-senha`** (`exigirUsuario` em `modules/acesso/sessao.ts`, antes da verificação em duas etapas, que continua valendo depois da troca). Ao salvar a senha nova, o servidor **tira a marca** (`updateUserById` com `trocar_senha: null`) e **renova a sessão** para o token novo não trazê-la.
- **A troca obrigatória também vale no banco:** com a marca no token, `app.usuario_interno_ativo()`, `app.tem_papel()` e `app.usuario_externo_da_empresa()` devolvem falso. Ou seja, um token de senha provisória não lê dado nenhum nem por chamada direta à API; só a tela de definir senha funciona. As políticas de RLS não mudaram (elas só chamam essas três funções).
- **Quem pode:** só administrador com verificação em duas etapas (`exigirPapel("admin")` + `app.admin_verificado()` na função de auditoria). **Limite de 15 senhas por administrador a cada 15 minutos** (`consumir_limite`, como nas outras ações sensíveis).
- **Auditoria:** "Senha provisória gerada para Fulano por Sicrano" (função `public.registrar_senha_provisoria`, que **não recebe a senha**). Na conta nova, se a auditoria falhar, a conta é desfeita; na conta existente, a auditoria vem **antes** de trocar a senha (se falhar, a senha não muda).
- **A senha nunca é gravada** no banco, na auditoria, em log nem em URL: só existe no estado da tela de quem gerou (campo com `data-agent-secret`) e some ao sair.

## Arquivos que lidam com a senha
- `lib/senha-provisoria.ts`: gerador (`crypto.randomInt`).
- `modules/admin/senha-provisoria.ts`: ações `criarUsuarioComSenhaProvisoria` e `gerarNovaSenhaProvisoria` (geram a senha, a mandam ao Auth e a devolvem uma vez à tela; não gravam nem registram a senha).
- `modules/acesso/sessao.ts`: lê a marca `trocar_senha` do token e redireciona para `/definir-senha`.
- `modules/acesso/acoes.ts`: `definirSenha` (senha nova do usuário; tira a marca e renova a sessão) e `entrar`.
- `app/(conta)/definir-senha/page.tsx`: tela de definir a senha (texto novo para quem entrou com provisória).
- `components/app/painel-senha.tsx`: mostra a senha uma vez, com copiar e aviso.
- `components/app/novo-usuario.tsx` e `components/app/gerar-senha-usuario.tsx`: formulários (abas e confirmação).
- `components/app/formulario.tsx`: ganhou o parâmetro `resultado` (mostra o dado devolvido pela ação, sem guardá-lo).
- `app/(interno)/admin/usuarios/page.tsx` e `app/(interno)/admin/usuarios/[id]/page.tsx`: telas.
- `supabase/migrations/20261116120000_senha_provisoria.sql`: auditoria e troca obrigatória no banco. `lib/supabase/tipos.ts`: tipo da função.

## Como foi testado
- `npm run lint`, `npm run typecheck`, `npm test`: passam.
- Unitário do gerador (`tests/unit/senha-provisoria.test.ts`): 16 caracteres, regra do projeto em 2.000 senhas, só caracteres fáceis de ditar, 2.000 senhas diferentes, espalhamento do alfabeto, usa `randomInt` e não o sorteador comum. Unitário da troca obrigatória (`tests/unit/troca-obrigatoria.test.ts`): a marca no token manda para `/definir-senha` (interno e portal), vem antes do MFA, `user_metadata` não conta.
- Tela (`tests/ui/senha-provisoria.test.tsx`): a senha aparece uma vez com o aviso, copia, não vai para armazenamento nem endereço e some ao sair; erro não mostra senha; confirmação da nova senha; teste de agente (todo controle tem nome; a ação só roda com a confirmação de uma pessoa).
- Banco (`supabase/tests/database/senha_provisoria.test.sql`, 14 asserções): só administrador com 2FA registra, a auditoria diz para quem e por quem e não guarda senha, e o token com a marca não é reconhecido nem lê dados. **Os outros 16 arquivos de banco também passam com esta migration aplicada dentro da transação.**

## Atenção
- **A migration `20261116120000_senha_provisoria.sql` AINDA NÃO FOI APLICADA** (nem no banco de desenvolvimento nem no de produção): aplicar nos dois depois da revisão e, em seguida, apagar a linha `-- migration:` do topo do teste.
- A mudança em `app.tem_papel`, `app.usuario_interno_ativo` e `app.usuario_externo_da_empresa` vale para todas as telas; só afeta quem tem a marca no token.
- Sessões que o usuário já tinha antes de ganhar nova senha provisória continuam válidas (o Supabase não derruba as sessões ao trocar a senha por esta API); a marca só aparece num token **novo** (depois de entrar de novo ou de renovar a sessão). Se quiser derrubar na hora, é preciso um passo a mais pela API de sessões.
- Não alterei o convite por e-mail.
