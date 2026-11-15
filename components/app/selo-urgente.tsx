// Selo "Urgente": marca para todos verem. Não muda o prazo do Suprimentos.
export function SeloUrgente({ data, comData = false }: { data?: string | null; comData?: boolean }) {
  const br = data ? `${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : null;
  return (
    <span className="selo selo-erro" title={br ? `Necessária até ${br}` : undefined}>
      {comData && br ? `Urgente · precisa em ${br.slice(0, 5)}` : "Urgente"}
    </span>
  );
}
