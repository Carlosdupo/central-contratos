import { agoraNoFuso, diasCorridosEntre, formatarData } from "@/lib/datas";
import { formatarCompetencia } from "@/modules/terceiros/dominio/documentos";
import type { ItemDocumentoEmpresa } from "@/modules/terceiros/consultas";
import { salvarTextoEmpresa } from "@/modules/terceiros/acoes";
import { BotaoAbrirArquivo, EnviarArquivo, SeloEstado } from "./documentos";
import { Formulario } from "./formulario";

const diasAte = (data: string) => diasCorridosEntre(agoraNoFuso().data, data);

// Lista de documentos da empresa. "editavel" no portal da empresa; só leitura para a equipe interna.
export function ListaDocumentosEmpresa({ itens, editavel, podeAbrir }: { itens: ItemDocumentoEmpresa[]; editavel: boolean; podeAbrir: boolean }) {
  return (
    <div className="lista-agrupada">
      {itens.map((item) => {
        const aceitaNovo = editavel && ["falta", "anexado", "reprovado", "vencido"].includes(item.estado);
        const detalhes = [
          item.competencia && `Competência ${formatarCompetencia(item.competencia)}`,
          item.validade && `Válido até ${formatarData(item.validade)}`,
          item.tipo.aceita_texto && item.valorTexto && !aceitaNovo && item.valorTexto,
        ].filter(Boolean);
        return (
          <div key={item.tipo.codigo} className="flex flex-col gap-2.5 px-3.5 py-3">
            <div className="flex flex-wrap items-center justify-between gap-x-4 gap-y-1">
              <div className="min-w-0">
                <div className="font-medium">{item.tipo.nome}</div>
                {detalhes.length > 0 && <div className="text-[12.5px] text-muted-foreground">{detalhes.join(" · ")}</div>}
                {item.estado === "reprovado" && item.motivo && <div className="text-[12.5px] text-bad">Motivo: {item.motivo}</div>}
                {aceitaNovo && item.tipo.observacao && <div className="text-[12.5px] text-faint">{item.tipo.observacao}</div>}
              </div>
              <div className="flex items-center gap-3">
                {podeAbrir && item.arquivoId && <BotaoAbrirArquivo arquivoId={item.arquivoId} />}
                {item.estado === "aprovado" && item.validade && diasAte(item.validade) <= 30 && <span className="selo selo-alerta">Vence em {diasAte(item.validade)} d</span>}
                <SeloEstado estado={item.estado} />
              </div>
            </div>
            {aceitaNovo &&
              (item.tipo.aceita_texto ? (
                <Formulario acao={salvarTextoEmpresa.bind(null, item.tipo.codigo)} textoBotao="Salvar informação" className="flex flex-wrap items-center gap-2">
                  <input name="texto" defaultValue={item.valorTexto ?? ""} placeholder="Nome da contabilidade e telefone" aria-label={item.tipo.nome} className="campo max-w-[360px] py-1.5" />
                </Formulario>
              ) : (
                <EnviarArquivo dono={{ tipo: "empresa" }} tipoDoc={item.tipo.codigo} regra={item.tipo.regra_validade} competencia={item.competencia} />
              ))}
          </div>
        );
      })}
    </div>
  );
}
