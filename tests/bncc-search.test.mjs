import assert from "node:assert/strict";
import test from "node:test";
import competencias from "../data/bncc/competencias-gerais.json" with { type: "json" };
import educacaoInfantil from "../data/bncc/educacao-infantil.json" with { type: "json" };
import portugues from "../data/bncc/lingua-portuguesa-anos-finais.json" with { type: "json" };
import dataset from "../data/bncc/matematica-anos-finais.json" with { type: "json" };
import { filterSkills, normalizeSearchText, parseSearchQuery } from "../lib/bncc/search.mjs";

const skills = dataset.registros;
const allRegistros = [...dataset.registros, ...portugues.registros, ...competencias.registros, ...educacaoInfantil.registros];
const objetivosInfantil = educacaoInfantil.registros.filter((registro) => registro.tipo === "objetivo_aprendizagem");
const direitosInfantil = educacaoInfantil.registros.filter((registro) => registro.tipo === "direito_aprendizagem");

test("normalizes accents, whitespace, and case", () => {
  assert.equal(normalizeSearchText("  EQUAÇÕES   Polinomiais  "), "equacoes polinomiais");
});

test("finds an exact BNCC code case-insensitively", () => {
  const results = filterSkills(skills, { query: "ef07ma18" });
  assert.deepEqual(results.map((skill) => skill.codigo), ["EF07MA18"]);
});

test("interprets a suggested grade query and keeps the subject as a search term", () => {
  assert.deepEqual(parseSearchQuery("Matemática 8º ano"), { query: "matematica", year: "8º ano" });
  const results = filterSkills(skills, { query: "Matemática 8º ano" });
  assert.equal(results.length, 27);
  assert.ok(results.every((skill) => skill.ano === "8º ano"));
});

test("finds skill text without requiring accents", () => {
  const results = filterSkills(skills, { query: "equacoes polinomiais" });
  assert.ok(results.some((skill) => skill.codigo === "EF07MA18"));
});

test("combines year, unit, object, and query filters", () => {
  const target = skills.find((skill) => skill.codigo === "EF07MA18");
  const results = filterSkills(skills, {
    query: "propriedades da igualdade",
    year: "7º ano",
    unit: target.unidade_tematica,
    object: target.objeto_conhecimento,
  });
  assert.deepEqual(results.map((skill) => skill.codigo), ["EF07MA18"]);
});

test("returns an empty list when no skill matches", () => {
  assert.deepEqual(filterSkills(skills, { query: "codigo inexistente xyz" }), []);
});

test("searches across scopes and finds a Competência Geral by its official text", () => {
  const results = filterSkills(allRegistros, { query: "consciência socioambiental" });
  assert.deepEqual(results.map((item) => [item.tipo, item.numero]), [["competencia_geral", 7]]);
});

test("a component name matches every record from that component even when the skill text doesn't repeat the word", () => {
  const results = filterSkills(allRegistros, { query: "matemática" });
  const matchedCodes = new Set(results.filter((item) => item.tipo === "habilidade").map((item) => item.codigo));
  assert.equal(matchedCodes.size, skills.length);
});

test("filtering by a single year also surfaces grade-paired and full-range codes that apply to it", () => {
  const results = filterSkills(portugues.registros, { year: "7º ano" });
  const codes = results.map((skill) => skill.codigo);
  assert.ok(codes.includes("EF07LP01"), "single-grade 7º ano code missing");
  assert.ok(codes.includes("EF67LP01"), "6º-7º paired code should apply to 7º ano too");
  assert.ok(codes.includes("EF69LP01"), "6º-9º full-range code should apply to 7º ano too");
  assert.ok(!codes.includes("EF89LP01"), "8º-9º paired code should not apply to 7º ano");
  assert.ok(results.every((skill) => skill.anos_aplicaveis.includes("7º ano")));
});

test("finds a Língua Portuguesa habilidade by campo de atuação across the merged dataset", () => {
  const results = filterSkills(allRegistros, { query: "campo artístico-literário" });
  assert.ok(results.length > 0);
  assert.ok(results.every((item) => item.campo_atuacao === "Campo Artístico-Literário"));
});

// ---- Educação Infantil ----

test("finds an Educação Infantil objetivo by its EI code case-insensitively", () => {
  const results = filterSkills(objetivosInfantil, { query: "ei02ts01" });
  assert.deepEqual(results.map((objetivo) => objetivo.codigo), ["EI02TS01"]);
});

test("finds an objetivo by a fragment of its official text, without requiring accents", () => {
  const results = filterSkills(objetivosInfantil, { query: "para acompanhar diversos ritmos de musica" });
  assert.ok(results.some((objetivo) => objetivo.codigo === "EI02TS01"));
});

test("finds every objetivo of a campo de experiências by its official name", () => {
  const results = filterSkills(objetivosInfantil, { query: "corpo, gestos e movimentos" });
  assert.equal(results.length, 15);
  assert.ok(results.every((objetivo) => objetivo.campo_experiencia_sigla === "CG"));
});

test("finds every objetivo of a grupo por faixa etária by its official name", () => {
  const results = filterSkills(objetivosInfantil, { query: "crianças bem pequenas" });
  assert.equal(results.length, 32);
  assert.ok(results.every((objetivo) => objetivo.faixa_etaria_codigo === "02"));
});

test("the faixa filter param narrows objetivos to exactly that grupo por faixa etária", () => {
  const results = filterSkills(objetivosInfantil, { faixa: "01" });
  assert.equal(results.length, 29);
  assert.ok(results.every((objetivo) => objetivo.faixa_etaria_codigo === "01"));
});

test("finds the direito 'Brincar' by its official name", () => {
  const results = filterSkills(direitosInfantil, { query: "brincar" });
  assert.deepEqual(results.map((direito) => direito.nome), ["Brincar"]);
});

test("finds the direito 'Conhecer-se' by its official name, including the hyphen", () => {
  const results = filterSkills(direitosInfantil, { query: "conhecer-se" });
  assert.deepEqual(results.map((direito) => direito.nome), ["Conhecer-se"]);
});

test("finds a direito by a fragment of its own official text", () => {
  const results = filterSkills(direitosInfantil, { query: "planejamento da gestão da escola" });
  assert.deepEqual(results.map((direito) => direito.nome), ["Participar"]);
});

test("searching across all merged scopes still surfaces Educação Infantil objetivos and direitos without losing Fundamental/Médio/Competências results", () => {
  const objetivoResults = filterSkills(allRegistros, { query: "EI02TS01" });
  assert.deepEqual(objetivoResults.map((item) => item.codigo), ["EI02TS01"]);

  const direitoResults = filterSkills(allRegistros, { query: "conhecer-se" });
  assert.ok(direitoResults.some((item) => item.tipo === "direito_aprendizagem" && item.nome === "Conhecer-se"));

  // Fundamental (Matemática) and Competências Gerais searches from earlier
  // tests still resolve correctly with Educação Infantil merged in.
  assert.ok(filterSkills(allRegistros, { query: "ef07ma18" }).some((item) => item.codigo === "EF07MA18"));
  assert.ok(filterSkills(allRegistros, { query: "consciência socioambiental" }).some((item) => item.tipo === "competencia_geral" && item.numero === 7));
});

test("no Educação Infantil registro is ever labeled 'habilidade'", () => {
  for (const registro of [...objetivosInfantil, ...direitosInfantil]) {
    assert.notEqual(registro.tipo, "habilidade");
  }
});
