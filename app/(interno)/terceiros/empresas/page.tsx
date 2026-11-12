import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { convidarEmpresa } from "@/modules/terceiros/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarCnpj } from "@/lib/documentos-br";
import { CampoTexto, Formulario } from "@/components/app/formulario";
import { JanelaLateral } from "@/components/app/janela-lateral";
import { CampoCnpj, CampoTelefone } from "@/components/app/campos-mascara";
import { SITUACAO_EMPRESA } from "@/modules/terceiros/rotulos";

export const metadata: Metadata = { title: "Empresas terceirizadas" };


export default async function PaginaEmpresas() {
  const usuario = await exigirInterno();
  const podeConvidar = temAlgumPapel(usuario.papeis, ["admin", "suprimentos", "gerente_suprimentos", "contratos"]);
  const supabase = await criarClienteServidor();
  const [{ data: empresas }, { data: obras }, { data: ligacoes }] = await Promise.all([
    supabase.from("empresas_terceiras").select("id, razao_social, cnpj, situacao").order("razao_social"),
    supabase.from("obras").select("id, nome").eq("ativa", true).order("nome"),
    supabase.from("empresa_obras").select("empresa_id, obras(nome)").eq("ativo", true),
  ]);
  const obrasDaEmpresa = (id: string) =>
    (ligacoes ?? []).filter((l) => l.empresa_id === id).map((l) => (l.obras as { nome: string } | null)?.nome).filter(Boolean).join(", ");

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Empresas terceirizadas</h1>
          <p className="mt-1 max-w-[66ch] text-muted-foreground">A empresa recebe um convite por e-mail, cria a senha e envia os documentos pelo portal.</p>
        </div>
        {podeConvidar && (
          <JanelaLateral textoBotao="Convidar empresa" titulo="Convidar empresa" descricao="O e-mail informado vira o acesso do responsável da empresa ao portal.">
            {(obras ?? []).length === 0 ? (
              <p className="text-[14px] text-muted-foreground">Cadastre uma obra em Administração antes de convidar empresas.</p>
            ) : (
              <Formulario acao={convidarEmpresa} textoBotao="Enviar convite à empresa">
                <CampoTexto nome="razao" rotulo="Razão social" />
                <CampoCnpj />
                <CampoTexto nome="email" rotulo="E-mail do responsável" tipo="email" />
                <CampoTelefone />
                <label className="flex flex-col gap-1.5">
                  <span className="text-[13px] font-semibold">Obra</span>
                  <select name="obra" className="campo" defaultValue="">
                    <option value="" disabled>Escolha a obra</option>
                    {(obras ?? []).map((o) => <option key={o.id} value={o.id}>{o.nome}</option>)}
                  </select>
                </label>
              </Formulario>
            )}
          </JanelaLateral>
        )}
      </div>
      <div>
        <section className="painel">
          {(empresas ?? []).length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Nenhuma empresa cadastrada ainda. As empresas entram por convite de Suprimentos ou na autorização da contratação.</p>
          ) : (
            <div className="-mx-1.5 overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Empresa</th><th>Obras</th><th>Documentos</th></tr></thead>
                <tbody>
                  {(empresas ?? []).map((e) => {
                    const [classe, rotulo] = SITUACAO_EMPRESA[e.situacao];
                    return (
                      <tr key={e.id}>
                        <td>
                          <Link href={`/terceiros/empresas/${e.id}`} className="font-medium text-primary">{e.razao_social}</Link>
                          <div className="font-mono text-xs text-muted-foreground">{formatarCnpj(e.cnpj)}</div>
                        </td>
                        <td className="text-[13px]">{obrasDaEmpresa(e.id) || "—"}</td>
                        <td><span className={`selo ${classe}`}>{rotulo}</span></td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      </div>
    </>
  );
}
