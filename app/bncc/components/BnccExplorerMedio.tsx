"use client";

import { ArrowRight, BookOpenText, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CompetenciaEspecificaMedio, HabilidadeMedio } from "@/lib/bncc/data";
import { filterSkills, uniqueSorted } from "@/lib/bncc/search.mjs";

const PAGE_SIZE = 18;

type BnccExplorerMedioProps = {
  skills: HabilidadeMedio[];
  competencias: CompetenciaEspecificaMedio[];
  componentLabel: string;
  searchPlaceholder: string;
  searchExamples: string[];
};

export function BnccExplorerMedio({
  skills,
  competencias,
  componentLabel,
  searchPlaceholder,
  searchExamples,
}: BnccExplorerMedioProps) {
  const [query, setQuery] = useState("");
  const [competencia, setCompetencia] = useState("");
  const [campo, setCampo] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const hasCampoFilter = useMemo(() => skills.some((skill) => skill.campo_atuacao), [skills]);
  const campos = useMemo(() => uniqueSorted(skills.map((skill) => skill.campo_atuacao ?? "").filter(Boolean)), [skills]);

  const results = useMemo(
    () => filterSkills(skills, { query, competencia, unit: campo }),
    [skills, query, competencia, campo],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (competencia) params.set("competencia", competencia);
    if (campo) params.set("campo", campo);
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [query, competencia, campo]);

  function clearFilters() {
    setQuery("");
    setCompetencia("");
    setCampo("");
    setVisibleCount(PAGE_SIZE);
  }

  const hasFilters = Boolean(query || competencia || campo);
  const visibleResults = results.slice(0, visibleCount);

  return (
    <section className="bncc-explorer-section" aria-labelledby="bncc-search-title">
      <div className="container bncc-explorer-layout">
        <aside className="bncc-filters" aria-label="Filtros da BNCC">
          <div className="bncc-filter-heading">
            <span><SlidersHorizontal size={18} aria-hidden="true" /> Filtros</span>
            {hasFilters && <button type="button" onClick={clearFilters}><RotateCcw size={14} /> Limpar</button>}
          </div>

          <fieldset>
            <legend>Competência específica</legend>
            <div className="bncc-year-options">
              <button type="button" className={!competencia ? "active" : ""} onClick={() => { setCompetencia(""); setVisibleCount(PAGE_SIZE); }} aria-pressed={!competencia}>Todas</button>
              {competencias.map((option) => (
                <button
                  key={option.numero}
                  type="button"
                  className={competencia === String(option.numero) ? "active" : ""}
                  onClick={() => { setCompetencia(String(option.numero)); setVisibleCount(PAGE_SIZE); }}
                  aria-pressed={competencia === String(option.numero)}
                >
                  {option.numero}
                </button>
              ))}
            </div>
          </fieldset>

          {hasCampoFilter && (
            <div className="bncc-select-field">
              <label htmlFor="bncc-campo">Campo de atuação</label>
              <select id="bncc-campo" value={campo} onChange={(event) => { setCampo(event.target.value); setVisibleCount(PAGE_SIZE); }}>
                <option value="">Todos os campos</option>
                {campos.map((option) => <option key={option} value={option}>{option}</option>)}
              </select>
            </div>
          )}

          <div className="bncc-filter-source">
            <strong>Dados oficiais</strong>
            <span>BNCC — Ministério da Educação</span>
          </div>
        </aside>

        <div className="bncc-results-column">
          <div className="bncc-search-block">
            <label id="bncc-search-title" htmlFor="bncc-search">Busque por código ou conteúdo da BNCC</label>
            <div className="bncc-search-input">
              <Search size={21} aria-hidden="true" />
              <input
                id="bncc-search"
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
                placeholder={searchPlaceholder}
                autoComplete="off"
              />
              {query && <button type="button" onClick={() => { setQuery(""); setVisibleCount(PAGE_SIZE); }} aria-label="Limpar busca">Limpar</button>}
            </div>
            <div className="bncc-search-examples" aria-label="Exemplos de busca">
              <span>Experimente:</span>
              {searchExamples.map((example) => (
                <button type="button" key={example} onClick={() => { setQuery(example); setVisibleCount(PAGE_SIZE); }}>{example}</button>
              ))}
            </div>
          </div>

          <div className="bncc-results-summary" aria-live="polite">
            <div>
              <strong>{results.length}</strong>
              <span>{results.length === 1 ? "habilidade encontrada" : "habilidades encontradas"}</span>
            </div>
            <span>{componentLabel} · Ensino Médio</span>
          </div>

          {results.length === 0 ? (
            <div className="bncc-empty-state">
              <BookOpenText size={30} aria-hidden="true" />
              <h2>Nenhuma habilidade encontrada.</h2>
              <p>Tente outro código, conteúdo ou filtro.</p>
              <button type="button" onClick={clearFilters}>Limpar busca e filtros</button>
            </div>
          ) : (
            <div className="bncc-results-list">
              {visibleResults.map((skill) => (
                <article className="bncc-result-card" key={skill.codigo}>
                  <div className="bncc-result-meta">
                    <code>{skill.codigo}</code>
                    <span>
                      {componentLabel} · Competência {skill.competencias_especificas.join(", ")}
                      {skill.campo_atuacao ? ` · ${skill.campo_atuacao}` : ""}
                    </span>
                  </div>
                  <p className="bncc-result-skill">{skill.texto}</p>
                  <div className="bncc-result-footer">
                    <div />
                    <a href={`/bncc/${skill.codigo.toLowerCase()}`}>Ver habilidade <ArrowRight size={17} aria-hidden="true" /></a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {visibleCount < results.length && (
            <button className="bncc-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Mostrar mais habilidades <span>{visibleCount} de {results.length}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
