import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { filaDeAnalise, visitasSolicitadas } from "@/modules/terceiros/analise";
import { abrirDocumentoDaVisita, decidirVisita } from "@/modules/terceiros/acoes-rh";
import { emailConfigurado } from "@/modules/notificacoes/enviar";
import { lerParametros } from "@/lib/configuracao";
import { formatarData } from "@/lib/datas";
import { SeloPrazo } from "@/components/app/selo-prazo";
import { BotaoAbrir } from "@/components/app/documentos";
import {CampoEmLinha,Formulario} from "@/components/app/formulario";

export const metadata: Metadata = { title: "Análise de documentos" };

export default async function PaginaFilaRh({ searchParams }: PageProps<"/terceiros/analise">) {
  const usuario = await exigirPapel("rh", "sst");
  const ehAdmin = usuario.papeis.includes("admin");
  const ehRh = usuario.papeis.includes("rh");
  const minhas = (["rh", "sst"] as const).filter((p) => usuario.papeis.includes(p));
  const soMeus = (await searchParams).ver === "meus";
  const [todos, visitas, parametros] = await Promise.all([filaDeAnalise(), ehRh ? visitasSolicitadas() : Promise.resolve([]), lerParametros()]);
  const fila = soMeus ? todos.filter((e) => minhas.some((p) => e.faltam[p] > 0)) : todos;
  const prazo = parametros.prazoAnaliseRh;

  return (
    <>
      <div>
        <h1 className="titulo">Análise de documentos</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">
          Envios das empresas esperando conferência. Cada documento é aprovado pelo RH ou pela Segurança do Trabalho, conforme o tipo. Prazo: {prazo.dias} {prazo.uteis ? "dias úteis" : "dias"} a partir do envio. Aprovado até as {parametros.horarioCorte}h entra na integração do próximo dia útil.
        </p>
      </div>
      {!emailConfigurado() &&
        (ehAdmin ? (
          <p className="rounded-[10px] bg-warn-soft px-4 py-3 text-[13px] text-warn">
            Para administradores: o envio de e-mail ainda não está configurado. Os avisos ficam guardados e aparecem no portal da empresa; saem por e-mail quando o Resend for configurado.
          </p>
        ) : (
          <p className="text-[13px] text-muted-foreground">Os avisos para a empresa aparecem no portal dela.</p>
        ))}

      <section className="painel">
        <div className="flex flex-wrap items-center justify-between gap-3">
          <h2 className="subtitulo">Documentos para conferir</h2>
          <nav aria-label="Filtro da fila" className="flex gap-2">
            <Link href="/terceiros/analise" aria-current={soMeus ? undefined : "page"} className="filtro-pilula">Todos ({todos.length})</Link>
            <Link href="/terceiros/analise?ver=meus" aria-current={soMeus ? "page" : undefined} className="filtro-pilula">Com itens meus ({todos.filter((e) => minhas.some((p) => e.faltam[p] > 0)).length})</Link>
          </nav>
        </div>
        {fila.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">{soMeus ? "Nenhum envio com itens seus esperando decisão." : "Nenhum envio esperando análise."} Quando uma empresa enviar documentos, eles aparecem aqui com o prazo.</p>
        ) : (
          <div className="-mx-1.5 overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Enviado por</th><th>O que</th><th>Falta decidir</th><th>Enviado em</th><th>Prazo</th></tr></thead>
              <tbody>
                {fila.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/terceiros/analise/${e.id}`} className="font-medium text-primary">{e.pessoa ?? e.empresa}</Link>
                      {e.pessoa && <div className="text-[12.5px] text-muted-foreground">{e.empresa}</div>}
                    </td>
                    <td className="text-[13px]">{e.pessoa ? "Documentos da pessoa" : "Documentos da empresa"}</td>
                    <td>
                      <div className="flex flex-wrap gap-1.5">
                        {e.faltam.rh > 0 && <span className="selo selo-alerta">Falta RH ({e.faltam.rh})</span>}
                        {e.faltam.sst > 0 && <span className="selo selo-alerta">Falta Segurança ({e.faltam.sst})</span>}
                        {e.faltam.rh + e.faltam.sst === 0 && <span className="selo selo-ok">Pronto para concluir</span>}
                      </div>
                    </td>
                    <td className="text-[13px]">{formatarData(e.enviadoEm)}</td>
                    <td><SeloPrazo prazo={e.prazo} uteis={prazo.uteis} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      {ehRh && (
      <section className="painel">
        <div>
          <h2 className="subtitulo">Pedidos de visita</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Sócios com acesso esporádico. Confira o documento com foto antes de aprovar.</p>
        </div>
        {visitas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhum pedido de visita. Os sócios com acesso esporádico pedem a visita pelo portal.</p>
        ) : (
          <div className="lista-agrupada">
            {visitas.map((v) => (
              <div key={v.id} className="flex flex-col gap-2.5 px-3.5 py-3">
                <div className="flex flex-wrap items-center justify-between gap-2">
                  <div>
                    <div className="font-medium">{v.pessoa}</div>
                    <div className="text-[12.5px] text-muted-foreground">{v.empresa} · {v.obra} · {formatarData(v.data)}</div>
                  </div>
                  <BotaoAbrir acao={abrirDocumentoDaVisita.bind(null, v.id)} texto="Ver documento com foto" />
                </div>
                <div className="flex flex-wrap items-start gap-3">
                  <Formulario acao={decidirVisita.bind(null, v.id, true)} textoBotao="Aprovar visita" sensivel="Aprova a visita do sócio à obra." className="flex" />
                  <Formulario acao={decidirVisita.bind(null, v.id, false)} textoBotao="Recusar visita" variante="perigo" sensivel="Recusa a visita do sócio, com o motivo." className="flex flex-wrap items-center gap-2">
                    <CampoEmLinha nome="motivo" placeholder="Motivo da recusa" rotulo="Motivo da recusa" className="max-w-[260px]" />
                  </Formulario>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
      )}
    </>
  );
}
