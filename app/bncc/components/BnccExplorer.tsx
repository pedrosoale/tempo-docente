"use client";

import { ArrowRight, BookOpenText, RotateCcw, Search, SlidersHorizontal } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { HabilidadeFundamental } from "@/lib/bncc/data";
import { filterSkills, uniqueSorted } from "@/lib/bncc/search.mjs";

const PAGE_SIZE = 18;

type BnccExplorerProps = {
  skills: HabilidadeFundamental[];
  componentLabel: string;
  searchPlaceholder: string;
  searchExamples: string[];
  initialQuery?: string;
  initialYear?: string;
};

function objectLabel(value: string) {
  return value.replaceAll("\n", " · ");
}

function unitOf(skill: HabilidadeFundamental) {
  return skill.unidade_tematica ?? skill.campo_atuacao ?? "";
}

function appliesToYear(skill: HabilidadeFundamental, year: string) {
  return (skill.anos_aplicaveis ?? [skill.ano]).includes(year);
}

export function BnccExplorer({
  skills,
  componentLabel,
  searchPlaceholder,
  searchExamples,
  initialQuery = "",
  initialYear = "",
}: BnccExplorerProps) {
  const [query, setQuery] = useState(initialQuery);
  const [year, setYear] = useState(initialYear);
  const [unit, setUnit] = useState("");
  const [object, setObject] = useState("");
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const unitLabel = useMemo(() => (skills.some((skill) => skill.unidade_tematica) ? "Unidade temática" : "Campo de atuação"), [skills]);
  const hasObjectFilter = useMemo(() => skills.some((skill) => skill.objeto_conhecimento), [skills]);

  const years = useMemo(() => uniqueSorted(skills.flatMap((skill) => skill.anos_aplicaveis ?? [skill.ano])), [skills]);
  const units = useMemo(
    () => uniqueSorted(skills.filter((skill) => !year || appliesToYear(skill, year)).map(unitOf)),
    [skills, year],
  );
  const objects = useMemo(
    () => uniqueSorted(
      skills
        .filter((skill) => (!year || appliesToYear(skill, year)) && (!unit || unitOf(skill) === unit))
        .map((skill) => skill.objeto_conhecimento ?? "")
        .filter(Boolean),
    ),
    [skills, year, unit],
  );
  const results = useMemo(
    () => filterSkills(skills, { query, year, unit, object }),
    [skills, query, year, unit, object],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (year) params.set("ano", year.slice(0, 1));
    if (unit) params.set("unidade", unit);
    if (object) params.set("objeto", object);
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [query, year, unit, object]);

  function clearFilters() {
    setQuery("");
    setYear(initialYear);
    setUnit("");
    setObject("");
    setVisibleCount(PAGE_SIZE);
  }

  const hasFilters = Boolean(query || (year && year !== initialYear) || unit || object);
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
            <legend>Ano</legend>
            <div className="bncc-year-options">
              <button type="button" className={!year ? "active" : ""} onClick={() => { setYear(""); setUnit(""); setObject(""); setVisibleCount(PAGE_SIZE); }} aria-pressed={!year}>Todos</button>
              {years.map((option) => (
                <button key={option} type="button" className={year === option ? "active" : ""} onClick={() => { setYear(option); setUnit(""); setObject(""); setVisibleCount(PAGE_SIZE); }} aria-pressed={year === option}>{option}</button>
              ))}
            </div>
          </fieldset>

          <div className="bncc-select-field">
            <label htmlFor="bncc-unit">{unitLabel}</label>
            <select id="bncc-unit" value={unit} onChange={(event) => { setUnit(event.target.value); setObject(""); setVisibleCount(PAGE_SIZE); }}>
              <option value="">Todas as opções</option>
              {units.map((option) => <option key={option} value={option}>{option}</option>)}
            </select>
          </div>

          {hasObjectFilter && (
            <div className="bncc-select-field">
              <label htmlFor="bncc-object">Objeto de conhecimento</label>
              <select id="bncc-object" value={object} onChange={(event) => { setObject(event.target.value); setVisibleCount(PAGE_SIZE); }}>
                <option value="">Todos os objetos</option>
                {objects.map((option) => <option key={option} value={option}>{objectLabel(option)}</option>)}
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
            <span>{componentLabel} · Anos Finais</span>
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
                    <span>{skill.ano} · {componentLabel} · {unitOf(skill)}</span>
                  </div>
                  <p className="bncc-result-skill">{skill.texto}</p>
                  <div className="bncc-result-footer">
                    {skill.objeto_conhecimento ? (
                      <div><span>Objeto de conhecimento</span><strong>{objectLabel(skill.objeto_conhecimento)}</strong></div>
                    ) : <div />}
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
