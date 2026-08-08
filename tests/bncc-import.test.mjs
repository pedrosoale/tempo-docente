import assert from "node:assert/strict";
import test from "node:test";
import report from "../data/bncc/matematica-anos-finais.report.json" with { type: "json" };
import dataset from "../data/bncc/matematica-anos-finais.json" with { type: "json" };

test("official BNCC import is valid and complete for the declared scope", () => {
  assert.equal(report.status, "valido");
  assert.equal(report.total_geral, 121);
  assert.deepEqual(report.total_por_ano, {
    "6º ano": 34,
    "7º ano": 37,
    "8º ano": 27,
    "9º ano": 23,
  });
  assert.deepEqual(report.duplicidades, []);
  assert.deepEqual(report.registros_rejeitados, []);
  assert.deepEqual(report.alertas, []);
  assert.equal(dataset.registros.length, report.total_geral);
});

test("every record has traceable official-source metadata", () => {
  for (const skill of dataset.registros) {
    assert.match(skill.codigo, /^EF0[6-9]MA\d{2}$/);
    assert.equal(skill.tipo, "habilidade");
    assert.equal(skill.classificacao, "dado_oficial");
    assert.match(skill.fonte, /Ministério da Educação/);
    assert.match(skill.documento_url, /basenacionalcomum\.mec\.gov\.br/);
    assert.ok(Number.isInteger(skill.pagina_fonte));
    assert.ok(skill.lote_importacao);
  }
});

test("preserves the official superscript in EF08MA09", () => {
  const skill = dataset.registros.find((item) => item.codigo === "EF08MA09");
  assert.ok(skill);
  assert.match(skill.objeto_conhecimento, /ax² = b/);
  assert.match(skill.texto, /ax² = b\./);
  assert.doesNotMatch(`${skill.objeto_conhecimento} ${skill.texto}`, /ax2/);
  assert.ok(dataset.metadata.correcoes_tipograficas_controladas.some((item) => item.codigo === "EF08MA09"));
});
