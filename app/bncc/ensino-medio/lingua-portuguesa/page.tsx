import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import { linguagensMedioCompetencias, linguaPortuguesaMedioSkills } from "@/lib/bncc/data";
import { BnccExplorerMedio } from "../../components/BnccExplorerMedio";
import { BnccIntro } from "../../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC de Língua Portuguesa (Ensino Médio) | Tempo Docente",
  description: "Consulte as habilidades da BNCC de Língua Portuguesa — Ensino Médio, organizadas por campo de atuação social.",
  alternates: { canonical: "/bncc/ensino-medio/lingua-portuguesa" },
};

export default function LinguaPortuguesaMedioPage() {
  return (
    <>
      <BnccIntro
        title="BNCC de Língua Portuguesa"
        subtitle="Consulte as habilidades oficiais da BNCC de Língua Portuguesa — Ensino Médio, organizadas por campo de atuação social."
        scopeComponent="Língua Portuguesa"
        scopeSegmento="Ensino Médio — Formação Geral Básica"
        scopeTotal={`${linguaPortuguesaMedioSkills.length} habilidades`}
        scopeGrades="6 campos de atuação social · sem recorte por série"
      />

      <section className="section quick-access">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Competências específicas</span>
              <h2>Língua Portuguesa não tem competências próprias</h2>
            </div>
            <p>
              Diferente das outras áreas, Língua Portuguesa não define suas próprias competências
              específicas — cada habilidade abaixo referencia uma ou mais das 7 competências de
              Linguagens e suas Tecnologias, indicadas conforme maior afinidade.{" "}
              <a href="/bncc/ensino-medio/linguagens#competencia-1">
                Ver as 7 competências de Linguagens e suas Tecnologias <ArrowRight size={15} aria-hidden="true" />
              </a>
            </p>
          </div>
        </div>
      </section>

      <BnccExplorerMedio
        skills={linguaPortuguesaMedioSkills}
        competencias={linguagensMedioCompetencias}
        componentLabel="Língua Portuguesa"
        searchPlaceholder="Ex.: EM13LP01, argumentação, curadoria…"
        searchExamples={["EM13LP01", "argumentação", "curadoria"]}
      />
    </>
  );
}
