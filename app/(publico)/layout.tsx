import { IconeApp } from "@/components/app/icones";
import { ProcessarLinkAcesso } from "@/components/app/processar-link-acesso";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="flex items-center gap-3 px-1">
          <IconeApp />
          <div className="leading-tight">
            <div className="text-[15px] font-semibold tracking-tight">Central de Contratos</div>
            <div className="text-xs text-muted-foreground">Contratação de empreiteiros e terceiros</div>
          </div>
        </div>
        <section className="painel">
          <ProcessarLinkAcesso />
          {children}
        </section>
      </div>
    </main>
  );
}
