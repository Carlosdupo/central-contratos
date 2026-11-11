import { formatarData } from "@/lib/datas";
import type { ItemDocumentoPessoa } from "@/modules/terceiros/consultas";
import { BotaoAbrirArquivo, EnviarArquivo, SeloEstado } from "./documentos";

// Documentos de uma pessoa. "editavel" no portal; só leitura para a equipe interna.
export function ListaDocumentosPessoa({ vinculoId, itens, editavel, podeAbrir }: { vinculoId: string; itens: ItemDocumentoPessoa[]; editavel: boolean; podeAbrir: (sensivel: boolean) => boolean }) {
  return (
    <div className="lista-agrupada">
      {itens.map((item) => {
        const aceitaNovo = editavel && ["falta", "anexado", "reprovado", "vencido"].includes(item.estado);
        return (
          <div key={item.tipo.codigo} className="flex flex-col gap-2.5 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="font-medium">
                  {item.tipo.nome}
                  {item.tipo.sensivel && <span className="ml-2 text-xs font-normal text-faint">dado de saúde</span>}
                </div>
                {item.validade && <div className="text-[12.5px] text-muted-foreground">Válido até {formatarData(item.validade)}</div>}
                {item.estado === "reprovado" && item.motivo && <div className="text-[12.5px] text-bad">Motivo: {item.motivo}</div>}
                {aceitaNovo && item.tipo.observacao && <div className="text-[12.5px] text-faint">{item.tipo.observacao}</div>}
              </div>
              <div className="flex items-center gap-3">
                {podeAbrir(item.tipo.sensivel) && item.arquivoId && <BotaoAbrirArquivo arquivoId={item.arquivoId} />}
                <SeloEstado estado={item.estado} />
              </div>
            </div>
            {aceitaNovo && <EnviarArquivo dono={{ tipo: "pessoa", vinculo: vinculoId }} tipoDoc={item.tipo.codigo} regra={item.tipo.regra_validade} />}
          </div>
        );
      })}
    </div>
  );
}
