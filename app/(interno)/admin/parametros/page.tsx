import type { Metadata } from "next";
import { exigirPapel } from "@/modules/acesso/sessao";
import { salvarParametro } from "@/modules/admin/acoes";
import { ESQUEMAS, ROTULO_PARAMETRO, ehChaveParametro, type ChaveParametro } from "@/modules/admin/parametros";
import { ETAPAS_CONTRATACAO } from "@/modules/contratacoes/etapas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario, Marcador } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Parâmetros" };

const ORDEM: ChaveParametro[] = [
  "limite_escolha_obra_reais",
  "prazo_analise_rh",
  "horario_corte_integracao",
  "antecedencia_visita_dias",
  "validade_documentos_meses",
  "prazos_etapas",
  "fuso_horario",
];

export default async function PaginaParametros() {
  await exigirPapel("admin");
  const supabase = await criarClienteServidor();
  const { data } = await supabase.from("parametros").select("chave, valor, descricao, updated_at");
  const porChave = new Map((data ?? []).filter((p) => ehChaveParametro(p.chave)).map((p) => [p.chave as ChaveParametro, p]));

  return (
    <div className="flex flex-col gap-5">
      <p className="max-w-[70ch] text-[14px] text-muted-foreground">
        Mudanças valem para o que for aberto depois. Contratações em andamento mantêm os prazos de quando foram abertas. Toda alteração fica registrada na auditoria.
      </p>
      <div className="grid items-start gap-5 lg:grid-cols-2">
        {ORDEM.map((chave) => {
          const p = porChave.get(chave);
          if (!p) return null;
          const lido = ESQUEMAS[chave].safeParse(p.valor);
          return (
            <section key={chave} className={`painel ${chave === "prazos_etapas" ? "lg:col-span-2" : ""}`}>
              <div>
                <h2 className="subtitulo">{ROTULO_PARAMETRO[chave]}</h2>
                <p className="mt-1 text-[13px] text-muted-foreground">{p.descricao}</p>
              </div>
              {lido.success ? <Editor chave={chave} valor={lido.data} /> : <p className="text-[13px] text-bad">Valor salvo em formato inválido. Corrija pela migration.</p>}
            </section>
          );
        })}
      </div>
    </div>
  );
}

function Editor({ chave, valor }: { chave: ChaveParametro; valor: unknown }) {
  const acao = salvarParametro.bind(null, chave);
  switch (chave) {
    case "fuso_horario":
      return <p className="font-mono text-[14px]">{String(valor)}</p>;
    case "limite_escolha_obra_reais":
      return <Formulario acao={acao} textoBotao="Salvar"><CampoTexto nome="valor" rotulo="Valor em reais" tipo="number" min={0} padrao={valor as number} /></Formulario>;
    case "horario_corte_integracao":
      return <Formulario acao={acao} textoBotao="Salvar"><CampoTexto nome="valor" rotulo="Hora (0 a 23)" tipo="number" min={0} max={23} padrao={valor as number} /></Formulario>;
    case "antecedencia_visita_dias":
      return <Formulario acao={acao} textoBotao="Salvar"><CampoTexto nome="valor" rotulo="Dias de antecedência" tipo="number" min={0} padrao={valor as number} /></Formulario>;
    case "prazo_analise_rh": {
      const v = valor as { dias: number; uteis: boolean };
      return (
        <Formulario acao={acao} textoBotao="Salvar">
          <CampoTexto nome="dias" rotulo="Dias" tipo="number" min={1} padrao={v.dias} />
          <div className="lista-agrupada"><Marcador nome="uteis" marcado={v.uteis} rotulo="Contar só dias úteis" /></div>
        </Formulario>
      );
    }
    case "validade_documentos_meses": {
      const v = valor as { aso: number; nr: number; rg_cnh: number };
      return (
        <Formulario acao={acao} textoBotao="Salvar">
          <div className="grid grid-cols-3 gap-3">
            <CampoTexto nome="aso" rotulo="ASO (meses)" tipo="number" min={1} padrao={v.aso} />
            <CampoTexto nome="nr" rotulo="NRs (meses)" tipo="number" min={1} padrao={v.nr} />
            <CampoTexto nome="rg_cnh" rotulo="RG/CNH (meses)" tipo="number" min={1} padrao={v.rg_cnh} />
          </div>
        </Formulario>
      );
    }
    case "prazos_etapas": {
      const v = valor as Record<string, { dias: number; uteis: boolean } | undefined>;
      return (
        <Formulario acao={acao} textoBotao="Salvar prazos">
          <div className="lista-agrupada">
            {ETAPAS_CONTRATACAO.map((e) => {
              const atual = v[String(e.numero)];
              return (
                <div key={e.numero} className="grid grid-cols-[28px_minmax(0,1fr)_96px_auto] items-center gap-3 px-3.5 py-2.5 max-sm:grid-cols-[28px_minmax(0,1fr)]">
                  <span className="grid size-6 place-items-center rounded-full border border-input text-xs font-semibold text-muted-foreground">{e.numero}</span>
                  <span className="min-w-0 text-[14px]">{e.nome} <span className="text-faint">· {e.area}</span></span>
                  <input name={`dias_${e.numero}`} type="number" min={1} defaultValue={atual?.dias ?? ""} placeholder="sem prazo" aria-label={`Dias da etapa ${e.numero}`} className="campo py-1.5 max-sm:col-start-2" />
                  <label className="flex items-center gap-2 text-[13px] text-muted-foreground max-sm:col-start-2">
                    <input type="checkbox" name={`uteis_${e.numero}`} defaultChecked={atual?.uteis} className="size-4 accent-primary" /> úteis
                  </label>
                </div>
              );
            })}
          </div>
          <p className="text-xs text-faint">Deixe em branco a etapa que não tem prazo definido.</p>
        </Formulario>
      );
    }
  }
}
