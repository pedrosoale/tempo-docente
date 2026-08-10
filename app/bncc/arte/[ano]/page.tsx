import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { arteSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Arte do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Arte aplicáveis ao ${grade} (código único EF69AR para todo o segmento).`,
    alternates: { canonical: `/bncc/arte/${ano}` },
  };
}

export default async function ArteYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Arte — ${grade}`}
        subtitle={`As habilidades de Arte usam um código único (EF69AR) para todo o Ensino Fundamental — Anos Finais, então as mesmas ${arteSkills.length} habilidades se aplicam ao ${grade}.`}
        currentYear={grade}
        scopeComponent="Arte"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${arteSkills.length} habilidades`}
        scopeGrades="6º ao 9º ano (código único)"
      />
      <BnccExplorer
        skills={arteSkills}
        componentLabel="Arte"
        searchPlaceholder="Ex.: EF69AR16, dança, artes visuais…"
        searchExamples={["EF69AR16", "dança", "teatro"]}
        initialYear={grade}
      />
    </>
  );
}
