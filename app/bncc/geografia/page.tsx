import type { Metadata } from "next";
import { geografiaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Geografia — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Geografia do Ensino Fundamental — Anos Finais, por unidade temática.",
  alternates: { canonical: "/bncc/geografia" },
};

export default function GeografiaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Geografia"
        subtitle="Consulte as habilidades organizadas por unidade temática — Ensino Fundamental, Anos Finais."
        scopeComponent="Geografia"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${geografiaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={geografiaSkills}
        componentLabel="Geografia"
        searchPlaceholder="Ex.: EF06GE01, território, cartografia…"
        searchExamples={["EF08GE01", "mundo do trabalho", "conexões e escalas"]}
      />
    </>
  );
}
