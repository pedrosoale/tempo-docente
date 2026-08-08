import type { Metadata } from "next";
import { cienciasSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Ciências — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Ciências do Ensino Fundamental — Anos Finais, por unidade temática.",
  alternates: { canonical: "/bncc/ciencias" },
};

export default function CienciasPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Ciências"
        subtitle="Consulte as habilidades de Matéria e Energia, Vida e Evolução e Terra e Universo — Ensino Fundamental, Anos Finais."
        scopeComponent="Ciências"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${cienciasSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={cienciasSkills}
        componentLabel="Ciências"
        searchPlaceholder="Ex.: EF06CI01, matéria e energia…"
        searchExamples={["EF07CI01", "vida e evolução", "terra e universo"]}
      />
    </>
  );
}
