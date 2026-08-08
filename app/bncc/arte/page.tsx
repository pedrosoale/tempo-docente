import type { Metadata } from "next";
import { arteSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Arte — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Arte do Ensino Fundamental — Anos Finais, por unidade temática.",
  alternates: { canonical: "/bncc/arte" },
};

export default function ArtePage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Arte"
        subtitle="Consulte as habilidades de Artes Visuais, Dança, Música, Teatro e Artes Integradas da BNCC — Ensino Fundamental, Anos Finais."
        scopeComponent="Arte"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${arteSkills.length} habilidades`}
        scopeGrades="6º ao 9º ano (código único)"
      />
      <BnccExplorer
        skills={arteSkills}
        componentLabel="Arte"
        searchPlaceholder="Ex.: EF69AR16, dança, artes visuais…"
        searchExamples={["EF69AR16", "dança", "teatro"]}
      />
    </>
  );
}
