import type { Metadata } from "next";
import { exigirInterno } from "@/modules/acesso/sessao";
import { quadroDeNegociacoes } from "@/modules/negociacoes/consultas";
import { QuadroNegociacoes } from "@/components/app/quadro-negociacoes";
import { DIAS_LEMBRETE_CONTRATO } from "@/lib/negociacoes";

export const metadata: Metadata = { title: "Negociações da obra" };

export default async function PaginaNegociacoes() {
  const usuario = await exigirInterno();
  const { itens, obrasDoFiltro, obrasQueEdita } = await quadroDeNegociacoes(usuario.id);

  return (
    <>
      <div>
        <h1 className="titulo">Negociações da obra</h1>
        <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
          Anote o que precisa negociar e acompanhe até virar contratação. O que já foi negociado fica lembrando de abrir o contrato: depois de {DIAS_LEMBRETE_CONTRATO} dias sem contrato, o cartão ganha um selo.
        </p>
      </div>
      <QuadroNegociacoes itens={itens} obrasDoFiltro={obrasDoFiltro} obrasQueEdita={obrasQueEdita} />
    </>
  );
}
