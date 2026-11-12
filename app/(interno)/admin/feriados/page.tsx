import type { Metadata } from "next";
import { exigirPapel } from "@/modules/acesso/sessao";
import { criarFeriado, excluirFeriado } from "@/modules/admin/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData, agoraNoFuso } from "@/lib/datas";
import { CampoTexto, Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Feriados" };

const ROTULO = { nacional: "Nacional", estadual: "Estadual", municipal: "Municipal" } as const;

export default async function PaginaFeriados() {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const anoAtual = agoraNoFuso().data.slice(0, 4);
  const { data: feriados } = await supabase
    .from("feriados")
    .select("id, data, descricao, abrangencia, uf, cidade")
    .gte("data", `${anoAtual}-01-01`)
    .order("data");

  return (
    <div className="grid items-start gap-5 lg:grid-cols-[minmax(0,1.6fr)_minmax(0,1fr)]">
      <section className="painel">
        <div>
          <h2 className="subtitulo">Feriados a partir de {anoAtual}</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Não contam como dia útil nos prazos do RH, da integração e das etapas.</p>
        </div>
        <div className="-mx-1.5 overflow-x-auto">
          <table className="tabela">
            <thead><tr><th>Data</th><th>Feriado</th><th>Abrangência</th><th /></tr></thead>
            <tbody>
              {(feriados ?? []).map((f) => (
                <tr key={f.id}>
                  <td className="whitespace-nowrap font-mono text-[13px]">{formatarData(f.data)}</td>
                  <td>{f.descricao}</td>
                  <td className="text-[13px] text-muted-foreground">
                    {ROTULO[f.abrangencia]}{f.uf ? ` · ${f.cidade ? `${f.cidade}/` : ""}${f.uf}` : ""}
                  </td>
                  <td className="text-right">
                    <Formulario acao={excluirFeriado.bind(null, f.id)} textoBotao="Excluir feriado" variante="neutro" confirmar={`Excluir o feriado ${f.descricao} (${formatarData(f.data)})?`} className="flex" />
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </section>

      <section className="painel">
        <div>
          <h2 className="subtitulo">Novo feriado</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Inclua os feriados estaduais e municipais das cidades das obras.</p>
        </div>
        <Formulario acao={criarFeriado} textoBotao="Cadastrar feriado">
          <CampoTexto nome="data" rotulo="Data" tipo="date" />
          <CampoTexto nome="descricao" rotulo="Descrição" />
          <label className="flex flex-col gap-1.5">
            <span className="text-[13px] font-semibold">Abrangência</span>
            <select name="abrangencia" defaultValue="municipal" className="campo">
              <option value="nacional">Nacional</option>
              <option value="estadual">Estadual</option>
              <option value="municipal">Municipal</option>
            </select>
          </label>
          <div className="grid grid-cols-[minmax(0,1fr)_minmax(0,3fr)] gap-3">
            <CampoTexto nome="uf" rotulo="UF" padrao="SC" />
            <CampoTexto nome="cidade" rotulo="Cidade" dica="Só para feriado municipal" />
          </div>
        </Formulario>
      </section>
    </div>
  );
}
