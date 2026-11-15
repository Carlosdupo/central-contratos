import type { Metadata } from "next";
import Link from "next/link";
import { exigirInterno } from "@/modules/acesso/sessao";
import { panoramaDasObras } from "@/modules/contratacoes/panorama";
import { Panorama } from "@/components/app/panorama";
import { agoraNoFuso, formatarData } from "@/lib/datas";

export const metadata: Metadata = { title: "Panorama das obras" };

export default async function PaginaPanorama() {
  const usuario = await exigirInterno();
  const contratacoes = await panoramaDasObras();
  return (
    <>
      <div className="flex flex-wrap items-end justify-between gap-3">
        <div>
          <h1 className="titulo">Panorama das obras</h1>
          <p className="mt-1.5 max-w-[70ch] text-[15px] text-muted-foreground">
            Onde está cada contratação, com quem e se o prazo está em dia. Toque em uma linha para ver o detalhe. Hoje é {formatarData(agoraNoFuso().data)}.
          </p>
        </div>
        {usuario.papeis.includes("coordenador_obra") && <Link href="/contratacoes/nova" className="botao botao-primario">Nova contratação</Link>}
      </div>
      <Panorama contratacoes={contratacoes} />
    </>
  );
}
