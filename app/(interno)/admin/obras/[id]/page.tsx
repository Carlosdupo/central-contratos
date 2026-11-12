import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { z } from "zod";
import { exigirPapel } from "@/modules/acesso/sessao";
import { atualizarObra, importarEap } from "@/modules/admin/acoes";
import { agruparEap } from "@/lib/eap";
import { formatarData, agoraNoFuso } from "@/lib/datas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Obra" };

export default async function PaginaObra({ params }: PageProps<"/admin/obras/[id]">) {
  await exigirPapel("admin");
  const { id } = await params;
  if (!z.uuid().safeParse(id).success) notFound();

  const supabase = await criarClienteServidor();
  const [{ data: obra }, { data: eap }] = await Promise.all([
    supabase.from("obras").select("id, codigo, nome, cidade, uf, ativa, eap_importada_em").eq("id", id).maybeSingle(),
    supabase.from("obra_eap").select("id, referencia, descricao, nivel").eq("obra_id", id).order("ordem"),
  ]);
  if (!obra) notFound();
  const grupos = agruparEap(eap ?? []);

  return (
    <>
      <div>
        <Link href="/admin/obras" className="text-[14px] text-primary">← Obras</Link>
        <h2 className="titulo mt-2 text-[28px]">{obra.nome}</h2>
      </div>
      <section className="painel max-w-[560px]">
        <Formulario acao={atualizarObra.bind(null, obra.id)} textoBotao="Salvar obra">
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

      <section className="painel">
        <div>
          <h3 className="subtitulo">EAP da obra</h3>
          <p className="mt-1 text-[13px] text-muted-foreground">
            {obra.eap_importada_em
              ? `${grupos.length} grupos e ${(eap ?? []).length - grupos.length} serviços, importada em ${formatarData(agoraNoFuso(new Date(obra.eap_importada_em)).data)}. Na nova contratação, o coordenador escolhe o serviço desta lista.`
              : "Envie o PDF da EAP exportado do Sienge (colunas Nível, Referência e Descrição). Na nova contratação, o coordenador escolhe o serviço desta lista."}
          </p>
        </div>
        <Formulario acao={importarEap.bind(null, obra.id)} textoBotao={obra.eap_importada_em ? "Importar EAP atualizada" : "Importar EAP"} className="flex flex-wrap items-center gap-3">
          <input type="file" name="arquivo" accept="application/pdf" aria-label="PDF da EAP" className="text-[13px]" />
        </Formulario>
        {grupos.length > 0 && (
          <div className="lista-agrupada">
            {grupos.map(({ grupo, filhos }) => (
              <details key={grupo.id} className="px-3.5 py-2">
                <summary className="cursor-pointer text-[14px] font-medium">
                  <span className="font-mono text-muted-foreground">{grupo.referencia}</span> {grupo.descricao}
                  <span className="ml-2 text-[12.5px] font-normal text-faint">{filhos.length} serviços</span>
                </summary>
                <ul className="mt-1.5 flex flex-col gap-0.5 pb-1 pl-5 text-[13px]">
                  {filhos.map((f) => <li key={f.id}><span className="font-mono text-muted-foreground">{f.referencia}</span> {f.descricao}</li>)}
                </ul>
              </details>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
