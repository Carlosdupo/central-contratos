import { formatarData } from "@/lib/datas";
import type { EstadoFormulario } from "@/lib/formulario";
import { formatarCompetencia } from "@/modules/terceiros/dominio/documentos";
import { BotaoAbrirArquivo } from "./documentos";
import { CampoEmLinha, Formulario } from "./formulario";

export type ItemAnalise = {
  id: string;
  arquivoId: string | null;
  decisao: "aprovado" | "reprovado" | null;
  motivo: string | null;
  nome: string;
  sensivel: boolean;
  responsavel: "rh" | "sst";
  valorTexto: string | null;
  competencia: string | null;
  validade: string | null;
};

type Acao = (estado: EstadoFormulario, dados: FormData) => Promise<EstadoFormulario>;
type Bloco = { chave: "rh" | "sst"; titulo: string; area: string; itens: ItemAnalise[]; meu: boolean };

// Um bloco da análise (RH ou Segurança). Só quem é da área decide; a outra área vê sem botões.
export function BlocoAnalise({ bloco, aberto, aprovar, devolver }: { bloco: Bloco; aberto: boolean; aprovar: (id: string) => Acao; devolver: (id: string) => Acao }) {
  const faltam = bloco.itens.filter((i) => !i.decisao).length;
  return (
    <section className="painel" aria-labelledby={`bloco-${bloco.chave}`}>
      <div className="flex flex-wrap items-end justify-between gap-2">
        <h2 id={`bloco-${bloco.chave}`} className="subtitulo">{bloco.titulo}</h2>
        <span className="text-[13px] text-muted-foreground">
          {!aberto ? "Análise concluída" : faltam ? `Faltam ${faltam} para decidir` : "Tudo decidido"}
          {!bloco.meu && " · só leitura"}
        </span>
      </div>
      <div className="lista-agrupada">
        {bloco.itens.map((item) => (
          <div key={item.id} className="flex flex-col gap-2.5 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="font-medium">{item.nome}{item.sensivel && <span className="ml-2 text-xs font-normal text-faint">dado de saúde</span>}</div>
                <div className="text-[12.5px] text-muted-foreground">
                  {[item.valorTexto, item.competencia && `Competência ${formatarCompetencia(item.competencia)}`, item.validade && `Válido até ${formatarData(item.validade)}`].filter(Boolean).join(" · ") || "Sem validade"}
                </div>
                {item.decisao === "reprovado" && <div className="text-[12.5px] text-bad">Reprovado: {item.motivo}</div>}
              </div>
              <div className="flex items-center gap-3">
                {item.arquivoId && <BotaoAbrirArquivo arquivoId={item.arquivoId} />}
                {item.decisao === "aprovado" && <span className="selo selo-ok">Aprovado</span>}
                {item.decisao === "reprovado" && <span className="selo selo-erro">Reprovado</span>}
                {!item.decisao && !bloco.meu && <span className="selo selo-neutro">Aguardando {bloco.area}</span>}
              </div>
            </div>
            {aberto && bloco.meu && !item.decisao && (
              <div className="flex flex-wrap items-start gap-3">
                <Formulario acao={aprovar(item.id)} textoBotao="Aprovar documento" sensivel={`Aprova o documento ${item.nome} da empresa terceirizada.`} className="flex" />
                <Formulario acao={devolver(item.id)} textoBotao="Devolver documento" variante="perigo" sensivel={`Devolve o documento ${item.nome} para a empresa corrigir, com o motivo.`} className="flex flex-wrap items-center gap-2">
                  <CampoEmLinha nome="motivo" placeholder="Motivo (a empresa vai ver)" rotulo={`Motivo da devolução: ${item.nome}`} className="max-w-[300px]" />
                </Formulario>
              </div>
            )}
          </div>
        ))}
      </div>
    </section>
  );
}
