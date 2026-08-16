"use client";

import { useDeferredValue, useEffect, useMemo, useState } from "react";
import { CalendarRange, Database, FileWarning, Info } from "lucide-react";
import {
  buildDiagnosis,
  buildPriorities,
  buildSchoolOptions,
  buildSchoolStateComparison,
  buildStateBenchmark,
  CSV_BOM,
  filterRowsBySchoolQuery,
  formatSchoolLabel,
  makeComparison,
  makeExecutiveComparison,
  resolveCurrentSchoolIdentity,
  resolveExactSchoolCode,
  toCsv,
} from "@/lib/saresp/analysis";
import { BENCHMARK_LABEL_LONG, BENCHMARK_METHODOLOGY } from "@/lib/saresp/labels";
import type { FilterOptions, FilterState, RawRow } from "@/lib/saresp/types";
import ComparisonTable from "./ComparisonTable";
import Diagnosis from "./Diagnosis";
import EvolutionChart from "./EvolutionChart";
import Filters from "./Filters";
import Rankings from "./Rankings";
import ResultSummaryCards from "./ResultSummaryCards";
import SchoolVsState from "./SchoolVsState";
import StateOverview from "./StateOverview";

type SearchableRow = RawRow & { searchKey: string };

const INITIAL_FILTERS: FilterState = {
  school: "",
  series: "",
  component: "",
  period: "",
  year: "",
  network: "",
};

function uniqueOptions(rows: RawRow[], key: keyof RawRow): string[] {
  return [...new Set(rows.map((row) => String(row[key])).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));
}

function normalizeSearch(value: string): string {
  return value
    .toString()
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
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

async function loadJson(path: string, year: number): Promise<RawRow[]> {
  const response = await fetch(path);
  if (!response.ok) {
    throw new Error(`Não foi possível carregar ${path}`);
  }
  const rows = (await response.json()) as Omit<RawRow, "year">[];
  return rows.map((row) => ({ ...row, year }));
}

export default function SarespReport() {
  const [rows, setRows] = useState<SearchableRow[]>([]);
  const [filters, setFilters] = useState<FilterState>(INITIAL_FILTERS);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState("");

  useEffect(() => {
    async function loadData() {
      try {
        setLoading(true);
        const [data2024, data2025] = await Promise.all([loadJson("/data/saresp-2024.json", 2024), loadJson("/data/saresp-2025.json", 2025)]);
        // Precomputed once at load time — the school search filter runs on every keystroke, so it
        // must never recompute normalizeSearch() over ~150k rows per character typed.
        const combined = [...data2024, ...data2025].map((row) => ({ ...row, searchKey: normalizeSearch(row.nomesc) }));
        setRows(combined);
      } catch (loadError) {
        setError(loadError instanceof Error ? loadError.message : String(loadError));
      } finally {
        setLoading(false);
      }
    }

    loadData();
  }, []);

  // The <input> itself always reflects filters.school immediately (see Filters below), but every
  // derived computation reads the deferred value instead. This lets React keep the keystroke
  // responsive and only catch the (heavier) filtering/aggregation pipeline up afterwards, instead
  // of blocking the input on the full recompute every time a character is typed.
  const deferredSchool = useDeferredValue(filters.school);
  const isSearchPending = filters.school !== deferredSchool;
  const hasSchool = deferredSchool.trim() !== "";

  // Rows matching every filter except the school search — the state-wide baseline a chosen school
  // gets compared against, on the same series/component/period/network/year recorte.
  const stateRows = useMemo(() => {
    return rows.filter((row) => {
      if (filters.series && row.serieAno !== filters.series) return false;
      if (filters.component && row.componente !== filters.component) return false;
      if (filters.period && row.periodo !== filters.period) return false;
      if (filters.network && row.rede !== filters.network) return false;
      if (filters.year && filters.year !== "Comparativo" && row.year !== Number(filters.year)) return false;
      return true;
    });
  }, [rows, filters.series, filters.component, filters.period, filters.network, filters.year]);

  // Picking an exact datalist suggestion (label includes " — Cód. NNNN") resolves straight to that
  // school's codesc, so it can be selected individually even when another school shares its name —
  // free-typed partial text still falls back to the substring search below.
  const exactSchoolCode = useMemo(() => resolveExactSchoolCode(deferredSchool), [deferredSchool]);

  const filteredRows = useMemo(() => {
    if (exactSchoolCode) return stateRows.filter((row) => row.codesc === exactSchoolCode);
    return filterRowsBySchoolQuery(stateRows, normalizeSearch(deferredSchool));
  }, [stateRows, deferredSchool, exactSchoolCode]);

  const filteredCount = filteredRows.length;
  const matchedSchoolCodes = useMemo(() => new Set(filteredRows.map((row) => row.codesc)), [filteredRows]);
  const hasMatches = filteredRows.length > 0;
  const isSingleSchool = hasSchool && matchedSchoolCodes.size === 1;
  const isAmbiguousSchool = hasSchool && matchedSchoolCodes.size > 1;
  // Full identity (name + rede + região + código) of the resolved school — shown back to the user
  // so they can confirm they landed on the right one when the name alone was ambiguous. Uses the
  // school's CURRENT (most recent year) identity, not just filteredRows[0]: for a school renamed
  // between 2024 and 2025, the first matched row is always a 2024 row (array load order), which
  // would otherwise show a stale name even when the user searched by — or picked — the current one.
  const selectedSchoolLabel = useMemo(() => {
    if (!isSingleSchool) return null;
    const identity = resolveCurrentSchoolIdentity(filteredRows);
    return identity ? formatSchoolLabel(identity) : null;
  }, [isSingleSchool, filteredRows]);

  // Detailed layer (keeps período separate) — feeds only the table/export, per the analytical rule
  // that período detail may stay visible there without leaking into executive indicators.
  const comparison = useMemo(() => makeComparison(filteredRows), [filteredRows]);

  // Executive layer (período-deduped) — feeds every summary/ranking/chart/diagnosis.
  const stateExecutiveRows = useMemo(() => makeExecutiveComparison(stateRows), [stateRows]);
  const stateBenchmark = useMemo(() => buildStateBenchmark(stateExecutiveRows), [stateExecutiveRows]);
  const schoolExecutiveRows = useMemo(() => makeExecutiveComparison(filteredRows), [filteredRows]);
  // Gap/classification/diagnosis only make sense for a single resolved school — skip the work
  // entirely while the search still matches many schools (typing a partial name).
  const schoolStateRows = useMemo(
    () => (isSingleSchool ? buildSchoolStateComparison(schoolExecutiveRows, stateBenchmark) : []),
    [isSingleSchool, schoolExecutiveRows, stateBenchmark]
  );
  const diagnosis = useMemo(() => buildDiagnosis(schoolStateRows), [schoolStateRows]);
  const priorities = useMemo(() => buildPriorities(schoolStateRows), [schoolStateRows]);

  const options: FilterOptions = useMemo(
    () => ({
      schools: buildSchoolOptions(rows),
      series: uniqueOptions(rows, "serieAno"),
      components: uniqueOptions(rows, "componente"),
      periods: uniqueOptions(rows, "periodo"),
      networks: uniqueOptions(rows, "rede"),
    }),
    [rows]
  );

  function updateFilter(key: keyof FilterState, value: string) {
    setFilters((current) => ({ ...current, [key]: value }));
  }

  function exportCsv() {
    downloadFile("comparativo-saresp-filtrado.csv", `${CSV_BOM}${toCsv(comparison)}`, "text/csv;charset=utf-8");
  }

  function printReport() {
    const report = [
      "Relatório SARESP — Tempo Docente",
      filters.school ? `Escola: ${filters.school}` : "Recorte atual (múltiplas escolas)",
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
                <strong>{filteredCount}</strong>registros no recorte atual
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
          <span>Confira se os arquivos JSON estão em public/data.</span>
        </section>
      )}

      {!loading && !error && (
        <>
          <Filters filters={filters} options={options} onChange={updateFilter} onReset={() => setFilters(INITIAL_FILTERS)} searchPending={isSearchPending} />

          <p className="scope-note">
            <Info size={17} />
            Esta base cobre apenas 2º, 5º e 9º Ano do Ensino Fundamental — os CSVs de origem não trazem resultados de Ensino Médio. Desde 2023 o EM é
            avaliado pelo Provão Paulista Seriado, publicado separadamente e sem versão pré-agregada por escola equivalente à proficiência usada aqui.
          </p>

          <p className="scope-note">
            <Info size={17} />
            <strong>Como calculamos a {BENCHMARK_LABEL_LONG}:</strong> {BENCHMARK_METHODOLOGY}
          </p>

          {!hasSchool && <StateOverview comparison={stateExecutiveRows} />}

          {hasSchool && !hasMatches && (
            <p className="overview-hint">
              <FileWarning size={17} />
              Nenhuma escola encontrada para &quot;{filters.school}&quot;. Verifique o nome digitado.
            </p>
          )}

          {isSingleSchool && (
            <>
              {selectedSchoolLabel && (
                <p className="overview-hint">
                  <Database size={17} />
                  Escola selecionada: <strong>{selectedSchoolLabel}</strong>
                </p>
              )}
              <ResultSummaryCards rows={schoolExecutiveRows} />
              <SchoolVsState schoolLabel={filters.school} rows={schoolStateRows} />
              <EvolutionChart rows={schoolStateRows} />
              <Diagnosis diagnosis={diagnosis} priorities={priorities} />
              <Rankings comparison={schoolExecutiveRows} scope="escola" />
              <ComparisonTable rows={comparison} stateBenchmark={stateBenchmark} onExport={exportCsv} onPrint={printReport} />
            </>
          )}

          {isAmbiguousSchool && (
            <>
              <p className="overview-hint">
                <Database size={17} />
                Vários registros correspondem a &quot;{filters.school}&quot; — refine a busca para ver o relatório completo de uma única escola.
              </p>
              <ComparisonTable rows={comparison} stateBenchmark={stateBenchmark} onExport={exportCsv} onPrint={printReport} />
            </>
          )}
        </>
      )}
    </>
  );
}
