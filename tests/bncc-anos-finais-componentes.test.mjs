import assert from "node:assert/strict";
import test from "node:test";

const COMPONENTES = [
  { scopeId: "matematica-anos-iniciais", componente: "Matemática", total: 126, codigoRegex: /^EF0[1-5]MA\d{2}$/ },
  { scopeId: "arte-anos-finais", componente: "Arte", total: 35, codigoRegex: /^EF69AR\d{2}$/ },
  { scopeId: "educacao-fisica-anos-finais", componente: "Educação Física", total: 42, codigoRegex: /^EF(67|89)EF\d{2}$/ },
  { scopeId: "lingua-inglesa-anos-finais", componente: "Língua Inglesa", total: 88, codigoRegex: /^EF0[6-9]LI\d{2}$/ },
  { scopeId: "ciencias-anos-finais", componente: "Ciências", total: 63, codigoRegex: /^EF0[6-9]CI\d{2}$/ },
  { scopeId: "geografia-anos-finais", componente: "Geografia", total: 67, codigoRegex: /^EF0[6-9]GE\d{2}$/ },
  { scopeId: "historia-anos-finais", componente: "História", total: 98, codigoRegex: /^EF0[6-9]HI\d{2}$/ },
  { scopeId: "ensino-religioso-anos-finais", componente: "Ensino Religioso", total: 30, codigoRegex: /^EF0[6-9]ER\d{2}$/ },
];

for (const { scopeId, componente, total, codigoRegex } of COMPONENTES) {
  const report = (await import(`../data/bncc/${scopeId}.report.json`, { with: { type: "json" } })).default;
  const dataset = (await import(`../data/bncc/${scopeId}.json`, { with: { type: "json" } })).default;

  test(`${componente}: import is valid with no duplicates or rejections`, () => {
    assert.equal(report.status, "valido");
    assert.equal(report.total_geral, total);
    assert.deepEqual(report.duplicidades, []);
    assert.deepEqual(report.registros_rejeitados, []);
    assert.equal(dataset.registros.length, total);
  });

  test(`${componente}: every record has a valid code, unidade temática, and traceable source metadata`, () => {
    for (const skill of dataset.registros) {
      assert.match(skill.codigo, codigoRegex, skill.codigo);
      assert.equal(skill.tipo, "habilidade");
      assert.equal(skill.componente, componente);
      assert.ok(skill.unidade_tematica?.trim().length > 0, `${skill.codigo} missing unidade_tematica`);
      assert.ok(skill.objeto_conhecimento?.trim().length > 0, `${skill.codigo} missing objeto_conhecimento`);
      assert.equal(skill.classificacao, "dado_oficial");
      assert.match(skill.documento_url, /basenacionalcomum\.mec\.gov\.br/);
      assert.ok(Array.isArray(skill.anos_aplicaveis) && skill.anos_aplicaveis.length > 0);
      assert.ok(skill.lote_importacao);
      assert.ok(skill.texto.trim().length > 0);
    }
  });

  test(`${componente}: codes are unique and sorted`, () => {
    const codes = dataset.registros.map((skill) => skill.codigo);
    assert.equal(new Set(codes).size, codes.length);
    assert.deepEqual([...codes].sort((a, b) => a.localeCompare(b, "pt-BR")), codes);
  });
}

test("Arte: every Anos Finais skill uses the single consolidated EF69AR code and applies to all four grades", async () => {
  const dataset = (await import("../data/bncc/arte-anos-finais.json", { with: { type: "json" } })).default;
  for (const skill of dataset.registros) {
    assert.equal(skill.ano, "6º ao 9º ano");
    assert.deepEqual(skill.anos_aplicaveis, ["6º ano", "7º ano", "8º ano", "9º ano"]);
  }
});

test("Educação Física: every Anos Finais skill is grade-paired, never a single grade", async () => {
  const dataset = (await import("../data/bncc/educacao-fisica-anos-finais.json", { with: { type: "json" } })).default;
  for (const skill of dataset.registros) {
    assert.equal(skill.anos_aplicaveis.length, 2, skill.codigo);
  }
  const anos = new Set(dataset.registros.map((skill) => skill.ano));
  assert.deepEqual(anos, new Set(["6º e 7º ano", "8º e 9º ano"]));
});

test("Ensino Religioso: all four Anos Finais grades are represented despite the missing dedicated 6º ano heading", async () => {
  const dataset = (await import("../data/bncc/ensino-religioso-anos-finais.json", { with: { type: "json" } })).default;
  const anos = new Set(dataset.registros.map((skill) => skill.ano));
  assert.deepEqual(anos, new Set(["6º ano", "7º ano", "8º ano", "9º ano"]));
});

test("aggregate import report accounts for all Ensino Fundamental Anos Finais components plus Competências Gerais", async () => {
  const summary = (await import("../data/bncc/import-report.json", { with: { type: "json" } })).default;
  assert.equal(summary.status, "valido");
  assert.equal(summary.total_geral, 865);
  assert.equal(summary.total_por_etapa["Ensino Fundamental"], 855);
  assert.equal(summary.total_por_etapa["Educação Básica"], 10);
  for (const { scopeId, total } of COMPONENTES) {
    assert.equal(summary.escopos[scopeId].status, "valido");
    assert.equal(summary.escopos[scopeId].total, total);
  }
});
