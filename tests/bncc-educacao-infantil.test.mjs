import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, mkdtempSync, readFileSync, readdirSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import path from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import sourceSnapshot from "../data/bncc/source/official-mec-bncc-educacao-infantil.json" with { type: "json" };
import report from "../data/bncc/educacao-infantil.report.json" with { type: "json" };
import dataset from "../data/bncc/educacao-infantil.json" with { type: "json" };
import importReport from "../data/bncc/import-report.json" with { type: "json" };

const REPO_ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const IMPORTER_PATH = path.join(REPO_ROOT, "scripts/bncc/import.mjs");
const EI_SNAPSHOT_RELATIVE = "data/bncc/source/official-mec-bncc-educacao-infantil.json";

// ---- Isolated temp-copy helpers for the real determinism/negative tests ----
// These never touch the real working tree and never hit the network: they
// copy the local data/bncc/ tree (source snapshots + already-generated
// datasets/reports, ~4MB) into an OS temp directory and run the importer
// with that directory as cwd, since scripts/bncc/import.mjs resolves every
// path relative to process.cwd().

function makeTempDataCopy() {
  const dir = mkdtempSync(path.join(tmpdir(), "bncc-ei-determinism-"));
  cpSync(path.join(REPO_ROOT, "data/bncc"), path.join(dir, "data/bncc"), { recursive: true });
  return dir;
}

function runImporter(cwd, args) {
  // stderr is where main() dumps each invalid scope's full report for human
  // debugging — expected and harmless for the deliberately-corrupted
  // negative-test snapshots below, so it's discarded here rather than
  // cluttering this test file's own output; the assertions read the written
  // report.json directly instead.
  const stdio = ["ignore", "pipe", "ignore"];
  try {
    const stdout = execFileSync("node", [IMPORTER_PATH, ...args], { encoding: "utf-8", cwd, stdio });
    return { summary: JSON.parse(stdout.trim()), stdout };
  } catch (error) {
    // import.mjs exits with code 1 whenever overall status isn't "valido" —
    // expected for the deliberately-corrupted negative-test snapshots below.
    // stdout still carries the full summary JSON.
    return { summary: JSON.parse(error.stdout.trim()), stdout: error.stdout };
  }
}

function hashTree(rootDir) {
  const hashes = [];
  const walk = (dir) => {
    for (const entry of readdirSync(dir)) {
      const full = path.join(dir, entry);
      if (statSync(full).isDirectory()) {
        walk(full);
      } else {
        hashes.push({
          path: path.relative(rootDir, full).replaceAll("\\", "/"),
          sha256: createHash("sha256").update(readFileSync(full)).digest("hex"),
        });
      }
    }
  };
  walk(rootDir);
  return hashes.sort((a, b) => a.path.localeCompare(b.path));
}

function corruptTempSnapshot(dir, mutate) {
  const snapshotPath = path.join(dir, EI_SNAPSHOT_RELATIVE);
  const snapshot = JSON.parse(readFileSync(snapshotPath, "utf-8"));
  mutate(snapshot);
  writeFileSync(snapshotPath, JSON.stringify(snapshot, null, 2));
}

// Every expectation below is declared fresh, from the official BNCC text and
// the counts already cross-checked against the PDF independently of
// scripts/bncc/import.mjs and extract_educacao_infantil.py — none of this is
// imported from the implementation under test.
const CAMPOS = {
  EO: "O eu, o outro e o nós",
  CG: "Corpo, gestos e movimentos",
  TS: "Traços, sons, cores e formas",
  EF: "Escuta, fala, pensamento e imaginação",
  ET: "Espaços, tempos, quantidades, relações e transformações",
};
const FAIXAS = {
  "01": { nome: "Bebês", descricao: "zero a 1 ano e 6 meses" },
  "02": { nome: "Crianças bem pequenas", descricao: "1 ano e 7 meses a 3 anos e 11 meses" },
  "03": { nome: "Crianças pequenas", descricao: "4 anos a 5 anos e 11 meses" },
};
// BNCC p. 45-52 — deliberately asymmetric: Bebês never gets a 7th "O eu, o
// outro e o nós" objetivo, nor a 7th/8th "Espaços, tempos...".
const EXPECTED_COUNTS = {
  EO: { "01": 6, "02": 7, "03": 7 },
  CG: { "01": 5, "02": 5, "03": 5 },
  TS: { "01": 3, "02": 3, "03": 3 },
  EF: { "01": 9, "02": 9, "03": 9 },
  ET: { "01": 6, "02": 8, "03": 8 },
};
const DIREITOS_OFICIAIS = ["Conviver", "Brincar", "Participar", "Explorar", "Expressar", "Conhecer-se"];

const objetivos = dataset.registros.filter((registro) => registro.tipo === "objetivo_aprendizagem");
const direitos = dataset.registros.filter((registro) => registro.tipo === "direito_aprendizagem");

test("snapshot carries exactly 93 objetivos and 6 direitos", () => {
  assert.equal(sourceSnapshot.objetivos.length, 93);
  assert.equal(sourceSnapshot.direitos.length, 6);
});

test("report's recorded source hash matches the actual committed snapshot file bytes", () => {
  const raw = readFileSync(path.join(REPO_ROOT, "data/bncc/source/official-mec-bncc-educacao-infantil.json"));
  assert.equal(report.hash_sha256_fonte, createHash("sha256").update(raw).digest("hex"));
});

test("dataset has exactly 99 registros — 93 objetivos + 6 direitos, no other tipo", () => {
  assert.equal(dataset.registros.length, 99);
  assert.equal(objetivos.length, 93);
  assert.equal(direitos.length, 6);
  assert.deepEqual(new Set(dataset.registros.map((registro) => registro.tipo)), new Set(["objetivo_aprendizagem", "direito_aprendizagem"]));
});

test("report is valid, with zero rejections and zero alerts", () => {
  assert.equal(report.status, "valido");
  assert.equal(report.total_objetivos, 93);
  assert.equal(report.total_direitos, 6);
  assert.equal(report.total_geral, 99);
  assert.deepEqual(report.duplicidades, []);
  assert.deepEqual(report.registros_rejeitados, []);
  assert.deepEqual(report.alertas, []);
});

test("all 93 objetivo codes are unique and match EI0[1-3](EO|CG|TS|EF|ET)[0-9]{2}", () => {
  const codes = objetivos.map((objetivo) => objetivo.codigo);
  assert.equal(new Set(codes).size, 93);
  for (const code of codes) {
    assert.match(code, /^EI0[1-3](EO|CG|TS|EF|ET)\d{2}$/);
  }
});

test("no objetivo has an empty código, and every direito has codigo: null (never invented)", () => {
  for (const objetivo of objetivos) {
    assert.ok(typeof objetivo.codigo === "string" && objetivo.codigo.length > 0);
  }
  for (const direito of direitos) {
    assert.equal(direito.codigo, null);
  }
});

test("counts per campo × faixa match the official table exactly, including its asymmetries", () => {
  for (const [sigla, porFaixa] of Object.entries(EXPECTED_COUNTS)) {
    for (const [faixaCodigo, esperado] of Object.entries(porFaixa)) {
      const actual = objetivos.filter((objetivo) => objetivo.campo_experiencia_sigla === sigla && objetivo.faixa_etaria_codigo === faixaCodigo).length;
      assert.equal(actual, esperado, `${sigla}/${faixaCodigo}`);
    }
  }
});

test("no sequence was invented to fill an official asymmetry (EI01EO07, EI01ET07, EI01ET08 do not exist)", () => {
  const codes = new Set(objetivos.map((objetivo) => objetivo.codigo));
  assert.equal(codes.has("EI01EO07"), false);
  assert.equal(codes.has("EI01ET07"), false);
  assert.equal(codes.has("EI01ET08"), false);
});

test("every objetivo's own código agrees with its campo_experiencia/campo_experiencia_sigla/faixa_etaria fields", () => {
  for (const objetivo of objetivos) {
    const match = objetivo.codigo.match(/^EI0([1-3])(EO|CG|TS|EF|ET)(\d{2})$/);
    assert.ok(match, objetivo.codigo);
    const [, faixaDigito, siglaDoCodigo] = match;
    const faixaCodigo = `0${faixaDigito}`;
    assert.equal(objetivo.campo_experiencia_sigla, siglaDoCodigo, objetivo.codigo);
    assert.equal(objetivo.campo_experiencia, CAMPOS[siglaDoCodigo], objetivo.codigo);
    assert.equal(objetivo.faixa_etaria_codigo, faixaCodigo, objetivo.codigo);
    assert.equal(objetivo.faixa_etaria, FAIXAS[faixaCodigo].nome, objetivo.codigo);
    assert.equal(objetivo.faixa_etaria_descricao, FAIXAS[faixaCodigo].descricao, objetivo.codigo);
  }
});

test("faixa_etaria_descricao is always the official text by extenso, never an approximate numeric range", () => {
  for (const objetivo of objetivos) {
    assert.doesNotMatch(objetivo.faixa_etaria_descricao, /\d\s*[-–]\s*\d/, objetivo.codigo);
    assert.match(objetivo.faixa_etaria_descricao, /(zero a 1 ano|1 ano e 7 meses|4 anos a 5 anos)/, objetivo.codigo);
  }
});

test("all 6 official direitos are present, exact canonical names, no more no less", () => {
  assert.deepEqual(direitos.map((direito) => direito.nome).sort(), [...DIREITOS_OFICIAIS].sort());
});

test("every direito has a deterministic slug and non-empty official text, no invented número or código", () => {
  for (const direito of direitos) {
    assert.equal(direito.slug, direito.nome.toLowerCase());
    assert.equal(direito.codigo, null);
    assert.equal("numero" in direito, false, `direito ${direito.nome} should not carry an invented ordering number`);
    assert.ok(direito.texto.trim().length > 40, direito.nome);
  }
});

test("every registro has traceable official-source provenance and non-empty, non-truncated text", () => {
  for (const registro of dataset.registros) {
    assert.equal(registro.classificacao, "dado_oficial");
    assert.match(registro.fonte, /Ministério da Educação/);
    assert.match(registro.documento_url, /basenacionalcomum\.mec\.gov\.br/);
    assert.ok(Number.isInteger(registro.pagina_fonte) && registro.pagina_fonte > 0, registro.id);
    assert.ok(registro.lote_importacao);
    assert.ok(registro.texto.trim().length > 0, registro.id);
    assert.match(registro.texto.trim(), /[.!?]$/, registro.id);
  }
});

test("no registro is ever labeled 'habilidade' as its tipo", () => {
  // The word "habilidade" can legitimately appear inside official prose as
  // ordinary Portuguese (e.g. EI02CG05: "as habilidades manuais") — the BNCC
  // itself does this 5 times in the chapter. What must never happen is the
  // *label*: no Educação Infantil registro's own `tipo` is ever "habilidade".
  for (const registro of dataset.registros) {
    assert.notEqual(registro.tipo, "habilidade");
  }
});

test("no table header or continuation marker leaked into an objetivo's text", () => {
  const forbidden = [/OBJETIVOS DE APRENDIZAGEM/i, /Continuação/i, /CAMPO DE EXPERIÊNCIAS/i];
  for (const objetivo of objetivos) {
    for (const pattern of forbidden) {
      assert.doesNotMatch(objetivo.texto, pattern, objetivo.codigo);
    }
  }
});

test("spot-checks objetivos across the beginning, middle and end of the tables — 5 campos, 3 faixas, 5 different pages", () => {
  const byCode = Object.fromEntries(objetivos.map((objetivo) => [objetivo.codigo, objetivo]));

  // Beginning: first page of the chapter's tables (EO, campo page 46/idx46 -> pagina_fonte 45).
  assert.equal(byCode.EI01EO01?.texto, "Perceber que suas ações têm efeitos nas outras crianças e nos adultos.");
  assert.equal(byCode.EI01EO01?.pagina_fonte, 45);
  // A continuation-page item (EO, page 47/idx47 -> pagina_fonte 46).
  assert.equal(byCode.EI01EO06?.texto, "Interagir com outras crianças da mesma faixa etária e adultos, adaptando-se ao convívio social.");
  assert.equal(byCode.EI01EO06?.pagina_fonte, 46);
  // CG, single-page campo (page 48/idx48 -> pagina_fonte 47).
  assert.equal(byCode.EI01CG01?.texto, "Movimentar as partes do corpo para exprimir corporalmente emoções, necessidades e desejos.");
  assert.equal(byCode.EI01CG01?.pagina_fonte, 47);
  // Middle: TS, the BNCC's own worked example for the EI code format (p. 26),
  // first EF page (page 50/idx50 -> pagina_fonte 49).
  assert.equal(byCode.EI02TS01?.texto, "Criar sons com materiais, objetos e instrumentos musicais, para acompanhar diversos ritmos de música.");
  assert.equal(byCode.EI03EF05?.texto, "Recontar histórias ouvidas para produção de reconto escrito, tendo o professor como escriba.");
  assert.equal(byCode.EI03EF05?.pagina_fonte, 49);
  // EF, continuation page (page 51/idx51 -> pagina_fonte 50).
  assert.equal(byCode.EI03EF08?.texto, "Selecionar livros e textos de gêneros conhecidos para a leitura de um adulto e/ou para sua própria leitura (partindo de seu repertório sobre esses textos, como a recuperação pela memória, pela leitura das ilustrações etc.).");
  assert.equal(byCode.EI03EF08?.pagina_fonte, 50);
  // End: ET, last continuation page of the chapter's tables (page 53/idx53 -> pagina_fonte 52),
  // where Bebês (faixa 01) has no equivalent — only faixas 02/03 continue.
  assert.equal(byCode.EI02ET08?.texto, "Registrar com números a quantidade de crianças (meninas e meninos, presentes e ausentes) e a quantidade de objetos da mesma natureza (bonecas, bolas, livros etc.).");
  assert.equal(byCode.EI03ET08?.texto, "Expressar medidas (peso, altura etc.), construindo gráficos básicos.");
  assert.equal(byCode.EI03ET08?.pagina_fonte, 52);
  assert.equal(byCode.EI01ET08, undefined);
});

test("cross-validation attempt against the official MEC download tool is recorded, not silently skipped", () => {
  const validacao = sourceSnapshot.metadata.validacao_cruzada;
  assert.ok(validacao, "expected a recorded validacao_cruzada attempt in the snapshot metadata");
  assert.match(validacao.fonte_tentada, /downloadbncc\.mec\.gov\.br|bnccapi\.mec\.gov\.br/);
  assert.ok(validacao.resultado);
  assert.equal(report.validacao_cruzada?.resultado, validacao.resultado);
});

test("--check reports valido and preserves every pre-existing scope's totals, without writing anything", () => {
  // This validates a different property from the byte-for-byte test below:
  // --check must never touch disk at all (writeReport/writeDataset gate on
  // `!isCheck` before ever calling the shared writer), which a plain
  // before/after hash comparison of a --check run can't distinguish from "it
  // wrote the same bytes back" — so it's kept as its own test rather than
  // folded into the determinism test.
  const before = hashTree(path.join(REPO_ROOT, "data/bncc"));
  const { summary } = runImporter(REPO_ROOT, ["--check"]);
  const after = hashTree(path.join(REPO_ROOT, "data/bncc"));

  assert.equal(summary.status, "valido");
  assert.equal(summary.total_geral, 1616);
  assert.equal(summary.escopos["educacao-infantil"].status, "valido");
  assert.equal(summary.escopos["educacao-infantil"].total, 99);
  for (const [escopo, info] of Object.entries(importReport.escopos)) {
    assert.equal(summary.escopos[escopo]?.status, info.status, escopo);
    assert.equal(summary.escopos[escopo]?.total, info.total, escopo);
  }
  assert.deepEqual(after, before, "--check must never write to data/bncc/");
});

test("running the importer twice against an isolated copy produces byte-for-byte identical artifacts on the second run", () => {
  // The property under test is real determinism of the *writing* mechanism
  // (writeJsonIfChanged), not just "the reported totals match" — a file that
  // gets needlessly rewritten with a fresh data_importacao/lote_importacao
  // would still report the same totals while still differing byte-for-byte.
  // Runs against an isolated temp copy so this never touches the real
  // working tree and never depends on the network (no PDF download; the
  // committed source snapshots are copied as-is).
  const dir = makeTempDataCopy();
  try {
    const first = runImporter(dir, []);
    assert.equal(first.summary.status, "valido");
    const hashesAfterFirstRun = hashTree(path.join(dir, "data/bncc"));

    const second = runImporter(dir, []);
    assert.equal(second.summary.status, "valido");
    const hashesAfterSecondRun = hashTree(path.join(dir, "data/bncc"));

    assert.deepEqual(
      hashesAfterSecondRun,
      hashesAfterFirstRun,
      "every file under data/bncc/ must be byte-for-byte identical after a second run with no source changes",
    );
    // Sanity: this must be a real, non-trivial set of files, not an
    // accidentally-empty comparison.
    assert.ok(hashesAfterFirstRun.length > 40, `expected dozens of dataset/report files, got ${hashesAfterFirstRun.length}`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

// The negative tests below run the importer in *normal* mode (not --check)
// against the isolated temp copy: writeReport always writes regardless of
// status, so the corrupted scope's report.json is actually readable on disk
// afterwards (--check never writes anything, so its report would still be
// the old, uncorrupted one). writeDataset, unlike writeReport, only ever
// writes when status is "valido" — so this also doubles as a check that a
// corrupted snapshot can never produce a rewritten educacao-infantil.json.

test("a snapshot with a missing documento_url on an objetivo never reaches status: valido", () => {
  const dir = makeTempDataCopy();
  try {
    corruptTempSnapshot(dir, (snapshot) => {
      delete snapshot.objetivos[0].documento_url;
    });
    const { summary } = runImporter(dir, []);
    assert.notEqual(summary.escopos["educacao-infantil"].status, "valido");
    assert.notEqual(summary.status, "valido");

    const reportPath = path.join(dir, "data/bncc/educacao-infantil.report.json");
    const scopeReport = JSON.parse(readFileSync(reportPath, "utf-8"));
    assert.equal(scopeReport.status, "revisao_necessaria");
    assert.ok(
      scopeReport.registros_rejeitados.some((item) => item.erros.some((erro) => erro.includes("documento_url"))),
      "expected a rejection explicitly naming documento_url",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a snapshot with documento_url pointing outside the official MEC host never reaches status: valido", () => {
  const dir = makeTempDataCopy();
  try {
    corruptTempSnapshot(dir, (snapshot) => {
      snapshot.objetivos[10].documento_url = "https://example.com/fake.pdf";
    });
    const { summary } = runImporter(dir, []);
    assert.notEqual(summary.escopos["educacao-infantil"].status, "valido");

    const reportPath = path.join(dir, "data/bncc/educacao-infantil.report.json");
    const scopeReport = JSON.parse(readFileSync(reportPath, "utf-8"));
    assert.ok(
      scopeReport.registros_rejeitados.some((item) => item.erros.some((erro) => erro.includes("documento_url"))),
      "expected a rejection explicitly naming documento_url",
    );
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("a snapshot with an invalid pagina_fonte (missing, zero, negative, or non-integer) never reaches status: valido", () => {
  const mutations = [
    { label: "missing", apply: (snapshot) => { delete snapshot.objetivos[0].pagina_fonte; } },
    { label: "zero", apply: (snapshot) => { snapshot.objetivos[0].pagina_fonte = 0; } },
    { label: "negative (direito)", apply: (snapshot) => { snapshot.direitos[0].pagina_fonte = -5; } },
    { label: "non-integer", apply: (snapshot) => { snapshot.objetivos[5].pagina_fonte = 45.5; } },
  ];

  for (const { label, apply } of mutations) {
    const dir = makeTempDataCopy();
    try {
      corruptTempSnapshot(dir, apply);
      const { summary } = runImporter(dir, []);
      assert.notEqual(summary.escopos["educacao-infantil"].status, "valido", `pagina_fonte case: ${label}`);

      const reportPath = path.join(dir, "data/bncc/educacao-infantil.report.json");
      const scopeReport = JSON.parse(readFileSync(reportPath, "utf-8"));
      assert.equal(scopeReport.status, "revisao_necessaria", `pagina_fonte case: ${label}`);
      assert.ok(
        scopeReport.registros_rejeitados.some((item) => item.erros.some((erro) => erro.includes("pagina_fonte"))),
        `expected a rejection explicitly naming pagina_fonte for case: ${label}`,
      );
    } finally {
      rmSync(dir, { recursive: true, force: true });
    }
  }
});

test("a corrupted snapshot never produces a rewritten (invalid) educacao-infantil.json dataset", () => {
  const dir = makeTempDataCopy();
  try {
    const datasetPath = path.join(dir, "data/bncc/educacao-infantil.json");
    const before = readFileSync(datasetPath, "utf-8");
    corruptTempSnapshot(dir, (snapshot) => {
      delete snapshot.objetivos[0].documento_url;
    });
    runImporter(dir, []);
    const after = readFileSync(datasetPath, "utf-8");
    assert.equal(after, before, "the dataset file must be left untouched when the scope is invalid");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("the 1517 pre-existing registros are fully preserved and the pipeline total is now 1616", () => {
  assert.equal(importReport.total_geral, 1616);
  const preexistingTotal = Object.entries(importReport.escopos)
    .filter(([escopo]) => escopo !== "educacao-infantil")
    .reduce((sum, [, info]) => sum + info.total, 0);
  assert.equal(preexistingTotal, 1517);
  assert.equal(importReport.escopos["educacao-infantil"].total, 99);
  assert.equal(importReport.total_por_etapa["Educação Infantil"], 99);
  assert.equal(importReport.total_por_tipo.objetivo_aprendizagem, 93);
  assert.equal(importReport.total_por_tipo.direito_aprendizagem, 6);
});
