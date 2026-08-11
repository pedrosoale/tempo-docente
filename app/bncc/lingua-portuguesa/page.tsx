import type { Metadata } from "next";
import { linguaPortuguesaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Língua Portuguesa | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Língua Portuguesa do Ensino Fundamental, do 1º ao 9º ano, por campo de atuação e ano.",
  alternates: { canonical: "/bncc/lingua-portuguesa" },
};

export default function LinguaPortuguesaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Língua Portuguesa"
        subtitle="Consulte as habilidades, organizadas por campo de atuação, da BNCC de Língua Portuguesa — Ensino Fundamental."
        scopeComponent="Língua Portuguesa"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${linguaPortuguesaSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
      />
      <BnccExplorer
        skills={linguaPortuguesaSkills}
        componentLabel="Língua Portuguesa"
        searchPlaceholder="Ex.: EF69LP01, campo jornalístico, argumentação…"
        searchExamples={["EF67LP01", "campo artístico-literário", "hipertexto"]}
      />
    </>
  );
}
