import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { SITUACAO_ALOCACAO, TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";

export const metadata: Metadata = { title: "Consultar pessoas" };

// Consulta por nome (parte, sem acento) ou CPF completo (A3). Mostra só a situação; arquivos ficam na ficha.
export default async function PaginaConsultaPessoas({ searchParams }: PageProps<"/terceiros/pessoas">) {
  await exigirInterno();
  const { q } = await searchParams;
  const termo = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const supabase = await criarClienteServidor();
  const { data: resultados, error } = termo ? await supabase.rpc("buscar_pessoas", { p_termo: termo }) : { data: null, error: null };

  return (
    <>
      <div>
        <h1 className="titulo">Consultar pessoas</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">Busque por parte do nome ou pelo CPF completo para ver se a pessoa está liberada e em qual obra.</p>
      </div>
      <form className="flex max-w-[560px] gap-2" role="search">
        <input name="q" defaultValue={termo} placeholder="Ex.: joao silva ou 000.000.000-00" aria-label="Nome ou CPF" className="campo" autoFocus />
        <button type="submit" className="botao botao-primario">Buscar</button>
      </form>

      {termo && (
        <section className="painel">
          {error ? (
            <p className="text-[14px] text-bad">Não foi possível buscar agora. Tente de novo.</p>
          ) : (resultados ?? []).length === 0 ? (
            <p className="text-[14px] text-muted-foreground">{termo.replace(/\D/g, "").length < 11 && termo.length < 3 ? "Digite pelo menos 3 letras ou o CPF completo." : "Ninguém encontrado."}</p>
          ) : (
            <div className="-mx-1.5 overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Pessoa</th><th>Empresa</th><th>Obra</th><th>Situação</th></tr></thead>
                <tbody>
                  {(resultados ?? []).map((r, i) => {
                    const [classe, rotulo] = r.situacao ? SITUACAO_ALOCACAO[r.situacao] : ["selo-neutro", r.tipo === "socio_esporadico" ? "Visita por pedido" : "—"];
                    return (
                      <tr key={`${r.vinculo_id}-${i}`}>
                        <td>
                          <Link href={`/terceiros/pessoas/${r.vinculo_id}`} className="font-medium text-primary">{r.nome}</Link>
                          <div className="text-[12.5px] text-muted-foreground">CPF {r.cpf_mascarado} · {r.funcao} · {TIPO_VINCULO[r.tipo]}</div>
                        </td>
                        <td className="text-[13px]">{r.empresa}</td>
                        <td className="text-[13px]">{r.obra ?? "—"}</td>
                        <td>
                          <span className={`selo ${classe}`}>{rotulo}</span>
                          {r.integracao_data && <div className="mt-1 text-xs text-muted-foreground">Integração {formatarData(r.integracao_data)}</div>}
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </section>
      )}
    </>
  );
}
