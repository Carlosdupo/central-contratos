import type { Metadata } from "next";
import Link from "next/link";
import { exigirExterno } from "@/modules/acesso/sessao";
import { cadastrarPessoa } from "@/modules/terceiros/acoes";
import { TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoTexto, Formulario } from "@/components/app/formulario";

export const metadata: Metadata = { title: "Adicionar pessoa" };

export default async function PaginaNovaPessoa() {
  const { empresaId } = await exigirExterno();
  const supabase = await criarClienteServidor();
  const { data: obras } = await supabase.from("empresa_obras").select("obra_id, obras(nome)").eq("empresa_id", empresaId).eq("ativo", true);

  return (
    <>
      <div>
        <Link href="/portal" className="text-[14px] text-primary">← Portal</Link>
        <h1 className="titulo mt-2">Adicionar pessoa</h1>
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">Só o básico agora. Depois de salvar, abre a lista de documentos de acordo com o tipo e a função.</p>
      </div>
      <section className="painel max-w-[640px]">
        <Formulario acao={cadastrarPessoa} textoBotao="Salvar e continuar">
          <fieldset className="flex flex-col gap-1.5">
            <legend className="mb-1.5 text-[12.5px] font-medium text-muted-foreground">Tipo</legend>
            <div className="lista-agrupada">
              {Object.entries(TIPO_VINCULO).map(([valor, rotulo], i) => (
                <label key={valor} className="flex cursor-pointer items-start gap-3 px-3.5 py-2.5 hover:bg-fill-2">
                  <input type="radio" name="tipo" value={valor} defaultChecked={i === 0} className="mt-1 size-4 accent-primary" />
                  <span className="text-[14px]">
                    {rotulo}
                    <span className="block text-xs text-faint">
                      {valor === "funcionario" && "Lista completa de documentos."}
                      {valor === "socio_diario" && "Sócio que vai à obra todos os dias: lista reduzida."}
                      {valor === "socio_esporadico" && "Sem documentação: pede cada visita com antecedência e envia um documento com foto."}
                    </span>
                  </span>
                </label>
              ))}
            </div>
          </fieldset>
          <CampoTexto nome="nome" rotulo="Nome completo" />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <CampoTexto nome="cpf" rotulo="CPF" />
            <CampoTexto nome="telefone" rotulo="Telefone (opcional)" />
          </div>
          <CampoTexto nome="funcao" rotulo="Função (só para funcionário)" dica="Ex.: pedreiro, servente, eletricista" />
          <label className="flex cursor-pointer items-center gap-3 rounded-xl bg-fill px-3.5 py-2.5">
            <input type="checkbox" name="eletricidade" className="size-[18px] accent-primary" />
            <span className="text-[14px]">Trabalha com eletricidade <span className="text-faint">(pede NR-10 e formação técnica)</span></span>
          </label>
          <label className="flex flex-col gap-1.5">
            <span className="text-[12.5px] font-medium text-muted-foreground">Obra</span>
            <select name="obra" className="campo" defaultValue={(obras ?? []).length === 1 ? obras![0].obra_id : ""}>
              <option value="" disabled>Escolha a obra</option>
              {(obras ?? []).map((o) => <option key={o.obra_id} value={o.obra_id}>{o.obras?.nome}</option>)}
            </select>
          </label>
        </Formulario>
      </section>
    </>
  );
}
