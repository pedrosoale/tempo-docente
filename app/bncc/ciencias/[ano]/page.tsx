import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { cienciasSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../../components/BnccExplorer";
import { BnccIntro } from "../../components/BnccIntro";

const validYears = ["1-ano", "2-ano", "3-ano", "4-ano", "5-ano", "6-ano", "7-ano", "8-ano", "9-ano"] as const;

type YearPageProps = { params: Promise<{ ano: string }> };

export function generateStaticParams() {
  return validYears.map((ano) => ({ ano }));
}

export async function generateMetadata({ params }: YearPageProps): Promise<Metadata> {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) return {};
  const grade = `${ano[0]}º ano`;
  return {
    title: `BNCC de Ciências do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Ciências do ${grade}.`,
    alternates: { canonical: `/bncc/ciencias/${ano}` },
  };
}

export default async function CienciasYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Ciências — ${grade}`}
        subtitle={`Consulte as habilidades, unidades temáticas oficiais do ${grade}.`}
        currentYear={grade}
        scopeComponent="Ciências"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${cienciasSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={cienciasSkills}
        componentLabel="Ciências"
        searchPlaceholder="Ex.: EF06CI01, matéria e energia…"
        searchExamples={["EF07CI01", "vida e evolução", "terra e universo"]}
        initialYear={grade}
      />
    </>
  );
}
