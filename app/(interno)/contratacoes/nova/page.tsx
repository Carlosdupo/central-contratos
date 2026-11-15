import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { abrirContratacao } from "@/modules/contratacoes/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Formulario } from "@/components/app/formulario";
import { CamposNovaContratacao, type ObraComEap } from "@/components/app/campos-nova-contratacao";
import { agruparEap } from "@/lib/eap";
import { lerParametros } from "@/lib/configuracao";

export const metadata: Metadata = { title: "Nova contratação" };

export default async function PaginaNovaContratacao() {
  const usuario = await exigirPapel("coordenador_obra");
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("usuario_obras").select("obra_id, obras(nome, ativa, prefixo_sienge)").eq("usuario_id", usuario.id);
  const ativas = (obras ?? []).filter((o) => o.obras?.ativa);
  const [{ data: eap }, parametros] = await Promise.all([
    supabase.from("obra_eap").select("id, obra_id, referencia, descricao, nivel").in("obra_id", ativas.map((o) => o.obra_id)).order("ordem"),
    lerParametros(),
  ]);
  const obrasComEap: ObraComEap[] = ativas.map((o) => ({
    id: o.obra_id,
    nome: o.obras?.nome ?? "",
    prefixoSienge: o.obras?.prefixo_sienge ?? null,
    eap: agruparEap((eap ?? []).filter((e) => e.obra_id === o.obra_id)),
  }));

  return (
    <>
      <div>
        <Link href="/contratacoes" className="text-[14px] text-primary">← Contratações</Link>
        <h1 className="titulo mt-2">Nova contratação</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">A obra abre a contratação. O serviço vem da EAP da obra. O valor orçamento pode ficar em branco por enquanto.</p>
      </div>
      <section className="painel max-w-[680px]">
        {ativas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Você ainda não está ligado a nenhuma obra. Peça ao administrador para ligar suas obras.</p>
        ) : (
          <Formulario acao={abrirContratacao} textoBotao="Abrir contratação">
            <CamposNovaContratacao obras={obrasComEap} limite={parametros.limiteEscolhaObra} />
          </Formulario>
        )}
      </section>
    </>
  );
}
