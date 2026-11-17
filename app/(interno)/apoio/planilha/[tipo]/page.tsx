import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { itensDaPlanilha, obrasDaPlanilha } from "@/modules/suprimentos/consultas";
import { editarItemPlanejamento, importarPlanilha } from "@/modules/suprimentos/acoes";
import { TabelaPlanejamento } from "@/components/app/tabela-planejamento";
import { Formulario } from "@/components/app/formulario";
import { CampoArquivo, CampoColar } from "@/components/app/campo-arquivo";

export const metadata: Metadata = { title: "Planilha de suprimentos" };

const TIPOS = { mo: { sigla: "MO", titulo: "Planilha suprimentos MO", descricao: "mão de obra" }, mat: { sigla: "MAT", titulo: "Planilha suprimentos MAT", descricao: "materiais" } } as const;

export default async function PaginaPlanilha({ params, searchParams }: PageProps<"/apoio/planilha/[tipo]">) {
  const usuario = await exigirInterno();
  const { tipo: tipoParam } = await params;
  const { obra: obraParam } = await searchParams;
  if (tipoParam !== "mo" && tipoParam !== "mat") notFound();
  const tipo = TIPOS[tipoParam];
  const obras = await obrasDaPlanilha();
  const obra = obras.find((o) => o.id === obraParam) ?? obras[0];
  const itens = obra ? await itensDaPlanilha(tipo.sigla, obra.id) : [];
  const podeEditar = temAlgumPapel(usuario.papeis, ["suprimentos", "gerente_suprimentos"]);
  return (
    <>
      <div>
        <h1 className="titulo">{tipo.titulo}</h1>
        <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
          Planejamento de {tipo.descricao} por obra. As datas são calculadas pelo cronograma: a obra solicita até (início do pacote − prazo de compras − prazo até chegar na obra) e Compras fecha até (início − prazo até chegar na obra).
          {podeEditar ? " Suprimentos importa a planilha e edita na própria linha." : ""}
        </p>
        {obras.length > 0 && (
          <nav aria-label="Obra" className="mt-3 flex flex-wrap gap-2">
            {obras.map((o) => (
              <Link key={o.id} href={`/apoio/planilha/${tipoParam}?obra=${o.id}`} aria-current={o.id === obra?.id ? "page" : undefined} className={`botao ${o.id === obra?.id ? "botao-primario" : ""}`}>{o.nome}</Link>
            ))}
          </nav>
        )}
      </div>
      {!obra ? (
        <p className="text-[14px] text-muted-foreground">Nenhuma obra ativa cadastrada.</p>
      ) : (
        <>
          {podeEditar && (
            <section className="painel">
              <div>
                <h2 className="subtitulo">Importar a planilha de {obra.nome}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">
                  Copie a aba IMPORTAR {tipo.sigla} no Excel (Ctrl+A, Ctrl+C) e cole na caixa, ou envie a aba salva como CSV. Colunas lidas pelo nome: Fase, ID do pacote, Descrição, Responsável, Prazo que compras precisa (dias), Prazo até chegar na obra (dias), Início, Data real da obra, Data real de compras e Causa do atraso. Itens que já viraram contratação são mantidos.
                </p>
              </div>
              <Formulario acao={importarPlanilha.bind(null, obra.id, tipo.sigla)} textoBotao="Importar planilha" className="flex flex-wrap items-end gap-3">
                <CampoColar rotulo={`Colar da planilha ${tipo.sigla}`} className="basis-full" />
                <CampoArquivo rotulo={`Ou envie o CSV da planilha ${tipo.sigla}`} aceita=".csv,text/csv" className="min-w-[260px] flex-1" />
              </Formulario>
            </section>
          )}
          {itens.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Nenhum item na planilha de {obra.nome}.</p>
          ) : (
            <TabelaPlanejamento itens={itens} podeEditar={podeEditar} editar={editarItemPlanejamento} />
          )}
        </>
      )}
    </>
  );
}
