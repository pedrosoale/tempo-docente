import { ArrowRight, Search } from "lucide-react";

const examples = ["EF07MA18", "Equações", "Frações", "Matemática 8º ano"];

export function EducationSearch() {
  return (
    <section className="section search-section" id="busca">
      <div className="container search-layout">
        <div className="search-copy">
          <span className="section-kicker">Busca educacional</span>
          <h2>Encontre rapidamente o que precisa.</h2>
          <p>Uma única busca para navegar por habilidades, matrizes, disciplinas, anos e avaliações.</p>
        </div>
        <div className="search-box">
          <form action="/bncc" method="get" role="search">
            <Search size={22} aria-hidden="true" />
            <label className="sr-only" htmlFor="education-search">Buscar na plataforma</label>
            <input
              id="education-search"
              name="q"
              placeholder="Busque uma habilidade, descritor, ano, disciplina ou avaliação…"
            />
            <button type="submit" aria-label="Buscar"><ArrowRight size={20} /></button>
          </form>
          <div className="search-examples" aria-label="Exemplos de busca">
            <span>Experimente:</span>
            {examples.map((example) => (
              <a key={example} href={`/bncc?q=${encodeURIComponent(example)}`}>{example}</a>
            ))}
          </div>
          <small>Busca na base oficial da BNCC — todos os componentes curriculares do 6º ao 9º ano.</small>
        </div>
      </div>
    </section>
  );
}
