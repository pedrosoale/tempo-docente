import type { Metadata } from "next";
import { historiaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de História | Tempo Docente",
  description: "Consulte as habilidades da BNCC de História do Ensino Fundamental, do 1º ao 9º ano, por unidade temática.",
  alternates: { canonical: "/bncc/historia" },
};

export default function HistoriaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de História"
        subtitle="Consulte as habilidades organizadas por unidade temática, do mundo antigo à história recente — Ensino Fundamental."
        scopeComponent="História"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${historiaSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
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
