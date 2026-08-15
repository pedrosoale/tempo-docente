import type { Metadata } from "next";
import { cienciasDaNaturezaMedioCompetencias, cienciasDaNaturezaMedioSkills } from "@/lib/bncc/data";
import { BnccExplorerMedio } from "../../components/BnccExplorerMedio";
import { BnccIntro } from "../../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Ciências da Natureza e suas Tecnologias | Tempo Docente",
  description: "Consulte as competências específicas e habilidades da BNCC de Ciências da Natureza e suas Tecnologias — Ensino Médio.",
  alternates: { canonical: "/bncc/ensino-medio/ciencias-da-natureza" },
};

export default function CienciasDaNaturezaMedioPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Ciências da Natureza e suas Tecnologias"
        subtitle="Consulte as competências específicas e as habilidades oficiais da BNCC de Ciências da Natureza e suas Tecnologias — Ensino Médio."
        scopeComponent="Ciências da Natureza e suas Tecnologias"
        scopeSegmento="Ensino Médio — Formação Geral Básica"
        scopeTotal={`${cienciasDaNaturezaMedioSkills.length} habilidades`}
        scopeGrades={`${cienciasDaNaturezaMedioCompetencias.length} competências específicas · sem recorte por série`}
      />

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Competências específicas</span>
              <h2>As {cienciasDaNaturezaMedioCompetencias.length} competências de Ciências da Natureza e suas Tecnologias</h2>
            </div>
          </div>
          <ol className="bncc-competencias-list">
            {cienciasDaNaturezaMedioCompetencias.map((competencia) => (
              <li className="bncc-competencia-item" key={competencia.id} id={`competencia-${competencia.numero}`}>
                <span className="bncc-competencia-numero">{competencia.numero}</span>
                <p>{competencia.texto}</p>
              </li>
            ))}
          </ol>
        </div>
      </section>

      <BnccExplorerMedio
        skills={cienciasDaNaturezaMedioSkills}
        competencias={cienciasDaNaturezaMedioCompetencias}
        componentLabel="Ciências da Natureza e suas Tecnologias"
        searchPlaceholder="Ex.: EM13CNT101, energia, sustentabilidade…"
        searchExamples={["EM13CNT101", "energia", "sustentabilidade"]}
      />
    </>
  );
}
