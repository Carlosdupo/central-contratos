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
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Análise do RH" };

export default async function PaginaFilaRh() {
  await exigirPapel("rh");
  const [fila, visitas, parametros] = await Promise.all([filaDeAnalise(), visitasSolicitadas(), lerParametros()]);
  const prazo = parametros.prazoAnaliseRh;

  return (
    <>
      <div>
        <h1 className="titulo">Análise do RH</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">
          Envios das empresas esperando conferência. Prazo: {prazo.dias} {prazo.uteis ? "dias úteis" : "dias"} a partir do envio. Aprovado até as {parametros.horarioCorte}h entra na integração do próximo dia útil.
        </p>
      </div>
      {!emailConfigurado() && (
        <p className="rounded-xl bg-warn-soft px-4 py-3 text-[13px] text-warn">
          O envio de e-mail ainda não está configurado. Os avisos ficam guardados e aparecem no portal da empresa; saem por e-mail quando o Resend for configurado.
        </p>
      )}

      <section className="painel">
        <h2 className="subtitulo">Documentos para conferir</h2>
        {fila.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhum envio esperando análise.</p>
        ) : (
          <div className="-mx-1.5 overflow-x-auto">
            <table className="tabela">
              <thead><tr><th>Enviado por</th><th>O que</th><th>Enviado em</th><th>Prazo</th></tr></thead>
              <tbody>
                {fila.map((e) => (
                  <tr key={e.id}>
                    <td>
                      <Link href={`/terceiros/analise/${e.id}`} className="font-medium text-primary">{e.pessoa ?? e.empresa}</Link>
                      {e.pessoa && <div className="text-[12.5px] text-muted-foreground">{e.empresa}</div>}
                    </td>
                    <td className="text-[13px]">{e.pessoa ? "Documentos da pessoa" : "Documentos da empresa"}</td>
                    <td className="text-[13px]">{formatarData(e.enviadoEm)}</td>
                    <td><SeloPrazo prazo={e.prazo} uteis={prazo.uteis} /></td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        )}
      </section>

      <section className="painel">
        <div>
          <h2 className="subtitulo">Pedidos de visita</h2>
          <p className="mt-1 text-[13px] text-muted-foreground">Sócios com acesso esporádico. Confira o documento com foto antes de aprovar.</p>
        </div>
        {visitas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Nenhum pedido de visita.</p>
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
                  <Formulario acao={decidirVisita.bind(null, v.id, true)} textoBotao="Aprovar" className="flex" />
                  <Formulario acao={decidirVisita.bind(null, v.id, false)} textoBotao="Recusar" variante="perigo" className="flex flex-wrap items-center gap-2">
                    <input name="motivo" placeholder="Motivo da recusa" aria-label="Motivo da recusa" className="campo max-w-[260px] py-1.5" />
                  </Formulario>
                </div>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
