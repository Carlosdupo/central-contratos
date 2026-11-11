import Link from "next/link";
import { formatarData } from "@/lib/datas";
import type { MembroEquipe } from "@/modules/terceiros/consultas";
import { SITUACAO_ALOCACAO, TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { Avatar } from "./avatar";

// Equipe da empresa com a situação em cada obra (portal e ficha interna da empresa).
export function ListaEquipe({ equipe, fotos, linkBase }: { equipe: (MembroEquipe & { fotoPath?: string | null })[]; fotos: Map<string, string>; linkBase: string }) {
  if (equipe.length === 0) return <p className="text-[14px] text-muted-foreground">Nenhuma pessoa cadastrada ainda.</p>;
  return (
    <div className="lista-agrupada">
      {equipe.map((m) => (
        <Link key={m.vinculoId} href={`${linkBase}/${m.vinculoId}`} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5 hover:bg-fill-2">
          <Avatar nome={m.nome} url={m.fotoPath ? fotos.get(m.fotoPath) : null} />
          <span className="min-w-0 flex-1">
            <span className="block font-medium">{m.nome}</span>
            <span className="block text-[12.5px] text-muted-foreground">{m.funcao} · {TIPO_VINCULO[m.tipo]}</span>
          </span>
          <span className="flex flex-col items-end gap-1">
            {m.tipo === "socio_esporadico" ? (
              <span className="selo selo-neutro">Visita por pedido</span>
            ) : (
              m.alocacoes.map((a, i) => {
                const [classe, rotulo] = SITUACAO_ALOCACAO[a.situacao];
                return (
                  <span key={i} className={`selo ${classe}`} title={a.obra}>
                    {m.alocacoes.length > 1 ? `${a.obra}: ` : ""}{rotulo}{a.situacao === "integracao_agendada" && a.integracaoData ? ` ${formatarData(a.integracaoData).slice(0, 5)}` : ""}
                  </span>
                );
              })
            )}
          </span>
        </Link>
      ))}
    </div>
  );
}
