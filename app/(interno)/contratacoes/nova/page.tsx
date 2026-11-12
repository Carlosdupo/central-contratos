import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { abrirContratacao } from "@/modules/contratacoes/acoes";
import { TIPO_CONTRATACAO } from "@/modules/contratacoes/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Formulario } from "@/components/app/formulario";
import { CamposNovaContratacao, type ObraComEap } from "@/components/app/campos-nova-contratacao";
import { agruparEap } from "@/lib/eap";
import { lerParametros } from "@/lib/configuracao";

export const metadata: Metadata = { title: "Nova contratação" };

export default async function PaginaNovaContratacao() {
  const usuario = await exigirPapel("coordenador_obra");
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("usuario_obras").select("obra_id, obras(nome, ativa)").eq("usuario_id", usuario.id);
  const ativas = (obras ?? []).filter((o) => o.obras?.ativa);
  const [{ data: eap }, parametros] = await Promise.all([
    supabase.from("obra_eap").select("id, obra_id, referencia, descricao, nivel").in("obra_id", ativas.map((o) => o.obra_id)).order("ordem"),
    lerParametros(),
  ]);
  const obrasComEap: ObraComEap[] = ativas.map((o) => ({
    id: o.obra_id,
    nome: o.obras?.nome ?? "",
    eap: agruparEap((eap ?? []).filter((e) => e.obra_id === o.obra_id)),
  }));

  return (
    <>
      <div>
        <Link href="/contratacoes" className="text-[14px] text-primary">← Contratações</Link>
        <h1 className="titulo mt-2">Nova contratação</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">A obra abre a contratação. O serviço vem da EAP da obra. O valor orçado pode ficar em branco por enquanto.</p>
      </div>
      <section className="painel max-w-[680px]">
        {ativas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Você ainda não está ligado a nenhuma obra. Peça ao administrador para ligar suas obras.</p>
        ) : (
          <Formulario acao={abrirContratacao} textoBotao="Abrir contratação">
            <CamposNovaContratacao obras={obrasComEap} limite={parametros.limiteEscolhaObra} />
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[13px] font-semibold">Tipo de contrato</legend>
              <div className="lista-agrupada">
                {Object.entries(TIPO_CONTRATACAO).map(([valor, rotulo], i) => (
                  <label key={valor} className="flex cursor-pointer items-center gap-3 px-3.5 py-2.5 hover:bg-fill-2">
                    <input type="radio" name="tipo" value={valor} className="size-4 accent-primary" />
                    <span className="text-[14px]">{i + 1}. {rotulo}</span>
                  </label>
                ))}
              </div>
            </fieldset>
          </Formulario>
        )}
      </section>
    </>
  );
}
