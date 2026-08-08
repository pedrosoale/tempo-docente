import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { linguaInglesaSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Língua Inglesa do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Língua Inglesa do ${grade}, por eixo.`,
    alternates: { canonical: `/bncc/lingua-inglesa/${ano}` },
  };
}

export default async function LinguaInglesaYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Língua Inglesa — ${grade}`}
        subtitle={`Consulte as habilidades oficiais do ${grade}, organizadas pelos cinco eixos do componente.`}
        currentYear={grade}
        scopeComponent="Língua Inglesa"
        scopeSegmento="Ensino Fundamental — Anos Finais"
        scopeTotal={`${linguaInglesaSkills.length} habilidades`}
        scopeGrades="6º, 7º, 8º e 9º anos"
      />
      <BnccExplorer
        skills={linguaInglesaSkills}
        componentLabel="Língua Inglesa"
        searchPlaceholder="Ex.: EF06LI01, oralidade, leitura…"
        searchExamples={["EF06LI01", "dimensão intercultural", "escrita"]}
        initialYear={grade}
      />
    </>
  );
}
