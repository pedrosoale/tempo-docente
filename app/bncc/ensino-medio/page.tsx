import type { Metadata } from "next";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { AREAS_ENSINO_MEDIO } from "@/lib/bncc/data";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC — Ensino Médio | Tempo Docente",
  description: "Consulte as competências específicas e habilidades da BNCC do Ensino Médio, por área do conhecimento.",
  alternates: { canonical: "/bncc/ensino-medio" },
};

export default function EnsinoMedioPage() {
  const totalHabilidades = AREAS_ENSINO_MEDIO.reduce((sum, area) => sum + area.skills.length, 0);

  return (
    <>
      <BnccIntro
        title="BNCC — Ensino Médio"
        subtitle="Escolha uma área do conhecimento para consultar as competências específicas e habilidades oficiais da Formação Geral Básica. Diferente do Ensino Fundamental, as habilidades não são organizadas por série — a própria BNCC as apresenta sem indicação de seriação."
        scopeComponent="Ensino Médio"
        scopeSegmento="Formação Geral Básica"
        scopeTotal={`${totalHabilidades} habilidades`}
        scopeGrades={`${AREAS_ENSINO_MEDIO.length} área${AREAS_ENSINO_MEDIO.length === 1 ? "" : "s"} · sem recorte por série`}
      />
      <section className="section quick-access">
        <div className="container">
          <div className="access-grid">
            {AREAS_ENSINO_MEDIO.map((area) => (
              <a className="access-card" href={`/bncc/ensino-medio/${area.slug}`} key={area.slug}>
                <div className="access-card-top">
                  <span className="access-icon"><BookOpenText size={22} aria-hidden="true" /></span>
                  <span className="access-label">{area.skills.length} habilidades</span>
                </div>
                <div>
                  <h3>{area.nome}</h3>
                  <p>{area.descricao}</p>
                </div>
                <span className="card-action">Explorar {area.nome} <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
