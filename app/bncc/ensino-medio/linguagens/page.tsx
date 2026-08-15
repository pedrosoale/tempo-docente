import type { Metadata } from "next";
import { linguagensMedioCompetencias, linguagensMedioSkills } from "@/lib/bncc/data";
import { BnccExplorerMedio } from "../../components/BnccExplorerMedio";
import { BnccIntro } from "../../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Linguagens e suas Tecnologias | Tempo Docente",
  description: "Consulte as competências específicas e habilidades da BNCC de Linguagens e suas Tecnologias — Ensino Médio.",
  alternates: { canonical: "/bncc/ensino-medio/linguagens" },
};

export default function LinguagensMedioPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Linguagens e suas Tecnologias"
        subtitle="Consulte as competências específicas e as habilidades oficiais da BNCC de Linguagens e suas Tecnologias — Ensino Médio."
        scopeComponent="Linguagens e suas Tecnologias"
        scopeSegmento="Ensino Médio — Formação Geral Básica"
        scopeTotal={`${linguagensMedioSkills.length} habilidades`}
        scopeGrades={`${linguagensMedioCompetencias.length} competências específicas · sem recorte por série`}
      />

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Competências específicas</span>
              <h2>As {linguagensMedioCompetencias.length} competências de Linguagens e suas Tecnologias</h2>
            </div>
          </div>
          <ol className="bncc-competencias-list">
            {linguagensMedioCompetencias.map((competencia) => (
              <li className="bncc-competencia-item" key={competencia.id} id={`competencia-${competencia.numero}`}>
                <span className="bncc-competencia-numero">{competencia.numero}</span>
                <p>{competencia.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BnccExplorerMedio
        skills={linguagensMedioSkills}
        competencias={linguagensMedioCompetencias}
        componentLabel="Linguagens e suas Tecnologias"
        searchPlaceholder="Ex.: EM13LGG101, protagonismo, tecnologias digitais…"
        searchExamples={["EM13LGG101", "protagonismo", "tecnologias digitais"]}
      />
    </>
  );
}
