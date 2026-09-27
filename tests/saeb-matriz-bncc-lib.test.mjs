// Testes puros de lib/saeb/matriz-bncc.ts — nenhuma rede, nenhum estado de UI. Usa o catálogo real
// (data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json), mesmo padrão de
// tests/saeb-descritores-lib.test.mjs.
import assert from "node:assert/strict";
import test from "node:test";

import {
  agruparPorEixo,
  buscarFonte,
  buscarHabilidades,
  buscarPorCodigoOficial,
  buscarPorIdInterno,
  buscarPorTexto,
  catalogoMatrizBncc,
  filtrarHabilidadesPorTexto,
  filtrarPorComponente,
  filtrarPorEixoCognitivo,
  filtrarPorEixoConhecimento,
  filtrarPorEtapa,
  listarComponentes,
  listarEtapas,
} from "../lib/saeb/matriz-bncc.ts";

// ---- listarEtapas / listarComponentes ----

test("listarEtapas: as três etapas do 2º, 5º e 9º ano, nesta ordem", () => {
  assert.deepEqual(listarEtapas(), ["2anoEF", "5anoEF", "9anoEF"]);
});

test("listarComponentes: linguagens e matematica", () => {
  assert.deepEqual(listarComponentes(), ["linguagens", "matematica"]);
});

// ---- buscarPorCodigoOficial ----

test("buscarPorCodigoOficial: encontra uma habilidade de Matemática pelo código oficial", () => {
  const h = buscarPorCodigoOficial("9G2.7");
  assert.ok(h);
  assert.equal(h.componente, "matematica");
  assert.equal(h.etapa, "9anoEF");
  assert.equal(h.eixoConhecimento, "Geometria");
  assert.match(h.textoHabilidade, /circunfer[eê]ncia/);
});

test("buscarPorCodigoOficial: devolve undefined para código inexistente, incluindo códigos D<n> da matriz tradicional", () => {
  assert.equal(buscarPorCodigoOficial("9Z9.99"), undefined);
  assert.equal(buscarPorCodigoOficial("D7"), undefined, "D7 é da matriz tradicional — nunca deveria existir aqui");
});

// ---- buscarPorIdInterno ----

test("buscarPorIdInterno: encontra uma habilidade pelo identificador interno e nunca pelo código oficial", () => {
  const porCodigo = buscarPorCodigoOficial("9G2.7");
  const porId = buscarPorIdInterno(porCodigo.idInterno);
  assert.ok(porId);
  assert.equal(porId.codigoOficial, "9G2.7");
  // O idInterno nunca deve, ele mesmo, funcionar como um código oficial de busca — são vocabulários distintos.
  assert.equal(buscarPorCodigoOficial(porCodigo.idInterno), undefined);
});

test("buscarPorIdInterno: devolve undefined para id inexistente", () => {
  assert.equal(buscarPorIdInterno("inexistente"), undefined);
});

// ---- buscarFonte ----

test("buscarFonte: metadados de proveniência de cada componente, incluindo situação de aplicação documentada", () => {
  const linguagens = buscarFonte("linguagens");
  assert.equal(linguagens.componente, "linguagens");
  assert.match(linguagens.hashSha256, /^[0-9a-f]{64}$/);
  assert.equal(linguagens.distintaDaMatrizTradicional, true);
  assert.ok(linguagens.situacaoAplicacao.length > 0);

  const matematica = buscarFonte("matematica");
  assert.equal(matematica.componente, "matematica");
  assert.match(matematica.hashSha256, /^[0-9a-f]{64}$/);
});

// ---- filtrarPorEtapa / filtrarPorComponente ----

test("filtrarPorEtapa: 2º ano tem 43 habilidades (10 Linguagens + 33 Matemática)", () => {
  assert.equal(filtrarPorEtapa("2anoEF").length, 43);
});

test("filtrarPorComponente: Linguagens tem 114, Matemática tem 148", () => {
  assert.equal(filtrarPorComponente("linguagens").length, 114);
  assert.equal(filtrarPorComponente("matematica").length, 148);
});

test("filtrarPorComponente: nenhuma habilidade de Linguagens tem codigoOficial", () => {
  for (const h of filtrarPorComponente("linguagens")) assert.equal(h.codigoOficial, null);
});

// ---- filtrarPorEixoConhecimento / filtrarPorEixoCognitivo ----

test("filtrarPorEixoConhecimento: 'Língua inglesa' só existe no 9º ano de Linguagens (10 habilidades)", () => {
  const resultado = filtrarPorEixoConhecimento("Língua inglesa");
  assert.equal(resultado.length, 10);
  for (const h of resultado) {
    assert.equal(h.componente, "linguagens");
    assert.equal(h.etapa, "9anoEF");
  }
});

test("filtrarPorEixoConhecimento: 'Geometria' (Matemática) soma 33 nas três etapas (4+11+18)", () => {
  assert.equal(filtrarPorEixoConhecimento("Geometria").length, 33);
});

test("filtrarPorEixoCognitivo: 'Resolver problemas e argumentar' (Matemática) soma exatamente 53", () => {
  const resultado = filtrarPorEixoCognitivo("Resolver problemas e argumentar");
  assert.equal(resultado.length, 53);
  for (const h of resultado) assert.equal(h.componente, "matematica");
});

test("filtrarPorEixoCognitivo: 'Produzir' (Linguagens) soma exatamente 2 (1 no 5º ano + 1 no 9º ano)", () => {
  const resultado = filtrarPorEixoCognitivo("Produzir");
  assert.equal(resultado.length, 2);
  for (const h of resultado) assert.equal(h.componente, "linguagens");
});

// ---- buscarPorTexto ----

test("buscarPorTexto: string vazia devolve o catálogo inteiro (262 habilidades)", () => {
  assert.equal(buscarPorTexto("").length, 262);
  assert.equal(buscarPorTexto("   ").length, 262);
});

test("buscarPorTexto: busca sem diferenciar maiúsculas/minúsculas", () => {
  const minuscula = buscarPorTexto("problemas");
  const maiuscula = buscarPorTexto("PROBLEMAS");
  assert.ok(minuscula.length > 0);
  assert.equal(minuscula.length, maiuscula.length);
});

test("buscarPorTexto: busca sem diferenciar acentuação ('circunferencia' encontra 'circunferência')", () => {
  const comAcento = buscarPorTexto("circunferência");
  const semAcento = buscarPorTexto("circunferencia");
  assert.ok(comAcento.length > 0);
  assert.equal(comAcento.length, semAcento.length);
});

test("buscarPorTexto: também casa por código oficial de Matemática", () => {
  const resultado = buscarPorTexto("9G2.7");
  assert.ok(resultado.some((h) => h.codigoOficial === "9G2.7"));
});

test("buscarPorTexto: nunca reescreve ou abrevia o texto encontrado", () => {
  const [h] = buscarPorTexto("teorema de Pitágoras");
  assert.ok(h);
  assert.equal(h.textoHabilidade, "Resolver problemas que envolvam relações métricas do triângulo retângulo, incluindo o teorema de Pitágoras.");
});

// ---- Distinção estrutural: nunca confundir com a matriz tradicional ----

test("catalogoMatrizBncc: todo o catálogo é marcado como distinto da matriz tradicional", () => {
  assert.equal(catalogoMatrizBncc.catalogo.distintoDaMatrizTradicional, true);
  assert.equal(catalogoMatrizBncc.fontes.linguagens.distintaDaMatrizTradicional, true);
  assert.equal(catalogoMatrizBncc.fontes.matematica.distintaDaMatrizTradicional, true);
});

test("catalogoMatrizBncc: nenhum código oficial de Matemática está no formato D<n> da matriz tradicional", () => {
  for (const h of filtrarPorComponente("matematica")) {
    assert.doesNotMatch(h.codigoOficial, /^D[1-9][0-9]*$/, `código "${h.codigoOficial}" colide com o padrão D<n>`);
  }
});

test("catalogoMatrizBncc: nenhuma habilidade afirma aplicação da matriz de Linguagens/Matemática em 5º/9º ano numa edição específica do Saeb", () => {
  const situacaoLinguagens = buscarFonte("linguagens").situacaoAplicacao;
  const situacaoMatematica = buscarFonte("matematica").situacaoAplicacao;
  assert.match(situacaoLinguagens, /inconclusivo/i);
  assert.match(situacaoMatematica, /inconclusivo/i);
});

// ---- buscarHabilidades (Rodada 14 — interface) ----

test("buscarHabilidades: as seis combinações etapa×componente batem exatamente com as contagens aprovadas", () => {
  assert.equal(buscarHabilidades("2anoEF", "linguagens").length, 10);
  assert.equal(buscarHabilidades("2anoEF", "matematica").length, 33);
  assert.equal(buscarHabilidades("5anoEF", "linguagens").length, 47);
  assert.equal(buscarHabilidades("5anoEF", "matematica").length, 56);
  assert.equal(buscarHabilidades("9anoEF", "linguagens").length, 57);
  assert.equal(buscarHabilidades("9anoEF", "matematica").length, 59);
});

test("buscarHabilidades: nunca mistura componente ou etapa fora do recorte pedido", () => {
  for (const h of buscarHabilidades("9anoEF", "matematica")) {
    assert.equal(h.etapa, "9anoEF");
    assert.equal(h.componente, "matematica");
  }
});

// ---- filtrarHabilidadesPorTexto (Rodada 14 — interface) ----

test("filtrarHabilidadesPorTexto: string vazia devolve o subconjunto original, sem cópia desnecessária", () => {
  const subset = buscarHabilidades("5anoEF", "matematica");
  assert.equal(filtrarHabilidadesPorTexto(subset, ""), subset);
});

test("filtrarHabilidadesPorTexto: busca por código só funciona dentro de Matemática, nunca inventa código para Linguagens", () => {
  const linguagens = buscarHabilidades("9anoEF", "linguagens");
  assert.equal(filtrarHabilidadesPorTexto(linguagens, "9E1").length, 0);
  const matematica = buscarHabilidades("9anoEF", "matematica");
  assert.ok(filtrarHabilidadesPorTexto(matematica, "9G2.7").some((h) => h.codigoOficial === "9G2.7"));
});

test("filtrarHabilidadesPorTexto: busca textual sem diferenciar maiúsculas/minúsculas ou acentuação, restrita ao subconjunto", () => {
  const subset = buscarHabilidades("9anoEF", "matematica");
  const comAcento = filtrarHabilidadesPorTexto(subset, "circunferência");
  const semAcento = filtrarHabilidadesPorTexto(subset, "CIRCUNFERENCIA");
  assert.ok(comAcento.length > 0);
  assert.equal(comAcento.length, semAcento.length);
});

// ---- agruparPorEixo (Rodada 14 — interface) ----

test("agruparPorEixo: cada habilidade do recorte aparece em exatamente um subgrupo, nenhuma perdida ou duplicada", () => {
  const habilidades = buscarHabilidades("9anoEF", "matematica");
  const grupos = agruparPorEixo(habilidades);
  const total = grupos.reduce((soma, g) => soma + g.subgrupos.reduce((s, sg) => s + sg.habilidades.length, 0), 0);
  assert.equal(total, habilidades.length);
  assert.equal(
    grupos.reduce((soma, g) => soma + g.totalHabilidades, 0),
    habilidades.length,
  );
});

test("agruparPorEixo: eixoCognitivo é null só para Linguagens/2º ano (Quadro 1, sem eixo cognitivo)", () => {
  const grupos2anoLinguagens = agruparPorEixo(buscarHabilidades("2anoEF", "linguagens"));
  for (const grupo of grupos2anoLinguagens) {
    for (const subgrupo of grupo.subgrupos) assert.equal(subgrupo.eixoCognitivo, null);
  }
  const grupos9anoMatematica = agruparPorEixo(buscarHabilidades("9anoEF", "matematica"));
  for (const grupo of grupos9anoMatematica) {
    for (const subgrupo of grupo.subgrupos) assert.notEqual(subgrupo.eixoCognitivo, null);
  }
});

test("agruparPorEixo: cada subgrupo vem ordenado por ordemEditorial, nunca fora de ordem", () => {
  const grupos = agruparPorEixo(buscarHabilidades("9anoEF", "matematica"));
  for (const grupo of grupos) {
    for (const subgrupo of grupo.subgrupos) {
      const ordens = subgrupo.habilidades.map((h) => h.ordemEditorial);
      const ordenadas = [...ordens].sort((a, b) => a - b);
      assert.deepEqual(ordens, ordenadas);
    }
  }
});

test("agruparPorEixo: preserva a ordem de primeira ocorrência dos eixos do conhecimento (a ordem dos quadros oficiais), nunca reordena alfabeticamente", () => {
  const habilidades = buscarHabilidades("5anoEF", "linguagens");
  const grupos = agruparPorEixo(habilidades);
  const ordemEsperada = [];
  for (const h of habilidades) if (!ordemEsperada.includes(h.eixoConhecimento)) ordemEsperada.push(h.eixoConhecimento);
  assert.deepEqual(
    grupos.map((g) => g.eixoConhecimento),
    ordemEsperada,
  );
});
