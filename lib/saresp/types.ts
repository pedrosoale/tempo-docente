export type Componente = string;
export type SerieAno = string;

// Row shape as it comes out of public/data/saresp-YYYY.json (see scripts/saresp/build-data.mjs).
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

// One picker entry per physical school (deduped by codesc — see buildSchoolOptions in
// lib/saresp/analysis.ts). `label` embeds codesc so two schools sharing a nomesc still resolve to
// distinct, individually selectable entries.
export interface SchoolOption {
  codesc: string;
  label: string;
}

export interface FilterOptions {
  schools: SchoolOption[];
  series: string[];
  components: string[];
  periods: string[];
  networks: string[];
}
