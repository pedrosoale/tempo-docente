export type Componente = string;
export type SerieAno = string;

// Canonical in-memory row shape used throughout lib/saresp/analysis.ts. On the wire this is now
// split across three partitioned artifacts (see scripts/saresp/build-data.mjs and
// public/data/saresp/): SchoolIdentity (codesc/nomesc/rede/codrmet) + SchoolDetailRow
// (year/serieAno/periodo/componente/medprof) per school, joined back into a full RawRow client-side
// when a school's detail partition is fetched.
export interface RawRow {
  year: number;
  rede: string;
  // "Código da Região Metropolitana" per the official SEDUC-SP data dictionary — a coarse
  // geographic grouping (opaque numeric code, no public name lookup shipped with this CSV
  // export). Used only to help disambiguate schools that share a name; codesc is the real
  // unique identifier.
  codrmet: string;
  codesc: string;
  nomesc: string;
  serieAno: SerieAno;
  periodo: string;
  componente: Componente;
  medprof: number;
}

export type Tone = "positive" | "negative" | "neutral";

export interface Variation {
  label: string;
  tone: Tone;
}

interface ComparisonBase {
  codesc: string;
  // See RawRow.codrmet — carried through so exports (toCsv) and the UI can show it alongside
  // codesc without a separate lookup back into the raw rows.
  codrmet: string;
  nomesc: string;
  serieAno: SerieAno;
  componente: Componente;
  rede: string;
  prof2024: number | null;
  prof2025: number | null;
  diff: number | null;
  percent: number | null;
  tone: Tone;
  statusLabel: string;
}

// makeComparison() output — keeps período separate, feeds only the detailed table/export.
export interface DetailedRow extends ComparisonBase {
  periodo: string;
}

// makeExecutiveComparison() output — one row per codesc|serieAno|componente, período deduped away.
// Feeds every summary/ranking/chart/diagnosis indicator.
export type ExecutiveRow = ComparisonBase;

export interface StateBenchmarkEntry {
  serieAno: SerieAno;
  componente: Componente;
  prof2024: number | null;
  prof2025: number | null;
  schoolCount2024: number;
  schoolCount2025: number;
}

export type StateBenchmark = Map<string, StateBenchmarkEntry>;

export type PositionKey =
  | "DESTAQUE"
  | "RECUPERACAO"
  | "ATENCAO"
  | "PRIORIDADE"
  | "SEM_REFERENCIA"
  | "SEM_EVOLUCAO";

export type PositionTone = "positive" | "negative" | "neutral" | "attention" | "info";

export interface Position {
  label: string;
  key: PositionKey;
  tone: PositionTone;
}

// buildSchoolStateComparison() output — one row per componente+série for the selected school,
// with the state benchmark, gap in each year and the 4-bucket classification.
export interface SchoolStateRow extends ExecutiveRow {
  state2024: number | null;
  state2025: number | null;
  stateDiff: number | null;
  gap2024: number | null;
  gap2025: number | null;
  gapChange: number | null;
  hasStateReference: boolean;
  position: Position;
}

export interface DiagnosisResult {
  destaques: string[];
  pontosDeAtencao: string[];
}

export type PriorityLabel = "ALTA" | "ATENÇÃO" | "MONITORAR" | "DESTAQUE";

export interface PriorityRow {
  key: PositionKey;
  priority: PriorityLabel;
  serieAno: SerieAno;
  componente: Componente;
  situacao: string;
  evidencia: string;
  tone: PositionTone;
}

export interface GroupAverageRow {
  name: string;
  prof2024: number | null;
  prof2025: number | null;
  diff: number | null;
}

export interface FilterState {
  school: string;
  series: string;
  component: string;
  period: string;
  year: string;
  network: string;
}

// One entry per physical school (deduped by codesc, most-recent-year identity — see
// buildSchoolIndex in lib/saresp/analysis.ts). This is the wire shape of
// public/data/saresp/schools-index.json, and also what formatSchoolLabel/SchoolCombobox consume
// directly — no separate pre-formatted "label" field, callers format on demand.
export interface SchoolIdentity {
  codesc: string;
  nomesc: string;
  rede: string;
  codrmet: string;
}

// SchoolIdentity plus a precomputed, normalized searchKey (see normalizeSearch/withSearchKey in
// lib/saresp/analysis.ts) — SarespReport.tsx builds this array once when schools-index.json (and
// schools-aliases.json) finish loading, so SchoolCombobox's matching runs on every keystroke
// without re-normalizing ~9.760 school names each time.
export interface SearchableIdentity extends SchoolIdentity {
  searchKey: string;
}

// Wire shape of public/data/saresp/schools-aliases.json — codesc -> that school's historical
// (non-current) names, present only for the ~52 of 9.760 schools whose nomesc actually differs
// between years (see buildSchoolAliases in lib/saresp/analysis.ts). Kept separate from
// SchoolIdentity/schools-index.json so the ~9.708 never-renamed schools don't each carry a
// searchKey-sized field just to cover the rare case.
export type SchoolAliasesMap = Record<string, string[]>;

export interface FilterOptions {
  schools: SearchableIdentity[];
  series: string[];
  components: string[];
  periods: string[];
  networks: string[];
}

// Wire shape of public/data/saresp/executive*.json — the ExecutiveRow shape minus the fields
// withVariation derives (diff/percent/tone/statusLabel), which the client recomputes after fetch.
// Precomputed at build time by calling makeExecutiveComparison for real (see
// scripts/saresp/build-data.mjs), so the client never has to run it over the raw 150k+ rows again.
export type ExecutiveRowSeed = Omit<ExecutiveRow, "diff" | "percent" | "tone" | "statusLabel">;

// Wire shape of public/data/saresp/schools/<codesc>.json — one school's raw rows (both years, every
// período), trimmed to only what's not already recoverable from the codesc (the fetch key) and the
// already-loaded SchoolIdentity (nomesc/rede/codrmet). Rehydrated back into RawRow client-side by
// joining those two back in (see the detail-fetch effect in SarespReport.tsx).
export interface SchoolDetailRow {
  year: number;
  serieAno: SerieAno;
  periodo: string;
  componente: Componente;
  medprof: number;
}
