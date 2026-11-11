"use client";

import { useState } from "react";

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
  const [obraId, setObraId] = useState(obras.length === 1 ? obras[0].id : "");
  const [semValor, setSemValor] = useState(false);
  const [valor, setValor] = useState("");
  const [negociacao, setNegociacao] = useState("");
  const obra = obras.find((o) => o.id === obraId);
  const valorNum = semValor ? NaN : paraNumero(valor);
  const obraNaoPodeNegociar = Number.isFinite(valorNum) && valorNum >= limite;
  const negociacaoEfetiva = obraNaoPodeNegociar && negociacao === "obra" ? "" : negociacao;

  return (
    <>
      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">Obra</span>
        <select name="obra" className="campo" value={obraId} onChange={(e) => setObraId(e.target.value)}>
          <option value="" disabled>Escolha a obra</option>
          {obras.map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
        </select>
      </label>

      {obra && obra.eap.length > 0 && (
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Serviço da EAP</span>
          <select name="eap" className="campo" defaultValue="" key={obra.id}>
            <option value="" disabled>Escolha o serviço</option>
            {obra.eap.map(({ grupo, filhos }) => (
              <optgroup key={grupo.id} label={`${grupo.referencia} ${grupo.descricao}`}>
                {filhos.map((f) => <option key={f.id} value={f.id}>{f.referencia} {f.descricao}</option>)}
              </optgroup>
            ))}
          </select>
        </label>
      )}
      {obra && obra.eap.length === 0 && (
        <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">Esta obra ainda não tem a EAP importada. O administrador importa o PDF na tela da obra.</p>
      )}

      <label className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">Descrição do serviço / escopo</span>
        <input name="servico" className="campo" />
        <span className="text-xs text-faint">Ex.: Alvenaria de vedação, torre B</span>
      </label>

      <div className="flex flex-col gap-1.5">
        <label className="flex flex-col gap-1.5">
          <span className="text-[12.5px] font-medium text-muted-foreground">Valor orçado (R$)</span>
          <input name="valor" className="campo" value={semValor ? "" : valor} disabled={semValor} onChange={(e) => setValor(e.target.value)} placeholder={semValor ? "Não informado" : ""} />
        </label>
        <label className="flex cursor-pointer items-center gap-2 text-[13px]">
          <input type="checkbox" name="sem_valor" checked={semValor} onChange={(e) => setSemValor(e.target.checked)} className="size-4 accent-primary" />
          Não informar / não se aplica
        </label>
      </div>

      <fieldset className="flex flex-col gap-1.5">
        <legend className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Quem negocia</legend>
        <div className="lista-agrupada">
          <label className={`flex items-start gap-3 px-3.5 py-2.5 ${obraNaoPodeNegociar ? "opacity-50" : "cursor-pointer hover:bg-fill-2"}`}>
            <input type="radio" name="negociacao" value="obra" disabled={obraNaoPodeNegociar} checked={negociacaoEfetiva === "obra"} onChange={() => setNegociacao("obra")} className="mt-0.5 size-4 accent-primary" />
            <span className="text-[14px]">
              Negociação pela obra
              <span className="block text-[12.5px] text-muted-foreground">
                {obraNaoPodeNegociar ? `Orçamento a partir de ${reais(limite)}: a negociação é de Suprimentos.` : "A obra negocia, escolhe o fornecedor e informa o valor final. Suprimentos valida."}
              </span>
            </span>
          </label>
          <label className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 hover:bg-fill-2">
            <input type="radio" name="negociacao" value="suprimentos" checked={negociacaoEfetiva === "suprimentos"} onChange={() => setNegociacao("suprimentos")} className="mt-0.5 size-4 accent-primary" />
            <span className="text-[14px]">
              Negociação pelo Suprimentos
              <span className="block text-[12.5px] text-muted-foreground">A obra faz as 3 cotações; Suprimentos negocia e escolhe o fornecedor.</span>
            </span>
          </label>
        </div>
      </fieldset>
    </>
  );
}
