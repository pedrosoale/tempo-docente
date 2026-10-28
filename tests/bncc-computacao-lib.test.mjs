// Testes puros de lib/bncc/computacao.ts — nenhuma rede, nenhum estado de UI. Usam o catálogo real
// (data/bncc/computacao-*.json). A biblioteca é INTERNA: estes testes também provam que ela não vaza para
// a busca pública existente (lib/bncc/search.mjs / data.ts).
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";

import {
  ESCOPOS_COMPUTACAO,
  NOME_CURTO_COMPUTACAO,
  NOME_OFICIAL_COMPUTACAO,
  buscarPorCodigo,
  buscarPorExemplos,
  buscarPorExplicacao,
  buscarPorIdInterno,
  buscarPorTexto,
  codigoImpressoNaFonte,
  ehCodigoOficial,
  filtrarPorAno,
  filtrarPorBlocoDeAnos,
  filtrarPorCompetenciaEspecifica,
  filtrarPorEixo,
  filtrarPorEtapa,
  filtrarPorObjetoDeConhecimento,
  filtrarPorSegmento,
  listarCompetenciasEspecificas,
  listarHabilidades,
  listarPremissas,
  listarTodosRegistros,
  obterMetadados,
  obterRelacoesTransversais,
} from "../lib/bncc/computacao.ts";

test("nomes: oficial e curto interno; os quatro escopos", () => {
  assert.equal(NOME_OFICIAL_COMPUTACAO, "Computação na Educação Básica — Complemento à BNCC");
  assert.equal(NOME_CURTO_COMPUTACAO, "BNCC Computação");
  assert.deepEqual(ESCOPOS_COMPUTACAO, ["educacao-infantil", "anos-iniciais", "anos-finais", "ensino-medio"]);
});

test("listarHabilidades: 141 registros (11 objetivos + 130 habilidades); listarTodosRegistros inclui competências e premissas", () => {
  const h = listarHabilidades();
  assert.equal(h.length, 141);
  assert.equal(h.filter((x) => x.tipo === "objetivo_aprendizagem").length, 11);
  assert.equal(h.filter((x) => x.tipo === "habilidade").length, 130);
  assert.equal(listarTodosRegistros().length, 15 + 57 + 61 + 33);
});

test("listarCompetenciasEspecificas: 7 do EF (sem duplicar entre os dois arquivos) + 7 do EM; listarPremissas: 4", () => {
  assert.equal(listarCompetenciasEspecificas().length, 14);
  assert.equal(listarCompetenciasEspecificas("Ensino Fundamental").length, 7);
  assert.equal(listarCompetenciasEspecificas("Ensino Médio").length, 7);
  assert.equal(listarCompetenciasEspecificas("Educação Infantil").length, 0);
  assert.equal(listarPremissas().length, 4);
});

test("filtrarPorEtapa e filtrarPorSegmento", () => {
  assert.equal(filtrarPorEtapa("Educação Infantil").length, 11);
  assert.equal(filtrarPorEtapa("Ensino Fundamental").length, 104);
  assert.equal(filtrarPorEtapa("Ensino Médio").length, 26);
  assert.equal(filtrarPorSegmento("Anos Iniciais").length, 50);
  assert.equal(filtrarPorSegmento("Anos Finais").length, 54);
});

test("filtrarPorAno: só o ano exato por padrão; os blocos entram só com incluirBlocos", () => {
  assert.equal(filtrarPorAno("3º ano").length, 9);
  assert.ok(filtrarPorAno("3º ano").every((h) => h.codigo.startsWith("EF03CO")));
  const comBlocos = filtrarPorAno("3º ano", { incluirBlocos: true });
  assert.equal(comBlocos.length, 9 + 9);
  assert.ok(comBlocos.some((h) => h.codigo.startsWith("EF15CO")));
  assert.equal(filtrarPorAno("3º ANO").length, 9, "caixa é ignorada");
  assert.equal(filtrarPorAno("10º ano").length, 0);
});

test("filtrarPorBlocoDeAnos: EF15CO e EF69CO", () => {
  assert.deepEqual(filtrarPorBlocoDeAnos("1º ao 5º ano").map((h) => h.codigo.slice(0, 6)), Array(9).fill("EF15CO"));
  assert.equal(filtrarPorBlocoDeAnos("6º ao 9º ano").length, 12);
  assert.equal(filtrarPorBlocoDeAnos("1º ano").length, 0);
});

test("filtrarPorEixo: sem exigir acentos nem caixa", () => {
  assert.equal(filtrarPorEixo("Pensamento Computacional").length, 49);
  assert.equal(filtrarPorEixo("Mundo Digital").length, 30);
  assert.equal(filtrarPorEixo("Cultura Digital").length, 36);
  assert.equal(filtrarPorEixo("pensamento computacional").length, filtrarPorEixo("PENSAMENTO COMPUTACIONAL").length);
  assert.equal(filtrarPorEixo("Pensamento Computacional").length + filtrarPorEixo("Mundo Digital").length + filtrarPorEixo("Cultura Digital").length, 115);
  assert.equal(filtrarPorEixo("Eixo Inexistente").length, 0);
});

test("filtrarPorObjetoDeConhecimento: nível 1 por padrão; nível 2 só quando pedido", () => {
  assert.deepEqual(filtrarPorObjetoDeConhecimento("Organização de objetos").map((h) => h.codigo), ["EF01CO01"]);
  assert.equal(filtrarPorObjetoDeConhecimento("programacao").length, 17);
  assert.equal(filtrarPorObjetoDeConhecimento("Generalização").length, 0, "é nível 2");
  assert.equal(filtrarPorObjetoDeConhecimento("Generalização", { incluirNivel2: true }).length, 4);
});

test("filtrarPorCompetenciaEspecifica: Ensino Médio 1 a 7", () => {
  assert.equal(filtrarPorCompetenciaEspecifica(1).length, 6);
  assert.equal(filtrarPorCompetenciaEspecifica(7).length, 4);
  assert.equal(filtrarPorCompetenciaEspecifica(8).length, 0);
});

test("buscarPorCodigo: código oficial exato, ignora caixa e espaços; EF05CO11 existe e EF05CO011 não", () => {
  assert.equal(buscarPorCodigo("EF01CO01")?.objeto_conhecimento, "Organização de objetos");
  assert.equal(buscarPorCodigo("  ef01co01 ")?.codigo, "EF01CO01");
  assert.equal(buscarPorCodigo("EF05CO11")?.ano, "5º ano");
  assert.equal(buscarPorCodigo("EF05CO011"), undefined);
  assert.equal(buscarPorCodigo("EF01CO08"), undefined, "nenhum código inventado");
  assert.equal(buscarPorCodigo("EM13MAT315"), undefined, "código de outro componente não é de Computação");
});

test("código oficial × identificador interno nunca se confundem", () => {
  assert.equal(buscarPorCodigo("computacao.ef01co01"), undefined);
  assert.equal(ehCodigoOficial("computacao.ef01co01"), false);
  assert.equal(ehCodigoOficial("EF01CO01"), true);
  const porId = buscarPorIdInterno("computacao.ef01co01");
  assert.equal(porId?.tipo, "habilidade");
  assert.equal(buscarPorIdInterno("EF01CO01"), undefined);
  assert.notEqual(buscarPorCodigo("EF01CO01")?.id_interno, "EF01CO01");
});

test("buscarPorTexto: sem acentos e sem caixa, todos os termos, só no texto da habilidade", () => {
  const a = buscarPorTexto("decomposicao").map((h) => h.codigo);
  assert.ok(a.includes("EF03CO03") && a.includes("EF15CO04") && a.includes("EF06CO04"));
  assert.equal(buscarPorTexto("DECOMPOSIÇÃO").length, a.length);
  assert.ok(buscarPorTexto("algoritmos criar simular").every((h) => /simular/i.test(h.texto)));
  assert.deepEqual(buscarPorTexto("   "), []);
});

test("buscarPorTexto NÃO alcança explicações nem exemplos; buscarPorExplicacao/Exemplos só quando pedidas", () => {
  assert.deepEqual(buscarPorTexto("telefone sem fio"), [], "expressão só aparece em exemplos/explicações");
  assert.ok(buscarPorExemplos("telefone sem fio").some((h) => h.codigo === "EF01CO04"));
  assert.ok(buscarPorExplicacao("ludicidade").length === 0);
  assert.ok(buscarPorExplicacao("estruturas de dados").some((h) => h.codigo === "EF04CO01"));
  assert.ok(buscarPorExplicacao("pixels").every((h) => h.explicacao !== null));
  assert.ok(buscarPorExemplos("scratch").some((h) => h.codigo === "EI03CO04"));
});

test("relações transversais: só EM13CO05 → EM13MAT315, como relação (nunca equivalência)", () => {
  assert.deepEqual(obterRelacoesTransversais("EM13CO05").map((r) => r.codigo), ["EM13MAT315"]);
  assert.deepEqual(obterRelacoesTransversais("EM13CO04"), []);
  assert.deepEqual(obterRelacoesTransversais("inexistente"), []);
});

test("código impresso na fonte: EF05CO11 foi impresso como EF05CO011; os demais coincidem", () => {
  assert.equal(codigoImpressoNaFonte("EF05CO11"), "EF05CO011");
  assert.equal(codigoImpressoNaFonte("EF05CO10"), "EF05CO10");
  assert.equal(codigoImpressoNaFonte("XX"), null);
});

test("metadados: nenhum escopo está publicado na interface; proveniência e fontes indisponíveis disponíveis", () => {
  for (const e of ESCOPOS_COMPUTACAO) {
    const m = obterMetadados(e);
    assert.equal(m.publicado_na_interface, false);
    assert.equal(m.nome_curto, "BNCC Computação");
    assert.ok(m.fontes.length === 4 && m.fontes_indisponiveis.length === 5);
  }
  assert.equal(obterMetadados("ensino-medio").divergencias_documentais.length, 3);
});

test("isolamento da interface: a busca pública existente (data.ts/search.mjs) não importa nem retorna Computação", () => {
  const data = readFileSync(new URL("../lib/bncc/data.ts", import.meta.url), "utf-8");
  const search = readFileSync(new URL("../lib/bncc/search.mjs", import.meta.url), "utf-8");
  assert.doesNotMatch(data + search, /computacao/i);
  assert.ok(!listarHabilidades().some((h) => h.codigo === "EF01MA01"), "nenhuma habilidade de outro componente aparece aqui");
});
