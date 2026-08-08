import type { Metadata } from "next";
import { competenciasGerais, competenciasGeraisMetadata } from "@/lib/bncc/data";

export const metadata: Metadata = {
  title: "Competências Gerais da Educação Básica | Tempo Docente",
  description: "As 10 competências gerais da BNCC que orientam a Educação Infantil, o Ensino Fundamental e o Ensino Médio, com o texto oficial completo.",
  alternates: { canonical: "/bncc/competencias-gerais" },
  openGraph: {
    title: "Competências Gerais da Educação Básica | Tempo Docente",
    description: "As 10 competências gerais oficiais da BNCC, com texto integral e fonte.",
    url: "/bncc/competencias-gerais",
  },
};

export default function CompetenciasGeraisPage() {
  return (
    <article className="bncc-skill-page">
      <div className="container">
        <nav className="bncc-breadcrumb" aria-label="Breadcrumb">
          <a href="/">Início</a><span aria-hidden="true">/</span>
          <a href="/bncc">BNCC</a><span aria-hidden="true">/</span>
          <span aria-current="page">Competências Gerais</span>
        </nav>

        <header className="bncc-competencias-header">
          <span className="bncc-official-label">Dado oficial · BNCC/MEC</span>
          <h1>Competências Gerais da Educação Básica</h1>
          <p>
            Ao longo da Educação Básica — na Educação Infantil, no Ensino Fundamental e no Ensino Médio —,
            os alunos devem desenvolver estas dez competências gerais, nos termos da BNCC.
          </p>
        </header>

        <ol className="bncc-competencias-list">
          {competenciasGerais.map((competencia) => (
            <li className="bncc-competencia-item" key={competencia.id} id={`competencia-${competencia.numero}`}>
              <span className="bncc-competencia-numero">{competencia.numero}</span>
              <p>{competencia.texto}</p>
            </li>
          ))}
        </ol>

        <aside className="bncc-source-panel bncc-competencias-source" id="fonte">
          <span>Fonte primária</span>
          <h2>Base Nacional Comum Curricular</h2>
          <p>Ministério da Educação · {competenciasGeraisMetadata.versao_fonte}</p>
        </aside>
      </div>
    </article>
  );
}
