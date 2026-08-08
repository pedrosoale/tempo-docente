import type { Metadata } from "next";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import Link from "next/link";
import { COMPONENTES_ANOS_FINAIS } from "@/lib/bncc/data";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC — Ensino Fundamental | Tempo Docente",
  description: "Consulte as habilidades da BNCC do Ensino Fundamental — Anos Finais, por componente curricular.",
  alternates: { canonical: "/bncc/ensino-fundamental" },
};

export default function EnsinoFundamentalPage() {
  const totalHabilidades = COMPONENTES_ANOS_FINAIS.reduce((sum, componente) => sum + componente.skills.length, 0);

  return (
    <>
      <BnccIntro
        title="BNCC — Ensino Fundamental"
        subtitle="Escolha um componente curricular para consultar as habilidades oficiais dos Anos Finais (6º ao 9º ano)."
        scopeComponent="Anos Finais"
        scopeSegmento="Ensino Fundamental"
        scopeTotal={`${totalHabilidades} habilidades`}
        scopeGrades={`${COMPONENTES_ANOS_FINAIS.length} componentes · 6º ao 9º ano`}
      />
      <section className="section quick-access">
        <div className="container">
          <div className="access-grid">
            {COMPONENTES_ANOS_FINAIS.map((componente) => (
              <Link className="access-card" href={`/bncc/${componente.slug}`} key={componente.slug}>
                <div className="access-card-top">
                  <span className="access-icon"><BookOpenText size={22} aria-hidden="true" /></span>
                  <span className="access-label">{componente.skills.length} habilidades</span>
                </div>
                <div>
                  <h3>{componente.nome}</h3>
                  <p>{componente.descricao}</p>
                </div>
                <span className="card-action">Explorar {componente.nome} <ArrowUpRight size={17} aria-hidden="true" /></span>
              </Link>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
