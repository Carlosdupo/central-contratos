// Selo "Urgente": marca para todos verem. Não muda o prazo do Suprimentos.
export function SeloUrgente({ data }: { data?: string | null }) {
  return (
    <span className="selo selo-erro" title={data ? `Necessária até ${data.slice(8, 10)}/${data.slice(5, 7)}/${data.slice(0, 4)}` : undefined}>
      Urgente
    </span>
  );
}
