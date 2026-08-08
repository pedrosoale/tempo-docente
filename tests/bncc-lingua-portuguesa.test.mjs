import assert from "node:assert/strict";
import test from "node:test";
import report from "../data/bncc/lingua-portuguesa-anos-finais.report.json" with { type: "json" };
import dataset from "../data/bncc/lingua-portuguesa-anos-finais.json" with { type: "json" };

const KNOWN_CAMPOS = new Set([
  "Campo Jornalístico-Midiático",
  "Campo de Atuação na Vida Pública",
  "Campo das Práticas de Estudo e Pesquisa",
  "Campo Artístico-Literário",
  "Todos os Campos de Atuação",
]);

const GRADE_TO_ANOS = {
  "06": ["6º ano"], "07": ["7º ano"], "08": ["8º ano"], "09": ["9º ano"],
  "67": ["6º ano", "7º ano"], "89": ["8º ano", "9º ano"],
  "69": ["6º ano", "7º ano", "8º ano", "9º ano"],
};

test("official Língua Portuguesa import is valid with no duplicates or rejections", () => {
  assert.equal(report.status, "valido");
  assert.equal(report.total_geral, 185);
  assert.deepEqual(report.duplicidades, []);
  assert.deepEqual(report.registros_rejeitados, []);
  assert.equal(dataset.registros.length, report.total_geral);
});

test("every record has a known campo de atuação and traceable source metadata", () => {
  for (const skill of dataset.registros) {
    assert.match(skill.codigo, /^EF(06|07|08|09|67|89|69)LP\d{2}$/);
    assert.equal(skill.tipo, "habilidade");
    assert.equal(skill.componente, "Língua Portuguesa");
    assert.ok(KNOWN_CAMPOS.has(skill.campo_atuacao), `unknown campo: ${skill.campo_atuacao}`);
    assert.equal(skill.classificacao, "dado_oficial");
    assert.match(skill.documento_url, /basenacionalcomum\.mec\.gov\.br/);
    assert.ok(skill.lote_importacao);
    // Unlike Matemática, this component organizes by campo de atuação rather
    // than unidade temática — but it still has an objeto de conhecimento per
    // row of the official table, prefixed with the prática de linguagem
    // (Leitura, Escrita…) when the row has one.
    assert.equal(skill.unidade_tematica, undefined);
    assert.ok(skill.objeto_conhecimento?.trim().length > 0, `${skill.codigo} missing objeto_conhecimento`);
  }
});

test("derives ano and anos_aplicaveis from the code's grade digits, including grade-paired codes", () => {
  for (const skill of dataset.registros) {
    const gradeKey = skill.codigo.slice(2, 4);
    assert.deepEqual(skill.anos_aplicaveis, GRADE_TO_ANOS[gradeKey], skill.codigo);
  }
  const paired = dataset.registros.find((skill) => skill.codigo === "EF67LP01");
  assert.deepEqual(paired.anos_aplicaveis, ["6º ano", "7º ano"]);
  assert.equal(paired.ano, "6º e 7º ano");
  const fullRange = dataset.registros.find((skill) => skill.codigo === "EF69LP01");
  assert.deepEqual(fullRange.anos_aplicaveis, ["6º ano", "7º ano", "8º ano", "9º ano"]);
});

test("flags EF67LP27's missing terminal punctuation as a known source characteristic, not a rejection", () => {
  assert.deepEqual(report.alertas, [
    { codigo: "EF67LP27", alerta: "Texto da habilidade pode estar truncado: pontuação final ausente (conferido contra o PDF oficial — pode ser assim na fonte)" },
  ]);
  const skill = dataset.registros.find((item) => item.codigo === "EF67LP27");
  assert.match(skill.texto, /recursos literários e semióticos$/);
});
