import type { Metadata } from "next";
import { exigirPapel } from "@/modules/acesso/sessao";
import { registrarIntegracao } from "@/modules/terceiros/acoes-sst";
import { linksDasFotos } from "@/modules/terceiros/fotos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { lerParametros } from "@/lib/configuracao";
import { agoraNoFuso, formatarData } from "@/lib/datas";
import { Avatar } from "@/components/app/avatar";
import { Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Integração de segurança" };

const DIAS = ["Domingo", "Segunda-feira", "Terça-feira", "Quarta-feira", "Quinta-feira", "Sexta-feira", "Sábado"];
const diaPorExtenso = (d: string) => `${DIAS[new Date(`${d}T12:00:00Z`).getUTCDay()]}, ${formatarData(d)}`;

export default async function PaginaIntegracao() {
  await exigirPapel("sst");
  const supabase = await criarClienteServidor();
  const selecao = "id, integracao_data, liberado_em, obras(nome), vinculos(funcao, empresas_terceiras(razao_social), pessoas(nome, foto_path))";
  const [{ data: agendadas }, { data: liberadas }, parametros] = await Promise.all([
    supabase.from("alocacoes").select(selecao).eq("situacao", "integracao_agendada").order("integracao_data"),
    supabase.from("alocacoes").select(selecao).eq("situacao", "liberado").order("liberado_em", { ascending: false }).limit(10),
    lerParametros(),
  ]);
  const todas = [...(agendadas ?? []), ...(liberadas ?? [])];
  const fotos = await linksDasFotos(todas.map((a) => a.vinculos?.pessoas?.foto_path));
  const hoje = agoraNoFuso().data;
  const dias = [...new Set((agendadas ?? []).map((a) => a.integracao_data ?? ""))];

  const Pessoa = ({ a }: { a: (typeof todas)[number] }) => (
    <span className="flex min-w-0 flex-1 items-center gap-3">
      <Avatar nome={a.vinculos?.pessoas?.nome ?? "?"} url={a.vinculos?.pessoas?.foto_path ? fotos.get(a.vinculos.pessoas.foto_path) : null} />
      <span className="min-w-0">
        <span className="block font-medium">{a.vinculos?.pessoas?.nome}</span>
        <span className="block text-[12.5px] text-muted-foreground">{a.vinculos?.funcao} · {a.vinculos?.empresas_terceiras?.razao_social} · {a.obras?.nome}</span>
      </span>
    </span>
  );

  return (
    <>
      <div>
        <h1 className="titulo">Integração de segurança</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">
          A lista se monta sozinha: quem o RH aprova até as {parametros.horarioCorte}h entra na integração do próximo dia útil. Ao marcar presença, a pessoa fica liberada para a obra e a empresa é avisada.
        </p>
      </div>

      {dias.length === 0 && <section className="painel"><p className="text-[14px] text-muted-foreground">Ninguém agendado.</p></section>}
      {dias.map((dia) => {
        const grupo = (agendadas ?? []).filter((a) => a.integracao_data === dia);
        return (
          <section key={dia} className="painel">
            <div className="flex flex-wrap items-end justify-between gap-2">
              <h2 className="subtitulo">{diaPorExtenso(dia)}{dia < hoje && <span className="ml-2 selo selo-erro align-middle">Atrasada</span>}</h2>
              <span className="text-[13px] text-muted-foreground">{grupo.length} pessoa(s)</span>
            </div>
            <div className="lista-agrupada">
              {grupo.map((a) => (
                <div key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                  <Pessoa a={a} />
                  <span className="flex flex-wrap items-center gap-2">
                    <Formulario acao={registrarIntegracao.bind(null, a.id, false)} textoBotao="Não compareceu" variante="neutro" className="flex" />
                    <Formulario acao={registrarIntegracao.bind(null, a.id, true)} textoBotao="Presente" className="flex" />
                  </span>
                </div>
              ))}
            </div>
          </section>
        );
      })}

      <section className="painel">
        <h2 className="subtitulo">Liberados recentemente</h2>
        {(liberadas ?? []).length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Ninguém liberado ainda.</p>
        ) : (
          <div className="lista-agrupada">
            {(liberadas ?? []).map((a) => (
              <div key={a.id} className="flex flex-wrap items-center gap-3 px-3.5 py-2.5">
                <Pessoa a={a} />
                <span className="selo selo-ok">Liberado {a.liberado_em ? formatarData(agoraNoFuso(new Date(a.liberado_em)).data) : ""}</span>
              </div>
            ))}
          </div>
        )}
      </section>
    </>
  );
}
