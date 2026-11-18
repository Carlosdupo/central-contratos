"use client";

import { useState } from "react";
import { CampoReais } from "@/components/app/campos-mascara";
import { lerValor } from "@/lib/valor-reais";
import { CampoAtividadeMatriz } from "@/components/app/campo-atividade-matriz";
import { CampoItemPlanilha, type ItemLivre } from "@/components/app/campo-item-planilha";
import type { AtividadeMatriz } from "@/modules/matriz/consultas";
import { valorParaCampo } from "@/lib/valor-reais";
import { dicaCodigoSienge } from "@/lib/sienge";
import { CampoSelecao, CampoTexto, GrupoOpcoes, Marcador } from "@/components/app/formulario";

export type ObraAbertura = { id: string; nome: string; prefixoSienge: string | null };
export type ItemLivreDaObra = ItemLivre & { obraId: string };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// Campos da abertura: obra, atividade da matriz, Valor Orçamento (opcional) e quem negocia.
// As regras são conferidas de novo no banco (abrir_contratacao).
export type InicialDoQuadro = { id: string; obraId: string; titulo: string; aditivo: boolean; valor: number | null };

export function CamposNovaContratacao({ obras, limite, matriz, itens = [], ciclos = [], hoje = new Date().toISOString().slice(0, 10), inicial }: { obras: ObraAbertura[]; limite: number; matriz: AtividadeMatriz[]; itens?: ItemLivreDaObra[]; ciclos?: { limite: string; inicio: string }[]; hoje?: string; inicial?: InicialDoQuadro }) {
  const [obraId, setObraId] = useState<string | null>(inicial && obras.some((o) => o.id === inicial.obraId) ? inicial.obraId : obras.length === 1 ? obras[0].id : null);
  const [semValor, setSemValor] = useState(false);
  const [valor, setValor] = useState(valorParaCampo(inicial?.valor));
  const [aditivo, setAditivo] = useState(inicial?.aditivo ?? false);
  const [urgente, setUrgente] = useState(false);
  const [negociacao, setNegociacao] = useState<string | null>(null);
  const obra = obras.find((o) => o.id === obraId);
  const valorNum = semValor ? NaN : lerValor(valor);
  const obraNaoPodeNegociar = Number.isFinite(valorNum) && valorNum >= limite;
  const negociacaoEfetiva = obraNaoPodeNegociar && negociacao === "obra" ? null : negociacao;

  return (
    <>
      {inicial && <input type="hidden" name="negociacao_item" value={inicial.id} />}
      <CampoSelecao nome="obra" rotulo="Obra da contratação" placeholder="Escolha a obra" valor={obraId} aoMudar={setObraId} opcoes={obras.map((o) => ({ value: o.id, label: o.nome }))} />

      <CampoAtividadeMatriz atividades={matriz} />

      <CampoItemPlanilha key={obraId ?? "sem-obra"} itens={itens.filter((i) => i.obraId === obraId)} ciclos={ciclos} hoje={hoje} />

      <CampoTexto nome="servico" rotulo="Descrição do escopo" padrao={inicial?.titulo} dica="Ex.: Alvenaria de vedação, torre B" />

      <div className="flex flex-col gap-1.5">
        <CampoReais
          nome="valor"
          rotulo="Valor Orçamento (R$)"
          padrao={inicial?.valor}
          desabilitado={semValor}
          placeholder={semValor ? "Não informado" : ""}
          aoMudar={setValor}
          dica={obraNaoPodeNegociar ? `A partir de ${reais(limite)} do orçamento, a negociação é de Suprimentos.` : undefined}
        />
        <Marcador nome="sem_valor" rotulo="Não informar / não se aplica" marcadoAgora={semValor} aoMudar={setSemValor} className="flex cursor-pointer items-center gap-2 text-[13px]" />
      </div>

      <GrupoOpcoes
        nome="negociacao"
        rotulo="Quem negocia"
        valor={negociacaoEfetiva}
        aoMudar={setNegociacao}
        opcoes={[
          {
            value: "obra",
            label: "Negociação pela obra",
            desabilitada: obraNaoPodeNegociar,
            dica: obraNaoPodeNegociar ? `Orçamento a partir de ${reais(limite)}: a negociação é de Suprimentos.` : "A obra negocia, escolhe o fornecedor e informa o valor final. Suprimentos valida.",
          },
          { value: "suprimentos", label: "Negociação pelo Suprimentos", dica: "A obra faz as 3 cotações; Suprimentos negocia e escolhe o fornecedor." },
        ]}
      />

      <Marcador nome="aditivo" rotulo="É aditivo de contrato (o fornecedor já tem contrato nesta obra)" marcadoAgora={aditivo} aoMudar={setAditivo} className="flex cursor-pointer items-center gap-2 text-[13px]" />
      {aditivo && (
        <CampoTexto nome="contrato_original" rotulo="Nº do contrato original no Sienge" dica={`Obrigatório no aditivo. ${dicaCodigoSienge(obra?.prefixoSienge)}`} />
      )}
      <Marcador nome="urgente" rotulo="Marcar como urgente (todos veem o selo; o prazo do Suprimentos não muda)" marcadoAgora={urgente} aoMudar={setUrgente} className="flex cursor-pointer items-center gap-2 text-[13px]" />
      {urgente && (
        <>
          <CampoTexto nome="urgente_motivo" rotulo="Motivo da urgência" dica="Explique por que a obra precisa antes do prazo." />
          <CampoTexto nome="urgente_data" rotulo="Data de necessidade" tipo="date" />
        </>
      )}
    </>
  );
}
