import type { Metadata } from "next";
import { bnccSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Matemática | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Matemática do Ensino Fundamental, do 1º ao 9º ano.",
  alternates: { canonical: "/bncc/matematica" },
};

export default function MathematicsPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Matemática"
        subtitle="Consulte as habilidades, unidades temáticas e objetos de conhecimento oficiais da BNCC de Matemática — Ensino Fundamental."
        scopeComponent="Matemática"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${bnccSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
      />
      <BnccExplorer
        skills={bnccSkills}
        componentLabel="Matemática"
        searchPlaceholder="Ex.: EF07MA18, equações, porcentagem…"
        searchExamples={["EF07MA18", "equações", "porcentagem", "frações"]}
      />
    </>
  );
}
