import { exigirExterno } from "@/modules/acesso/sessao";
import { sair } from "@/modules/acesso/acoes";
import { criarClienteServidor } from "@/lib/supabase/server";
import { Logo } from "@/components/app/logo";

// Portal da empresa terceirizada: layout simples, sem o menu interno.
export default async function LayoutPortal({ children }: LayoutProps<"/">) {
  const { usuario, empresaId } = await exigirExterno();
  const supabase = await criarClienteServidor();
  const { data: empresa } = await supabase.from("empresas_terceiras").select("razao_social").eq("id", empresaId).maybeSingle();

  return (
    <div className="min-h-full">
      <header className="sticky top-0 z-10 border-b border-sep bg-card">
        <div className="mx-auto flex max-w-[1100px] items-center justify-between gap-4 px-6 py-3 max-sm:px-4">
          <div className="flex min-w-0 items-center gap-3">
            <Logo tamanho={32} />
            <div className="min-w-0 leading-tight">
              <div className="truncate text-[15px] font-semibold tracking-tight">{empresa?.razao_social ?? "Portal da empresa"}</div>
              <div className="truncate text-xs text-muted-foreground">Nexo · Portal da empresa · {usuario.email}</div>
            </div>
          </div>
          <form action={sair}><button type="submit" className="text-[13px] text-primary">Sair</button></form>
        </div>
      </header>
      <main className="mx-auto flex w-full max-w-[1100px] flex-col gap-6 px-6 pt-8 pb-16 max-sm:px-4">{children}</main>
    </div>
  );
}
