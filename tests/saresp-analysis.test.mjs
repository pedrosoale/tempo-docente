import assert from "node:assert/strict";
import test from "node:test";
import {
  buildDiagnosis,
  buildPriorities,
  buildSchoolAliases,
  buildSchoolIndex,
  buildSchoolStateComparison,
  buildStateBenchmark,
  classifySchoolPosition,
  CSV_BOM,
  formatSchoolLabel,
  makeComparison,
  makeExecutiveComparison,
  matchSchoolIndex,
  normalizeSearch,
  restrictToYear,
  toCsv,
  withSearchKey,
  withVariation,
} from "../lib/saresp/analysis.ts";
import { BENCHMARK_METHODOLOGY } from "../lib/saresp/labels.ts";

// Minimal RawRow factory — every test overrides only the fields it cares about, keeping each
// scenario's actual intent legible instead of buried in boilerplate.
function row(overrides = {}) {
  return {
    year: 2024,
    rede: "Rede Estadual",
    codrmet: "1",
    codesc: "100",
    nomesc: "ESCOLA TESTE",
    serieAno: "5º Ano EF",
    periodo: "GERAL",
    componente: "LÍNGUA PORTUGUESA",
    medprof: 200,
    ...overrides,
  };
}

// --- Período dedup: GERAL preference and fallback --------------------------------------------

test("prefers the GERAL period record over período-specific records when both exist", () => {
  const rows = [
    row({ periodo: "MANHÃ", medprof: 180 }),
    row({ periodo: "TARDE", medprof: 220 }),
    row({ periodo: "GERAL", medprof: 205 }),
  ];

  const [executive] = makeExecutiveComparison(rows);
  assert.equal(executive.prof2024, 205);
});

test("falls back to averaging período-specific records when GERAL is absent", () => {
  const rows = [row({ periodo: "MANHÃ", medprof: 180 }), row({ periodo: "TARDE", medprof: 220 })];

  const [executive] = makeExecutiveComparison(rows);
  assert.equal(executive.prof2024, 200);
});

test("falls back to the single período record when only one exists and GERAL is absent", () => {
  const rows = [row({ periodo: "TARDE", medprof: 214.7 })];

  const [executive] = makeExecutiveComparison(rows);
  assert.equal(executive.prof2024, 214.7);
});

// --- 2024x2025 pairing --------------------------------------------------------------------------

test("pairs 2024 and 2025 records for the same escola/série/componente into one executive row", () => {
  const rows = [row({ year: 2024, medprof: 200 }), row({ year: 2025, medprof: 215 })];

  const executive = makeExecutiveComparison(rows);
  assert.equal(executive.length, 1);
  assert.equal(executive[0].prof2024, 200);
  assert.equal(executive[0].prof2025, 215);
  assert.equal(executive[0].diff, 15);
  assert.equal(executive[0].tone, "positive");
});

test("keeps a result when only one year has data, without fabricating the missing year", () => {
  const rows = [row({ year: 2024, medprof: 200 })];

  const [executive] = makeExecutiveComparison(rows);
  assert.equal(executive.prof2024, 200);
  assert.equal(executive.prof2025, null);
  assert.equal(executive.diff, null);
  assert.equal(executive.tone, "neutral");
  assert.equal(executive.statusLabel, "Sem comparação");
});

test("never blends Língua Portuguesa and Matemática into the same comparison row", () => {
  const rows = [
    row({ componente: "LÍNGUA PORTUGUESA", medprof: 200 }),
    row({ componente: "MATEMÁTICA", medprof: 260 }),
  ];

  const executive = makeExecutiveComparison(rows);
  assert.equal(executive.length, 2);
  assert.deepEqual(
    executive.map((item) => item.componente).sort(),
    ["LÍNGUA PORTUGUESA", "MATEMÁTICA"]
  );
});

// --- Benchmark por componente e série ------------------------------------------------------------

test("computes the benchmark separately per componente and série — never blended across either", () => {
  const rows = [
    row({ codesc: "1", serieAno: "5º Ano EF", componente: "LÍNGUA PORTUGUESA", medprof: 100 }),
    row({ codesc: "2", serieAno: "5º Ano EF", componente: "LÍNGUA PORTUGUESA", medprof: 200 }),
    row({ codesc: "1", serieAno: "9º Ano EF", componente: "LÍNGUA PORTUGUESA", medprof: 400 }),
    row({ codesc: "1", serieAno: "5º Ano EF", componente: "MATEMÁTICA", medprof: 900 }),
  ];

  const benchmark = buildStateBenchmark(makeExecutiveComparison(rows));

  assert.equal(benchmark.get("5º Ano EF|LÍNGUA PORTUGUESA").prof2024, 150);
  assert.equal(benchmark.get("5º Ano EF|LÍNGUA PORTUGUESA").schoolCount2024, 2);
  assert.equal(benchmark.get("9º Ano EF|LÍNGUA PORTUGUESA").prof2024, 400);
  assert.equal(benchmark.get("5º Ano EF|MATEMÁTICA").prof2024, 900);
});

// --- Benchmark e o filtro de rede: sem filtro mistura redes, filtrado isola uma rede ------------
// Mirrors what SarespReport.tsx actually does: `filters.network` filters `stateRows` BEFORE they
// reach makeExecutiveComparison/buildStateBenchmark — buildStateBenchmark itself has no rede
// concept, it just averages whatever executive rows it's given. These tests exercise the three
// real recortes the UI can produce, matching what BENCHMARK_METHODOLOGY (lib/saresp/labels.ts)
// now documents: no rede filter blends every network into one average.

test("recorte sem filtro de rede mistura Rede Estadual e Rede Municipal no mesmo benchmark", () => {
  const rows = [
    row({ codesc: "1", rede: "Rede Estadual", medprof: 100, year: 2024 }),
    row({ codesc: "2", rede: "Rede Municipal", medprof: 200, year: 2024 }),
  ];

  const benchmark = buildStateBenchmark(makeExecutiveComparison(rows));
  const entry = benchmark.get("5º Ano EF|LÍNGUA PORTUGUESA");

  assert.equal(entry.prof2024, 150); // (100 + 200) / 2 — both redes blended
  assert.equal(entry.schoolCount2024, 2);
});

test("recorte filtrado por Rede Estadual usa só escolas estaduais no benchmark", () => {
  const allRows = [
    row({ codesc: "1", rede: "Rede Estadual", medprof: 100, year: 2024 }),
    row({ codesc: "2", rede: "Rede Municipal", medprof: 200, year: 2024 }),
  ];
  const filteredByRede = allRows.filter((r) => r.rede === "Rede Estadual"); // mirrors filters.network

  const benchmark = buildStateBenchmark(makeExecutiveComparison(filteredByRede));
  const entry = benchmark.get("5º Ano EF|LÍNGUA PORTUGUESA");

  assert.equal(entry.prof2024, 100);
  assert.equal(entry.schoolCount2024, 1);
});

test("recorte filtrado por Rede Municipal usa só escolas municipais no benchmark", () => {
  const allRows = [
    row({ codesc: "1", rede: "Rede Estadual", medprof: 100, year: 2024 }),
    row({ codesc: "2", rede: "Rede Municipal", medprof: 200, year: 2024 }),
  ];
  const filteredByRede = allRows.filter((r) => r.rede === "Rede Municipal");

  const benchmark = buildStateBenchmark(makeExecutiveComparison(filteredByRede));
  const entry = benchmark.get("5º Ano EF|LÍNGUA PORTUGUESA");

  assert.equal(entry.prof2024, 200);
  assert.equal(entry.schoolCount2024, 1);
});

test("BENCHMARK_METHODOLOGY explains rede is only applied when filtered, and that 'Todos' blends every rede", () => {
  assert.match(BENCHMARK_METHODOLOGY, /rede, quando filtrada/);
  assert.match(BENCHMARK_METHODOLOGY, /Todos/);
  assert.match(BENCHMARK_METHODOLOGY, /mistura escolas.*de todas as redes/);
});

// --- Gaps and gap variation ------------------------------------------------------------------

test("computes gap2024, gap2025 and gapChange against the recorte benchmark", () => {
  const rawRows = [
    row({ codesc: "1", medprof: 190, year: 2024 }),
    row({ codesc: "1", medprof: 230, year: 2025 }),
    row({ codesc: "2", medprof: 210, year: 2024 }),
    row({ codesc: "2", medprof: 210, year: 2025 }),
  ];

  const executive = makeExecutiveComparison(rawRows);
  const benchmark = buildStateBenchmark(executive);
  const school = executive.filter((item) => item.codesc === "1");
  const [comparison] = buildSchoolStateComparison(school, benchmark);

  // Benchmark (simple mean of codesc 1 and 2): 2024 = (190+210)/2 = 200, 2025 = (230+210)/2 = 220.
  assert.equal(comparison.state2024, 200);
  assert.equal(comparison.state2025, 220);
  assert.equal(comparison.gap2024, -10); // 190 - 200
  assert.equal(comparison.gap2025, 10); // 230 - 220
  assert.equal(comparison.gapChange, 20); // 10 - (-10)
});

// --- Position classification ------------------------------------------------------------------

test("classifySchoolPosition: DESTAQUE — above the recorte and growing", () => {
  const position = classifySchoolPosition({ schoolDiff: 3, gap2024: 2, gap2025: 5 });
  assert.equal(position.key, "DESTAQUE");
});

test("classifySchoolPosition: ATENCAO — above the recorte but the school itself fell", () => {
  const position = classifySchoolPosition({ schoolDiff: -3, gap2024: 2, gap2025: 5 });
  assert.equal(position.key, "ATENCAO");
});

test("classifySchoolPosition: ATENCAO — above the recorte, flat, but the gap widened against the school", () => {
  const position = classifySchoolPosition({ schoolDiff: 0.5, gap2024: 9, gap2025: 5 });
  assert.equal(position.key, "ATENCAO");
});

test("classifySchoolPosition: RECUPERACAO — below the recorte but growing", () => {
  const position = classifySchoolPosition({ schoolDiff: 3, gap2024: -8, gap2025: -5 });
  assert.equal(position.key, "RECUPERACAO");
});

test("classifySchoolPosition: RECUPERACAO — below the recorte, flat, but the gap narrowed", () => {
  const position = classifySchoolPosition({ schoolDiff: 0.5, gap2024: -8, gap2025: -3 });
  assert.equal(position.key, "RECUPERACAO");
});

test("classifySchoolPosition: PRIORIDADE — below the recorte and falling", () => {
  const position = classifySchoolPosition({ schoolDiff: -3, gap2024: -5, gap2025: -5 });
  assert.equal(position.key, "PRIORIDADE");
});

test("classifySchoolPosition: RECUPERACAO fallback — below the recorte with no clear worsening signal", () => {
  const position = classifySchoolPosition({ schoolDiff: 0.5, gap2024: -5, gap2025: -5 });
  assert.equal(position.key, "RECUPERACAO");
});

test("classifySchoolPosition: SEM_REFERENCIA when the recorte has no benchmark for this cut", () => {
  const position = classifySchoolPosition({ schoolDiff: 3, gap2024: null, gap2025: null });
  assert.equal(position.key, "SEM_REFERENCIA");
});

test("classifySchoolPosition: SEM_EVOLUCAO when the school has no prior-year pair, never guesses evolution", () => {
  const above = classifySchoolPosition({ schoolDiff: null, gap2024: null, gap2025: 5 });
  assert.equal(above.key, "SEM_EVOLUCAO");
  assert.match(above.label, /Acima/);

  const below = classifySchoolPosition({ schoolDiff: null, gap2024: null, gap2025: -5 });
  assert.equal(below.key, "SEM_EVOLUCAO");
  assert.match(below.label, /Abaixo/);
});

// --- Diagnósticos e prioridades --------------------------------------------------------------

test("buildDiagnosis and buildPriorities bucket a full school×recorte comparison correctly", () => {
  const rawRows = [
    // Componente 1: escola cresce acima do recorte -> DESTAQUE.
    row({ codesc: "1", componente: "LÍNGUA PORTUGUESA", medprof: 220, year: 2024 }),
    row({ codesc: "1", componente: "LÍNGUA PORTUGUESA", medprof: 240, year: 2025 }),
    row({ codesc: "2", componente: "LÍNGUA PORTUGUESA", medprof: 200, year: 2024 }),
    row({ codesc: "2", componente: "LÍNGUA PORTUGUESA", medprof: 200, year: 2025 }),
    // Componente 2: escola cai abaixo do recorte e piora -> PRIORIDADE.
    row({ codesc: "1", componente: "MATEMÁTICA", medprof: 210, year: 2024 }),
    row({ codesc: "1", componente: "MATEMÁTICA", medprof: 195, year: 2025 }),
    row({ codesc: "2", componente: "MATEMÁTICA", medprof: 250, year: 2024 }),
    row({ codesc: "2", componente: "MATEMÁTICA", medprof: 250, year: 2025 }),
  ];

  const executive = makeExecutiveComparison(rawRows);
  const benchmark = buildStateBenchmark(executive);
  const schoolRows = buildSchoolStateComparison(
    executive.filter((item) => item.codesc === "1"),
    benchmark
  );

  const diagnosis = buildDiagnosis(schoolRows);
  assert.equal(diagnosis.destaques.length, 1);
  assert.equal(diagnosis.pontosDeAtencao.length, 1);
  assert.match(diagnosis.destaques[0], /avanço/);
  assert.match(diagnosis.pontosDeAtencao[0], /queda/);

  const priorities = buildPriorities(schoolRows);
  assert.equal(priorities.length, 2);
  assert.equal(priorities[0].priority, "ALTA"); // PRIORIDADE sorts first
  assert.equal(priorities[0].componente, "MATEMÁTICA");
  assert.equal(priorities[1].priority, "DESTAQUE");
  assert.equal(priorities[1].componente, "LÍNGUA PORTUGUESA");
});

// --- CSV export -----------------------------------------------------------------------------

test("toCsv exports headers (including Codigo/Regiao) and escapes fields containing the delimiter/quotes", () => {
  const detailed = makeComparison([
    row({ nomesc: 'ESCOLA "TESTE"; LTDA', codesc: "42", codrmet: "3", year: 2024, medprof: 200 }),
    row({ nomesc: 'ESCOLA "TESTE"; LTDA', codesc: "42", codrmet: "3", year: 2025, medprof: 215 }),
  ]);

  const csv = toCsv(detailed);
  const [header, dataLine] = csv.split("\n");

  assert.equal(header, "Escola;Codigo;Regiao;Serie/Ano;Componente;Periodo;Rede;Prof 2024;Prof 2025;Diferenca;Variacao %;Status");
  assert.match(dataLine, /"ESCOLA ""TESTE""; LTDA"/);
  assert.match(dataLine, /"42"/);
  assert.match(dataLine, /"3"/);
  assert.match(dataLine, /200/);
  assert.match(dataLine, /215/);
});

test("toCsv keeps schools sharing a nomesc distinguishable in the exported file via Codigo/Regiao", () => {
  const detailed = makeComparison([
    row({ codesc: "875", nomesc: "CASTRO ALVES", codrmet: "1", year: 2024, medprof: 210 }),
    row({ codesc: "33613", nomesc: "CASTRO ALVES", codrmet: "5", year: 2024, medprof: 250 }),
  ]);

  const csv = toCsv(detailed);
  const lines = csv.split("\n").slice(1); // drop header
  assert.equal(lines.length, 2);

  const line875 = lines.find((line) => line.includes('"875"'));
  const line33613 = lines.find((line) => line.includes('"33613"'));
  assert.ok(line875, "row for codesc 875 must be present");
  assert.ok(line33613, "row for codesc 33613 must be present");
  assert.notEqual(line875, line33613);

  // Both rows share the same "Escola" text (CASTRO ALVES) — Codigo/Regiao are what a spreadsheet
  // reader actually distinguishes them by, not the name column.
  assert.match(line875, /^"CASTRO ALVES";"875";"1";/);
  assert.match(line33613, /^"CASTRO ALVES";"33613";"5";/);
});

test("CSV_BOM is exactly one U+FEFF character — the exact byte a text editor could accidentally drop", () => {
  // toCsv() itself stays BOM-free (SarespReport.tsx prepends CSV_BOM only at download time) so its
  // own header-string assertions above don't have to account for an invisible leading character.
  assert.equal(CSV_BOM.length, 1);
  assert.equal(CSV_BOM.charCodeAt(0), 0xfeff);
  assert.equal(toCsv([]).startsWith(CSV_BOM), false);
});

// --- Escolas com nomes iguais, códigos diferentes --------------------------------------------

test("two schools sharing a nomesc stay distinguishable by codesc throughout the pipeline", () => {
  const rawRows = [
    row({ codesc: "875", nomesc: "CASTRO ALVES", rede: "Rede Estadual", codrmet: "1", medprof: 210, year: 2024 }),
    row({ codesc: "33613", nomesc: "CASTRO ALVES", rede: "Rede Estadual", codrmet: "5", medprof: 250, year: 2024 }),
  ];

  // The comparison layers group by codesc, not nomesc — two rows in, two rows out.
  const executive = makeExecutiveComparison(rawRows);
  assert.equal(executive.length, 2);
  assert.deepEqual(
    executive.map((item) => item.codesc).sort(),
    ["33613", "875"]
  );

  // The school index offers one entry per codesc — formatSchoolLabel renders each distinctly even
  // though both share a nomesc, because the label always ends in the (different) codesc.
  const index = buildSchoolIndex(rawRows);
  assert.equal(index.length, 2);
  const labels = index.map((entry) => formatSchoolLabel(entry));
  assert.notEqual(labels[0], labels[1]);
  assert.ok(labels.every((label) => label.startsWith("CASTRO ALVES — Rede Estadual")));

  const entry875 = index.find((entry) => entry.codesc === "875");
  const entry33613 = index.find((entry) => entry.codesc === "33613");
  assert.equal(formatSchoolLabel(entry875), formatSchoolLabel(rawRows[0]));
  assert.equal(formatSchoolLabel(entry33613), formatSchoolLabel(rawRows[1]));

  // The combobox carries codesc as its actual selection value (see SchoolCombobox.tsx's
  // onSelect(codesc)) — no text parsing involved, so both schools are unambiguously selectable
  // even though matchSchoolIndex (below) would return both for a bare "CASTRO ALVES" query.
  assert.notEqual(entry875.codesc, entry33613.codesc);
});

// --- Busca textual: preserva 2024x2025 mesmo quando o nome muda entre os anos ------------------
// The old (pre-payload-reduction) design filtered the FULL raw dataset client-side, so a school's
// 2024 row (old name) and 2025 row (new name) were both directly searchable. Now the client only
// ever holds the lightweight schools-index.json (one entry per codesc, current name only) plus the
// tiny schools-aliases.json (old names for the ~43 actually-renamed schools) — these two tests
// cover that the SAME guarantee (searchable by either name, and both years still show up once a
// school resolves) survives that redesign end to end.

test("a renamed school's raw rows both survive makeExecutiveComparison once resolved by codesc", () => {
  const rows = [
    // Same codesc, renamed between 2024 and 2025 — the school itself didn't change, only its label.
    row({ codesc: "500", nomesc: "ESCOLA ANTIGA", year: 2024, medprof: 190 }),
    row({ codesc: "500", nomesc: "ESCOLA NOVA", year: 2025, medprof: 210 }),
  ];

  const executive = makeExecutiveComparison(rows);
  assert.equal(executive.length, 1);
  assert.equal(executive[0].prof2024, 190);
  assert.equal(executive[0].prof2025, 210);
});

// --- Escola renomeada: identidade exibida deve ser a mais recente, em toda a pipeline -----------
// Reproduces the real codesc 10603 case: "CEMEB TERRA BRASILIS" (2024) renamed to "CEMEB
// PROFESSORA ELIZABETH OLIVEIRA RODRIGUES" (2025). Every function that dedupes rows by codesc must
// display the CURRENT (highest year) name/rede/codrmet — not whichever row was inserted first
// (always 2024, since rows load as [...data2024, ...data2025]) — otherwise the picker never offers
// the school's current name, and the "Escola selecionada" confirmation can show a name the user
// never typed nor selected.

const RENAMED_SCHOOL_2024 = row({ codesc: "10603", nomesc: "CEMEB TERRA BRASILIS", rede: "Rede Municipal", codrmet: "5", year: 2024, medprof: 191.9 });
const RENAMED_SCHOOL_2025 = row({ codesc: "10603", nomesc: "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES", rede: "Rede Municipal", codrmet: "5", year: 2025, medprof: 160.9 });

test("buildSchoolIndex shows a renamed school's CURRENT (2025) name, one entry per codesc", () => {
  const index = buildSchoolIndex([RENAMED_SCHOOL_2024, RENAMED_SCHOOL_2025]);
  assert.equal(index.length, 1);
  assert.equal(index[0].nomesc, "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES");
  assert.equal(formatSchoolLabel(index[0]), "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES — Rede Municipal · Região 5 — Cód. 10603");
  assert.equal(index[0].codesc, "10603");
});

test("buildSchoolIndex falls back to the only available name when a school hasn't been renamed (single year)", () => {
  const index = buildSchoolIndex([RENAMED_SCHOOL_2024]);
  assert.equal(formatSchoolLabel(index[0]), "CEMEB TERRA BRASILIS — Rede Municipal · Região 5 — Cód. 10603");
});

// --- normalizeSearch + matchSchoolIndex: the school combobox's matching logic -------------------

test("normalizeSearch strips accents, trims, and lowercases", () => {
  assert.equal(normalizeSearch("  ESCOLA MUNICÍPAL   "), "escola municipal");
  assert.equal(normalizeSearch("São Paulo"), "sao paulo");
  assert.equal(normalizeSearch(""), "");
});

test("matchSchoolIndex returns every match sorted alphabetically by nomesc, unbounded", () => {
  const index = [
    { codesc: "3", nomesc: "ZETA ESCOLA", searchKey: normalizeSearch("ZETA ESCOLA") },
    { codesc: "1", nomesc: "ALFA ESCOLA", searchKey: normalizeSearch("ALFA ESCOLA") },
    { codesc: "2", nomesc: "BETA COLEGIO", searchKey: normalizeSearch("BETA COLEGIO") },
  ];

  const matches = matchSchoolIndex(index, "escola");
  assert.deepEqual(matches.map((m) => m.codesc), ["1", "3"]); // ALFA before ZETA; BETA has no "escola" substring

  assert.deepEqual(matchSchoolIndex(index, ""), []);
  assert.deepEqual(matchSchoolIndex(index, "inexistente"), []);
});

test("matchSchoolIndex returns both homonyms for a name-only query, leaving disambiguation to the caller", () => {
  const index = [
    { codesc: "875", nomesc: "CASTRO ALVES", searchKey: normalizeSearch("CASTRO ALVES") },
    { codesc: "33613", nomesc: "CASTRO ALVES", searchKey: normalizeSearch("CASTRO ALVES") },
  ];

  const matches = matchSchoolIndex(index, normalizeSearch("castro alves"));
  assert.equal(matches.length, 2);
  assert.deepEqual(
    matches.map((m) => m.codesc).sort(),
    ["33613", "875"]
  );
});

// --- withVariation: client-side hydration of the executive*.json wire shape ---------------------

test("withVariation computes diff/percent/tone/statusLabel from prof2024/prof2025 alone", () => {
  // Mirrors how SarespReport.tsx rehydrates a fetched ExecutiveRowSeed (see lib/saresp/types.ts)
  // back into a full ExecutiveRow, without re-running makeExecutiveComparison over raw data it no
  // longer holds in memory.
  const hydrated = withVariation({ codesc: "1", prof2024: 200, prof2025: 215 });
  assert.equal(hydrated.diff, 15);
  assert.equal(hydrated.tone, "positive");
  assert.equal(hydrated.statusLabel, "Evolução positiva");
  assert.equal(hydrated.percent, 7.5);

  const missingYear = withVariation({ codesc: "2", prof2024: 200, prof2025: null });
  assert.equal(missingYear.diff, null);
  assert.equal(missingYear.tone, "neutral");
  assert.equal(missingYear.statusLabel, "Sem comparação");
});

test("restrictToYear nulls the other year and recomputes diff, matching what filtering raw rows to one year used to produce", () => {
  const hydrated = withVariation({ codesc: "1", prof2024: 200, prof2025: 215 });

  const only2024 = restrictToYear(hydrated, "2024");
  assert.equal(only2024.prof2024, 200);
  assert.equal(only2024.prof2025, null);
  assert.equal(only2024.diff, null);
  assert.equal(only2024.statusLabel, "Sem comparação");

  const only2025 = restrictToYear(hydrated, "2025");
  assert.equal(only2025.prof2024, null);
  assert.equal(only2025.prof2025, 215);
  assert.equal(only2025.diff, null);
});

test("restrictToYear leaves both years intact for '' and 'Comparativo'", () => {
  const hydrated = withVariation({ codesc: "1", prof2024: 200, prof2025: 215 });

  assert.deepEqual(restrictToYear(hydrated, ""), hydrated);
  assert.deepEqual(restrictToYear(hydrated, "Comparativo"), hydrated);
});

test("makeExecutiveComparison and makeComparison show the renamed school's CURRENT name for every row, not just the ones with 2025 data", () => {
  const rows = [RENAMED_SCHOOL_2024, RENAMED_SCHOOL_2025];

  const [executive] = makeExecutiveComparison(rows);
  assert.equal(executive.nomesc, "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES");
  assert.equal(executive.prof2024, 191.9);
  assert.equal(executive.prof2025, 160.9);

  const [detailed] = makeComparison(rows);
  assert.equal(detailed.nomesc, "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES");
  assert.equal(detailed.codesc, "10603");
});

// --- schools-aliases.json: keeps a renamed school findable by its OLD name too -------------------
// The index (schools-index.json) only ever displays a school's CURRENT name — searchability by an
// older, retired one is covered separately (see buildSchoolAliases in lib/saresp/analysis.ts) so
// the ~9.717 never-renamed schools don't each carry a searchKey-sized field just to cover the rare
// renamed case. These tests cover the real codesc 10603 case end-to-end through that pipeline.

test("buildSchoolAliases captures only the non-current name(s) for a renamed school, and omits unrenamed ones entirely", () => {
  const aliases = buildSchoolAliases([RENAMED_SCHOOL_2024, RENAMED_SCHOOL_2025]);
  assert.deepEqual(aliases, { "10603": ["CEMEB TERRA BRASILIS"] });

  const unrenamed = [row({ codesc: "1", nomesc: "ESCOLA X", year: 2024 }), row({ codesc: "1", nomesc: "ESCOLA X", year: 2025 })];
  assert.deepEqual(buildSchoolAliases(unrenamed), {});
});

test("withSearchKey leaves an unrenamed school's searchKey as just its own normalized name", () => {
  const entry = { codesc: "1", nomesc: "ESCOLA SEM RENOMEACAO", rede: "Rede Estadual", codrmet: "1" };
  const searchable = withSearchKey(entry, {}); // no alias entry for this codesc
  assert.equal(searchable.searchKey, normalizeSearch("ESCOLA SEM RENOMEACAO"));
});

test("a renamed school is findable by its OLD name via matchSchoolIndex, even though the index only displays the current one", () => {
  const rawRows = [RENAMED_SCHOOL_2024, RENAMED_SCHOOL_2025];
  const index = buildSchoolIndex(rawRows);
  const aliases = buildSchoolAliases(rawRows);
  const searchable = index.map((entry) => withSearchKey(entry, aliases));

  assert.equal(searchable[0].nomesc, "CEMEB PROFESSORA ELIZABETH OLIVEIRA RODRIGUES"); // display: current name only

  const byOldName = matchSchoolIndex(searchable, normalizeSearch("terra brasilis"));
  assert.equal(byOldName.length, 1);
  assert.equal(byOldName[0].codesc, "10603");

  const byNewName = matchSchoolIndex(searchable, normalizeSearch("elizabeth"));
  assert.equal(byNewName.length, 1);
  assert.equal(byNewName[0].codesc, "10603");
});
