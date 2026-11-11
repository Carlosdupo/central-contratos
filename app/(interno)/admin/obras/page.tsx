import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarObra } from "@/modules/admin/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Obras" };

export default async function PaginaObras() {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("obras").select("id, codigo, nome, cidade, uf, ativa").order("ativa", { ascending: false }).order("nome");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="painel">
        <h2 className="subtitulo">Obras</h2>
        {(obras ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhuma obra cadastrada ainda. Use o formulário ao lado para cadastrar a primeira.</p>
        ) : (
          <div className="-mx-1.5 overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Obra</th><th>Cidade</th><th>Situação</th></tr></thead>
              <tbody>
                {(obras ?? []).map((o) => (
                  <tr key={o.id}>
                    <td>
                      <Link href={`/admin/obras/${o.id}`} className="font-medium text-primary">{o.nome}</Link>
                      <div className="font-mono text-xs text-muted-foreground">{o.codigo}</div>
                    </td>
                    <td className="text-[13px]">{o.cidade}/{o.uf}</td>
                    <td><span className={`selo ${o.ativa ? "selo-ok" : "selo-neutro"}`}>{o.ativa ? "Ativa" : "Desativada"}</span></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="painel">
        <h2 className="subtitulo">Nova obra</h2>
        <Formulario acao={criarObra} textoBotao="Cadastrar obra">
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,2fr)] gap-3">
            <CampoTexto nome="codigo" rotulo="Código" dica="Ex.: IPE" />
            <CampoTexto nome="nome" rotulo="Nome" />
          </div>
          <div className="grid grid-cols-[minmax(0,3fr)_minmax(0,1fr)] gap-3">
            <CampoTexto nome="cidade" rotulo="Cidade" />
            <CampoTexto nome="uf" rotulo="UF" padrao="SC" />
          </div>
        </Formulario>
      </section>
    </div>
  );
}
