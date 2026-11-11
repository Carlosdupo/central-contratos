import Link from "next/link";
import type { DocumentoVencendo, EnvioNaFila } from "@/modules/terceiros/analise";
import { agoraNoFuso, diasCorridosEntre, formatarData } from "@/lib/datas";
import { SeloPrazo } from "@/components/app/selo-prazo";

type Props = {
  fila: EnvioNaFila[];
  visitas: number;
  vencendo: DocumentoVencendo[];
  vencidos: number;
  prazoUteis: boolean;
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

// Painel do RH: o que é dele para fazer hoje, em destaque no topo da página inicial.
export function PainelRh({ fila, visitas, vencendo, vencidos, prazoUteis }: Props) {
  const atrasados = fila.filter((e) => e.prazo.tipo === "atrasada").length;
  const venceHoje = fila.filter((e) => e.prazo.tipo === "vence_hoje").length;
  const hoje = agoraNoFuso().data;
  const tudoEmDia = fila.length === 0 && visitas === 0;

  return (
    <section className="flex flex-col gap-4 rounded-[22px] bg-primary-soft p-5">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="subtitulo">Sua fila no RH</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {tudoEmDia ? "Nada esperando você agora." : "Os mais urgentes primeiro."}
          </p>
        </div>
        <Link href="/terceiros/analise" className="botao botao-primario">Abrir análise do RH</Link>
      </div>

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <Numero n={fila.length} rotulo="Envios para conferir" />
        <Numero n={atrasados} rotulo="Fora do prazo" tom="erro" />
        <Numero n={venceHoje} rotulo="Prazo vence hoje" tom="alerta" />
        <Numero n={visitas} rotulo="Pedidos de visita" tom="alerta" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="painel gap-3">
          <h3 className="text-[15px] font-semibold">Para conferir</h3>
          {fila.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Nenhum envio esperando análise.</p>
          ) : (
            <div className="lista-agrupada">
              {fila.slice(0, 6).map((e) => (
                <Link key={e.id} href={`/terceiros/analise/${e.id}`} className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-fill-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{e.pessoa ?? e.empresa}</span>
                    <span className="block text-[12.5px] text-muted-foreground">
                      {e.pessoa ? `${e.empresa} · documentos da pessoa` : "Documentos da empresa"} · enviado {formatarData(e.enviadoEm).slice(0, 5)}
                    </span>
                  </span>
                  <SeloPrazo prazo={e.prazo} uteis={prazoUteis} />
                </Link>
              ))}
            </div>
          )}
          {fila.length > 6 && <Link href="/terceiros/analise" className="text-[13px] text-primary">Ver os outros {fila.length - 6}</Link>}
        </div>

        <div className="painel gap-3">
          <div>
            <h3 className="text-[15px] font-semibold">Vencendo em 30 dias</h3>
            {vencidos > 0 && <p className="mt-0.5 text-[12.5px] text-bad">{vencidos} documento(s) já vencido(s): as pessoas ficam bloqueadas até a empresa renovar.</p>}
          </div>
          {vencendo.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Nenhum documento vence nos próximos 30 dias.</p>
          ) : (
            <div className="lista-agrupada">
              {vencendo.slice(0, 6).map((d) => {
                const faltam = diasCorridosEntre(hoje, d.validade);
                return (
                  <Link
                    key={d.id}
                    href={d.vinculoId ? `/terceiros/pessoas/${d.vinculoId}` : `/terceiros/empresas/${d.empresaId}`}
                    className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-fill-2"
                  >
                    <span className="min-w-0">
                      <span className="block font-medium">{d.documento}</span>
                      <span className="block text-[12.5px] text-muted-foreground">{d.pessoa ? `${d.pessoa} · ${d.empresa}` : d.empresa}</span>
                    </span>
                    <span className={`selo ${faltam <= 7 ? "selo-alerta" : "selo-neutro"}`}>
                      {faltam === 0 ? "Vence hoje" : `${formatarData(d.validade).slice(0, 5)} · ${faltam} d`}
                    </span>
                  </Link>
                );
              })}
            </div>
          )}
        </div>
      </div>
    </section>
  );
}
