import Link from "next/link";
import type { EtapaAberta } from "@/modules/contratacoes/consultas";
import type { AssinaturaPendente, ResumoObra } from "@/modules/contratacoes/painel-suprimentos";
import { SeloPrazo } from "@/components/app/selo-prazo";

type Props = {
  fila: EtapaAberta[];
  negociar: number;
  autorizar: number;
  atrasadas: number;
  assinaturas: AssinaturaPendente[];
  chegando: number;
  obras: ResumoObra[];
  ehGerente: boolean;
};

function Numero({ n, rotulo, tom }: { n: number; rotulo: string; tom?: "erro" | "alerta" }) {
  const cor = n > 0 && tom === "erro" ? "text-bad" : n > 0 && tom === "alerta" ? "text-warn" : "";
  return (
    <div className="flex flex-col gap-1 rounded-2xl bg-card px-4 py-3">
      <span className={`text-[34px] leading-none font-bold tracking-tight tabular-nums ${cor}`}>{n}</span>
      <span className="text-[12.5px] font-medium text-muted-foreground">{rotulo}</span>
    </div>
  );
}

const Contagem = ({ n, tom }: { n: number; tom?: "erro" }) => (
  <span className={`tabular-nums ${n === 0 ? "text-faint" : tom === "erro" ? "font-semibold text-bad" : "font-semibold"}`}>{n}</span>
);

// Painel de Suprimentos: negociações, autorizações, assinaturas e a situação de cada obra.
export function PainelSuprimentos({ fila, negociar, autorizar, atrasadas, assinaturas, chegando, obras, ehGerente }: Props) {
  return (
    <section className="flex flex-col gap-4 rounded-[22px] bg-[color-mix(in_srgb,var(--warn-soft)_70%,transparent)] p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="subtitulo">Suprimentos</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">Negociações, autorizações e assinaturas esperando a área, e como está cada obra.</p>
        </div>
        <Link href="/contratacoes/panorama" className="botao botao-primario">Panorama das obras</Link>
      </div>

      <div className="grid grid-cols-5 gap-3 max-lg:grid-cols-3 max-sm:grid-cols-2">
        <Numero n={negociar} rotulo="Para negociar (etapa 5)" />
        <Numero n={autorizar} rotulo={ehGerente ? "Para você autorizar" : "Com o gerente"} tom={ehGerente ? "alerta" : undefined} />
        <Numero n={assinaturas.length} rotulo="Assinaturas de Suprimentos" tom="alerta" />
        <Numero n={atrasadas} rotulo="Fora do prazo" tom="erro" />
        <Numero n={chegando} rotulo="Ainda na obra (vão chegar)" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.2fr)_minmax(0,1fr)]">
        <div className="painel gap-3">
          <h3 className="text-[15px] font-semibold">Solicitações com Suprimentos</h3>
          {fila.length === 0 && assinaturas.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Nada esperando Suprimentos agora.</p>
          ) : (
            <div className="lista-agrupada">
              {fila.slice(0, 8).map((a) => (
                <Link key={`${a.contratacaoId}-${a.etapa.etapa}`} href={`/contratacoes/${a.contratacaoId}?etapa=${a.etapa.etapa}`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-fill-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{a.servico}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{a.obra} · {a.etapa.etapa === 6 ? "Autorização do gerente" : "Validação e negociação"}</span>
                  </span>
                  <SeloPrazo prazo={a.prazo} uteis={a.uteis} />
                </Link>
              ))}
              {assinaturas.slice(0, 5).map((a) => (
                <Link key={`${a.contratacaoId}-ass`} href={`/contratacoes/${a.contratacaoId}?etapa=9`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-fill-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{a.servico}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{a.obra} · Assinatura de Suprimentos</span>
                  </span>
                  <SeloPrazo prazo={a.prazo} uteis={a.uteis} />
                </Link>
              ))}
            </div>
          )}
        </div>

        <div className="painel gap-3">
          <h3 className="text-[15px] font-semibold">Por obra</h3>
          {obras.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Nenhuma contratação aberta.</p>
          ) : (
            <div className="-mx-1.5 overflow-x-auto">
              <table className="tabela text-[13px]">
                <thead>
                  <tr><th>Obra</th><th className="text-center">Na obra</th><th className="text-center">Supr.</th><th className="text-center">Contrato</th><th className="text-center">Assin.</th><th className="text-center">Doc./Integr.</th><th className="text-center">Liberadas</th></tr>
                </thead>
                <tbody>
                  {obras.map((o) => (
                    <tr key={o.obraId}>
                      <td>
                        <Link href={`/contratacoes/panorama?obra=${o.obraId}`} className="font-medium text-primary">{o.obra}</Link>
                        {o.atrasadas > 0 && <div className="text-[12px] text-bad">{o.atrasadas} com atraso</div>}
                      </td>
                      <td className="text-center"><Contagem n={o.naObra} /></td>
                      <td className="text-center"><Contagem n={o.emSuprimentos} /></td>
                      <td className="text-center"><Contagem n={o.noContrato} /></td>
                      <td className="text-center"><Contagem n={o.emAssinatura} /></td>
                      <td className="text-center"><Contagem n={o.naDocumentacao} /></td>
                      <td className="text-center"><Contagem n={o.liberadas} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
