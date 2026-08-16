// Regenerates public/data/saresp-YYYY.json from the raw CSVs at data/saresp/source/. Manual,
// developer-run script (npm run saresp:build-data) — mirrors scripts/bncc/import.mjs's convention
// of committed processed output rather than a predev/prebuild auto-run hook.
//
// The raw CSVs are gitignored (~15MB, only ever needed to regenerate the JSON — see .gitignore).
// If data/saresp/source/*.csv is missing, re-download "Proficiência do SARESP por Escola" (2024 e
// 2025) from https://dados.educacao.sp.gov.br/dataset/profici%C3%AAncia-do-sistema-de-avalia%C3%A7%C3%A3o-de-rendimento-escolar-do-estado-de-s%C3%A3o-paulo-saresp-60
// and save as saresp-2024.csv / saresp-2025.csv in that folder (same column structure: DEPADM;
// DEPBOL;NOMEDEPBOL;CODRMET;CODESC;NOMESC;SERIE_ANO;COD_PER;PERIODO;CO_COMP;DS_COMP;MEDPROF).
//
// Self-contained on purpose: this repo has no loader configured to run .ts directly with plain
// `node`, so the CSV parsing logic here is a standalone copy rather than an import from
// lib/saresp/analysis.ts (which only holds the typed runtime/calculation layer the app itself uses).
import { mkdir, readFile, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

const root = process.cwd();
const sourceDir = path.join(root, "data", "saresp", "source");
const outputDir = path.join(root, "public", "data");
const years = [2024, 2025];

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

function parseCsvText(text) {
  const lines = text.split(/\r?\n/).filter(Boolean);
  const rawHeaders = splitCsvLine(lines[0]).map((header) => header.trim().toLowerCase());
  const fieldByIndex = rawHeaders
    .map((header, index) => [FIELD_BY_HEADER[header], index])
    .filter(([field]) => field);

  return lines.slice(1).map((line) => {
    const cells = splitCsvLine(line);
    const row = {};
    fieldByIndex.forEach(([field, index]) => {
      row[field] = cleanText(cells[index]);
    });

    row.rede = row.rede || "Nao informado";
    row.medprof = parseNumber(row.medprof);
    return row;
  }).filter((row) => row.codesc && row.nomesc && row.medprof != null);
}

async function buildYear(year) {
  const csvPath = path.join(sourceDir, `saresp-${year}.csv`);
  const jsonPath = path.join(outputDir, `saresp-${year}.json`);

  const buffer = await readFile(csvPath);
  const text = decodeCsv(buffer);
  const rows = parseCsvText(text);

  // Compact (no indentation): this JSON is fetched by the browser at runtime, not just read by
  // developers — pretty-printing would inflate an already-large payload for no benefit.
  const json = JSON.stringify(rows);
  await writeFile(jsonPath, json);

  return { year, rows: rows.length, bytes: Buffer.byteLength(json) };
}

async function main() {
  await mkdir(outputDir, { recursive: true });
  const summary = [];
  for (const year of years) {
    summary.push(await buildYear(year));
  }
  console.log(JSON.stringify(summary, null, 2));
}

await main();
