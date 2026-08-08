import type { Metadata } from "next";
import { linguaPortuguesaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Língua Portuguesa — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Língua Portuguesa do Ensino Fundamental — Anos Finais, por campo de atuação e ano.",
  alternates: { canonical: "/bncc/lingua-portuguesa" },
};

export default function LinguaPortuguesaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Língua Portuguesa"
        subtitle="Consulte as habilidades, organizadas por campo de atuação, da BNCC de Língua Portuguesa — Ensino Fundamental, Anos Finais."
        scopeComponent="Língua Portuguesa"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${linguaPortuguesaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
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
