"use client";

import { useState } from "react";
import { Dialog, DialogBackdrop, DialogClose, DialogContent, DialogDescription, DialogTitle, DialogTrigger } from "@ui-sdk/react/dialog";
import { Field, FieldLabel } from "@ui-sdk/react/field";
import { Input } from "@ui-sdk/react/input";
import { CampoTexto, Formulario } from "@/components/app/formulario";
import { formatarData } from "@/lib/datas";
import type { EstadoFormulario } from "@/lib/formulario";
import type { ItemPlanejamento } from "@/modules/suprimentos/consultas";

type Editar = (id: string, tipo: "MO" | "MAT", estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;

const semAcento = (t: string) => t.normalize("NFD").replace(/[̀-ͯ]/g, "").toLowerCase();
const data = (d: string | null) => (d ? formatarData(d).slice(0, 5) : "—");
// "ok" na planilha = feito sem a data; "NA" = não se aplica; "_" = pendente.
const feito = (d: string | null, situacao: ItemPlanejamento["situacaoObra"]) => (d ? data(d) : situacao === "feito_sem_data" ? "feito (sem data)" : situacao === "nao_se_aplica" ? "não se aplica" : "—");

function EditarItem({ item, editar }: { item: ItemPlanejamento; editar: Editar }) {
  return (
    <Dialog>
      <DialogTrigger className="botao" aria-label={`Editar ${item.descricao}`}>Editar</DialogTrigger>
      <DialogBackdrop />
      <DialogContent>
        <DialogTitle className="subtitulo">{item.descricao}</DialogTitle>
        <DialogDescription className="text-[13px] text-muted-foreground">
          {item.idPacote ? `Pacote ${item.idPacote}: a data de início vem do cronograma.` : "Item sem ID de pacote: digite a data de início do pacote."}
        </DialogDescription>
        <Formulario acao={editar.bind(null, item.id, item.tipo)} textoBotao="Salvar item">
          <CampoTexto nome="responsavel" rotulo="Responsável" padrao={item.responsavel} />
          <div className="grid grid-cols-2 gap-2">
            <CampoTexto nome="prazo_compras" rotulo="Prazo de compras (dias)" padrao={item.prazoCompras} tipo="number" min={0} />
            <CampoTexto nome="prazo_chegada" rotulo="Prazo até chegar na obra (dias)" padrao={item.prazoChegada} tipo="number" min={0} />
          </div>
          {!item.idPacote && <CampoTexto nome="inicio" rotulo="Início do pacote" padrao={item.inicioManual} tipo="date" />}
          <CampoTexto nome="observacao" rotulo="Observação (causa do atraso)" padrao={item.observacao} />
        </Formulario>
        <div className="flex justify-end">
          <DialogClose className="botao">Fechar</DialogClose>
        </div>
      </DialogContent>
    </Dialog>
  );
}

// Planilha de suprimentos: busca, linha compacta com as datas calculadas (sem rolagem lateral) e edição na linha.
export function TabelaPlanejamento({ itens, podeEditar, editar }: { itens: ItemPlanejamento[]; podeEditar: boolean; editar: Editar }) {
  const [busca, setBusca] = useState("");
  const termo = semAcento(busca.trim());
  const achados = termo ? itens.filter((i) => semAcento([i.descricao, i.idPacote ?? "", i.fase ?? "", i.responsavel ?? ""].join(" ")).includes(termo)) : itens;
  return (
    <div className="flex flex-col gap-3">
      <Field className="flex max-w-[460px] flex-col gap-1.5">
        <FieldLabel className="text-[13px] font-semibold">Buscar item</FieldLabel>
        <Input className="campo" value={busca} onChange={(e) => setBusca(e.target.value)} placeholder="Descrição, ID do pacote, fase ou responsável" autoComplete="off" />
      </Field>
      <p role="status" className="text-[13px] text-muted-foreground">{achados.length === itens.length ? `${itens.length} itens` : `${achados.length} de ${itens.length} itens`}</p>
      {achados.length === 0 ? (
        <p className="rounded-xl bg-fill px-3.5 py-2.5 text-[13px] text-muted-foreground">Nenhum item encontrado.</p>
      ) : (
        <ul className="lista-agrupada">
          {achados.map((i) => (
            <li key={i.id} className="flex flex-wrap items-start justify-between gap-3 px-3.5 py-3">
              <div className="min-w-0 flex-[1_1_320px]">
                <div className="font-medium">{i.descricao}</div>
                <div className="text-[12.5px] text-muted-foreground">
                  {[i.fase, i.idPacote ? `Pacote ${i.idPacote}` : "Sem ID de pacote", i.responsavel].filter(Boolean).join(" · ")}
                </div>
                <dl className="mt-1.5 grid grid-cols-[repeat(auto-fit,minmax(150px,1fr))] gap-x-4 gap-y-0.5 text-[12.5px]">
                  <div><dt className="inline text-muted-foreground">Início do pacote: </dt><dd className="inline">{data(i.inicioPacote)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Estudo: </dt><dd className="inline">{data(i.dataEstudo)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Obra solicita até: </dt><dd className="inline">{data(i.dataSolicitar)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Compras fecha até: </dt><dd className="inline">{data(i.dataComprasFechar)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Obra pediu em: </dt><dd className="inline">{feito(i.dataRealObra, i.situacaoObra)}</dd></div>
                  <div><dt className="inline text-muted-foreground">Compras fechou em: </dt><dd className="inline">{feito(i.dataRealCompras, i.situacaoCompras)}</dd></div>
                </dl>
                {!i.idPacote && !i.inicioManual && <p className="mt-1 text-[12.5px] text-hot">Sem data: digite o início do pacote na edição.</p>}
                {i.observacao && <p className="mt-1 text-[12.5px] text-muted-foreground">{i.observacao}</p>}
              </div>
              <div className="flex items-center gap-2">
                {i.contratacaoId && <span className="selo selo-info">Em contratação</span>}
                {podeEditar && <EditarItem item={i} editar={editar} />}
              </div>
            </li>
          ))}
        </ul>
      )}
    </div>
  );
}
