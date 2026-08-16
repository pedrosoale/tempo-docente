"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { CalendarRange, Database, FileWarning, Info } from "lucide-react";
import {
  buildDiagnosis,
  buildPriorities,
  buildSchoolStateComparison,
  buildStateBenchmark,
  CSV_BOM,
  formatSchoolLabel,
  makeComparison,
  matchSchoolIndex,
  normalizeSearch,
  restrictToYear,
  SCHOOL_MATCH_LIMIT,
  toCsv,
  withSearchKey,
  withVariation,
} from "@/lib/saresp/analysis";
import { BENCHMARK_LABEL_LONG, BENCHMARK_METHODOLOGY } from "@/lib/saresp/labels";
import type {
  ExecutiveRow,
  ExecutiveRowSeed,
  FilterOptions,
  FilterState,
  RawRow,
  SchoolAliasesMap,
  SchoolDetailRow,
  SchoolIdentity,
  SearchableIdentity,
} from "@/lib/saresp/types";
import ComparisonTable from "./ComparisonTable";
import Diagnosis from "./Diagnosis";
import EvolutionChart from "./EvolutionChart";
import Filters from "./Filters";
import Rankings from "./Rankings";
import ResultSummaryCards from "./ResultSummaryCards";
import SchoolVsState from "./SchoolVsState";
import StateOverview from "./StateOverview";

const INITIAL_FILTERS: FilterState = {
  school: "",
  series: "",
  component: "",
  period: "",
  year: "",
  network: "",
};

// The source CSVs only ever contain these four (confirmed against the real data) — période can't be
// derived from executive.json like série/componente/rede can, because it's exactly the dimension
// makeExecutiveComparison dedupes away (see dedupeByPeriodo in lib/saresp/analysis.ts).
const PERIODO_OPTIONS = ["GERAL", "MANHÃ", "NOITE", "TARDE"];

// GERAL needs no separate file: every codesc×serieAno×componente×year group has a GERAL row (see
// scripts/saresp/build-data.mjs), so it's numerically identical to the no-filter default
// (executive.json) — only MANHÃ/TARDE/NOITE materially change the state-wide numbers.
const PERIODO_VARIANT_FILES: Partial<Record<string, string>> = {
  "MANHÃ": "executive-manha.json",
  TARDE: "executive-tarde.json",
  NOITE: "executive-noite.json",
};

function uniqueOptions<T>(rows: T[], key: keyof T): string[] {
  return [...new Set(rows.map((row) => String(row[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function downloadFile(filename: string, content: string, type = "text/plain;charset=utf-8") {
  const blob = new Blob([content], { type });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = filename;
  link.click();
  URL.revokeObjectURL(url);
}

async function loadJson<T>(path: string): Promise<T> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${path}`);
  }
  return response.json() as Promise<T>;
}

// Every row of a matched school's detail partition, plus the executive-level and detailed-table
// filters (série/componente/período/rede/ano) — used both for the détail/CSV layer below.
function matchesRowFilters(row: { serieAno: string; componente: string; periodo: string; rede: string; year: number }, filters: FilterState): boolean {
  if (filters.series && row.serieAno !== filters.series) return false;
  if (filters.component && row.componente !== filters.component) return false;
  if (filters.period && row.periodo !== filters.period) return false;
  if (filters.network && row.rede !== filters.network) return false;
  if (filters.year && filters.year !== "Comparativo" && row.year !== Number(filters.year)) return false;
  return true;
}

export default function SarespReport() {
  // --- Always-loaded baseline: schools-index.json (~155KB gzip) + executive.json (~477KB gzip) —
  // see README "Pipeline de dados do SARESP" for the full artifact breakdown and size measurements.
  const [schoolIndex, setSchoolIndex] = useState<SearchableIdentity[]>([]);
  const [defaultExecutive, setDefaultExecutive] = useState<ExecutiveRow[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  // --- On-demand: período variant (MANHÃ/TARDE/NOITE) executive layer, fetched only when that
  // filter is actually selected — see PERIODO_VARIANT_FILES above.
  const [periodoVariants, setPeriodoVariants] = useState<Partial<Record<string, ExecutiveRow[]>>>({});
  const requestedPeriodoVariants = useRef(new Set<string>());

  useEffect(() => {
    async function loadBaseline() {
      try {
        setLoading(true);
        const [indexData, aliasesData, executiveSeed] = await Promise.all([
          loadJson<SchoolIdentity[]>("/data/saresp/schools-index.json"),
          loadJson<SchoolAliasesMap>("/data/saresp/schools-aliases.json"),
          loadJson<ExecutiveRowSeed[]>("/data/saresp/executive.json"),
        ]);
        // withSearchKey folds each school's historical (pre-rename) names from schools-aliases.json
        // into its searchKey — a tiny separate fetch (~52 of 9.760 schools) instead of giving every
        // index entry a searchKey-sized field just to cover the rare renamed case (see
        // buildSchoolAliases in lib/saresp/analysis.ts).
        setSchoolIndex(indexData.map((entry) => withSearchKey(entry, aliasesData)));
        setDefaultExecutive(executiveSeed.map((seed) => withVariation(seed)));
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    }

    loadBaseline();
  }, []);

  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  // The combobox's onSelect(entry) sets this; any further edit to the query text clears it (see
  // updateSchoolQuery below) — carrying codesc as real selection state instead of parsing it back
  // out of a formatted label string.
  const [exactSchool, setExactSchool] = useState<SearchableIdentity | null>(null);

  useEffect(() => {
    const filename = PERIODO_VARIANT_FILES[filters.period];
    if (!filename || requestedPeriodoVariants.current.has(filters.period)) return;
    requestedPeriodoVariants.current.add(filters.period);

    loadJson<ExecutiveRowSeed[]>(`/data/saresp/${filename}`)
      .then((seed) => {
        setPeriodoVariants((current) => ({ ...current, [filters.period]: seed.map((row) => withVariation(row)) }));
      })
      .catch(() => {
        // A missing/failed variant degrades to an empty state-wide view for that período (see
        // activeExecutive below) rather than breaking the whole page — the single-school detailed
        // table still works fine, since it reads période granularity from the raw partition, not
        // from this precomputed layer.
        requestedPeriodoVariants.current.delete(filters.period);
      });
  }, [filters.period]);

  // Resolves which precomputed executive source is active for the current Período filter — null
  // means "variant requested but hasn't arrived yet" (GERAL and "Todos" both use the default file,
  // since a GERAL row is present in 100% of groups — see PERIODO_VARIANT_FILES above).
  const activeExecutive = useMemo((): ExecutiveRow[] | null => {
    const filename = PERIODO_VARIANT_FILES[filters.period];
    if (!filename) return defaultExecutive;
    return periodoVariants[filters.period] ?? null;
  }, [filters.period, defaultExecutive, periodoVariants]);

  // State-wide baseline for the current recorte (all filters except the school search) — powers
  // StateOverview's Rankings/Charts, the benchmark, AND (filtered further by codesc) every
  // single-school executive indicator. No fetch: this is a client-side filter over already-loaded
  // data, per componente/série/rede (all present on ExecutiveRow) and ano (restrictToYear).
  const stateExecutiveRows = useMemo(() => {
    if (!activeExecutive) return [];
    return activeExecutive
      .filter((row) => {
        if (filters.series && row.serieAno !== filters.series) return false;
        if (filters.component && row.componente !== filters.component) return false;
        if (filters.network && row.rede !== filters.network) return false;
        return true;
      })
      .map((row) => restrictToYear(row, filters.year))
      .filter((row) => Number.isFinite(row.prof2024) || Number.isFinite(row.prof2025));
  }, [activeExecutive, filters.series, filters.component, filters.network, filters.year]);

  const stateBenchmark = useMemo(() => buildStateBenchmark(stateExecutiveRows), [stateExecutiveRows]);

  const hasSchoolQuery = filters.school.trim() !== "";

  // Exact combobox pick always wins (one entry, no ambiguity); otherwise every school whose
  // (already-loaded, lightweight) index entry matches the free-typed query — same matcher the
  // combobox itself uses for its suggestion list, so "what's suggested" and "what resolves" can
  // never disagree.
  const matchedEntries = useMemo(() => {
    if (exactSchool) return [exactSchool];
    const normalized = normalizeSearch(filters.school);
    return normalized ? matchSchoolIndex(schoolIndex, normalized) : [];
  }, [exactSchool, filters.school, schoolIndex]);

  const matchedCodes = useMemo(() => matchedEntries.map((entry) => entry.codesc), [matchedEntries]);
  const matchedCount = matchedEntries.length;
  const hasMatches = matchedCount > 0;
  const isSingleSchool = hasSchoolQuery && matchedCount === 1;
  const isAmbiguousWithinCap = hasSchoolQuery && matchedCount > 1 && matchedCount <= SCHOOL_MATCH_LIMIT;
  const isAmbiguousOverCap = hasSchoolQuery && matchedCount > SCHOOL_MATCH_LIMIT;
  const showsDetailedView = isSingleSchool || isAmbiguousWithinCap;

  // Instant — a client-side filter over the already-loaded executive layer, not a fetch. This is
  // what lets a school's summary cards / gap / diagnosis / rankings render before its détail
  // partition (below) even starts downloading.
  const schoolExecutiveRows = useMemo(() => {
    if (!matchedCodes.length) return [];
    const codeSet = new Set(matchedCodes);
    return stateExecutiveRows.filter((row) => codeSet.has(row.codesc));
  }, [stateExecutiveRows, matchedCodes]);

  const schoolStateRows = useMemo(
    () => (isSingleSchool ? buildSchoolStateComparison(schoolExecutiveRows, stateBenchmark) : []),
    [isSingleSchool, schoolExecutiveRows, stateBenchmark]
  );
  const diagnosis = useMemo(() => buildDiagnosis(schoolStateRows), [schoolStateRows]);
  const priorities = useMemo(() => buildPriorities(schoolStateRows), [schoolStateRows]);

  const selectedSchoolLabel = useMemo(() => (isSingleSchool ? formatSchoolLabel(matchedEntries[0]) : null), [isSingleSchool, matchedEntries]);

  // --- Per-school detail partitions (público/data/saresp/schools/<codesc>.json, ~1-8KB each),
  // fetched only for matched schools within the cap — an ambiguous "prof" (4.417 matches in the
  // real data) never triggers a fetch storm; it just shows "refine sua busca" (see
  // isAmbiguousOverCap above) with no network request at all.
  const [schoolDetails, setSchoolDetails] = useState<Map<string, RawRow[]>>(new Map());
  const [detailError, setDetailError] = useState("");
  const fetchedSchoolCodes = useRef(new Set<string>());
  const schoolIndexByCode = useMemo(() => new Map(schoolIndex.map((entry) => [entry.codesc, entry])), [schoolIndex]);

  useEffect(() => {
    if (!showsDetailedView) return;
    const missingCodes = matchedCodes.filter((codesc) => !fetchedSchoolCodes.current.has(codesc));
    if (!missingCodes.length) return;
    missingCodes.forEach((codesc) => fetchedSchoolCodes.current.add(codesc));

    Promise.all(
      missingCodes.map(async (codesc) => {
        const detailRows = await loadJson<SchoolDetailRow[]>(`/data/saresp/schools/${codesc}.json`);
        const identity = schoolIndexByCode.get(codesc);
        const hydrated: RawRow[] = detailRows.map((row) => ({
          ...row,
          codesc,
          nomesc: identity?.nomesc ?? "",
          rede: identity?.rede ?? "",
          codrmet: identity?.codrmet ?? "",
        }));
        return [codesc, hydrated] as const;
      })
    )
      .then((entries) => {
        setSchoolDetails((current) => {
          const next = new Map(current);
          entries.forEach(([codesc, hydrated]) => next.set(codesc, hydrated));
          return next;
        });
      })
      .catch((loadError) => {
        missingCodes.forEach((codesc) => fetchedSchoolCodes.current.delete(codesc));
        setDetailError(loadError instanceof Error ? loadError.message : String(loadError));
      });
  }, [showsDetailedView, matchedCodes, schoolIndexByCode]);

  const detailReady = matchedCodes.length > 0 && matchedCodes.every((codesc) => schoolDetails.has(codesc));

  // Detailed (período-inclusive) layer — feeds only ComparisonTable and CSV export. Re-applies
  // every filter (raw partitions retain full período/ano granularity the executive layer doesn't).
  const comparison = useMemo(() => {
    if (!detailReady) return [];
    const rowsForMatched = matchedCodes.flatMap((codesc) => schoolDetails.get(codesc) ?? []);
    return makeComparison(rowsForMatched.filter((row) => matchesRowFilters(row, filters)));
  }, [detailReady, matchedCodes, schoolDetails, filters]);

  const options: FilterOptions = useMemo(
    () => ({
      schools: schoolIndex,
      series: uniqueOptions(defaultExecutive, "serieAno"),
      components: uniqueOptions(defaultExecutive, "componente"),
      periods: PERIODO_OPTIONS,
      networks: uniqueOptions(defaultExecutive, "rede"),
    }),
    [schoolIndex, defaultExecutive]
  );

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
    if (key === "school") setExactSchool(null);
  }

  function handleSchoolSelect(entry: SearchableIdentity) {
    setFilters((current) => ({ ...current, school: entry.nomesc }));
    setExactSchool(entry);
  }

  function handleReset() {
    setFilters(INITIAL_FILTERS);
    setExactSchool(null);
  }

  function exportCsv() {
    downloadFile("comparativo-saresp-filtrado.csv", `${CSV_BOM}${toCsv(comparison)}`, "text/csv;charset=utf-8");
  }

  function printReport() {
    const report = [
      "Relatório SARESP — Tempo Docente",
      isSingleSchool && selectedSchoolLabel ? `Escola: ${selectedSchoolLabel}` : "Recorte atual (múltiplas escolas)",
      "",
      "Resumo por componente e série:",
      ...schoolExecutiveRows.map((row) => `- ${row.componente} (${row.serieAno}): ${row.prof2024 ?? "-"} -> ${row.prof2025 ?? "-"} (${row.statusLabel})`),
      "",
      "Destaques:",
      ...(diagnosis.destaques.length ? diagnosis.destaques.map((item) => `- ${item}`) : ["- Nenhum."]),
      "",
      "Pontos de atenção:",
      ...(diagnosis.pontosDeAtencao.length ? diagnosis.pontosDeAtencao.map((item) => `- ${item}`) : ["- Nenhum."]),
      "",
      "Prioridades para análise:",
      ...(priorities.length ? priorities.map((item) => `- [${item.priority}] ${item.componente} (${item.serieAno}): ${item.evidencia}`) : ["- Nenhuma."]),
    ].join("\n");

    const win = window.open("", "_blank");
    if (!win) return;
    win.document.write(`<pre>${report.replaceAll("<", "&lt;")}</pre>`);
    win.document.close();
    win.print();
  }

  return (
    <>
      <section className="dashboard-intro">
        <div className="container dashboard-intro-grid">
          <div>
            <span className="section-kicker">
              <span /> Avaliação externa · SEDUC-SP
            </span>
            <h1>Relatório SARESP — 2024 x 2025</h1>
            <p>
              Analise cada componente curricular separadamente, compare a escola com a {BENCHMARK_LABEL_LONG} no mesmo recorte de série e
              componente, e acompanhe a distância ano a ano.
            </p>
          </div>
          <div className="intro-stats">
            <div>
              <span className="intro-stat-icon">
                <Database size={19} />
              </span>
              <span>
                <strong>{stateExecutiveRows.length}</strong>registros no recorte atual
              </span>
            </div>
            <div>
              <span className="intro-stat-icon">
                <CalendarRange size={19} />
              </span>
              <span>
                <strong>2024 → 2025</strong>período comparado
              </span>
            </div>
          </div>
        </div>
      </section>

      {loading && (
        <section className="state-panel">
          <Database size={28} />
          <strong>Carregando dados do SARESP...</strong>
        </section>
      )}

      {error && (
        <section className="state-panel error">
          <FileWarning size={28} />
          <strong>{error}</strong>
          <span>Confira se os arquivos JSON estão em public/data/saresp.</span>
        </section>
      )}

      {!loading && !error && (
        <>
          <Filters filters={filters} options={options} onChange={updateFilter} onSchoolSelect={handleSchoolSelect} onReset={handleReset} />

          <p className="scope-note">
            <Info size={17} />
            Esta base cobre apenas 2º, 5º e 9º Ano do Ensino Fundamental — os CSVs de origem não trazem resultados de Ensino Médio. Desde 2023 o EM é
            avaliado pelo Provão Paulista Seriado, publicado separadamente e sem versão pré-agregada por escola equivalente à proficiência usada aqui.
          </p>

          <p className="scope-note">
            <Info size={17} />
            <strong>Como calculamos a {BENCHMARK_LABEL_LONG}:</strong> {BENCHMARK_METHODOLOGY}
          </p>

          {!hasSchoolQuery && <StateOverview comparison={stateExecutiveRows} />}

          {hasSchoolQuery && !hasMatches && (
            <p className="overview-hint">
              <FileWarning size={17} />
              Nenhuma escola encontrada para &quot;{filters.school}&quot;. Verifique o nome digitado.
            </p>
          )}

          {isAmbiguousOverCap && (
            <p className="overview-hint">
              <Database size={17} />
              {matchedCount} escolas correspondem a &quot;{filters.school}&quot; — refine a busca para ver o relatório de uma escola específica.
            </p>
          )}

          {isSingleSchool && selectedSchoolLabel && (
            <p className="overview-hint">
              <Database size={17} />
              Escola selecionada: <strong>{selectedSchoolLabel}</strong>
            </p>
          )}

          {isAmbiguousWithinCap && (
            <p className="overview-hint">
              <Database size={17} />
              {matchedCount} escolas correspondem a &quot;{filters.school}&quot; — refine a busca para ver o relatório completo de uma única escola.
            </p>
          )}

          {isSingleSchool && (
            <>
              <ResultSummaryCards rows={schoolExecutiveRows} />
              <SchoolVsState schoolLabel={selectedSchoolLabel ?? filters.school} rows={schoolStateRows} />
              <EvolutionChart rows={schoolStateRows} />
              <Diagnosis diagnosis={diagnosis} priorities={priorities} />
              <Rankings comparison={schoolExecutiveRows} scope="escola" />
            </>
          )}

          {showsDetailedView &&
            (detailError ? (
              <section className="state-panel error">
                <FileWarning size={24} />
                <strong>{detailError}</strong>
              </section>
            ) : detailReady ? (
              <ComparisonTable rows={comparison} stateBenchmark={stateBenchmark} onExport={exportCsv} onPrint={printReport} />
            ) : (
              <section className="state-panel">
                <Database size={24} />
                <strong>Carregando detalhes da escola...</strong>
              </section>
            ))}
        </>
      )}
    </>
  );
}
