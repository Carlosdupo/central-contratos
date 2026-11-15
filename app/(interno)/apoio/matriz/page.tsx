import type { Metadata } from "next";
import { exigirInterno } from "@/modules/acesso/sessao";
import { listarMatriz } from "@/modules/matriz/consultas";
import { ConsultaMatriz } from "@/components/app/consulta-matriz";

export const metadata: Metadata = { title: "Matriz de contratação" };

export default async function PaginaMatriz() {
  await exigirInterno();
  const atividades = await listarMatriz();
  return (
    <>
      <div>
        <h1 className="titulo">Matriz de contratação</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">
          Para cada atividade: forma legal, tipo, unidade da negociação, lotes, unidade de medição e observações. É a mesma para todas as obras.
        </p>
      </div>
      <ConsultaMatriz atividades={atividades} />
    </>
  );
}
