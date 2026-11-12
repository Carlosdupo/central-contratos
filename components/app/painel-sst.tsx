import Link from "next/link";
import type { PessoaAgendada } from "@/modules/terceiros/painel-sst";
import { formatarData, type DataISO } from "@/lib/datas";

type Props = { hoje: DataISO; agendadas: PessoaAgendada[]; noRh: number; bloqueados: number; liberados: number };

function Numero({ n, rotulo, tom }: { n: number; rotulo: string; tom?: "erro" | "alerta" }) {
  const cor = n === 0 ? "font-medium! text-muted-foreground" : tom === "erro" ? "text-bad" : tom === "alerta" ? "text-hot" : "";
  return (
    <div className="flex flex-col gap-1 rounded-[14px] border border-sep px-4 py-3">
      <span className={`text-[34px] leading-none font-bold tracking-tight tabular-nums ${cor}`}>{n}</span>
      <span className="text-[12.5px] font-medium text-muted-foreground">{rotulo}</span>
    </div>
  );
}

const DIAS = ["dom", "seg", "ter", "qua", "qui", "sex", "sáb"];
const diaCurto = (d: DataISO) => `${DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${formatarData(d).slice(0, 5)}`;

// Painel da segurança do trabalho: integrações de hoje, atrasadas e próximas, em destaque no topo.
export function PainelSst({ hoje, agendadas, noRh, bloqueados, liberados }: Props) {
  const deHoje = agendadas.filter((a) => a.data === hoje);
  const atrasadas = agendadas.filter((a) => a.data < hoje);
  const proximas = agendadas.filter((a) => a.data > hoje);
  const lista = [...atrasadas, ...deHoje, ...proximas];

  return (
    <section className="flex flex-col gap-4 rounded-[14px] border border-sep bg-card p-[18px]">
      <div className="flex flex-wrap items-end justify-between gap-2">
        <div>
          <h2 className="subtitulo">Integração de segurança</h2>
          <p className="mt-0.5 text-[13px] text-muted-foreground">
            {deHoje.length > 0 ? `${deHoje.length} pessoa(s) na integração de hoje.` : "Ninguém na integração de hoje."}
          </p>
        </div>
        <Link href="/terceiros/integracao" className="botao botao-primario">Marcar presença</Link>
      </div>

      <div className="grid grid-cols-4 gap-3 max-md:grid-cols-2">
        <Numero n={deHoje.length} rotulo="Integração hoje" tom="alerta" />
        <Numero n={atrasadas.length} rotulo="Sem presença marcada" tom="erro" />
        <Numero n={proximas.length} rotulo="Próximos dias" />
        <Numero n={noRh} rotulo="Ainda no RH (vão chegar)" />
      </div>

      <div className="grid items-start gap-4 lg:grid-cols-[minmax(0,1.4fr)_minmax(0,1fr)]">
        <div className="painel gap-3">
          <h3 className="text-[15px] font-semibold">Agenda</h3>
          {lista.length === 0 ? (
            <p className="text-[13.5px] text-muted-foreground">Nenhuma integração agendada.</p>
          ) : (
            <div className="lista-agrupada">
              {lista.slice(0, 8).map((a) => (
                <Link key={a.id} href="/terceiros/integracao" className="flex flex-wrap items-center justify-between gap-2 px-3.5 py-2.5 hover:bg-fill-2">
                  <span className="min-w-0">
                    <span className="block font-medium">{a.pessoa}</span>
                    <span className="block text-[12.5px] text-muted-foreground">{[a.funcao, a.empresa, a.obra].filter(Boolean).join(" · ")}</span>
                  </span>
                  <span className={`selo ${a.data < hoje ? "selo-erro" : a.data === hoje ? "selo-alerta" : "selo-neutro"}`}>
                    {a.data < hoje ? `Atrasada · ${diaCurto(a.data)}` : a.data === hoje ? "Hoje" : diaCurto(a.data)}
                  </span>
                </Link>
              ))}
            </div>
          )}
          {lista.length > 8 && <Link href="/terceiros/integracao" className="text-[13px] text-primary">Ver os outros {lista.length - 8}</Link>}
        </div>

        <div className="painel gap-3">
          <h3 className="text-[15px] font-semibold">Situação das equipes</h3>
          <div className="lista-agrupada">
            <div className="flex items-center justify-between px-3.5 py-2.5 text-[14px]">
              <span>Liberados nos últimos 7 dias</span><span className="selo selo-ok">{liberados}</span>
            </div>
            <div className="flex items-center justify-between px-3.5 py-2.5 text-[14px]">
              <span>Bloqueados por documento vencido</span><span className={`selo ${bloqueados > 0 ? "selo-erro" : "selo-neutro"}`}>{bloqueados}</span>
            </div>
          </div>
          <p className="text-[12.5px] text-muted-foreground">Quem está bloqueado não pode entrar na obra até a empresa renovar o documento e o RH aprovar.</p>
        </div>
      </div>
    </section>
  );
}
