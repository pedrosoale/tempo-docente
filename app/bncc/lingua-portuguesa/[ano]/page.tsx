import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { linguaPortuguesaSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Língua Portuguesa do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Língua Portuguesa do ${grade}, incluindo habilidades compartilhadas com anos vizinhos.`,
    alternates: { canonical: `/bncc/lingua-portuguesa/${ano}` },
  };
}

export default async function LinguaPortuguesaYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Língua Portuguesa — ${grade}`}
        subtitle={`Consulte as habilidades oficiais do ${grade}, incluindo habilidades compartilhadas com anos vizinhos (ex.: códigos de par de anos).`}
        currentYear={grade}
        scopeComponent="Língua Portuguesa"
        scopeSegmento="Ensino Fundamental — Anos Iniciais e Anos Finais"
        scopeTotal={`${linguaPortuguesaSkills.length} habilidades`}
        scopeGrades="1º ao 9º ano"
      />
      <BnccExplorer
        skills={linguaPortuguesaSkills}
        componentLabel="Língua Portuguesa"
        searchPlaceholder="Ex.: EF69LP01, campo jornalístico, argumentação…"
        searchExamples={["EF67LP01", "campo artístico-literário", "hipertexto"]}
        initialYear={grade}
      />
    </>
  );
}
