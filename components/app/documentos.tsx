"use client";

import { useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/browser";
import { abrirArquivo, confirmarArquivo, prepararEnvioArquivo } from "@/modules/terceiros/acoes";
import type { EstadoItem, RegraValidade } from "@/modules/terceiros/dominio/documentos";

export const ROTULO_ESTADO: Record<EstadoItem, [string, string]> = {
  falta: ["selo-neutro", "Falta enviar"],
  anexado: ["selo-info", "Pronto para enviar"],
  enviado: ["selo-info", "Em análise"],
  aprovado: ["selo-ok", "Aprovado"],
  reprovado: ["selo-erro", "Reprovado"],
  vencido: ["selo-erro", "Vencido"],
};

export function SeloEstado({ estado }: { estado: EstadoItem }) {
  const [classe, texto] = ROTULO_ESTADO[estado];
  return <span className={`selo ${classe}`}>{texto}</span>;
}

/** Abre o arquivo por link temporário; a abertura fica registrada (LGPD). */
export function BotaoAbrirArquivo({ arquivoId }: { arquivoId: string }) {
  const [erro, setErro] = useState("");
  const [abrindo, setAbrindo] = useState(false);
  return (
    <span className="inline-flex items-center gap-2">
      <button
        type="button"
        className="text-[13px] text-primary disabled:opacity-50"
        disabled={abrindo}
        onClick={async () => {
          setAbrindo(true);
          const r = await abrirArquivo(arquivoId);
          setAbrindo(false);
          if (r.url) window.location.href = r.url;
          else setErro(r.erro ?? "Não foi possível abrir.");
        }}
      >
        {abrindo ? "Abrindo…" : "Abrir arquivo"}
      </button>
      {erro && <span className="text-xs text-bad">{erro}</span>}
    </span>
  );
}

const TIPOS_ACEITOS = ["application/pdf", "image/jpeg", "image/png"];

/** Envio de arquivo: o navegador manda direto ao Storage pela URL assinada; o servidor confere e registra. */
export function EnviarArquivo({ tipo, regra, competencia }: { tipo: string; regra: RegraValidade; competencia: string | null }) {
  const router = useRouter();
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);
  const pedeData = regra === "meses_apos_emissao" ? "Data de emissão" : regra === "data_informada" ? "Válido até" : null;

  async function enviar(e: FormEvent<HTMLFormElement>) {
    e.preventDefault();
    const form = e.currentTarget;
    const arquivo = (form.elements.namedItem("arquivo") as HTMLInputElement).files?.[0];
    const data = (form.elements.namedItem("data") as HTMLInputElement | null)?.value || undefined;
    if (!arquivo) return setErro("Escolha o arquivo.");
    if (!TIPOS_ACEITOS.includes(arquivo.type)) return setErro("Envie PDF, JPG ou PNG.");
    if (arquivo.size > 10 * 1024 * 1024) return setErro("O arquivo passa de 10 MB.");
    if (pedeData && !data) return setErro(`Informe: ${pedeData.toLowerCase()}.`);

    setEnviando(true);
    setErro("");
    const preparo = await prepararEnvioArquivo({ tipo, mime: arquivo.type, tamanho: arquivo.size });
    if (!preparo.caminho || !preparo.token) {
      setEnviando(false);
      return setErro(preparo.erro ?? "Não foi possível enviar.");
    }
    const { error } = await criarClienteNavegador().storage.from("documentos").uploadToSignedUrl(preparo.caminho, preparo.token, arquivo, { contentType: arquivo.type });
    if (error) {
      setEnviando(false);
      return setErro("A conexão falhou durante o envio. Tente de novo.");
    }
    const r = await confirmarArquivo({
      tipo,
      caminho: preparo.caminho,
      nome: arquivo.name,
      dataEmissao: regra === "meses_apos_emissao" ? data : undefined,
      dataValidade: regra === "data_informada" ? data : undefined,
      competencia: regra === "mensal" ? competencia ?? undefined : undefined,
    });
    setEnviando(false);
    if (r.erro) return setErro(r.erro);
    form.reset();
    router.refresh();
  }

  return (
    <form onSubmit={enviar} className="flex flex-wrap items-end gap-2" noValidate>
      <input name="arquivo" type="file" accept=".pdf,.jpg,.jpeg,.png,application/pdf,image/jpeg,image/png" aria-label="Arquivo" className="max-w-[220px] text-[13px] text-muted-foreground file:mr-2 file:rounded-full file:border-0 file:bg-fill-2 file:px-3 file:py-1.5 file:text-[13px] file:text-foreground" />
      {pedeData && (
        <label className="flex items-center gap-1.5 text-xs text-muted-foreground">
          {pedeData}
          <input name="data" type="date" className="rounded-lg border border-border bg-card px-2 py-1 text-[13px] text-foreground" />
        </label>
      )}
      <button type="submit" className="botao botao-primario botao-pequeno" disabled={enviando}>{enviando ? "Enviando…" : "Anexar"}</button>
      {erro && <span role="alert" className="basis-full text-xs text-bad">{erro}</span>}
    </form>
  );
}
