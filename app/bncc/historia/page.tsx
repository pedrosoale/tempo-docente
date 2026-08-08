import type { Metadata } from "next";
import { historiaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de História — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de História do Ensino Fundamental — Anos Finais, por unidade temática.",
  alternates: { canonical: "/bncc/historia" },
};

export default function HistoriaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de História"
        subtitle="Consulte as habilidades organizadas por unidade temática, do mundo antigo à história recente — Ensino Fundamental, Anos Finais."
        scopeComponent="História"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${historiaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={historiaSkills}
        componentLabel="História"
        searchPlaceholder="Ex.: EF06HI01, mundo clássico, república…"
        searchExamples={["EF09HI01", "totalitarismos", "independência"]}
      />
    </>
  );
}
