import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { bnccSkills } from "@/lib/bncc/data";
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
    title: `BNCC de Matemática do ${grade} | Tempo Docente`,
    description: `Consulte as habilidades oficiais da BNCC de Matemática do ${grade}, com unidades temáticas e objetos de conhecimento.`,
    alternates: { canonical: `/bncc/matematica/${ano}` },
  };
}

export default async function YearPage({ params }: YearPageProps) {
  const { ano } = await params;
  if (!validYears.includes(ano as (typeof validYears)[number])) notFound();
  const grade = `${ano[0]}º ano`;
  return (
    <>
      <BnccIntro title={`BNCC de Matemática — ${grade}`} subtitle={`Consulte as habilidades, unidades temáticas e objetos de conhecimento oficiais do ${grade}.`} currentYear={grade} />
      <BnccExplorer
        skills={bnccSkills}
        componentLabel="Matemática"
        searchPlaceholder="Ex.: EF07MA18, equações, porcentagem…"
        searchExamples={["EF07MA18", "equações", "porcentagem", "frações"]}
        initialYear={grade}
      />
    </>
  );
}
