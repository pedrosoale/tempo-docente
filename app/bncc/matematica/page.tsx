import type { Metadata } from "next";
import { bnccSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Matemática — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Matemática do Ensino Fundamental — Anos Finais.",
  alternates: { canonical: "/bncc/matematica" },
};

export default function MathematicsPage() {
  return (
    <>
      <BnccIntro title="BNCC de Matemática" />
      <BnccExplorer
        skills={bnccSkills}
        componentLabel="Matemática"
        searchPlaceholder="Ex.: EF07MA18, equações, porcentagem…"
        searchExamples={["EF07MA18", "equações", "porcentagem", "frações"]}
      />
    </>
  );
}
