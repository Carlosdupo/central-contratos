import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { agoraNoFuso } from "@/lib/datas";
import { calendarioDoAno } from "@/modules/suprimentos/consultas";
import { salvarCalendario } from "@/modules/suprimentos/acoes";
import { FormularioCalendario } from "@/components/app/formulario-calendario";

export const metadata: Metadata = { title: "Calendário de suprimentos" };

export default async function PaginaCalendario({ searchParams }: PageProps<"/apoio/calendario">) {
  const usuario = await exigirInterno();
  const { ano: anoParam } = await searchParams;
  const hoje = Number(agoraNoFuso().data.slice(0, 4));
  const ano = Number(anoParam) >= 2020 && Number(anoParam) <= 2100 ? Number(anoParam) : hoje;
  const salvos = await calendarioDoAno(ano);
  const ehGerente = usuario.papeis.includes("gerente_suprimentos");
  return (
    <>
      <div>
        <h1 className="titulo">Calendário de suprimentos</h1>
        <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
          Um calendário só, igual para todas as obras, com dois ciclos por mês. A obra solicita até o limite do ciclo e Suprimentos começa a negociar no dia seguinte (15 dias).
          Vale só para o que não está na planilha de suprimentos; os itens da planilha seguem as datas dela.
          {ehGerente ? " O gerente de suprimentos define o ano inteiro." : " Só o gerente de suprimentos altera."}
        </p>
        <nav aria-label="Ano do calendário" className="mt-3 flex gap-2">
          {[ano - 1, ano, ano + 1].map((a) => (
            <Link key={a} href={`/apoio/calendario?ano=${a}`} aria-current={a === ano ? "page" : undefined} className={`botao ${a === ano ? "botao-primario" : ""}`}>{a}</Link>
          ))}
        </nav>
      </div>
      <FormularioCalendario key={ano} ano={ano} salvos={salvos} acao={salvarCalendario.bind(null, ano)} podeEditar={ehGerente} />
    </>
  );
}
