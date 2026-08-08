import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { ensinoReligiosoSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Ensino Religioso do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Ensino Religioso do ${grade}.`,
    alternates: { canonical: `/bncc/ensino-religioso/${ano}` },
  };
}

export default async function EnsinoReligiosoYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Ensino Religioso — ${grade}`}
        subtitle={`Consulte as habilidades e unidades temáticas oficiais do ${grade}.`}
        currentYear={grade}
        scopeComponent="Ensino Religioso"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${ensinoReligiosoSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={ensinoReligiosoSkills}
        componentLabel="Ensino Religioso"
        searchPlaceholder="Ex.: EF06ER01, crenças religiosas…"
        searchExamples={["EF07ER01", "manifestações religiosas"]}
        initialYear={grade}
      />
    </>
  );
}
