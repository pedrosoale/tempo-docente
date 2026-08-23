import type { Metadata } from "next";
import { CAMPOS_EXPERIENCIA_INFANTIL, FAIXAS_ETARIAS_INFANTIL } from "@/lib/bncc/data";
import { BnccExplorerInfantil } from "../../components/BnccExplorerInfantil";
import { BnccIntro } from "../../components/BnccIntro";

const campo = CAMPOS_EXPERIENCIA_INFANTIL.find((item) => item.sigla === "CG")!;

export const metadata: Metadata = {
  title: `BNCC — ${campo.nome} (Educação Infantil) | Tempo Docente`,
  description: `Consulte os ${campo.objetivos.length} objetivos de aprendizagem e desenvolvimento do campo de experiências "${campo.nome}" (${campo.sigla}) da BNCC — Educação Infantil, por grupo de faixa etária.`,
  alternates: { canonical: `/bncc/educacao-infantil/${campo.slug}` },
  openGraph: {
    title: `BNCC — ${campo.nome} (Educação Infantil) | Tempo Docente`,
    description: `Objetivos de aprendizagem e desenvolvimento oficiais do campo "${campo.nome}".`,
    url: `/bncc/educacao-infantil/${campo.slug}`,
  },
};

type CampoPageProps = { searchParams?: Promise<{ q?: string; faixa?: string }> };

// Grupos válidos por faixa etária, derivados do dataset (nunca hand-typed) —
// um valor de "faixa" fora desses três é descartado com segurança em vez de
// quebrar a página ou vazar para o filtro "Todos" como um valor inválido.
const VALID_FAIXAS: string[] = FAIXAS_ETARIAS_INFANTIL.map((faixa) => faixa.codigo);

export default async function CampoCorpoGestosEMovimentosPage({ searchParams }: CampoPageProps) {
  const params = await searchParams;
  const initialQuery = params?.q?.trim() ?? "";
  const initialFaixa = params?.faixa && VALID_FAIXAS.includes(params.faixa) ? params.faixa : "";

  return (
    <>
      <BnccIntro
        title={`BNCC — ${campo.nome}`}
        subtitle={`Consulte os ${campo.objetivos.length} objetivos de aprendizagem e desenvolvimento oficiais do campo de experiências "${campo.nome}" (sigla ${campo.sigla}), organizados pelos três grupos por faixa etária.`}
        currentYear={campo.nome}
        parentLabel="Educação Infantil"
        parentHref="/bncc/educacao-infantil"
        scopeComponent="Educação Infantil"
        scopeSegmento={`Campo de experiências · sigla ${campo.sigla}`}
        scopeTotal={`${campo.objetivos.length} objetivos`}
        scopeGrades={`${FAIXAS_ETARIAS_INFANTIL.length} grupos por faixa etária`}
      />
      <BnccExplorerInfantil campo={campo} initialQuery={initialQuery} initialFaixa={initialFaixa} />
    </>
  );
}
