import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { atualizarObra } from "@/modules/admin/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Obra" };

export default async function PaginaObra({ params }: PageProps<"/admin/obras/[id]">) {
  await exigirPapel("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await criarClienteServidor();
  const { data: obra } = await supabase.from("obras").select("id, codigo, nome, cidade, uf, ativa").eq("id", id).maybeSingle();
  if (!obra) notFound();

  return (
    <>
      <div>
        <Link href="/admin/obras" className="text-[14px] text-primary">← Obras</Link>
        <h2 className="titulo mt-2 text-[28px]">{obra.nome}</h2>
      </div>
      <section className="painel max-w-[560px]">
        <Formulario acao={atualizarObra.bind(null, obra.id)} textoBotao="Salvar">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <CampoTexto nome="codigo" rotulo="Código" padrao={obra.codigo} />
            <CampoTexto nome="nome" rotulo="Nome" padrao={obra.nome} />
          </div>
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-3">
            <CampoTexto nome="cidade" rotulo="Cidade" padrao={obra.cidade} />
            <CampoTexto nome="uf" rotulo="UF" padrao={obra.uf} />
          </div>
          <div className="lista-agrupada">
            <Marcador nome="ativa" marcado={obra.ativa} rotulo="Obra ativa (desmarque quando a obra terminar; o histórico continua guardado)" />
          </div>
        </Formulario>
      </section>
    </>
  );
}
