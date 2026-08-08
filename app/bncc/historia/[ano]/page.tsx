import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { historiaSkills } from "@/lib/bncc/data";
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
    title: `BNCC de História do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de História do ${grade}.`,
    alternates: { canonical: `/bncc/historia/${ano}` },
  };
}

export default async function HistoriaYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de História — ${grade}`}
        subtitle={`Consulte as habilidades e unidades temáticas oficiais do ${grade}.`}
        currentYear={grade}
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
        initialYear={grade}
      />
    </>
  );
}
