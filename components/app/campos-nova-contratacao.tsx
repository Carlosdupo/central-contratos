"use client";

import { useState } from "react";
import { CampoReais } from "@/components/app/campos-mascara";
import { lerValor } from "@/lib/valor-reais";
import { TIPO_CONTRATACAO } from "@/modules/contratacoes/rotulos";
import { dicaCodigoSienge } from "@/lib/sienge";
import { CampoSelecao, CampoTexto, GrupoOpcoes, Marcador } from "@/components/app/formulario";

type ItemEap = { id: string; referencia: string; descricao: string };
export type ObraComEap = { id: string; nome: string; prefixoSienge: string | null; eap: { grupo: ItemEap; filhos: ItemEap[] }[] };


const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });
// Campos da abertura: obra, serviço da EAP, Valor Orçamento (opcional) e quem negocia.
// As regras são conferidas de novo no banco (abrir_contratacao).
export function CamposNovaContratacao({ obras, limite }: { obras: ObraComEap[]; limite: number }) {
  const [obraId, setObraId] = useState<string | null>(obras.length === 1 ? obras[0].id : null);
  const [semValor, setSemValor] = useState(false);
  const [valor, setValor] = useState("");
  const [tipo, setTipo] = useState<string | null>(null);
  const [negociacao, setNegociacao] = useState<string | null>(null);
  const obra = obras.find((o) => o.id === obraId);
  const valorNum = semValor ? NaN : lerValor(valor);
  const obraNaoPodeNegociar = Number.isFinite(valorNum) && valorNum >= limite;
  const negociacaoEfetiva = obraNaoPodeNegociar && negociacao === "obra" ? null : negociacao;

  return (
    <>
      <CampoSelecao nome="obra" rotulo="Obra da contratação" placeholder="Escolha a obra" valor={obraId} aoMudar={setObraId} opcoes={obras.map((o) => ({ value: o.id, label: o.nome }))} />

      {obra && obra.eap.length > 0 && (
        <CampoSelecao
          key={obra.id}
          nome="eap"
          rotulo="Serviço da EAP"
          placeholder="Escolha o serviço"
          grupos={obra.eap.map(({ grupo, filhos }) => ({
            label: `${grupo.referencia} ${grupo.descricao}`,
            itens: filhos.map((f) => ({ value: f.id, label: `${f.referencia} ${f.descricao}` })),
          }))}
        />
      )}
      {obra && obra.eap.length === 0 && (
        <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">Esta obra ainda não tem a EAP importada. O administrador importa o PDF na tela da obra.</p>
      )}

      <CampoTexto nome="servico" rotulo="Descrição do serviço / escopo" dica="Ex.: Alvenaria de vedação, torre B" />

      <div className="flex flex-col gap-1.5">
        <CampoReais
          nome="valor"
          rotulo="Valor Orçamento (R$)"
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

      <GrupoOpcoes nome="tipo" rotulo="Tipo de contrato" valor={tipo} aoMudar={setTipo} opcoes={Object.entries(TIPO_CONTRATACAO).map(([value, rotulo], i) => ({ value, label: `${i + 1}. ${rotulo}` }))} />
      {tipo === "aditivo" && (
        <CampoTexto nome="contrato_original" rotulo="Nº do contrato original no Sienge" dica={`Obrigatório no aditivo. ${dicaCodigoSienge(obra?.prefixoSienge)}`} />
      )}
    </>
  );
}
