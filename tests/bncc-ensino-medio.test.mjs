import assert from "node:assert/strict";
import test from "node:test";

const AREAS = [
  { scopeId: "linguagens", area: "Linguagens e suas Tecnologias", componente: "Linguagens e suas Tecnologias", codigoRegex: /^EM13LGG\d{3}$/, totalCompetencias: 7, totalHabilidades: 28 },
  { scopeId: "matematica", area: "Matemática e suas Tecnologias", componente: "Matemática e suas Tecnologias", codigoRegex: /^EM13MAT\d{3}$/, totalCompetencias: 5, totalHabilidades: 43 },
  { scopeId: "ciencias-da-natureza", area: "Ciências da Natureza e suas Tecnologias", componente: "Ciências da Natureza e suas Tecnologias", codigoRegex: /^EM13CNT\d{3}$/, totalCompetencias: 3, totalHabilidades: 26 },
  { scopeId: "ciencias-humanas", area: "Ciências Humanas e Sociais Aplicadas", componente: "Ciências Humanas e Sociais Aplicadas", codigoRegex: /^EM13CHS\d{3}$/, totalCompetencias: 6, totalHabilidades: 32 },
];

for (const { scopeId, area, componente, codigoRegex, totalCompetencias, totalHabilidades } of AREAS) {
  const report = (await import(`../data/bncc/ensino-medio-${scopeId}.report.json`, { with: { type: "json" } })).default;
  const dataset = (await import(`../data/bncc/ensino-medio-${scopeId}.json`, { with: { type: "json" } })).default;
  const totalGeral = totalCompetencias + totalHabilidades;

  test(`Ensino Médio — ${area}: import is valid and complete for the declared scope`, () => {
    assert.equal(report.status, "valido");
    assert.equal(report.total_competencias, totalCompetencias);
    assert.equal(report.total_habilidades, totalHabilidades);
    assert.equal(report.total_geral, totalGeral);
    assert.deepEqual(report.duplicidades, []);
    assert.deepEqual(report.registros_rejeitados, []);
    assert.deepEqual(report.alertas, []);
    assert.equal(dataset.registros.length, totalGeral);
  });

  test(`Ensino Médio — ${area}: competências específicas cover 1-N with non-empty official text`, () => {
    const competencias = dataset.registros.filter((registro) => registro.tipo === "competencia_especifica");
    assert.equal(competencias.length, totalCompetencias);
    const numeros = competencias.map((registro) => registro.numero).sort((a, b) => a - b);
    assert.deepEqual(numeros, Array.from({ length: totalCompetencias }, (_, index) => index + 1));
    for (const competencia of competencias) {
      assert.equal(competencia.codigo, null);
      assert.equal(competencia.etapa, "Ensino Médio");
      assert.equal(competencia.area, area);
      assert.ok(competencia.texto.trim().length > 0);
    }
  });

  test(`Ensino Médio — ${area}: every habilidade has a valid code, competência específica, and traceable source metadata`, () => {
    const habilidades = dataset.registros.filter((registro) => registro.tipo === "habilidade");
    assert.equal(habilidades.length, totalHabilidades);
    for (const skill of habilidades) {
      assert.match(skill.codigo, codigoRegex, skill.codigo);
      assert.equal(skill.etapa, "Ensino Médio");
      assert.equal(skill.area, area);
      assert.equal(skill.componente, componente);
      assert.deepEqual(skill.competencias_especificas, [Number(skill.codigo[7])]);
      assert.equal(skill.classificacao, "dado_oficial");
      assert.match(skill.documento_url, /basenacionalcomum\.mec\.gov\.br/);
      assert.ok(Number.isInteger(skill.pagina_fonte));
      assert.ok(skill.lote_importacao);
      assert.ok(skill.texto.trim().length > 0);
    }
  });

  test(`Ensino Médio — ${area}: codes are unique and sorted`, () => {
    const codes = dataset.registros.filter((registro) => registro.codigo).map((registro) => registro.codigo);
    assert.equal(new Set(codes).size, codes.length);
    assert.deepEqual([...codes].sort((a, b) => a.localeCompare(b, "pt-BR")), codes);
  });

  // Regression guard for two running-header leaks found and fixed while
  // building extract_ensino_medio_area.py: (1) every page repeats a
  // "N BASE NACIONAL COMUM CURRICULAR" / "N <ÁREA> ENSINO MÉDIO" header that
  // could sweep into the last habilidade of a competência before a page
  // turn, and (2) a long habilidades list spilling onto a page that
  // reprints "HABILIDADES" as a continuation marker instead (confirmed on
  // Ciências da Natureza — EM13CNT307 came out ending in "... cotidiano.
  // HABILIDADES" before the fix).
  test(`Ensino Médio — ${area}: no running-header page furniture leaked into any text`, () => {
    for (const registro of dataset.registros) {
      const label = registro.codigo ?? registro.id;
      assert.doesNotMatch(registro.texto, /BASE NACIONAL/i, label);
      assert.doesNotMatch(registro.texto, /COMUM CURRICULAR/i, label);
      assert.doesNotMatch(registro.texto, /\bHABILIDADES\b/, label);
    }
  });
}

test("Ensino Médio — Matemática: unidade_tematica enrichment covers every habilidade exactly once", async () => {
  const dataset = (await import("../data/bncc/ensino-medio-matematica.json", { with: { type: "json" } })).default;
  const habilidades = dataset.registros.filter((registro) => registro.tipo === "habilidade");
  assert.equal(habilidades.length, 43);
  for (const skill of habilidades) {
    assert.ok(["Números e álgebra", "Geometria e medidas", "Probabilidade e estatística"].includes(skill.unidade_tematica), skill.codigo);
  }
  const totals = {};
  for (const skill of habilidades) totals[skill.unidade_tematica] = (totals[skill.unidade_tematica] ?? 0) + 1;
  assert.deepEqual(totals, { "Números e álgebra": 21, "Geometria e medidas": 12, "Probabilidade e estatística": 10 });
});

test("Ensino Médio — other áreas do not carry a unidade_tematica (only Matemática's official table has one)", async () => {
  for (const scopeId of ["linguagens", "ciencias-da-natureza", "ciencias-humanas", "lingua-portuguesa"]) {
    const dataset = (await import(`../data/bncc/ensino-medio-${scopeId}.json`, { with: { type: "json" } })).default;
    for (const registro of dataset.registros.filter((item) => item.tipo === "habilidade")) {
      assert.equal(registro.unidade_tematica, undefined, `${scopeId} ${registro.codigo}`);
    }
  }
});

test("Ensino Médio — Língua Portuguesa: import is valid and complete (no competências específicas of its own)", async () => {
  const report = (await import("../data/bncc/ensino-medio-lingua-portuguesa.report.json", { with: { type: "json" } })).default;
  const dataset = (await import("../data/bncc/ensino-medio-lingua-portuguesa.json", { with: { type: "json" } })).default;
  assert.equal(report.status, "valido");
  assert.equal(report.total_habilidades, 54);
  assert.equal(report.total_geral, 54);
  assert.deepEqual(report.duplicidades, []);
  assert.deepEqual(report.registros_rejeitados, []);
  assert.deepEqual(report.alertas, []);
  assert.equal(dataset.registros.length, 54);
  assert.equal(dataset.registros.filter((registro) => registro.tipo === "competencia_especifica").length, 0);
});

test("Ensino Médio — Língua Portuguesa: every habilidade has a valid code, campo de atuação, and 1-7 competências específicas from Linguagens", async () => {
  const dataset = (await import("../data/bncc/ensino-medio-lingua-portuguesa.json", { with: { type: "json" } })).default;
  const camposConhecidos = [
    "Todos os Campos de Atuação Social",
    "Campo da Vida Pessoal",
    "Campo de Atuação na Vida Pública",
    "Campo das Práticas de Estudo e Pesquisa",
    "Campo Jornalístico-Midiático",
    "Campo Artístico-Literário",
  ];
  for (const skill of dataset.registros) {
    assert.match(skill.codigo, /^EM13LP\d{2}$/, skill.codigo);
    assert.equal(skill.etapa, "Ensino Médio");
    assert.equal(skill.area, "Linguagens e suas Tecnologias");
    assert.equal(skill.componente, "Língua Portuguesa");
    assert.ok(camposConhecidos.includes(skill.campo_atuacao), `${skill.codigo}: ${skill.campo_atuacao}`);
    assert.ok(Array.isArray(skill.competencias_especificas) && skill.competencias_especificas.length > 0, skill.codigo);
    for (const numero of skill.competencias_especificas) assert.ok(numero >= 1 && numero <= 7, `${skill.codigo}: competência ${numero}`);
    assert.equal(skill.classificacao, "dado_oficial");
    assert.match(skill.documento_url, /basenacionalcomum\.mec\.gov\.br/);
    assert.ok(Number.isInteger(skill.pagina_fonte));
    assert.ok(skill.texto.trim().length > 0);
  }
});

test("Ensino Médio — Língua Portuguesa: campo de atuação distribution matches the official table (18/4/5/8/10/9)", async () => {
  const dataset = (await import("../data/bncc/ensino-medio-lingua-portuguesa.json", { with: { type: "json" } })).default;
  const totals = {};
  for (const skill of dataset.registros) totals[skill.campo_atuacao] = (totals[skill.campo_atuacao] ?? 0) + 1;
  assert.deepEqual(totals, {
    "Todos os Campos de Atuação Social": 18,
    "Campo da Vida Pessoal": 4,
    "Campo de Atuação na Vida Pública": 5,
    "Campo das Práticas de Estudo e Pesquisa": 8,
    "Campo Jornalístico-Midiático": 10,
    "Campo Artístico-Literário": 9,
  });
});

// Regression guard for the risk this scope was built to avoid: a "capture
// up to the next code" approach (used for the 4 simple áreas) would swallow
// a whole campo's narrative introduction and Parâmetros bullet list into
// the preceding habilidade's text (confirmed this actually happens between
// EM13LP18 and EM13LP19 in the raw PDF). Each match here is atomic with its
// own competências-específicas line, so no body should ever run past ~800
// characters (the longest genuine habilidade found by hand) or contain
// table/section furniture.
test("Ensino Médio — Língua Portuguesa: no campo introduction or Parâmetros text leaked into any habilidade", async () => {
  const dataset = (await import("../data/bncc/ensino-medio-lingua-portuguesa.json", { with: { type: "json" } })).default;
  for (const skill of dataset.registros) {
    assert.ok(skill.texto.length < 1000, `${skill.codigo}: ${skill.texto.length} chars — likely swallowed extra text`);
    assert.doesNotMatch(skill.texto, /Parâmetros para a organização/i, skill.codigo);
    assert.doesNotMatch(skill.texto, /^(TODOS OS CAMPOS|CAMPO )/i, skill.codigo);
    assert.doesNotMatch(skill.texto, /PRÁTICAS\n|Competências\s*\nespecíficas/i, skill.codigo);
    assert.doesNotMatch(skill.texto, /BASE NACIONAL/i, skill.codigo);
    assert.doesNotMatch(skill.texto, /COMUM CURRICULAR/i, skill.codigo);
  }
});

test("Ensino Médio — Ciências Humanas: the ligature-glyph typography correction was applied", async () => {
  const dataset = (await import("../data/bncc/ensino-medio-ciencias-humanas.json", { with: { type: "json" } })).default;
  const competencia1 = dataset.registros.find((registro) => registro.tipo === "competencia_especifica" && registro.numero === 1);
  const competencia5 = dataset.registros.find((registro) => registro.tipo === "competencia_especifica" && registro.numero === 5);
  assert.match(competencia1.texto, /científicos e tecnológicos/);
  assert.match(competencia1.texto, /fontes de natureza científica\.$/);
  assert.match(competencia5.texto, /^Identificar e combater/);
  for (const registro of dataset.registros) {
    assert.doesNotMatch(registro.texto, /ﬁ/, registro.codigo ?? registro.id);
  }
});

test("aggregate import report accounts for all 5 Ensino Médio scopes (4 áreas + Língua Portuguesa)", async () => {
  const summary = (await import("../data/bncc/import-report.json", { with: { type: "json" } })).default;
  assert.equal(summary.status, "valido");
  let totalMedio = 0;
  for (const { scopeId, totalCompetencias, totalHabilidades } of AREAS) {
    const total = totalCompetencias + totalHabilidades;
    assert.equal(summary.escopos[`ensino-medio-${scopeId}`].status, "valido");
    assert.equal(summary.escopos[`ensino-medio-${scopeId}`].total, total);
    totalMedio += total;
  }
  assert.equal(summary.escopos["ensino-medio-lingua-portuguesa"].status, "valido");
  assert.equal(summary.escopos["ensino-medio-lingua-portuguesa"].total, 54);
  totalMedio += 54;
  assert.equal(summary.total_por_etapa["Ensino Médio"], totalMedio);
});
