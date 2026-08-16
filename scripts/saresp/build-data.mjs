// Regenerates public/data/saresp/ from the raw CSVs at data/saresp/source/. Manual, developer-run
// script (npm run saresp:build-data) — mirrors scripts/bncc/import.mjs's convention of committed
// processed output rather than a predev/prebuild auto-run hook.
//
// The raw CSVs are gitignored (~15MB, only ever needed to regenerate the JSON — see .gitignore).
// If data/saresp/source/*.csv is missing, re-download "Proficiência do SARESP por Escola" (2024 e
// 2025) from https://dados.educacao.sp.gov.br/dataset/profici%C3%AAncia-do-sistema-de-avalia%C3%A7%C3%A3o-de-rendimento-escolar-do-estado-de-s%C3%A3o-paulo-saresp-60
// and save as saresp-<ano>.csv / saresp-<ano>.csv in that folder (same column structure: DEPADM;
// DEPBOL;NOMEDEPBOL;CODRMET;CODESC;NOMESC;SERIE_ANO;COD_PER;PERIODO;CO_COMP;DS_COMP;MEDPROF).
//
// The CSV-parsing half below (splitCsvLine/decodeCsv/cleanText/mojibakeFixes/FIELD_BY_HEADER) stays
// a standalone copy, same as always. The calculation half no longer duplicates
// lib/saresp/analysis.ts, though: it imports makeExecutiveComparison/buildSchoolIndex directly (via
// explicit .ts extensions + `node --experimental-strip-types`, the same mechanism
// tests/saresp-analysis.test.mjs already relies on) so the build-time and client-time numbers can
// never drift apart. See README "Pipeline de dados do SARESP" for the full artifact breakdown.
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";
import { buildSchoolAliases, buildSchoolIndex, makeExecutiveComparison } from "../../lib/saresp/analysis.ts";

const root = process.cwd();
const sourceDir = path.join(root, "data", "saresp", "source");
const outputDir = path.join(root, "public", "data", "saresp");
const schoolsDir = path.join(outputDir, "schools");
const years = [2024, 2025];

// Precomputed on top of the GERAL-preferred default (executive.json, no período filter — see
// dedupeByPeriodo in lib/saresp/analysis.ts). MANHÃ/TARDE materially change state-wide
// Rankings/Charts/benchmark (measured: present in 79%/57% of codesc×serieAno×componente groups) —
// without these, selecting that período filter with no school chosen would silently stop doing
// anything. NOITE has only 6 rows total; included anyway so the client never special-cases it.
// GERAL itself needs no variant: every group has a GERAL row, so it's numerically identical to the
// default file.
const PERIODOS_TO_PRECOMPUTE = ["MANHÃ", "TARDE", "NOITE"];

// Only the columns the app actually reads — depadm/depbol/cod_per/co_comp exist in the source
// CSVs but nothing downstream consumes them. codrmet ("Código da Região Metropolitana" per the
// official data dictionary at dados.educacao.sp.gov.br) is kept: it's the only geographic
// disambiguator present in this CSV export for schools that share a name — the export has no
// município/diretoria name columns to fall back on (see README "Identificação de escolas").
const FIELD_BY_HEADER = {
  nomedepbol: "rede",
  codrmet: "codrmet",
  codesc: "codesc",
  nomesc: "nomesc",
  serie_ano: "serieAno",
  periodo: "periodo",
  ds_comp: "componente",
  medprof: "medprof",
};

const mojibakeFixes = new Map([
  ["�", "º"],
  ["MANH�", "MANHÃ"],
  ["L�NGUA PORTUGUESA", "LÍNGUA PORTUGUESA"],
  ["MATEM�TICA", "MATEMÁTICA"],
]);

function parseNumber(value) {
  if (value == null || value === "") return null;
  const raw = String(value).trim();
  const normalized = raw.includes(",") ? raw.replace(/\./g, "").replace(",", ".") : raw;
  const numeric = Number(normalized);
  return Number.isFinite(numeric) ? numeric : null;
}

function cleanText(value) {
  if (value == null) return "";
  const text = String(value).trim();
  if (!text.includes("�")) return text;
  let fixed = text;
  mojibakeFixes.forEach((replacement, target) => {
    fixed = fixed.replaceAll(target, replacement);
  });
  return fixed;
}

function splitCsvLine(line) {
  const result = [];
  let current = "";
  let quoted = false;

  for (let index = 0; index < line.length; index += 1) {
    const char = line[index];
    const next = line[index + 1];

    if (char === '"' && quoted && next === '"') {
      current += '"';
      index += 1;
    } else if (char === '"') {
      quoted = !quoted;
    } else if (char === ";" && !quoted) {
      result.push(current);
      current = "";
    } else {
      current += char;
    }
  }

  result.push(current);
  return result;
}

function decodeCsv(buffer) {
  const utf8 = new TextDecoder("utf-8", { fatal: false }).decode(buffer);
  const replacementCount = (utf8.match(/�/g) || []).length;
  if (replacementCount > 4) {
    return new TextDecoder("windows-1252").decode(buffer);
  }
  return utf8;
}

// `year` is stamped onto every row here (not left implicit-per-file like the old saresp-YYYY.json
// convention) because build-data.mjs now combines both years in memory to compute cross-year
// artifacts (schools-index, executive*) — RawRow.year is what lib/saresp/analysis.ts's functions
// key on.
function parseCsvText(text, year) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rawHeaders = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const fieldByIndex = rawHeaders
    .map((header, index) => [FIELD_BY_HEADER[header], index])
    .filter(([field]) => field);

  return lines
    .slice(1)
    .map((line) => {
      const cells = splitCsvLine(line);
      const row = { year };
      fieldByIndex.forEach(([field, index]) => {
        row[field] = cleanText(cells[index]);
      });

      row.rede = row.rede || "Nao informado";
      row.medprof = parseNumber(row.medprof);
      return row;
    })
    .filter((row) => row.codesc && row.nomesc && row.medprof != null);
}

async function readYear(year) {
  const csvPath = path.join(sourceDir, `saresp-${year}.csv`);
  const buffer = await readFile(csvPath);
  return parseCsvText(decodeCsv(buffer), year);
}

// Compact (no indentation): every artifact here is fetched by the browser at runtime, not just
// read by developers — pretty-printing would inflate an already loading-time-sensitive payload.
async function writeJson(filePath, data) {
  const json = JSON.stringify(data);
  await writeFile(filePath, json);
  return { bytes: Buffer.byteLength(json) };
}

async function writeSchoolsIndex(allRows) {
  const index = buildSchoolIndex(allRows);
  const { bytes } = await writeJson(path.join(outputDir, "schools-index.json"), index);
  return { file: "schools-index.json", schools: index.length, bytes };
}

async function writeSchoolAliases(allRows) {
  const aliases = buildSchoolAliases(allRows);
  const { bytes } = await writeJson(path.join(outputDir, "schools-aliases.json"), aliases);
  return { file: "schools-aliases.json", schools: Object.keys(aliases).length, bytes };
}

// Strips the derived fields (diff/percent/tone/statusLabel) that makeExecutiveComparison already
// computed via withVariation — the client recomputes them from prof2024/prof2025 alone after
// fetching (see withVariation, exported from lib/saresp/analysis.ts for exactly this), so shipping
// them here would just repeat several MB of text that's fully determined by two numbers.
function toExecutiveSeed(executiveRows) {
  return executiveRows.map(({ codesc, codrmet, nomesc, serieAno, componente, rede, prof2024, prof2025 }) => ({
    codesc,
    codrmet,
    nomesc,
    serieAno,
    componente,
    rede,
    prof2024,
    prof2025,
  }));
}

async function writeExecutive(allRows, { periodo, filename }) {
  const rowsForPeriodo = periodo ? allRows.filter((row) => row.periodo === periodo) : allRows;
  const seed = toExecutiveSeed(makeExecutiveComparison(rowsForPeriodo));
  const { bytes } = await writeJson(path.join(outputDir, filename), seed);
  return { file: filename, rows: seed.length, bytes };
}

// Drops codesc/rede/codrmet/nomesc — recoverable from the fetch URL (codesc) and the
// already-loaded schools-index entry (rede/codrmet/nomesc) — roughly halving each partition's size.
function toSchoolDetailRow({ year, serieAno, periodo, componente, medprof }) {
  return { year, serieAno, periodo, componente, medprof };
}

async function writeSchoolPartitions(allRows) {
  const byCode = new Map();
  allRows.forEach((row) => {
    const list = byCode.get(row.codesc) || [];
    list.push(row);
    byCode.set(row.codesc, list);
  });

  // Clears stale partitions from a prior run (e.g. a school that disappeared from a future source
  // CSV — merged, closed) so it doesn't linger as an orphaned file forever.
  await rm(schoolsDir, { recursive: true, force: true });
  await mkdir(schoolsDir, { recursive: true });

  const entries = [...byCode.entries()];
  const BATCH_SIZE = 500;
  let totalBytes = 0;
  for (let start = 0; start < entries.length; start += BATCH_SIZE) {
    const batch = entries.slice(start, start + BATCH_SIZE);
    const results = await Promise.all(
      batch.map(([codesc, rowsForSchool]) => writeJson(path.join(schoolsDir, `${codesc}.json`), rowsForSchool.map(toSchoolDetailRow)))
    );
    totalBytes += results.reduce((sum, result) => sum + result.bytes, 0);
  }

  return { files: entries.length, totalBytes };
}

async function main() {
  await mkdir(outputDir, { recursive: true });

  const perYearRows = await Promise.all(years.map(readYear));
  const allRows = perYearRows.flat();

  const artifacts = [];
  artifacts.push(await writeSchoolsIndex(allRows));
  artifacts.push(await writeSchoolAliases(allRows));
  artifacts.push(await writeExecutive(allRows, { periodo: null, filename: "executive.json" }));
  for (const periodo of PERIODOS_TO_PRECOMPUTE) {
    const filename = `executive-${periodo.toLocaleLowerCase("pt-BR").normalize("NFD").replace(/\p{Diacritic}/gu, "")}.json`;
    artifacts.push(await writeExecutive(allRows, { periodo, filename }));
  }

  const partitions = await writeSchoolPartitions(allRows);
  artifacts.push({ file: "schools/<codesc>.json", ...partitions });

  console.log(JSON.stringify({ totalRawRows: allRows.length, uniqueSchools: partitions.files, artifacts }, null, 2));
}

await main();
