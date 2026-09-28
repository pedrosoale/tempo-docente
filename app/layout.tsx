import type { Metadata } from "next";
import { Geist, Geist_Mono } from "next/font/google";
import "./globals.css";

const geistSans = Geist({
  variable: "--font-geist-sans",
  subsets: ["latin"],
});

const geistMono = Geist_Mono({
  variable: "--font-geist-mono",
  subsets: ["latin"],
});

export const metadata: Metadata = {
  metadataBase: new URL("https://tempodocente.com.br"),
  title: "BNCC, SAEB e SARESP | Tempo Docente",
  description: "Consulte habilidades da BNCC, matrizes de referência e resultados do SAEB e do SARESP por escola, com fontes oficiais e acesso gratuito.",
  openGraph: {
    title: "BNCC, SAEB e SARESP | Tempo Docente",
    description: "Consulte habilidades da BNCC, matrizes de referência e resultados do SAEB e do SARESP por escola, com fontes oficiais e acesso gratuito.",
    url: "https://tempodocente.com.br",
    siteName: "Tempo Docente",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.jpg", width: 1200, height: 630, alt: "Tempo Docente — BNCC, SAEB e SARESP em um só lugar" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "BNCC, SAEB e SARESP | Tempo Docente",
    description: "Consulte habilidades da BNCC, matrizes de referência e resultados do SAEB e do SARESP por escola, com fontes oficiais e acesso gratuito.",
    images: ["/og.jpg"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>
        <a className="skip-link" href="#main-content">Pular para o conteúdo</a>
        {children}
      </body>
    </html>
  );
}
