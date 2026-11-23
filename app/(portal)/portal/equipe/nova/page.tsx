import type { Metadata } from "next";
import Link from "next/link";
import { exigirExterno } from "@/modules/acesso/sessao";
import { cadastrarPessoa } from "@/modules/terceiros/acoes";
import { TIPO_VINCULO } from "@/modules/terceiros/rotulos";
import { criarClienteServidor } from "@/lib/supabase/server";
import { CampoSelecao, CampoTexto, Formulario, GrupoOpcoes, Marcador } from "@/components/app/formulario";

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
        <p className="mt-1.5 max-w-[66ch] text-[15px] text-muted-foreground">Só o básico agora. Depois de salvar, abre a lista de documentos de acordo com o tipo e a função. Se a pessoa já é da sua empresa, use o mesmo CPF e escolha a obra nova: ela entra com os documentos que já tem.</p>
      </div>
      <section className="painel max-w-[640px]">
        <Formulario acao={cadastrarPessoa} textoBotao="Salvar e continuar">
          <GrupoOpcoes
            nome="tipo"
            rotulo="Tipo"
            padrao="funcionario"
            opcoes={Object.entries(TIPO_VINCULO).map(([value, label]) => ({
              value,
              label,
              dica:
                value === "funcionario" ? "Lista completa de documentos."
                : value === "socio_diario" ? "Sócio que vai à obra todos os dias: lista reduzida."
                : "Sem documentação: pede cada visita com antecedência e envia um documento com foto.",
            }))}
          />
          <CampoTexto nome="nome" rotulo="Nome completo" />
          <div className="grid grid-cols-2 gap-3 max-sm:grid-cols-1">
            <CampoTexto nome="cpf" rotulo="CPF" />
            <CampoTexto nome="telefone" rotulo="Telefone (opcional)" />
          </div>
          <CampoTexto nome="funcao" rotulo="Função (só para funcionário)" dica="Ex.: pedreiro, servente, eletricista" />
          <Marcador nome="eletricidade" className="flex cursor-pointer items-center gap-3 rounded-xl bg-fill px-3.5 py-2.5" rotulo={<>Trabalha com eletricidade <span className="text-faint">(pede NR-10 e formação técnica)</span></>} />
          <CampoSelecao
            nome="obra"
            rotulo="Obra"
            placeholder="Escolha a obra"
            padrao={(obras ?? []).length === 1 ? obras![0].obra_id : null}
            opcoes={(obras ?? []).map((o) => ({ value: o.obra_id, label: o.obras?.nome ?? "" }))}
          />
        </Formulario>
      </section>
    </>
  );
}
