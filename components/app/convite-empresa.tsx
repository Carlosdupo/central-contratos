"use client";

import Link from "next/link";
import type { EmpresaExistente } from "@/modules/terceiros/dominio/documentos";
import { SITUACAO_EMPRESA } from "@/modules/terceiros/rotulos";
import { formatarData } from "@/lib/datas";
import { CampoSelecao, CampoTexto, Formulario, type Opcao } from "@/components/app/formulario";
import { CampoCnpj, CampoTelefone } from "@/components/app/campos-mascara";

type EstadoConvite = { erro?: string; ok?: string; empresaExistente?: EmpresaExistente };

export function ConviteEmpresa({ obras, convidar }: { obras: Opcao[]; convidar: (estado: EstadoConvite, dados: FormData) => Promise<EstadoConvite> }) {
  return (
    <Formulario
      acao={convidar}
      textoBotao="Enviar convite à empresa"
      resultado={(e) => (e.empresaExistente ? <EmpresaJaCadastrada empresa={e.empresaExistente} /> : null)}
    >
      <CampoCnpj />
      <CampoTexto nome="razao" rotulo="Razão social" />
      <CampoTexto nome="email" rotulo="E-mail do responsável" tipo="email" />
      <CampoTelefone />
      <CampoSelecao nome="obra" rotulo="Obra" placeholder="Escolha a obra" opcoes={obras} />
    </Formulario>
  );
}

function EmpresaJaCadastrada({ empresa }: { empresa: EmpresaExistente }) {
  const [classe, rotulo] = SITUACAO_EMPRESA[empresa.situacao] ?? ["selo-neutro", empresa.situacao];
  return (
    <section aria-label="Empresa já cadastrada" className="flex flex-col gap-3 rounded-xl bg-fill px-3.5 py-3 text-[14px]">
      <div className="flex flex-wrap items-center justify-between gap-2">
        <strong>{empresa.razao}</strong>
        <span className={`selo ${classe}`}>{rotulo}</span>
      </div>
      <p className="text-muted-foreground">Obras: {empresa.obras.join(", ") || "nenhuma"}</p>
      <div>
        <h3 className="font-medium">Documentos aprovados ({empresa.aprovados.length})</h3>
        {empresa.aprovados.length === 0 ? (
          <p className="text-muted-foreground">Nenhum ainda.</p>
        ) : (
          <ul className="mt-1 flex flex-col gap-0.5">
            {empresa.aprovados.map((d) => (
              <li key={d.codigo}>
                {d.nome}
                {d.validade && <span className="text-muted-foreground"> · vale até {formatarData(d.validade)}</span>}
              </li>
            ))}
          </ul>
        )}
      </div>
      {empresa.pendentes.length > 0 && (
        <div>
          <h3 className="font-medium">Ainda faltam ({empresa.pendentes.length})</h3>
          <ul className="mt-1 flex flex-col gap-0.5 text-muted-foreground">
            {empresa.pendentes.map((d) => <li key={d.codigo}>{d.nome}</li>)}
          </ul>
        </div>
      )}
      <Link href={`/terceiros/empresas/${empresa.id}`} className="font-medium text-primary">
        Abrir a empresa para liberar outra obra →
      </Link>
    </section>
  );
}
