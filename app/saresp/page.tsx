import type { Metadata } from "next";
import SarespReport from "./components/SarespReport";

export const metadata: Metadata = {
  title: "Relatório SARESP | Tempo Docente",
  description: "Compare resultados de proficiência do SARESP por escola, com benchmark contra o Estado, gap e diagnóstico automático.",
  alternates: { canonical: "/saresp" },
  openGraph: {
    title: "Relatório SARESP | Tempo Docente",
    description: "Compare resultados de proficiência do SARESP por escola, com benchmark contra o Estado, gap e diagnóstico automático.",
    url: "/saresp",
  },
};

export default function SarespPage() {
  return <SarespReport />;
}
