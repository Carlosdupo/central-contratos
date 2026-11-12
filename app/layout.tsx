import type { Metadata } from "next";
import "./globals.css";

// Toda página é renderizada a cada requisição: a CSP usa um nonce novo por requisição (proxy.ts),
// e uma página gerada no build (estática) ficaria sem nonce e teria os scripts bloqueados.
export const dynamic = "force-dynamic";

// Fonte do sistema (San Francisco no Mac/iPhone, Segoe UI no Windows), como no protótipo.
export const metadata: Metadata = {
  title: { default: "Nexo", template: "%s · Nexo" },
  description: "Nexo: contratação e liberação de terceiros.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
