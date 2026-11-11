import type { Metadata } from "next";
import "./globals.css";

// Fonte do sistema (San Francisco no Mac/iPhone, Segoe UI no Windows), como no protótipo.
export const metadata: Metadata = {
  title: { default: "Central de Contratos", template: "%s · Central de Contratos" },
  description: "Contratação de empreiteiros e gestão de terceiros.",
  robots: { index: false, follow: false },
};

export default function RootLayout({ children }: LayoutProps<"/">) {
  return (
    <html lang="pt-BR">
      <body className="min-h-full">{children}</body>
    </html>
  );
}
