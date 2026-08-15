import type {
  Componente,
  DetailedRow,
  DiagnosisResult,
  ExecutiveRow,
  GroupAverageRow,
  Position,
  PositionKey,
  PriorityLabel,
  PriorityRow,
  RawRow,
  SchoolStateRow,
  StateBenchmark,
  Tone,
  Variation,
} from "./types";

export function average(values: Array<number | null | undefined>): number | null {
  const valid = values.filter((value): value is number => Number.isFinite(value as number));
  if (!valid.length) return null;
  return valid.reduce((sum, value) => sum + value, 0) / valid.length;
}

export function formatNumber(value: number | null | undefined, digits = 1): string {
  if (!Number.isFinite(value as number)) return "-";
  return (value as number).toLocaleString("pt-BR", {
    minimumFractionDigits: digits,
    maximumFractionDigits: digits,
  });
}

export function formatSigned(value: number | null | undefined, digits = 1): string {
  if (!Number.isFinite(value as number)) return "-";
  return `${(value as number) > 0 ? "+" : ""}${formatNumber(value, digits)}`;
}

export function toTitleCase(value: string): string {
  if (!value) return "";
  return value
    .toLocaleLowerCase("pt-BR")
    .split(" ")
    .map((word) => (word ? word[0].toLocaleUpperCase("pt-BR") + word.slice(1) : word))
    .join(" ");
}

interface Averageable {
  prof2024: number | null;
  prof2025: number | null;
  diff: number | null;
}

export function groupAverage<T extends Averageable & Record<string, unknown>>(
  rows: T[],
  key: keyof T
): GroupAverageRow[] {
  const groups = new Map<string, { name: string; prof2024: number[]; prof2025: number[]; diff: number[] }>();

  rows.forEach((row) => {
    const label = String(row[key] ?? "Nao informado") || "Nao informado";
    const current = groups.get(label) || { name: label, prof2024: [], prof2025: [], diff: [] };
    if (Number.isFinite(row.prof2024)) current.prof2024.push(row.prof2024 as number);
    if (Number.isFinite(row.prof2025)) current.prof2025.push(row.prof2025 as number);
    if (Number.isFinite(row.diff)) current.diff.push(row.diff as number);
    groups.set(label, current);
  });

  return [...groups.values()].map((group) => ({
    name: group.name,
    prof2024: average(group.prof2024),
    prof2025: average(group.prof2025),
    diff: average(group.diff),
  }));
}

export const VARIATION_THRESHOLD = 1;

// Central classifier for a school's own year-over-year change. A diff between -1 and +1 has no
// statistical backing to be called "stable", so it's labeled as a plain description instead.
export function classifyVariation(diff: number | null): Variation {
  if (!Number.isFinite(diff as number)) return { label: "Sem comparação", tone: "neutral" };
  if ((diff as number) > VARIATION_THRESHOLD) return { label: "Evolução positiva", tone: "positive" };
  if ((diff as number) < -VARIATION_THRESHOLD) return { label: "Evolução negativa", tone: "negative" };
  return { label: "Pequena variação", tone: "neutral" };
}

// Shared by makeComparison/makeExecutiveComparison — both pair prof2024/prof2025 into the same
// diff/percent/tone/statusLabel shape, just at a different grouping granularity.
function withVariation<T extends { prof2024: number | null; prof2025: number | null }>(
  item: T
): T & { diff: number | null; percent: number | null; tone: Tone; statusLabel: string } {
  const diff =
    Number.isFinite(item.prof2024 as number) && Number.isFinite(item.prof2025 as number)
      ? (item.prof2025 as number) - (item.prof2024 as number)
      : null;
  const percent = Number.isFinite(diff as number) && item.prof2024 !== 0 ? ((diff as number) / (item.prof2024 as number)) * 100 : null;
  const variation = classifyVariation(diff);

  return { ...item, diff, percent, tone: variation.tone, statusLabel: variation.label };
}

// Detailed comparison: groups by codesc|serieAno|periodo|componente, so GERAL/MANHÃ/TARDE/NOITE
// stay as separate rows. Feeds ONLY the detailed table, filters and CSV export — every executive
// indicator (cards, rankings, charts, diagnosis) must go through makeExecutiveComparison instead,
// otherwise a school with both a GERAL and a TARDE record for the same result gets counted twice.
export function makeComparison(rows: RawRow[]): DetailedRow[] {
  const groups = new Map<
    string,
    {
      codesc: string;
      nomesc: string;
      serieAno: string;
      periodo: string;
      componente: Componente;
      rede: string;
      prof2024: number | null;
      prof2025: number | null;
    }
  >();

  rows.forEach((row) => {
    const key = [row.codesc, row.serieAno, row.periodo, row.componente].join("|");
    const current = groups.get(key) || {
      codesc: row.codesc,
      nomesc: row.nomesc,
      serieAno: row.serieAno,
      periodo: row.periodo,
      componente: row.componente,
      rede: row.rede,
      prof2024: null,
      prof2025: null,
    };

    if (row.year === 2024) current.prof2024 = row.medprof;
    if (row.year === 2025) current.prof2025 = row.medprof;
    groups.set(key, current);
  });

  return [...groups.values()]
    .map((item) => withVariation(item))
    .filter((item) => Number.isFinite(item.prof2024 as number) || Number.isFinite(item.prof2025 as number));
}

// Picks one canonical proficiency value for a codesc|serieAno|componente|year group. GERAL is a
// genuine school-wide aggregate (verified: it equals the single período when only one exists, and
// is not a naive mean of MANHÃ+TARDE when several exist), so it's preferred whenever present —
// this is what keeps a school from being counted once per período for the same underlying result.
function dedupeByPeriodo(rawRowsForKey: RawRow[]): number | null {
  const geral = rawRowsForKey.find((row) => row.periodo === "GERAL");
  if (geral) return geral.medprof;
  if (rawRowsForKey.length === 1) return rawRowsForKey[0].medprof;
  return average(rawRowsForKey.map((row) => row.medprof));
}

// Executive comparison: one row per codesc|serieAno|componente (no período dimension), built from
// deduped raw rows. This is the layer every indicator (summary cards, rankings, charts, gap,
// diagnosis, priorities) must be built on top of — never the raw/detailed rows.
export function makeExecutiveComparison(rawRows: RawRow[]): ExecutiveRow[] {
  const byYearGroup = new Map<string, RawRow[]>();

  rawRows.forEach((row) => {
    const key = [row.codesc, row.serieAno, row.componente, row.year].join("|");
    const list = byYearGroup.get(key) || [];
    list.push(row);
    byYearGroup.set(key, list);
  });

  const paired = new Map<
    string,
    { codesc: string; nomesc: string; serieAno: string; componente: Componente; rede: string; prof2024: number | null; prof2025: number | null }
  >();

  byYearGroup.forEach((rowsForKey, key) => {
    const [codesc, serieAno, componente, yearStr] = key.split("|");
    const year = Number(yearStr);
    const medprof = dedupeByPeriodo(rowsForKey);
    const pairKey = [codesc, serieAno, componente].join("|");
    const current = paired.get(pairKey) || {
      codesc,
      nomesc: rowsForKey[0].nomesc,
      serieAno,
      componente,
      rede: rowsForKey[0].rede,
      prof2024: null,
      prof2025: null,
    };

    if (year === 2024) current.prof2024 = medprof;
    if (year === 2025) current.prof2025 = medprof;
    paired.set(pairKey, current);
  });

  return [...paired.values()]
    .map((item) => withVariation(item))
    .filter((item) => Number.isFinite(item.prof2024 as number) || Number.isFinite(item.prof2025 as number));
}

// State-wide benchmark, aggregated from the executive (already deduped) layer so it isn't itself
// inflated by GERAL+TARDE double counting. Keyed by serieAno+componente — never blended across
// componentes, and never averaged together with a different série.
export function buildStateBenchmark(executiveRows: ExecutiveRow[]): StateBenchmark {
  const groups = new Map<string, { serieAno: string; componente: Componente; prof2024: number[]; prof2025: number[] }>();

  executiveRows.forEach((row) => {
    const key = [row.serieAno, row.componente].join("|");
    const current = groups.get(key) || { serieAno: row.serieAno, componente: row.componente, prof2024: [], prof2025: [] };
    if (Number.isFinite(row.prof2024)) current.prof2024.push(row.prof2024 as number);
    if (Number.isFinite(row.prof2025)) current.prof2025.push(row.prof2025 as number);
    groups.set(key, current);
  });

  const benchmark: StateBenchmark = new Map();
  groups.forEach((group, key) => {
    benchmark.set(key, {
      serieAno: group.serieAno,
      componente: group.componente,
      prof2024: average(group.prof2024),
      prof2025: average(group.prof2025),
      schoolCount2024: group.prof2024.length,
      schoolCount2025: group.prof2025.length,
    });
  });

  return benchmark;
}

// CSS class per classification key — co-located with classifySchoolPosition so the two never drift apart.
export const POSITION_BADGE_CLASS: Record<PositionKey, string> = {
  DESTAQUE: "tone-destaque",
  RECUPERACAO: "tone-recuperacao",
  ATENCAO: "tone-atencao",
  PRIORIDADE: "tone-prioridade",
  SEM_REFERENCIA: "tone-sem-referencia",
  SEM_EVOLUCAO: "tone-sem-referencia",
};

// Central 4-bucket classifier: position vs. the state benchmark crossed with the school's own
// evolution, within the SAME componente+série — never Português vs. Matemática absolute scores.
export function classifySchoolPosition({
  schoolDiff,
  gap2024,
  gap2025,
}: {
  schoolDiff: number | null;
  gap2024: number | null;
  gap2025: number | null;
}): Position {
  if (!Number.isFinite(gap2025 as number)) {
    return { label: "Sem referência estadual", key: "SEM_REFERENCIA", tone: "neutral" };
  }

  // Posição vs. Estado é conhecida, mas não há par 2024/2025 da escola (ex.: série nova em 2025) —
  // não dá para falar em "evolução" nem "recuperação" sem dado do ano anterior (Regra 4: separar
  // desempenho atual de evolução).
  if (!Number.isFinite(schoolDiff as number)) {
    return {
      label: (gap2025 as number) > 0 ? "Acima do Estado, sem comparação anual" : "Abaixo do Estado, sem comparação anual",
      key: "SEM_EVOLUCAO",
      tone: "neutral",
    };
  }

  const gapChange = Number.isFinite(gap2024 as number) ? (gap2025 as number) - (gap2024 as number) : null;
  const aboveState = (gap2025 as number) > 0;
  const grew = (schoolDiff as number) > VARIATION_THRESHOLD;
  const fell = (schoolDiff as number) < -VARIATION_THRESHOLD;
  const gapNarrowed = Number.isFinite(gapChange as number) && (gapChange as number) > VARIATION_THRESHOLD;
  const gapWidenedAgainstSchool = Number.isFinite(gapChange as number) && (gapChange as number) < -VARIATION_THRESHOLD;

  if (aboveState) {
    return fell || gapWidenedAgainstSchool
      ? { label: "Atenção", key: "ATENCAO", tone: "attention" }
      : { label: "Destaque", key: "DESTAQUE", tone: "positive" };
  }

  if (grew || gapNarrowed) return { label: "Em recuperação", key: "RECUPERACAO", tone: "info" };
  if (fell || gapWidenedAgainstSchool) return { label: "Prioridade de análise", key: "PRIORIDADE", tone: "negative" };

  // Abaixo do Estado, mas sem sinal claro de piora (nem crescimento nem gap widening) — tratado com
  // cautela como "Em recuperação" em vez de "Prioridade", para não superestimar um sinal que não existe.
  return { label: "Em recuperação", key: "RECUPERACAO", tone: "info" };
}

// One row per componente+série for the selected school: school values, state benchmark values,
// gap in each year, gap change, and the position classification above.
export function buildSchoolStateComparison(schoolExecutiveRows: ExecutiveRow[], stateBenchmark: StateBenchmark): SchoolStateRow[] {
  return schoolExecutiveRows.map((row) => {
    const state = stateBenchmark.get(`${row.serieAno}|${row.componente}`);
    const hasStateReference = Boolean(state && (Number.isFinite(state.prof2024 as number) || Number.isFinite(state.prof2025 as number)));

    const stateDiff =
      hasStateReference && Number.isFinite(state?.prof2024 as number) && Number.isFinite(state?.prof2025 as number)
        ? (state as StateBenchmarkEntryLike).prof2025! - (state as StateBenchmarkEntryLike).prof2024!
        : null;

    const gap2024 =
      hasStateReference && Number.isFinite(row.prof2024 as number) && Number.isFinite(state?.prof2024 as number)
        ? (row.prof2024 as number) - (state as StateBenchmarkEntryLike).prof2024!
        : null;
    const gap2025 =
      hasStateReference && Number.isFinite(row.prof2025 as number) && Number.isFinite(state?.prof2025 as number)
        ? (row.prof2025 as number) - (state as StateBenchmarkEntryLike).prof2025!
        : null;
    const gapChange = Number.isFinite(gap2024 as number) && Number.isFinite(gap2025 as number) ? (gap2025 as number) - (gap2024 as number) : null;

    const position = classifySchoolPosition({ schoolDiff: row.diff, gap2024, gap2025 });

    return {
      ...row,
      state2024: state?.prof2024 ?? null,
      state2025: state?.prof2025 ?? null,
      stateDiff,
      gap2024,
      gap2025,
      gapChange,
      hasStateReference,
      position,
    };
  });
}

type StateBenchmarkEntryLike = { prof2024: number | null; prof2025: number | null };

// Prose builder for the Diagnóstico narrative. Deliberately NOT reused for the Priorities table's
// "Evidência" column (see summarizeEvidence below) — reusing the same sentence in both places made
// every row read identically twice, once as a bullet and once as a table row. Never states a
// cause — only describes what the numbers show.
function describeSchoolResult(row: SchoolStateRow): string {
  const componente = toTitleCase(row.componente);
  const direction = (row.diff as number) >= 0 ? "avanço" : "queda";
  const base = `${componente} no ${row.serieAno} passou de ${formatNumber(row.prof2024)} para ${formatNumber(row.prof2025)} pontos, ${direction} de ${formatNumber(Math.abs(row.diff as number))} pontos.`;

  if (!row.hasStateReference) return base;

  if ((row.gap2024 as number) < 0 && (row.gap2025 as number) >= 0) {
    return `${base} A escola passou de ${formatNumber(Math.abs(row.gap2024 as number))} pontos abaixo da média estadual em 2024 para ${formatNumber(row.gap2025)} pontos acima em 2025.`;
  }

  if ((row.gap2025 as number) < 0 && Number.isFinite(row.gapChange as number) && (row.gapChange as number) > VARIATION_THRESHOLD) {
    return `${base} A escola reduziu a distância para a média estadual em ${formatNumber(row.gapChange)} pontos, mas o resultado permanece ${formatNumber(Math.abs(row.gap2025 as number))} pontos abaixo da média estadual.`;
  }

  if ((row.gap2025 as number) < 0) {
    return `${base} O resultado permanece ${formatNumber(Math.abs(row.gap2025 as number))} pontos abaixo da média estadual.`;
  }

  if (Number.isFinite(row.stateDiff as number) && (row.diff as number) > (row.stateDiff as number)) {
    return `${base} A evolução da escola foi superior à observada no Estado.`;
  }

  return base;
}

// "Diagnóstico dos resultados": two prose buckets. Rows without a state reference are still
// classified by their own evolution sign so they aren't silently dropped from the diagnosis.
export function buildDiagnosis(schoolStateRows: SchoolStateRow[]): DiagnosisResult {
  const destaques: string[] = [];
  const pontosDeAtencao: string[] = [];

  schoolStateRows.forEach((row) => {
    if (!Number.isFinite(row.diff as number)) return;

    const sentence = describeSchoolResult(row);
    const key: PositionKey = row.hasStateReference ? row.position.key : row.tone === "negative" ? "ATENCAO" : "DESTAQUE";

    if (key === "DESTAQUE" || key === "RECUPERACAO") {
      destaques.push(sentence);
    } else if (key === "ATENCAO") {
      pontosDeAtencao.push(`${sentence} Este resultado merece investigação.`);
    } else {
      pontosDeAtencao.push(sentence);
    }
  });

  return { destaques, pontosDeAtencao };
}

// Compact fact for the Priorities table — a scannable number, not a repeat of the Diagnóstico
// sentence. The table's job is to index/sort by priority; the prose above already explains why.
function summarizeEvidence(row: SchoolStateRow): string {
  const parts = [`Variação: ${formatSigned(row.diff)} pts`];
  if (Number.isFinite(row.gap2025 as number)) {
    parts.push(`Gap para o Estado: ${formatSigned(row.gap2025)} pts`);
  }
  return parts.join(" · ");
}

const PRIORITY_LABEL: Record<PositionKey, PriorityLabel | undefined> = {
  PRIORIDADE: "ALTA",
  ATENCAO: "ATENÇÃO",
  RECUPERACAO: "MONITORAR",
  DESTAQUE: "DESTAQUE",
  SEM_REFERENCIA: undefined,
  SEM_EVOLUCAO: undefined,
};
const PRIORITY_ORDER: Record<PriorityLabel, number> = { ALTA: 0, "ATENÇÃO": 1, MONITORAR: 2, DESTAQUE: 3 };

// "Prioridades para análise" table. Only rows with a state reference are shown — nothing is
// fabricated when the benchmark for that recorte doesn't exist.
export function buildPriorities(schoolStateRows: SchoolStateRow[]): PriorityRow[] {
  return schoolStateRows
    .filter((row) => row.hasStateReference && Number.isFinite(row.diff as number))
    .map((row) => ({
      key: row.position.key,
      priority: PRIORITY_LABEL[row.position.key] as PriorityLabel,
      serieAno: row.serieAno,
      componente: row.componente,
      situacao: row.position.label,
      evidencia: summarizeEvidence(row),
      tone: row.position.tone,
    }))
    .sort((a, b) => PRIORITY_ORDER[a.priority] - PRIORITY_ORDER[b.priority]);
}

// CSV export for the "Exportar CSV" button — operates on the detailed (período-inclusive) rows.
export function toCsv(rows: DetailedRow[]): string {
  const headers = ["Escola", "Serie/Ano", "Componente", "Periodo", "Rede", "Prof 2024", "Prof 2025", "Diferenca", "Variacao %", "Status"];
  const escape = (value: unknown) => `"${String(value ?? "").replaceAll('"', '""')}"`;
  const body = rows.map((row) =>
    [row.nomesc, row.serieAno, row.componente, row.periodo, row.rede, row.prof2024 ?? "", row.prof2025 ?? "", row.diff ?? "", row.percent ?? "", row.statusLabel]
      .map(escape)
      .join(";")
  );

  return [headers.join(";"), ...body].join("\n");
}
