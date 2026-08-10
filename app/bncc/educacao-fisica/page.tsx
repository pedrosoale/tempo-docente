import type { Metadata } from "next";
import { educacaoFisicaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../components/BnccExplorer";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Educação Física | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Educação Física do Ensino Fundamental, do 1º ao 9º ano, por unidade temática.",
  alternates: { canonical: "/bncc/educacao-fisica" },
};

export default function EducacaoFisicaPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Educação Física"
        subtitle="Consulte as habilidades de brincadeiras e jogos, esportes, ginásticas, danças, lutas e práticas corporais de aventura — Ensino Fundamental."
        scopeComponent="Educação Física"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${educacaoFisicaSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano (códigos pareados)"
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
