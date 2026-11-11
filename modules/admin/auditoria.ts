// Resume um registro de auditoria em "campo: de → para", ignorando colunas técnicas.

const IGNORAR = new Set(["created_at", "updated_at", "created_by", "updated_by"]);

export type Alteracao = { campo: string; de: unknown; para: unknown };

type Registro = Record<string, unknown> | null;

export function camposAlterados(antes: Registro, depois: Registro): Alteracao[] {
  const campos = new Set([...Object.keys(antes ?? {}), ...Object.keys(depois ?? {})]);
  const lista: Alteracao[] = [];
  for (const campo of campos) {
    if (IGNORAR.has(campo)) continue;
    const de = antes?.[campo] ?? null;
    const para = depois?.[campo] ?? null;
    if (JSON.stringify(de) !== JSON.stringify(para)) lista.push({ campo, de, para });
  }
  return lista;
}

export function formatarValor(valor: unknown): string {
  if (valor === null || valor === undefined) return "—";
  if (typeof valor === "boolean") return valor ? "sim" : "não";
  if (typeof valor === "object") return JSON.stringify(valor);
  return String(valor);
}
