import { ArrowRight, Search } from "lucide-react";

const examples = ["Língua Portuguesa", "Ciências", "História", "Geografia"];

export function EducationSearch() {
  return (
    <section className="section search-section" id="busca">
      <div className="container home-rail search-layout">
        <div className="search-copy">
          <span className="section-kicker">Buscar na BNCC</span>
          <h2>Busque habilidades da BNCC.</h2>
          <p>Pesquise por habilidade, componente curricular ou etapa na base oficial da BNCC.</p>
        </div>
        <div className="search-box">
          <form action="/bncc" method="get" role="search">
            <Search size={22} aria-hidden="true" />
            <label className="sr-only" htmlFor="education-search">Buscar na BNCC</label>
            <input
              id="education-search"
              name="q"
              placeholder="Busque uma habilidade, componente ou etapa da BNCC…"
            />
            <button type="submit" aria-label="Buscar"><ArrowRight size={20} /></button>
          </form>
          <div className="search-examples" aria-label="Exemplos de busca">
            <span>Experimente:</span>
            {examples.map((example) => (
              <a key={example} href={`/bncc?q=${encodeURIComponent(example)}`}>{example}</a>
            ))}
          </div>
          <small>Busca na base oficial da BNCC — Educação Infantil, Ensino Fundamental e Ensino Médio.</small>
        </div>
      </div>
    </section>
  );
}
