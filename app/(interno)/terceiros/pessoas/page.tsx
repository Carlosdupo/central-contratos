import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { formatarData } from "@/lib/datas";

export const metadata: Metadata = { title: "Consultar pessoas" };

type Situacao = "rascunho" | "em_analise" | "pendente" | "aguardando_empresa" | "integracao_agendada" | "liberado" | "bloqueado";
type Linha = { vinculoId: string; nome: string; cpf: string | null; empresa: string; tipo: string; funcao: string; obra: string | null; situacao: Situacao | null; integracao: string | null };

const FILTROS = [
  { chave: "", rotulo: "Todas" },
  { chave: "liberadas", rotulo: "Liberadas" },
  { chave: "aguardando", rotulo: "Aguardando" },
  { chave: "bloqueadas", rotulo: "Bloqueadas" },
] as const;
const grupo = (s: Situacao | null) => (s === "liberado" ? "liberadas" : s === "bloqueado" ? "bloqueadas" : "aguardando");

const Icone = ({ d }: { d: string }) => (
  <svg viewBox="0 0 24 24" width="18" height="18" fill="none" stroke="currentColor" strokeWidth="1.8" strokeLinecap="round" strokeLinejoin="round" aria-hidden="true">
    <path d={d} />
  </svg>
);
const CHECK = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm-4 9.5 3 3 5-6";
const RELOGIO = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zm0 4v5l3 2";
const BLOQUEIO = "M12 3a9 9 0 1 0 0 18 9 9 0 0 0 0-18zM6 6l12 12";

function Selo({ l }: { l: Linha }) {
  const base = "inline-flex items-center gap-2 rounded-[10px] px-3.5 py-2.5 font-heading text-[13px] leading-none font-bold tracking-[.08em] whitespace-nowrap";
  if (l.situacao === "liberado") return <span className={`${base} bg-ok text-[var(--superficie)]`}><Icone d={CHECK} />LIBERADA</span>;
  if (l.situacao === "bloqueado") return <span className={`${base} bg-bad text-[var(--superficie)]`}><Icone d={BLOQUEIO} />BLOQUEADA</span>;
  const texto =
    l.situacao === "integracao_agendada" ? `INTEGRAÇÃO ${l.integracao ? formatarData(l.integracao).slice(0, 5) : ""}`.trim()
    : l.situacao === "em_analise" ? "EM ANÁLISE DO RH"
    : l.situacao === "pendente" ? "DOCUMENTOS PENDENTES"
    : l.situacao === "aguardando_empresa" ? "AGUARDA A EMPRESA"
    : l.situacao === "rascunho" ? "EM CADASTRO"
    : l.tipo === "socio_esporadico" ? "VISITA POR PEDIDO" : "SEM OBRA";
  return <span className={`${base} bg-warn-soft text-warn`}><Icone d={RELOGIO} />{texto}</span>;
}

export default async function PaginaConsultaPessoas({ searchParams }: PageProps<"/terceiros/pessoas">) {
  await exigirInterno();
  const { q, f } = await searchParams;
  const termo = typeof q === "string" ? q.trim().slice(0, 80) : "";
  const filtro = typeof f === "string" && FILTROS.some((x) => x.chave === f) ? f : "";
  const supabase = await criarClienteServidor();

  // Com busca: a função de sempre (nome em parte ou CPF completo, CPF mascarado).
  // Sem busca: lista inicial das pessoas alocadas em obras (a RLS decide o que cada um vê; o CPF não é lido).
  let linhas: Linha[] = [];
  let erro = false;
  if (termo) {
    const { data, error } = await supabase.rpc("buscar_pessoas", { p_termo: termo });
    erro = !!error;
    linhas = (data ?? []).map((r) => ({ vinculoId: r.vinculo_id, nome: r.nome, cpf: r.cpf_mascarado, empresa: r.empresa, tipo: r.tipo, funcao: r.funcao, obra: r.obra, situacao: r.situacao as Situacao | null, integracao: r.integracao_data }));
  } else {
    const { data, error } = await supabase
      .from("alocacoes")
      .select("situacao, integracao_data, obras(nome), vinculos(id, tipo, funcao, pessoas(nome), empresas_terceiras(razao_social))")
      .order("updated_at", { ascending: false })
      .limit(60);
    erro = !!error;
    linhas = (data ?? []).flatMap((a) =>
      a.vinculos
        ? [{ vinculoId: a.vinculos.id, nome: a.vinculos.pessoas?.nome ?? "—", cpf: null, empresa: a.vinculos.empresas_terceiras?.razao_social ?? "—", tipo: a.vinculos.tipo, funcao: a.vinculos.funcao, obra: a.obras?.nome ?? null, situacao: a.situacao as Situacao, integracao: a.integracao_data }]
        : [],
    );
  }

  // Motivo de quem está bloqueado ou pendente: os documentos vencidos ou reprovados da pessoa.
  const comMotivo = linhas.filter((l) => l.situacao === "bloqueado" || l.situacao === "pendente").map((l) => l.vinculoId);
  const [{ data: docs }, { data: tipos }] = comMotivo.length
    ? await Promise.all([
        supabase.from("documentos").select("vinculo_id, tipo_documento, situacao, data_validade").in("vinculo_id", comMotivo).in("situacao", ["vencido", "reprovado"]),
        supabase.from("tipos_documento").select("codigo, nome"),
      ])
    : [{ data: [] }, { data: [] }];
  const nomeDoc = new Map((tipos ?? []).map((t) => [t.codigo, t.nome]));
  const motivo = (l: Linha): string => {
    const meus = (docs ?? []).filter((d) => d.vinculo_id === l.vinculoId);
    const vencidos = meus.filter((d) => d.situacao === "vencido");
    const reprovados = meus.filter((d) => d.situacao === "reprovado");
    if (l.situacao === "bloqueado")
      return vencidos.length
        ? `${vencidos.map((d) => `${nomeDoc.get(d.tipo_documento) ?? d.tipo_documento}${d.data_validade ? ` vencido em ${formatarData(d.data_validade).slice(0, 5)}` : " vencido"}`).join(", ")}. A empresa precisa enviar um novo e o RH aprovar.`
        : "Bloqueada. A empresa precisa regularizar os documentos e o RH aprovar.";
    if (l.situacao === "pendente")
      return reprovados.length
        ? `Devolvido pelo RH: ${reprovados.map((d) => nomeDoc.get(d.tipo_documento) ?? d.tipo_documento).join(", ")}. A empresa precisa corrigir e enviar de novo.`
        : "O RH devolveu documentos. A empresa precisa corrigir e enviar de novo.";
    if (l.situacao === "liberado") return `Liberada para entrar na obra${l.obra ? ` ${l.obra}` : ""}.`;
    if (l.situacao === "integracao_agendada") return "Documentos aprovados pelo RH. Falta a integração de segurança.";
    if (l.situacao === "em_analise") return "A empresa enviou os documentos. O RH confere em até 2 dias úteis.";
    if (l.situacao === "aguardando_empresa") return "Documentos da pessoa aprovados. Falta aprovar os documentos da empresa.";
    if (l.situacao === "rascunho") return "A empresa ainda não enviou os documentos desta pessoa.";
    return "";
  };

  const visiveis = linhas.filter((l) => !filtro || grupo(l.situacao) === filtro);
  const contar = (chave: string) => linhas.filter((l) => !chave || grupo(l.situacao) === chave).length;
  const link = (chave: string) => `/terceiros/pessoas?${new URLSearchParams({ ...(termo ? { q: termo } : {}), ...(chave ? { f: chave } : {}) })}`;
  const curto = termo && termo.replace(/\D/g, "").length < 11 && termo.length < 3;
  const anuncio = erro ? "Não foi possível buscar agora." : visiveis.length === 0 ? "Nenhuma pessoa encontrada." : visiveis.length === 1 ? "1 pessoa encontrada." : `${visiveis.length} pessoas encontradas.`;

  return (
    <>
      <div>
        <h1 className="titulo">Consultar pessoas</h1>
        <p className="mt-1 max-w-[66ch] text-muted-foreground">Busque pelo nome ou pelo CPF completo para saber se a pessoa está liberada e em qual obra.</p>
      </div>
      <form className="flex max-w-[640px] flex-wrap items-end gap-2" role="search" aria-label="Buscar pessoas">
        <label className="flex min-w-[240px] flex-1 flex-col gap-1.5">
          <span className="text-[13px] font-semibold">Nome ou CPF</span>
          <input name="q" type="search" defaultValue={termo} aria-describedby="dica-busca" className="campo" />
        </label>
        {filtro && <input type="hidden" name="f" value={filtro} />}
        <button type="submit" className="botao botao-primario">Buscar pessoa</button>
        <p id="dica-busca" className="w-full text-[13px] text-muted-foreground">Para buscar pelo CPF, digite os 11 números.</p>
      </form>

      <div className="flex flex-wrap gap-2" role="group" aria-label="Filtrar por situação">
        {FILTROS.map((x) => (
          <Link key={x.chave} href={link(x.chave)} aria-current={filtro === x.chave ? "true" : undefined} className={`inline-flex min-h-10 items-center rounded-full border px-3.5 text-[13px] font-medium ${filtro === x.chave ? "border-foreground bg-foreground text-background" : "border-sep-strong bg-card hover:bg-fill"}`}>
            {x.rotulo} <span className="ml-1 tabular-nums opacity-75">{contar(x.chave)}</span>
          </Link>
        ))}
      </div>
      <p role="status" aria-live="polite" className="sr-only">{anuncio}</p>

      <section className="painel gap-0 p-0" aria-label={termo ? `Resultado da busca por ${termo}` : "Pessoas alocadas em obras"}>
        {erro ? (
          <p className="px-[18px] py-4 text-[14px] text-bad">Não foi possível buscar agora. Tente de novo em instantes.</p>
        ) : curto ? (
          <p className="px-[18px] py-4 text-[14px] text-muted-foreground">Digite pelo menos 3 letras do nome ou o CPF completo.</p>
        ) : visiveis.length === 0 ? (
          <p className="px-[18px] py-4 text-[14px] text-muted-foreground">
            {termo ? "Nenhuma pessoa encontrada. Confira a grafia ou digite o CPF completo." : "Nenhuma pessoa nesta situação. As pessoas aparecem aqui quando a empresa as cadastra no portal."}
          </p>
        ) : (
          <ul>
            {visiveis.map((l, i) => (
              <li key={`${l.vinculoId}-${i}`} className="flex flex-wrap items-center gap-3.5 border-sep px-[18px] py-3.5 [&+&]:border-t">
                <div className="min-w-0 flex-[1_1_220px]">
                  <Link href={`/terceiros/pessoas/${l.vinculoId}`} className="font-semibold hover:text-primary">{l.nome}</Link>
                  <span className="block text-[13px] text-muted-foreground">
                    {[l.funcao, l.empresa, l.obra, TIPO_VINCULO[l.tipo], l.cpf ? `CPF ${l.cpf}` : null].filter(Boolean).join(" · ")}
                  </span>
                </div>
                <Selo l={l} />
                {motivo(l) && <p className="w-full text-[12.5px] text-muted-foreground">{motivo(l)}</p>}
              </li>
            ))}
          </ul>
        )}
      </section>
    </>
  );
}
