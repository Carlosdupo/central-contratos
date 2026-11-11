import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { temAlgumPapel } from "@/modules/acesso/papeis";
import { etapasEmAberto } from "@/modules/contratacoes/consultas";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";
import { SeloPrazo } from "@/components/app/selo-prazo";
import { PainelRh } from "@/components/app/painel-rh";
import { PainelSst } from "@/components/app/painel-sst";
import { PainelSuprimentos } from "@/components/app/painel-suprimentos";
import { resumoSuprimentos } from "@/modules/contratacoes/painel-suprimentos";
import { resumoSst } from "@/modules/terceiros/painel-sst";
import { filaDeAnalise, vencimentosProximos, visitasSolicitadas } from "@/modules/terceiros/analise";
import { lerParametros } from "@/lib/configuracao";

export const metadata: Metadata = { title: "Painel" };

function Kpi({ n, rotulo, alerta }: { n: number; rotulo: string; alerta?: boolean }) {
  return (
    <div className="painel gap-1.5">
      <span className={`text-[40px] leading-none font-bold tracking-tight tabular-nums ${alerta && n > 0 ? "text-bad" : ""}`}>{n}</span>
      <span className="text-[13px] font-medium text-muted-foreground">{rotulo}</span>
    </div>
  );
}

export default async function PaginaPainel() {
  const usuario = await exigirInterno();
  const supabase = await criarClienteServidor();
  const ehRh = usuario.papeis.includes("rh");
  const ehSst = usuario.papeis.includes("sst");
  const ehSuprimentos = temAlgumPapel(usuario.papeis, ["suprimentos", "gerente_suprimentos"]);
  // Quem só é do RH e/ou da segurança do trabalho vê o painel focado no que é dele.
  const focoTerceiros = (ehRh || ehSst) && !temAlgumPapel(usuario.papeis, ["admin", "coordenador_obra", "suprimentos", "gerente_suprimentos", "contratos", "direcao"]);
  const [abertas, { data: contratacoes }, rh, sst, supr] = await Promise.all([
    etapasEmAberto(),
    supabase.from("contratacoes").select("id, situacao"),
    ehRh
      ? Promise.all([filaDeAnalise(), visitasSolicitadas(), vencimentosProximos(30), lerParametros()]).catch(() => null)
      : Promise.resolve(null),
    ehSst ? resumoSst().catch(() => null) : Promise.resolve(null),
    ehSuprimentos ? resumoSuprimentos().catch(() => null) : Promise.resolve(null),
  ]);
  const emAndamento = (contratacoes ?? []).filter((c) => c.situacao === "em_andamento").length;
  const liberadas = (contratacoes ?? []).filter((c) => c.situacao === "liberada").length;
  const comAtraso = new Set(abertas.filter((a) => a.prazo.tipo === "atrasada").map((a) => a.contratacaoId)).size;
  const assinatura = abertas.filter((a) => a.etapa.etapa === 9).length;
  // Minhas pendências: etapas do meu papel (a RLS já limitou o coordenador às obras dele).
  const minhas = abertas.filter((a) =>
    a.etapa.etapa === 9 ? false : a.etapa.papel === "suprimentos" ? temAlgumPapel(usuario.papeis, ["suprimentos", "gerente_suprimentos"]) : !!a.etapa.papel && usuario.papeis.includes(a.etapa.papel),
  );
  const primeiroNome = usuario.nome.split(" ")[0];

  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Olá, {primeiroNome}</h1>
          <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">
            {focoTerceiros ? (ehRh && ehSst ? "Documentos para conferir, integrações e vencimentos." : ehRh ? "Documentos de terceiros esperando você e o que vence nos próximos dias." : "Integrações de segurança agendadas e a situação das equipes.") : "Onde cada contratação está parada, com quem e há quanto tempo."}
          </p>
        </div>
        {usuario.papeis.includes("coordenador_obra") && <Link href="/contratacoes/nova" className="botao botao-primario">+ Nova contratação</Link>}
      </div>

      {usuario.papeis.length === 0 && (
        <section className="painel">
          <h2 className="subtitulo">Seu usuário ainda não tem perfil</h2>
          <p className="text-[14px] text-muted-foreground">Peça ao administrador para atribuir seus perfis de acesso.</p>
        </section>
      )}

      {supr && <PainelSuprimentos {...supr} ehGerente={usuario.papeis.includes("gerente_suprimentos")} />}
      {rh && <PainelRh fila={rh[0]} visitas={rh[1].length} vencendo={rh[2].vencendo} vencidos={rh[2].vencidos} prazoUteis={rh[3].prazoAnaliseRh.uteis} />}
      {sst && <PainelSst {...sst} />}

      {!focoTerceiros && <div className="grid grid-cols-4 gap-4 max-lg:grid-cols-2">
        <Kpi n={emAndamento} rotulo="Em andamento" />
        <Kpi n={comAtraso} rotulo="Com etapa atrasada" alerta />
        <Kpi n={assinatura} rotulo="Aguardando assinatura" />
        <Kpi n={liberadas} rotulo="Liberadas para a obra" />
      </div>}

      <div className={focoTerceiros ? "flex flex-col gap-5" : "grid items-start gap-5 lg:grid-cols-[minmax(0,1.7fr)_minmax(0,1fr)]"}>
        {!focoTerceiros && <section className="painel">
          <div className="flex items-end justify-between"><h2 className="subtitulo">Etapas em aberto</h2><span className="text-[13px] text-muted-foreground">{abertas.length} etapas</span></div>
          {abertas.length === 0 ? (
            <p className="text-[14px] text-muted-foreground">Nenhuma etapa em aberto.</p>
          ) : (
            <div className="-mx-1.5 overflow-x-auto">
              <table className="tabela">
                <thead><tr><th>Contratação</th><th>Etapa e responsável</th><th>Desde</th><th>Prazo</th></tr></thead>
                <tbody>
                  {abertas.map((a) => (
                    <tr key={`${a.contratacaoId}-${a.etapa.etapa}`}>
                      <td>
                        <Link href={`/contratacoes/${a.contratacaoId}?etapa=${a.etapa.etapa}`} className="font-medium text-primary">{a.servico}</Link>
                        <div className="text-[12.5px] text-muted-foreground">{a.obra} · <span className="font-mono">{a.codigo}</span></div>
                      </td>
                      <td><div className="font-medium">{a.etapa.nome}</div><div className="text-[12.5px] text-muted-foreground">{a.etapa.responsavel}</div></td>
                      <td className="text-[13px] text-muted-foreground">{formatarData(a.desde).slice(0, 5)}</td>
                      <td><SeloPrazo prazo={a.prazo} uteis={a.uteis} /></td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          )}
        </section>}

        <div className="flex flex-col gap-5">
          <section className="painel">
            <h2 className="subtitulo">{focoTerceiros ? "Contratações com etapa sua" : "Minhas pendências"}</h2>
            {minhas.length === 0 ? (
              <p className="text-[14px] text-muted-foreground">Nada pendente para você nas contratações.</p>
            ) : (
              <div className="lista-agrupada">
                {minhas.map((a) => (
                  <Link key={`${a.contratacaoId}-${a.etapa.etapa}`} href={`/contratacoes/${a.contratacaoId}?etapa=${a.etapa.etapa}`} className="flex flex-col gap-1 px-3.5 py-2.5 hover:bg-fill-2">
                    <span className="font-medium">{a.etapa.nome}</span>
                    <span className="flex flex-wrap items-center gap-2 text-[12.5px] text-muted-foreground">{a.servico}<SeloPrazo prazo={a.prazo} uteis={a.uteis} /></span>
                  </Link>
                ))}
              </div>
            )}
          </section>
        </div>
      </div>
    </>
  );
}
