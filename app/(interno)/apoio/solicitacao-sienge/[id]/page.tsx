import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirInterno } from "@/modules/acesso/sessao";
import { solicitacaoCompleta } from "@/modules/sienge/consultas";
import { excluirSolicitacaoSienge, salvarSolicitacaoSienge } from "@/modules/sienge/acoes";
import { EditorSolicitacaoSienge } from "@/components/app/editor-solicitacao-sienge";
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Solicitação Sienge" };

export default async function PaginaSolicitacaoSienge({ params }: PageProps<"/apoio/solicitacao-sienge/[id]">) {
  const usuario = await exigirInterno();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();
  const s = await solicitacaoCompleta(id, usuario.id);
  if (!s) notFound();

  return (
    <>
      <div>
        <Link href="/apoio/solicitacao-sienge" className="text-[13px] text-muted-foreground hover:text-foreground">← Solicitações Sienge</Link>
        <h1 className="titulo mt-1">{s.titulo}</h1>
        <p className="mt-1.5 text-[15px] text-muted-foreground">{s.obra}</p>
      </div>
      {s.eap.length === 0 ? (
        <p className="painel text-[14px]">A EAP desta obra ainda não foi importada. Peça ao administrador para importar o PDF da EAP do Sienge na administração da obra.</p>
      ) : (
        <EditorSolicitacaoSienge solicitacao={s} salvar={salvarSolicitacaoSienge.bind(null, s.id)} />
      )}
      {s.podeEditar && (
        <Formulario
          acao={excluirSolicitacaoSienge.bind(null, s.id)}
          textoBotao="Excluir solicitação"
          variante="discreto"
          confirmar={`A solicitação ${s.titulo} e todos os itens dela serão apagados. Não dá para desfazer.`}
        />
      )}
    </>
  );
}
