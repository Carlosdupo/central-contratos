import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { listaDeSolicitacoes } from "@/modules/sienge/consultas";
import { criarSolicitacaoSienge } from "@/modules/sienge/acoes";
import { CampoSelecao, CampoTexto, Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Solicitação Sienge" };

const reais = (v: number) => v.toLocaleString("pt-BR", { style: "currency", currency: "BRL" });
const dataHora = (iso: string) => new Date(iso).toLocaleString("pt-BR", { timeZone: "America/Sao_Paulo", dateStyle: "short", timeStyle: "short" });

export default async function PaginaSolicitacoesSienge() {
  const usuario = await exigirInterno();
  const { resumos, obrasQueEdita } = await listaDeSolicitacoes(usuario.id);

  return (
    <>
      <div>
        <h1 className="titulo">Solicitação Sienge</h1>
        <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
          Monte a solicitação pelos serviços da EAP da obra: abra o serviço, escreva os itens com quantidade e preço e baixe o CSV pronto para importar no Sienge.
        </p>
      </div>

      {obrasQueEdita.length > 0 && (
        <section className="painel">
          <h2 className="subtitulo">Nova solicitação</h2>
          <Formulario acao={criarSolicitacaoSienge} textoBotao="Criar solicitação" className="flex flex-wrap items-end gap-3">
            <CampoSelecao nome="obra" rotulo="Obra da solicitação" opcoes={obrasQueEdita.map((o) => ({ value: o.id, label: o.nome }))} padrao={obrasQueEdita.length === 1 ? obrasQueEdita[0].id : null} className="min-w-[220px] flex-1" />
            <CampoTexto nome="titulo" rotulo="Nome da solicitação" placeholder="Ex.: BL0087" dica="Vira o nome do arquivo CSV." className="min-w-[220px] flex-1" />
          </Formulario>
        </section>
      )}

      {resumos.length === 0 ? (
        <p className="text-[14px] text-muted-foreground">Nenhuma solicitação ainda.</p>
      ) : (
        <div className="overflow-x-auto">
          <table className="tabela">
            <thead>
              <tr>
                <th scope="col">Solicitação</th>
                <th scope="col">Obra</th>
                <th scope="col" className="text-right">Itens</th>
                <th scope="col" className="text-right">Total</th>
                <th scope="col">Última alteração</th>
              </tr>
            </thead>
            <tbody>
              {resumos.map((s) => (
                <tr key={s.id}>
                  <td><Link href={`/apoio/solicitacao-sienge/${s.id}`} className="font-semibold text-primary hover:underline">{s.titulo}</Link></td>
                  <td>{s.obra}</td>
                  <td className="text-right tabular-nums">{s.itens}</td>
                  <td className="text-right tabular-nums">{reais(s.total)}</td>
                  <td className="text-muted-foreground">{dataHora(s.atualizadoEm)} · {s.autor}</td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      )}
    </>
  );
}
