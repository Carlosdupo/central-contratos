-- Fase 1A: Ajustes rápidos
-- 1.1: Mudar rótulo "Valor orçado" para "Valor Orçamento"
-- 1.2: Campo de valor com pontos e vírgulas automáticos (frontend)
-- 1.4: Cancelar pelo coordenador da obra
-- 1.5: Prefixo do contrato no Sienge em obras
-- 1.6: Contrato original no aditivo

-- 1.5: Adicionar prefixo_sienge a obras
ALTER TABLE public.obras ADD COLUMN prefixo_sienge text;
COMMENT ON COLUMN public.obras.prefixo_sienge IS 'Prefixo do contrato no Sienge, ex: CT/BL. Usado com 4 números para formar o código CT/BL0083.';

-- 1.6: Adicionar contrato_original a contratacoes (para aditivos)
ALTER TABLE public.contratacoes ADD COLUMN contrato_original text;
COMMENT ON COLUMN public.contratacoes.contrato_original IS 'Número do contrato original no Sienge para aditivos, ex: CT/BL0083.';

-- 1.1: Atualizar itens de checklist da etapa 1 de "Valor orçado" para "Valor Orçamento"
UPDATE public.etapa_itens
SET nome = 'Valor Orçamento conferido'
WHERE nome = 'Valor orçado conferido';

-- 1.4: Atualizar função cancelar_contratacao para permitir coordenador_obra
CREATE OR REPLACE FUNCTION public.cancelar_contratacao(
  p_contratacao uuid,
  p_motivo text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
DECLARE
  v_usuario_id uuid;
  v_obra_id uuid;
  v_papel text;
BEGIN
  -- Verificar usuário
  v_usuario_id := auth.uid();
  IF v_usuario_id IS NULL THEN
    RAISE EXCEPTION 'Usuário não autenticado';
  END IF;

  -- Obter obra_id da contratação
  SELECT c.obra_id INTO v_obra_id
  FROM contratacoes c
  WHERE c.id = p_contratacao;

  IF v_obra_id IS NULL THEN
    RAISE EXCEPTION 'Contratação não encontrada';
  END IF;

  -- Verificar permissão: admin ou coordenador_obra da obra
  SELECT u.papel INTO v_papel
  FROM usuarios u
  WHERE u.id = v_usuario_id;

  IF v_papel != 'admin' THEN
    -- Se não for admin, deve ser coordenador_obra da obra
    IF v_papel != 'coordenador_obra' THEN
      RAISE EXCEPTION 'Você não tem permissão para cancelar contratações';
    END IF;

    -- Verificar se o usuário é coordenador desta obra específica
    IF NOT EXISTS (
      SELECT 1 FROM usuario_obras
      WHERE usuario_id = v_usuario_id AND obra_id = v_obra_id
    ) THEN
      RAISE EXCEPTION 'Você não tem permissão para cancelar contratações desta obra';
    END IF;
  END IF;

  -- Cancelar a contratação
  UPDATE contratacoes
  SET situacao = 'cancelada',
      cancelamento_motivo = COALESCE(p_motivo, ''),
      updated_at = now()
  WHERE id = p_contratacao AND situacao = 'em_andamento';
END;
$$;

-- 1.3 e outras: Função para autorizar contratação (etapa 6) - salvar condições e concluir em uma ação
CREATE OR REPLACE FUNCTION public.autorizar_contratacao_gerente(
  p_contratacao uuid,
  p_permuta boolean,
  p_permuta_valor numeric,
  p_permuta_formato text,
  p_fat_direto boolean,
  p_fat_direto_valor numeric,
  p_fat_direto_percentual numeric,
  p_sinal boolean,
  p_sinal_valor numeric,
  p_caucao text
)
RETURNS void
LANGUAGE plpgsql
SECURITY DEFINER
SET search_path = public
AS $$
BEGIN
  -- Salvar condições
  UPDATE contratacoes
  SET
    permuta = p_permuta,
    permuta_valor = p_permuta_valor,
    permuta_formato = p_permuta_formato,
    fat_direto = p_fat_direto,
    fat_direto_valor = p_fat_direto_valor,
    fat_direto_percentual = p_fat_direto_percentual,
    sinal = p_sinal,
    sinal_valor = p_sinal_valor,
    caucao = p_caucao,
    updated_at = now()
  WHERE id = p_contratacao;

  -- Concluir etapa 6 e abrir etapa 7
  PERFORM concluir_etapa(p_contratacao, 6);
END;
$$;
