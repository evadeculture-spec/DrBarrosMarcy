import type { Metadata, Viewport } from "next";
import "./globals.css";
import { Providers } from "@/components/Providers";

export const metadata: Metadata = {
  title: "SolicitaFlow — Gestão de processos para solicitadoria",
  description:
    "Organize clientes, prazos, documentos e tarefas do seu escritório de solicitadoria num só lugar.",
};

export const viewport: Viewport = {
  themeColor: "#7F1D1D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <html lang="pt-PT">
      <body>
        <Providers>{children}</Providers>
      </body>
    </html>
  );
}
