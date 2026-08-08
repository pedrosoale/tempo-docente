import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { geografiaSkills } from "@/lib/bncc/data";
import { BnccExplorer } from "../../components/BnccExplorer";
import { BnccIntro } from "../../components/BnccIntro";

const validYears = ["6-ano", "7-ano", "8-ano", "9-ano"] as const;

type YearPageProps = { params: Promise<{ ano: string }> };

export function generateStaticParams() {
  return validYears.map((ano) => ({ ano }));
}

export async function generateMetadata({ params }: YearPageProps): Promise<Metadata> {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) return {};
  const grade = `${ano[0]}º ano`;
  return {
    title: `BNCC de Geografia do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Geografia do ${grade}.`,
    alternates: { canonical: `/bncc/geografia/${ano}` },
  };
}

export default async function GeografiaYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Geografia — ${grade}`}
        subtitle={`Consulte as habilidades e unidades temáticas oficiais do ${grade}.`}
        currentYear={grade}
        scopeComponent="Geografia"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${geografiaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={geografiaSkills}
        componentLabel="Geografia"
        searchPlaceholder="Ex.: EF06GE01, território, cartografia…"
        searchExamples={["EF08GE01", "mundo do trabalho", "conexões e escalas"]}
        initialYear={grade}
      />
    </>
  );
}
