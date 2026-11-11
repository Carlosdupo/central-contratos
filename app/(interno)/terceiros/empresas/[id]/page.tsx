import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { documentosDaEmpresa, equipeDaEmpresa } from "@/modules/terceiros/consultas";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { ListaEquipe } from "@/components/app/lista-equipe";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCnpj } from "@/lib/documentos-br";
import { ListaDocumentosEmpresa } from "@/components/app/lista-documentos-empresa";
import { SITUACAO_EMPRESA } from "@/modules/terceiros/rotulos";

export const metadata: Metadata = { title: "Empresa" };

export default async function PaginaEmpresa({ params }: PageProps<"/terceiros/empresas/[id]">) {
  const usuario = await exigirInterno();
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: empresa }, { data: obras }, { data: acessos }, documentos] = await Promise.all([
    supabase.from("empresas_terceiras").select("id, razao_social, cnpj, email, telefone, situacao").eq("id", id).maybeSingle(),
    supabase.from("empresa_obras").select("obras(nome, cidade, uf)").eq("empresa_id", id).eq("ativo", true),
    supabase.from("empresa_usuarios").select("usuarios!empresa_usuarios_usuario_id_fkey(nome, email, ativo)").eq("empresa_id", id),
    documentosDaEmpresa(id),
  ]);
  if (!empresa) notFound();
  const equipe = await equipeDaEmpresa(id);
  const fotos = await linksDasFotos(equipe.map((m) => m.fotoPath));

  // Quem abre arquivos (a RLS confere de novo; ASO só RH/SST).
  const podeAbrir = temAlgumPapel(usuario.papeis, ["admin", "suprimentos", "contratos", "rh", "sst"]);
  const [classe, rotulo] = SITUACAO_EMPRESA[empresa.situacao];

  return (
    <>
      <div>
        <Link href="/terceiros/empresas" className="text-[14px] text-primary">← Empresas</Link>
        <div className="mt-2 flex flex-wrap items-end justify-between gap-3">
          <div>
            <h1 className="titulo">{empresa.razao_social}</h1>
            <p className="font-mono text-[13px] text-muted-foreground">{formatarCnpj(empresa.cnpj)}</p>
          </div>
          <span className={`selo ${classe}`}>{rotulo}</span>
        </div>
      </div>

      <div className="painel flex-row flex-wrap gap-x-8 gap-y-3 py-4 text-[14px]">
        <div><div className="text-xs font-medium text-faint">Contato</div>{empresa.email}{empresa.telefone ? ` · ${empresa.telefone}` : ""}</div>
        <div><div className="text-xs font-medium text-faint">Obras</div>{(obras ?? []).map((o) => (o.obras as { nome: string } | null)?.nome).filter(Boolean).join(", ") || "—"}</div>
        <div><div className="text-xs font-medium text-faint">Acesso ao portal</div>{(acessos ?? []).map((a) => (a.usuarios as { email: string } | null)?.email).filter(Boolean).join(", ") || "—"}</div>
      </div>

      <section className="painel">
        <div>
          <h2 className="subtitulo">Documentos da empresa</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Toda abertura de arquivo fica registrada.</p>
        </div>
        <ListaDocumentosEmpresa itens={documentos.itens} editavel={false} podeAbrir={podeAbrir} />
      </section>

      <section className="painel">
        <div>
          <h2 className="subtitulo">Equipe</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">{equipe.length} pessoa(s). Clique para ver os documentos de cada uma.</p>
        </div>
        <ListaEquipe equipe={equipe} fotos={fotos} linkBase="/terceiros/pessoas" />
      </section>
    </>
  );
}
