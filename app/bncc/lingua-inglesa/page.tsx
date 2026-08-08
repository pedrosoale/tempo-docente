import type { Metadata } from "next";
import { linguaInglesaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Língua Inglesa — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Língua Inglesa do Ensino Fundamental — Anos Finais, por eixo.",
  alternates: { canonical: "/bncc/lingua-inglesa" },
};

export default function LinguaInglesaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Língua Inglesa"
        subtitle="Consulte as habilidades organizadas pelos eixos Oralidade, Leitura, Escrita, Conhecimentos Linguísticos e Dimensão Intercultural — Ensino Fundamental, Anos Finais."
        scopeComponent="Língua Inglesa"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${linguaInglesaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={linguaInglesaSkills}
        componentLabel="Língua Inglesa"
        searchPlaceholder="Ex.: EF06LI01, oralidade, leitura…"
        searchExamples={["EF06LI01", "dimensão intercultural", "escrita"]}
      />
    </>
  );
}
