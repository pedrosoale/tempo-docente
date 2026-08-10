import type { Metadata } from "next";
import { geografiaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Geografia | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Geografia do Ensino Fundamental, do 1º ao 9º ano, por unidade temática.",
  alternates: { canonical: "/bncc/geografia" },
};

export default function GeografiaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Geografia"
        subtitle="Consulte as habilidades organizadas por unidade temática — Ensino Fundamental."
        scopeComponent="Geografia"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${geografiaSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
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
