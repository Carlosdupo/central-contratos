"use client";

import type { ReactNode } from "react";
import { Tabs, TabsList, TabsPanel, TabsTab } from "@ui-sdk/react/tabs";

export type Aba = { chave: string; rotulo: string; contador?: number; conteudo: ReactNode };

// Abas por área (Suprimentos, RH, Segurança) para quem tem vários perfis. Tabs do UI SDK.
export function AbasAreas({ abas }: { abas: Aba[] }) {
  if (abas.length === 0) return null;
  if (abas.length === 1) return <>{abas[0].conteudo}</>;
  return (
    <Tabs defaultValue={abas[0].chave} className="flex flex-col gap-3">
      <TabsList aria-label="Áreas">
        {abas.map((a) => (
          <TabsTab key={a.chave} value={a.chave}>
            {a.rotulo}
            {!!a.contador && (
              <span className="tabular-nums opacity-80">
                {a.contador}
                <span className="sr-only"> {a.contador === 1 ? "pendência" : "pendências"}</span>
              </span>
            )}
          </TabsTab>
        ))}
      </TabsList>
      {abas.map((a) => (
        <TabsPanel key={a.chave} value={a.chave} className="outline-offset-4">
          {a.conteudo}
        </TabsPanel>
      ))}
    </Tabs>
  );
}
