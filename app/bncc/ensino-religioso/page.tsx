import type { Metadata } from "next";
import { ensinoReligiosoSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Ensino Religioso | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Ensino Religioso do Ensino Fundamental, do 1º ao 9º ano, por unidade temática.",
  alternates: { canonical: "/bncc/ensino-religioso" },
};

export default function EnsinoReligiosoPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Ensino Religioso"
        subtitle="Consulte as habilidades de crenças religiosas e filosofias de vida e manifestações religiosas — Ensino Fundamental."
        scopeComponent="Ensino Religioso"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${ensinoReligiosoSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
      />
      <BnccExplorer
        skills={ensinoReligiosoSkills}
        componentLabel="Ensino Religioso"
        searchPlaceholder="Ex.: EF06ER01, crenças religiosas…"
        searchExamples={["EF07ER01", "manifestações religiosas"]}
      />
    </>
  );
}
