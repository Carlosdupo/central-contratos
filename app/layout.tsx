import type { Metadata } from "next";
import "./globals.css";

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
