import type { Metadata } from "next";
import Link from "next/link";
import { exigirPapel } from "@/modules/acesso/sessao";
import { abrirContratacao } from "@/modules/contratacoes/acoes";
import { TIPO_CONTRATACAO } from "@/modules/contratacoes/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Nova contratação" };

export default async function PaginaNovaContratacao() {
  const usuario = await exigirPapel("coordenador_obra");
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("usuario_obras").select("obra_id, obras(nome, ativa)").eq("usuario_id", usuario.id);
  const ativas = (obras ?? []).filter((o) => o.obras?.ativa);

  return (
    <>
      <div>
        <Link href="/contratacoes" className="text-[14px] text-primary">← Contratações</Link>
        <h1 className="titulo mt-2">Nova contratação</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">A obra abre a contratação. Sem estas informações o processo não segue, como define a regra da solicitação de serviço.</p>
      </div>
      <section className="painel max-w-[680px]">
        {ativas.length === 0 ? (
          <p className="text-[14px] text-muted-foreground">Você ainda não está ligado a nenhuma obra. Peça ao administrador para ligar suas obras.</p>
        ) : (
          <Formulario acao={abrirContratacao} textoBotao="Abrir contratação">
            <label className="flex flex-col gap-1.5">
              <span className="text-[12.5px] font-medium text-muted-foreground">Obra</span>
              <select name="obra" className="campo" defaultValue={ativas.length === 1 ? ativas[0].obra_id : ""}>
                <option value="" disabled>Escolha a obra</option>
                {ativas.map((o) => <option key={o.obra_id} value={o.obra_id}>{o.obras?.nome}</option>)}
              </select>
            </label>
            <CampoTexto nome="servico" rotulo="Serviço / escopo" dica="Ex.: Alvenaria de vedação, torre B" />
            <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
              <CampoTexto nome="pacote" rotulo="Pacote do planejamento" />
              <CampoTexto nome="valor" rotulo="Valor orçado (R$)" dica="Do orçamento da obra" />
            </div>
            <fieldset className="flex flex-col gap-1.5">
              <legend className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Tipo de contrato</legend>
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
