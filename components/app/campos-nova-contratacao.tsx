"use client";

import { useState } from "react";
import { Field, FieldDescription, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { CampoSelecao, CampoTexto, GrupoOpcoes, Marcador } from "@/components/app/formulario";

type ItemEap = { id: string; referencia: string; descricao: string };
export type ObraComEap = { id: string; nome: string; eap: { grupo: ItemEap; filhos: ItemEap[] }[] };

const paraNumero = (t: string) => {
  const n = Number(t.trim().replace(/\./g, "").replace(",", "."));
  return Number.isFinite(n) ? n : NaN;
};
const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL", maximumFractionDigits: 0 });

// Campos da abertura: obra, serviço da EAP, valor orçado (opcional) e quem negocia.
// As regras são conferidas de novo no banco (abrir_contratacao).
export function CamposNovaContratacao({ obras, limite }: { obras: ObraComEap[]; limite: number }) {
  const [obraId, setObraId] = useState<string | null>(obras.length === 1 ? obras[0].id : null);
  const [semValor, setSemValor] = useState(false);
  const [valor, setValor] = useState("");
  const [negociacao, setNegociacao] = useState<string | null>(null);
  const obra = obras.find((o) => o.id === obraId);
  const valorNum = semValor ? NaN : paraNumero(valor);
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
        <Field className="flex flex-col gap-1.5" disabled={semValor}>
          <FieldLabel className="text-[13px] font-semibold">Valor orçado (R$)</FieldLabel>
          <Input name="valor" className="campo" value={semValor ? "" : valor} onChange={(e) => setValor(e.target.value)} placeholder={semValor ? "Não informado" : ""} />
          {obraNaoPodeNegociar && <FieldDescription className="text-xs text-muted-foreground">A partir de {reais(limite)} do orçamento, a negociação é de Suprimentos.</FieldDescription>}
        </Field>
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
    </>
  );
}
