"use client";

import { useEffect, useState } from "react";
import { useRouter } from "next/navigation";
import { criarClienteNavegador } from "@/lib/supabase/browser";

// Enquanto não houver e-mail próprio (SMTP), o Supabase usa o modelo padrão de convite.
// O link padrão volta para o site com a sessão no fragmento da URL (#access_token=...).
// Este componente lê o fragmento, cria a sessão, apaga os tokens da barra de endereço
// e manda a pessoa criar a senha.
export function ProcessarLinkAcesso() {
  const router = useRouter();
  const [mensagem, setMensagem] = useState("");

  useEffect(() => {
    if (!window.location.hash) return;
    const p = new URLSearchParams(window.location.hash.slice(1));
    const accessToken = p.get("access_token");
    const refreshToken = p.get("refresh_token");
    const falhou = !!p.get("error");
    if (!falhou && (!accessToken || !refreshToken)) return;

    // Tira os tokens da barra de endereço antes de qualquer outra coisa.
    window.history.replaceState(null, "", window.location.pathname + window.location.search);
    const expirado = "O link expirou ou já foi usado. Peça um novo.";

    (async () => {
      if (falhou || !accessToken || !refreshToken) return setMensagem(expirado);
      const { error } = await criarClienteNavegador().auth.setSession({ access_token: accessToken, refresh_token: refreshToken });
      if (error) return setMensagem(expirado);
      const tipo = p.get("type");
      router.replace(tipo === "invite" || tipo === "recovery" ? "/definir-senha" : "/");
      router.refresh();
    })();
  }, [router]);

  if (!mensagem) return null;
  return <p role="alert" className="rounded-xl bg-warn-soft px-3.5 py-2.5 text-[13px] text-warn">{mensagem}</p>;
}
