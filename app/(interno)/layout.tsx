import { exigirInterno } from "@/modules/acesso/sessao";
import { sair } from "@/modules/acesso/acoes";
import { ROTULO_PAPEL } from "@/modules/acesso/papeis";
import { BarraLateral, type GrupoMenu } from "@/components/app/barra-lateral";
import { IconeAdmin, IconeAnalise, IconeBusca, IconeEmpresas, IconeIntegracao, IconePainel } from "@/components/app/icones";

// Área interna. Os módulos entram no menu conforme cada fase fica pronta (F1 em diante).
export default async function LayoutInterno({ children }: LayoutProps<"/">) {
  const usuario = await exigirInterno();

  const grupos: GrupoMenu[] = [
    { itens: [{ href: "/painel", rotulo: "Painel", icone: <IconePainel /> }] },
    {
      titulo: "Terceiros",
      itens: [
        { href: "/terceiros/empresas", rotulo: "Empresas", icone: <IconeEmpresas /> },
        { href: "/terceiros/pessoas", rotulo: "Consultar pessoas", icone: <IconeBusca /> },
      ],
    },
  ];
  if (usuario.papeis.includes("rh")) grupos[1].itens.push({ href: "/terceiros/analise", rotulo: "Análise do RH", icone: <IconeAnalise /> });
  if (usuario.papeis.includes("sst")) grupos[1].itens.push({ href: "/terceiros/integracao", rotulo: "Integração", icone: <IconeIntegracao /> });
  if (usuario.papeis.includes("admin")) {
    grupos.push({ titulo: "Sistema", itens: [{ href: "/admin", rotulo: "Administração", icone: <IconeAdmin /> }] });
  }

  const rodape = (
    <div className="flex flex-col gap-2 border-t-[.5px] border-sep px-1.5 pt-4">
      <div className="min-w-0 leading-tight">
        <div className="truncate text-[13px] font-medium">{usuario.nome}</div>
        <div className="truncate text-xs text-muted-foreground">{usuario.papeis.map((p) => ROTULO_PAPEL[p]).join(", ") || "Sem perfil atribuído"}</div>
      </div>
      <form action={sair}>
        <button type="submit" className="text-[13px] text-primary">Sair</button>
      </form>
    </div>
  );

  return (
    <div className="grid min-h-full grid-cols-[248px_minmax(0,1fr)] max-md:grid-cols-1">
      <BarraLateral grupos={grupos} rodape={rodape} />
      <main className="mx-auto flex w-full max-w-[1280px] min-w-0 flex-col gap-6 px-9 pt-9 pb-16 max-md:px-4 max-md:pt-6">{children}</main>
    </div>
  );
}
