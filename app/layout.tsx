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
  title: "Tempo Docente | Dados, planejamento e inteligência para a educação",
  description: "Plataforma para consulta da BNCC, avaliações externas, SAEB, SARESP e dados educacionais voltados ao planejamento pedagógico.",
  openGraph: {
    title: "Tempo Docente",
    description: "Dados, planejamento e inteligência para a educação.",
    url: "https://tempodocente.com.br",
    siteName: "Tempo Docente",
    locale: "pt_BR",
    type: "website",
    images: [{ url: "/og.png", width: 1200, height: 630, alt: "Tempo Docente — dados, planejamento e inteligência para a educação" }],
  },
  twitter: {
    card: "summary_large_image",
    title: "Tempo Docente",
    description: "Dados, planejamento e inteligência para a educação.",
    images: ["/og.png"],
  },
};

export default function RootLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <html lang="pt-BR">
      <body className={`${geistSans.variable} ${geistMono.variable}`}>{children}</body>
    </html>
  );
}
