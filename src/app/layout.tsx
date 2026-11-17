import type { Metadata, Viewport } from "next";
import "./globals.css";
import { AvisosProvider } from "@/components/avisos";

export const metadata: Metadata = {
  title: { default: "SolicitaFlow", template: "%s · SolicitaFlow" },
  description: "Sabe sempre o que falta em cada processo, quem tem de agir e desde quando.",
  robots: { index: false, follow: false },
};

export const viewport: Viewport = {
  themeColor: "#7F1D1D",
  width: "device-width",
  initialScale: 1,
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="pt-PT">
      <body>
        <AvisosProvider>{children}</AvisosProvider>
      </body>
    </html>
  );
}
