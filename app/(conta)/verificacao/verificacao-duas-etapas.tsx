"use client";

import { useEffect, useRef, useState, type FormEvent } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/browser";

type Estado =
  | { etapa: "carregando" }
  | { etapa: "cadastrar"; fatorId: string; qrCode: string; segredo: string }
  | { etapa: "confirmar"; fatorId: string }
  | { etapa: "falha"; mensagem: string };

export function VerificacaoDuasEtapas() {
  const router = useRouter();
  const [estado, setEstado] = useState<Estado>({ etapa: "carregando" });
  const [codigo, setCodigo] = useState("");
  const [erro, setErro] = useState("");
  const [enviando, setEnviando] = useState(false);

  // Em desenvolvimento o React roda o efeito duas vezes; sem esta trava, dois QR codes
  // seriam pedidos ao mesmo tempo e o segundo falharia por nome repetido.
  const iniciou = useRef(false);

  useEffect(() => {
    if (iniciou.current) return;
    iniciou.current = true;
    const supabase = criarClienteNavegador();
    (async () => {
      const { data, error } = await supabase.auth.mfa.listFactors();
      if (error) return setEstado({ etapa: "falha", mensagem: "Não foi possível carregar a verificação. Recarregue a página." });

      const confirmado = data.totp.find((f) => f.status === "verified");
      if (confirmado) return setEstado({ etapa: "confirmar", fatorId: confirmado.id });

      // Remove cadastros que ficaram pela metade antes de gerar um novo QR code.
      for (const f of data.all.filter((f) => f.factor_type === "totp" && f.status !== "verified")) {
        const { error: erroRemover } = await supabase.auth.mfa.unenroll({ factorId: f.id });
        if (erroRemover) console.error("Falha ao remover cadastro incompleto de verificação", erroRemover.message);
      }
      const novo = await supabase.auth.mfa.enroll({ factorType: "totp", friendlyName: "Central de Contratos" });
      if (novo.error) {
        console.error("Falha ao gerar QR code", novo.error.message);
        return setEstado({ etapa: "falha", mensagem: "Não foi possível gerar o QR code. Recarregue a página." });
      }
      setEstado({ etapa: "cadastrar", fatorId: novo.data.id, qrCode: novo.data.totp.qr_code, segredo: novo.data.totp.secret });
    })();
  }, []);

  async function confirmar(evento: FormEvent) {
    evento.preventDefault();
    if (estado.etapa !== "cadastrar" && estado.etapa !== "confirmar") return;
    if (!/^\d{6}$/.test(codigo)) return setErro("Digite os 6 números do aplicativo.");
    setEnviando(true);
    setErro("");
    const supabase = criarClienteNavegador();
    const { error } = await supabase.auth.mfa.challengeAndVerify({ factorId: estado.fatorId, code: codigo });
    setEnviando(false);
    if (error) return setErro("Código incorreto ou expirado. Confira o horário do celular e tente de novo.");
    router.replace("/");
    router.refresh();
  }

  if (estado.etapa === "carregando") return <p className="text-[13.5px] text-muted-foreground">Preparando…</p>;
  if (estado.etapa === "falha") return <p className="text-[13px] text-bad">{estado.mensagem}</p>;

  return (
    <form onSubmit={confirmar} className="flex flex-col gap-4" noValidate>
      {estado.etapa === "cadastrar" && (
        <div className="flex flex-col items-center gap-3 rounded-xl bg-fill p-4">
          {/* QR code em SVG gerado pelo Supabase Auth */}
          {/* eslint-disable-next-line @next/next/no-img-element */}
          <img src={estado.qrCode} alt="QR code para o aplicativo autenticador" width={180} height={180} className="rounded-lg bg-white p-2" />
          <p className="text-center text-xs text-muted-foreground">
            Escaneie com o aplicativo. Sem câmera? Digite a chave:
            <span className="mt-1 block break-all font-mono text-foreground">{estado.segredo}</span>
          </p>
        </div>
      )}
      <label htmlFor="codigo" className="flex flex-col gap-1.5">
        <span className="text-[12.5px] font-medium text-muted-foreground">Código de 6 dígitos</span>
        <input
          id="codigo"
          inputMode="numeric"
          autoComplete="one-time-code"
          maxLength={6}
          value={codigo}
          onChange={(e) => setCodigo(e.target.value.replace(/\D/g, ""))}
          className="campo text-center font-mono text-lg tracking-[.4em]"
        />
      </label>
      {erro && <p role="alert" className="text-[13px] text-bad">{erro}</p>}
      <button type="submit" className="botao botao-primario" disabled={enviando}>
        {enviando ? "Verificando…" : "Confirmar"}
      </button>
    </form>
  );
}
