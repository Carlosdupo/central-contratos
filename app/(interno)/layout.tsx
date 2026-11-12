import { exigirInterno } from "@/modules/acesso/sessao";
import { sair } from "@/modules/acesso/acoes";
import { ROTULO_PAPEL } from "@/modules/acesso/papeis";
import { contarPendencias } from "@/modules/painel/pendencias";
import { BarraLateral, type GrupoMenu } from "@/components/app/barra-lateral";
import { FocoNoTitulo } from "@/components/app/foco-no-titulo";
import { IconeAdmin, IconeAnalise, IconeBusca, IconeContratos, IconeEmpresas, IconeIntegracao, IconePainel, IconePanorama } from "@/components/app/icones";

const iniciais = (nome: string) =>
  nome
    .split(/\s+/)
    .filter(Boolean)
    .slice(0, 2)
    .map((p) => p[0]?.toUpperCase())
    .join("");

// Área interna. Itens do menu conforme os papéis do usuário (mesma regra de antes; nenhuma permissão nova).
export default async function LayoutInterno({ children }: LayoutProps<"/">) {
  const usuario = await exigirInterno();
  const pendencias = await contarPendencias(usuario.papeis).catch(() => 0);

  const terceiros: GrupoMenu["itens"] = [
    { href: "/terceiros/empresas", rotulo: "Empresas", icone: <IconeEmpresas /> },
    { href: "/terceiros/pessoas", rotulo: "Consultar pessoas", icone: <IconeBusca /> },
  ];
  if (usuario.papeis.includes("rh")) terceiros.push({ href: "/terceiros/analise", rotulo: "Análise do RH", icone: <IconeAnalise /> });
  if (usuario.papeis.includes("sst")) terceiros.push({ href: "/terceiros/integracao", rotulo: "Integração", icone: <IconeIntegracao /> });

  const grupos: GrupoMenu[] = [
    {
      titulo: "Obras",
      itens: [
        { href: "/painel", rotulo: "Painel", icone: <IconePainel />, contador: pendencias },
        { href: "/contratacoes", rotulo: "Contratações", icone: <IconeContratos /> },
        { href: "/contratacoes/panorama", rotulo: "Panorama das obras", icone: <IconePanorama /> },
      ],
    },
    { titulo: "Terceiros", itens: terceiros },
  ];
  if (usuario.papeis.includes("admin")) grupos.push({ titulo: "Sistema", itens: [{ href: "/admin", rotulo: "Administração", icone: <IconeAdmin /> }] });

  const perfis = usuario.papeis.map((p) => ROTULO_PAPEL[p]).join(", ") || "Sem perfil atribuído";
  const rodape = (
    <div className="flex flex-col gap-2 rounded-xl border border-sep p-2.5">
      <div className="flex min-w-0 items-center gap-2.5">
        <span className="grid size-8 shrink-0 place-items-center rounded-full bg-fill text-[12px] font-semibold" aria-hidden="true">{iniciais(usuario.nome)}</span>
        <span className="min-w-0 leading-tight">
          <span className="block truncate text-[13px] font-semibold">{usuario.nome}</span>
          <span className="block truncate text-xs text-muted-foreground">{perfis}</span>
        </span>
      </div>
      <form action={sair}>
        <button type="submit" className="min-h-9 text-[13px] font-medium text-primary">Sair da conta</button>
      </form>
    </div>
  );

  return (
    <>
      <a href="#conteudo" className="sr-only-foco fixed top-2 left-3 z-50 rounded-[10px] bg-primary px-4 py-2.5 font-semibold text-primary-foreground">Ir para o conteúdo</a>
      <div className="grid min-h-full grid-cols-[248px_minmax(0,1fr)] max-[859px]:grid-cols-1">
        <BarraLateral grupos={grupos} rodape={rodape} />
        <main id="conteudo" tabIndex={-1} className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 px-8 pt-7 pb-16 outline-none max-[859px]:px-4 max-[859px]:pt-5">
          <FocoNoTitulo />
          {children}
        </main>
      </div>
    </>
  );
}
