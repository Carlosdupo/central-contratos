import { Marca } from "@/components/app/logo";
import { ProcessarLinkAcesso } from "@/components/app/processar-link-acesso";

export default function LayoutPublico({ children }: LayoutProps<"/">) {
  return (
    <main className="flex min-h-full items-center justify-center px-4 py-12">
      <div className="flex w-full max-w-[400px] flex-col gap-6">
        <div className="px-1"><Marca /></div>
        <section className="painel">
          <ProcessarLinkAcesso />
          {children}
        </section>
      </div>
    </main>
  );
}
