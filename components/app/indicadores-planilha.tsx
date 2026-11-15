import Link from "next/link";

type Linha = { obra_id: string; obra: string; previstos_obra: number; obra_no_prazo: number; obra_atrasada: number; previstos_compras: number; compras_no_prazo: number; compras_atrasada: number };

const MESES = ["janeiro", "fevereiro", "março", "abril", "maio", "junho", "julho", "agosto", "setembro", "outubro", "novembro", "dezembro"];
const pct = (parte: number, total: number) => (total === 0 ? "—" : `${Math.round((parte / total) * 100)}%`);

// Indicadores da planilha de suprimentos no mês: a obra pediu no prazo e Suprimentos fechou no prazo.
export function IndicadoresPlanilha({ linhas, ano, mes }: { linhas: Linha[]; ano: number; mes: number }) {
  return (
    <section aria-label="Indicadores da planilha de suprimentos" className="flex flex-col gap-3 rounded-[14px] border border-sep bg-card p-[18px]">
      <div>
        <h2 className="subtitulo">Indicadores da planilha em {MESES[mes - 1]} de {ano}</h2>
        <p className="mt-0.5 text-[13px] text-muted-foreground">Itens da planilha com data prevista neste mês. Atrasado conta o que passou da data sem ser feito. <Link href="/apoio/planilha/mo" className="text-primary">Abrir a planilha</Link></p>
      </div>
      {linhas.length === 0 ? (
        <p className="text-[13px] text-muted-foreground">Nenhum item da planilha tem data prevista neste mês.</p>
      ) : (
        <ul className="lista-agrupada">
          {linhas.map((l) => (
            <li key={l.obra_id} className="flex flex-col gap-1 px-3.5 py-2.5 text-[13px]">
              <span className="font-semibold">{l.obra}</span>
              <span>A obra pediu no prazo: <strong>{l.obra_no_prazo} de {l.previstos_obra}</strong> ({pct(l.obra_no_prazo, l.previstos_obra)}){l.obra_atrasada > 0 && <span className="ml-2 selo selo-erro">{l.obra_atrasada} atrasados</span>}</span>
              <span>Suprimentos fechou no prazo: <strong>{l.compras_no_prazo} de {l.previstos_compras}</strong> ({pct(l.compras_no_prazo, l.previstos_compras)}){l.compras_atrasada > 0 && <span className="ml-2 selo selo-erro">{l.compras_atrasada} atrasados</span>}</span>
            </li>
          ))}
        </ul>
      )}
    </section>
  );
}
