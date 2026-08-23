"use client";

import { ArrowRight, BookOpenText, RotateCcw, Search } from "lucide-react";
import { useEffect, useMemo, useState } from "react";
import type { CampoExperienciaInfo } from "@/lib/bncc/data";
import { FAIXAS_ETARIAS_INFANTIL } from "@/lib/bncc/data";
import { filterSkills } from "@/lib/bncc/search.mjs";

const PAGE_SIZE = 18;

type BnccExplorerInfantilProps = {
  campo: CampoExperienciaInfo;
  // Vindos de searchParams já validados na página (ver as 5 páginas de
  // campo) — nunca lidos de window.location aqui, para que o valor inicial
  // seja idêntico no SSR e na primeira hidratação e o efeito abaixo não
  // apague um parâmetro válido da URL ao montar.
  initialQuery?: string;
  initialFaixa?: string;
};

export function BnccExplorerInfantil({ campo, initialQuery = "", initialFaixa = "" }: BnccExplorerInfantilProps) {
  const [query, setQuery] = useState(initialQuery);
  const [faixa, setFaixa] = useState(initialFaixa);
  const [visibleCount, setVisibleCount] = useState(PAGE_SIZE);

  const results = useMemo(
    () => filterSkills(campo.objetivos, { query, faixa }),
    [campo.objetivos, query, faixa],
  );

  useEffect(() => {
    const params = new URLSearchParams();
    if (query.trim()) params.set("q", query.trim());
    if (faixa) params.set("faixa", faixa);
    const nextUrl = `${window.location.pathname}${params.size ? `?${params}` : ""}`;
    window.history.replaceState(null, "", nextUrl);
  }, [query, faixa]);

  function clearFilters() {
    setQuery("");
    setFaixa("");
    setVisibleCount(PAGE_SIZE);
  }

  const hasFilters = Boolean(query || faixa);
  const visibleResults = results.slice(0, visibleCount);
  const firstExampleCode = campo.objetivos[0]?.codigo ?? "";

  return (
    <section className="bncc-explorer-section" aria-labelledby="bncc-search-title">
      <div className="container bncc-explorer-layout">
        <aside className="bncc-filters" aria-label="Filtros do campo de experiências">
          <div className="bncc-filter-heading">
            <span>Filtros</span>
            {hasFilters && <button type="button" onClick={clearFilters}><RotateCcw size={14} /> Limpar</button>}
          </div>

          <fieldset>
            <legend>Grupo por faixa etária</legend>
            <div className="bncc-year-options bncc-faixa-options" role="group" aria-label="Filtrar por grupo por faixa etária">
              <button type="button" className={!faixa ? "active" : ""} onClick={() => { setFaixa(""); setVisibleCount(PAGE_SIZE); }} aria-pressed={!faixa}>
                Todos
              </button>
              {FAIXAS_ETARIAS_INFANTIL.map((option) => (
                <button
                  key={option.codigo}
                  type="button"
                  className={faixa === option.codigo ? "active" : ""}
                  onClick={() => { setFaixa(option.codigo); setVisibleCount(PAGE_SIZE); }}
                  aria-pressed={faixa === option.codigo}
                  title={option.descricao}
                >
                  {option.nome}
                </button>
              ))}
            </div>
            {faixa && (
              <p className="bncc-faixa-descricao" aria-live="polite">
                {FAIXAS_ETARIAS_INFANTIL.find((option) => option.codigo === faixa)?.descricao}
              </p>
            )}
          </fieldset>

          <div className="bncc-filter-source">
            <strong>Dados oficiais</strong>
            <span>BNCC — Ministério da Educação</span>
          </div>
        </aside>

        <div className="bncc-results-column">
          <div className="bncc-search-block">
            <label id="bncc-search-title" htmlFor="bncc-search">Busque por código ou conteúdo deste campo</label>
            <div className="bncc-search-input">
              <Search size={21} aria-hidden="true" />
              <input
                id="bncc-search"
                type="search"
                value={query}
                onChange={(event) => { setQuery(event.target.value); setVisibleCount(PAGE_SIZE); }}
                placeholder={`Ex.: ${firstExampleCode}, brincar, explorar…`}
                autoComplete="off"
              />
              {query && <button type="button" onClick={() => { setQuery(""); setVisibleCount(PAGE_SIZE); }} aria-label="Limpar busca">Limpar</button>}
            </div>
          </div>

          <div className="bncc-results-summary" aria-live="polite">
            <div>
              <strong>{results.length}</strong>
              <span>{results.length === 1 ? "objetivo encontrado" : "objetivos encontrados"}</span>
            </div>
            <span>{campo.nome} · Educação Infantil</span>
          </div>

          {results.length === 0 ? (
            <div className="bncc-empty-state">
              <BookOpenText size={30} aria-hidden="true" />
              <h2>Nenhum objetivo encontrado.</h2>
              <p>Tente outro código, conteúdo ou filtro.</p>
              <button type="button" onClick={clearFilters}>Limpar busca e filtros</button>
            </div>
          ) : (
            <div className="bncc-results-list">
              {visibleResults.map((objetivo) => (
                <article className="bncc-result-card" key={objetivo.codigo}>
                  <div className="bncc-result-meta">
                    <code>{objetivo.codigo}</code>
                    <span>{objetivo.faixa_etaria}</span>
                  </div>
                  <p className="bncc-result-skill">{objetivo.texto}</p>
                  <div className="bncc-result-footer">
                    <div />
                    <a href={`/bncc/${objetivo.codigo.toLowerCase()}`}>Ver objetivo <ArrowRight size={17} aria-hidden="true" /></a>
                  </div>
                </article>
              ))}
            </div>
          )}

          {visibleCount < results.length && (
            <button className="bncc-load-more" type="button" onClick={() => setVisibleCount((count) => count + PAGE_SIZE)}>
              Mostrar mais objetivos <span>{visibleCount} de {results.length}</span>
            </button>
          )}
        </div>
      </div>
    </section>
  );
}
