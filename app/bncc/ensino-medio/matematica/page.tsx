import type { Metadata } from "next";
import { matematicaMedioCompetencias, matematicaMedioSkills } from "@/lib/bncc/data";
import { BnccExplorerMedio } from "../../components/BnccExplorerMedio";
import { BnccIntro } from "../../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Matemática e suas Tecnologias | Tempo Docente",
  description: "Consulte as competências específicas e habilidades da BNCC de Matemática e suas Tecnologias — Ensino Médio.",
  alternates: { canonical: "/bncc/ensino-medio/matematica" },
};

export default function MatematicaMedioPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Matemática e suas Tecnologias"
        subtitle="Consulte as competências específicas e as habilidades oficiais da BNCC de Matemática e suas Tecnologias — Ensino Médio."
        scopeComponent="Matemática e suas Tecnologias"
        scopeSegmento="Ensino Médio — Formação Geral Básica"
        scopeTotal={`${matematicaMedioSkills.length} habilidades`}
        scopeGrades={`${matematicaMedioCompetencias.length} competências específicas · sem recorte por série`}
      />

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Competências específicas</span>
              <h2>As {matematicaMedioCompetencias.length} competências de Matemática e suas Tecnologias</h2>
            </div>
          </div>
          <ol className="bncc-competencias-list">
            {matematicaMedioCompetencias.map((competencia) => (
              <li className="bncc-competencia-item" key={competencia.id} id={`competencia-${competencia.numero}`}>
                <span className="bncc-competencia-numero">{competencia.numero}</span>
                <p>{competencia.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BnccExplorerMedio
        skills={matematicaMedioSkills}
        competencias={matematicaMedioCompetencias}
        componentLabel="Matemática e suas Tecnologias"
        searchPlaceholder="Ex.: EM13MAT101, funções, probabilidade…"
        searchExamples={["EM13MAT101", "funções", "probabilidade"]}
      />
    </>
  );
}
