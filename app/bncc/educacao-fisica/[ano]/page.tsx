import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { educacaoFisicaSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Educação Física do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Educação Física aplicáveis ao ${grade}.`,
    alternates: { canonical: `/bncc/educacao-fisica/${ano}` },
  };
}

export default async function EducacaoFisicaYearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro
        title={`BNCC de Educação Física — ${grade}`}
        subtitle={`Consulte as habilidades oficiais do ${grade}, incluindo habilidades compartilhadas com o ano vizinho (códigos EF67EF/EF89EF pareados).`}
        currentYear={grade}
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
        initialYear={grade}
      />
    </>
  );
}
