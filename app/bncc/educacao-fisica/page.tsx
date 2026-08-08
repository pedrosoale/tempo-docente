import type { Metadata } from "next";
import { educacaoFisicaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Educação Física — Anos Finais | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Educação Física do Ensino Fundamental — Anos Finais, por unidade temática.",
  alternates: { canonical: "/bncc/educacao-fisica" },
};

export default function EducacaoFisicaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Educação Física"
        subtitle="Consulte as habilidades de brincadeiras e jogos, esportes, ginásticas, danças, lutas e práticas corporais de aventura — Ensino Fundamental, Anos Finais."
        scopeComponent="Educação Física"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${educacaoFisicaSkills.length} habilidades`}
        scopeGrades="6º-7º e 8º-9º (códigos pareados)"
      />
      <BnccExplorer
        skills={educacaoFisicaSkills}
        componentLabel="Educação Física"
        searchPlaceholder="Ex.: EF67EF01, esportes, ginástica…"
        searchExamples={["EF89EF01", "lutas", "danças urbanas"]}
      />
    </>
  );
}
