import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { abrirContratacao } from "@/modules/contratacoes/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Formulario } from "@/components/app/formulario";
import { CamposNovaContratacao, type ObraAbertura } from "@/components/app/campos-nova-contratacao";
import { listarMatriz } from "@/modules/matriz/consultas";
import { itensLivres, todosOsCiclos } from "@/modules/suprimentos/consultas";
import { agoraNoFuso } from "@/lib/datas";
import { lerParametros } from "@/lib/configuracao";

export const metadata: Metadata = { title: "Nova contratação" };

export default async function PaginaNovaContratacao() {
  const usuario = await exigirPapel("coordenador_obra");
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("usuario_obras").select("obra_id, obras(nome, ativa, prefixo_sienge)").eq("usuario_id", usuario.id);
  const ativas = (obras ?? []).filter((o) => o.obras?.ativa);
  const [matriz, parametros, itens, ciclos] = await Promise.all([listarMatriz(), lerParametros(), itensLivres(ativas.map((o) => o.obra_id)), todosOsCiclos()]);
  const obrasAbertura: ObraAbertura[] = ativas.map((o) => ({ id: o.obra_id, nome: o.obras?.nome ?? "", prefixoSienge: o.obras?.prefixo_sienge ?? null }));

  return (
    <>
      <div>
        <Link href="/contratacoes" className="text-[14px] text-primary">← Contratações</Link>
        <h1 className="titulo mt-2">Nova contratação</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">A obra abre a contratação. A atividade vem da matriz de contratação. O valor orçamento pode ficar em branco por enquanto.</p>
      </div>
      <section className="painel max-w-[680px]">
        {ativas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Você ainda não está ligado a nenhuma obra. Peça ao administrador para ligar suas obras.</p>
        ) : (
          <Formulario acao={abrirContratacao} textoBotao="Abrir contratação">
            <CamposNovaContratacao obras={obrasAbertura} limite={parametros.limiteEscolhaObra} matriz={matriz} itens={itens} ciclos={ciclos} hoje={agoraNoFuso().data} />
          </Formulario>
        )}
      </section>
    </>
  );
}
