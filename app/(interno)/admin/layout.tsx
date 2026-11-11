import { exigirPapel } from "@/modules/acesso/sessao";
import { AbasAdmin } from "./abas";

export default async function LayoutAdmin({ children }: LayoutProps<"/admin">) {
  await exigirPapel("admin");
  return (
    <>
      <div className="flex flex-col gap-4">
        <h1 className="titulo">Administração</h1>
        <AbasAdmin />
      </div>
      {children}
    </>
  );
}
