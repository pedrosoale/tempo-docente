import assert from "node:assert/strict";
import test from "node:test";
import report from "../data/bncc/competencias-gerais.report.json" with { type: "json" };
import dataset from "../data/bncc/competencias-gerais.json" with { type: "json" };

test("official Competências Gerais import is valid and complete", () => {
  assert.equal(report.status, "valido");
  assert.equal(report.total_geral, 10);
  assert.deepEqual(report.registros_rejeitados, []);
  assert.deepEqual(report.alertas, []);
  assert.equal(dataset.registros.length, 10);
});

test("numbers the ten competências sequentially with no gaps or duplicates", () => {
  const numbers = dataset.registros.map((item) => item.numero);
  assert.deepEqual(numbers, [1, 2, 3, 4, 5, 6, 7, 8, 9, 10]);
});

test("every record has official text and traceable source metadata", () => {
  for (const item of dataset.registros) {
    assert.equal(item.tipo, "competencia_geral");
    assert.equal(item.etapa, "Educação Básica");
    assert.equal(item.codigo, null);
    assert.ok(item.texto.trim().length > 0);
    assert.equal(item.classificacao, "dado_oficial");
    assert.match(item.fonte, /Ministério da Educação/);
    assert.match(item.documento_url, /basenacionalcomum\.mec\.gov\.br/);
    assert.ok(item.lote_importacao);
  }
});

test("recomposes the line-wrapped word in competência 8 without a stray hyphen", () => {
  const item = dataset.registros.find((candidate) => candidate.numero === 8);
  assert.ok(item);
  assert.match(item.texto, /compreendendo-se/);
  assert.doesNotMatch(item.texto, /com- preendendo-se/);
});
