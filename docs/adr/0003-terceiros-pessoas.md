# ADR 0003: Pessoas, equipe e consulta (F2)

Data: 11/11/2026 · Situação: aceita

1. **Pessoa identificada pelo CPF (A3)**: tabela `pessoas` com CPF único. Se outra empresa cadastrar o mesmo CPF, aproveita a pessoa existente e **mantém o nome já cadastrado**, para uma empresa não trocar os dados de quem trabalha para outra. O vínculo com cada empresa fica em `vinculos`.
2. **CPF não sai por consulta direta (LGPD)**: a coluna `cpf` não tem permissão de leitura para os usuários; só as funções `buscar_pessoas` e `cpf_mascarado` devolvem o CPF, sempre mascarado (`***.982.247-**`).
3. **Liberação por obra (A4)**: `alocacoes` (pessoa × obra), com a situação: rascunho → em análise → pendente / aguardando a empresa / integração agendada → liberado → bloqueado.
4. **Sócio esporádico** não é alocado na obra: pede visita (`visitas`) com a antecedência do parâmetro e um documento com foto.
5. **Consulta (A3)**: busca por parte do nome, sem acento (índice de trigramas sobre `app.sem_acento(nome)`), ou pelo CPF completo. Só para a equipe interna; mostra a situação, não os arquivos.
6. **CIPA (P10 pendente)**: por enquanto conta todas as pessoas ativas da empresa, exceto sócio esporádico, sem separar por obra.
7. **Função (P9 pendente)**: texto livre. Hoje só a marcação "trabalha com eletricidade" muda a lista (NR-10 e formação técnica). A matriz por função entra quando a P9 for respondida.
8. **Foto do crachá**: no mesmo bucket privado, na pasta da pessoa; exibida por link temporário de 5 minutos.
