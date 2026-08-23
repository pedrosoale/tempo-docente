import type { Metadata } from "next";
import { ArrowUpRight, BookOpenText } from "lucide-react";
import { CAMPOS_EXPERIENCIA_INFANTIL, educacaoInfantilDireitos, educacaoInfantilMetadata, FAIXAS_ETARIAS_INFANTIL } from "@/lib/bncc/data";
import { BnccIntro } from "../components/BnccIntro";

export const metadata: Metadata = {
  title: "BNCC — Educação Infantil | Tempo Docente",
  description: "Consulte os direitos e os objetivos de aprendizagem e desenvolvimento da BNCC — Educação Infantil, por campo de experiências e grupo por faixa etária.",
  alternates: { canonical: "/bncc/educacao-infantil" },
  openGraph: {
    title: "BNCC — Educação Infantil | Tempo Docente",
    description: "Direitos e objetivos de aprendizagem e desenvolvimento oficiais da BNCC — Educação Infantil.",
    url: "/bncc/educacao-infantil",
  },
};

export default function EducacaoInfantilPage() {
  const totalObjetivos = CAMPOS_EXPERIENCIA_INFANTIL.reduce((sum, campo) => sum + campo.objetivos.length, 0);

  return (
    <>
      <BnccIntro
        title="BNCC — Educação Infantil"
        subtitle="Consulte os direitos de aprendizagem e desenvolvimento e os objetivos organizados por campo de experiências e grupo por faixa etária. Diferente do Ensino Fundamental, a Educação Infantil não é seriada — a própria BNCC apresenta os objetivos sequencialmente dentro de cada campo e faixa, sem recorte por ano."
        currentYear="Educação Infantil"
        scopeComponent="Educação Infantil"
        scopeSegmento="Creche e pré-escola"
        scopeTotal={`${totalObjetivos} objetivos`}
        scopeGrades={`${educacaoInfantilDireitos.length} direitos · ${CAMPOS_EXPERIENCIA_INFANTIL.length} campos de experiências`}
        scopeVersaoFonte={educacaoInfantilMetadata.versao_fonte}
      />

      <section className="section quick-access" aria-labelledby="direitos-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Direitos de aprendizagem e desenvolvimento</span>
              <h2 id="direitos-title">Os seis direitos que orientam a Educação Infantil</h2>
            </div>
            <p>Texto oficial da BNCC — não numerados no documento original; a ordem abaixo segue a apresentação oficial.</p>
          </div>
          <ul className="bncc-direitos-list">
            {educacaoInfantilDireitos.map((direito) => (
              <li className="bncc-direito-item" key={direito.id} id={`direito-${direito.slug}`}>
                <span className="bncc-direito-nome">{direito.nome}</span>
                <p>{direito.texto}</p>
              </li>
            ))}
          </ul>
        </div>
      </section>

      <section className="section quick-access" aria-labelledby="faixas-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Grupos por faixa etária</span>
              <h2 id="faixas-title">Três grupos, com o texto oficial da BNCC</h2>
            </div>
          </div>
          <div className="bncc-faixas-grid">
            {FAIXAS_ETARIAS_INFANTIL.map((faixa) => (
              <div className="bncc-faixa-card" key={faixa.codigo}>
                <h3>{faixa.nome}</h3>
                <p>{faixa.descricao}</p>
              </div>
            ))}
          </div>
          <aside className="bncc-official-note">
            <span className="bncc-official-label">Nota oficial da BNCC</span>
            <p>
              A própria Base destaca que esses grupos não podem ser considerados de forma rígida, já que há
              diferenças de ritmo na aprendizagem e no desenvolvimento das crianças que precisam ser
              consideradas na prática pedagógica.
            </p>
          </aside>
        </div>
      </section>

      <section className="section quick-access" aria-labelledby="campos-title">
        <div className="container">
          <div className="section-heading">
            <div>
              <span className="section-kicker">Campos de experiências</span>
              <h2 id="campos-title">Escolha um campo para consultar os objetivos</h2>
            </div>
          </div>
          <div className="access-grid">
            {CAMPOS_EXPERIENCIA_INFANTIL.map((campo) => (
              <a className="access-card" href={`/bncc/educacao-infantil/${campo.slug}`} key={campo.slug}>
                <div className="access-card-top">
                  <span className="access-icon"><BookOpenText size={22} aria-hidden="true" /></span>
                  <span className="access-label">{campo.objetivos.length} objetivos</span>
                </div>
                <div>
                  <h3>{campo.nome}</h3>
                  <p>Sigla oficial: {campo.sigla}</p>
                </div>
                <span className="card-action">Explorar {campo.nome} <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>
            ))}
          </div>
        </div>
      </section>
    </>
  );
}
