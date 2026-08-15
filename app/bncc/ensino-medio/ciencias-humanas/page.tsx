import type { Metadata } from "next";
import { cienciasHumanasMedioCompetencias, cienciasHumanasMedioSkills } from "@/lib/bncc/data";
import { BnccExplorerMedio } from "../../components/BnccExplorerMedio";
import { BnccIntro } from "../../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Ciências Humanas e Sociais Aplicadas | Tempo Docente",
  description: "Consulte as competências específicas e habilidades da BNCC de Ciências Humanas e Sociais Aplicadas — Ensino Médio.",
  alternates: { canonical: "/bncc/ensino-medio/ciencias-humanas" },
};

export default function CienciasHumanasMedioPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Ciências Humanas e Sociais Aplicadas"
        subtitle="Consulte as competências específicas e as habilidades oficiais da BNCC de Ciências Humanas e Sociais Aplicadas — Ensino Médio."
        scopeComponent="Ciências Humanas e Sociais Aplicadas"
        scopeSegmento="Ensino Médio — Formação Geral Básica"
        scopeTotal={`${cienciasHumanasMedioSkills.length} habilidades`}
        scopeGrades={`${cienciasHumanasMedioCompetencias.length} competências específicas · sem recorte por série`}
      />

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Competências específicas</span>
              <h2>As {cienciasHumanasMedioCompetencias.length} competências de Ciências Humanas e Sociais Aplicadas</h2>
            </div>
          </div>
          <ol className="bncc-competencias-list">
            {cienciasHumanasMedioCompetencias.map((competencia) => (
              <li className="bncc-competencia-item" key={competencia.id} id={`competencia-${competencia.numero}`}>
                <span className="bncc-competencia-numero">{competencia.numero}</span>
                <p>{competencia.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BnccExplorerMedio
        skills={cienciasHumanasMedioSkills}
        competencias={cienciasHumanasMedioCompetencias}
        componentLabel="Ciências Humanas e Sociais Aplicadas"
        searchPlaceholder="Ex.: EM13CHS101, território, cidadania…"
        searchExamples={["EM13CHS101", "território", "cidadania"]}
      />
    </>
  );
}
