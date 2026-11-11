/* eslint-disable @next/next/no-img-element -- foto vem de link temporário do Storage */
export function Avatar({ nome, url, grande }: { nome: string; url?: string | null; grande?: boolean }) {
  const iniciais = nome.split(" ").filter(Boolean).slice(0, 2).map((p) => p[0]).join("").toUpperCase();
  const tamanho = grande ? "size-16 text-xl" : "size-9 text-[13px]";
  return url ? (
    <img src={url} alt="" className={`${tamanho} shrink-0 rounded-full object-cover`} />
  ) : (
    <span aria-hidden className={`${tamanho} grid shrink-0 place-items-center rounded-full bg-fill-2 font-semibold text-muted-foreground`}>{iniciais}</span>
  );
}
