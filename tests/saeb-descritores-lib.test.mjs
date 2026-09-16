// Testes puros de lib/saeb/descritores.ts — nenhuma rede, nenhum estado de UI. Usa o catálogo real
// (data/saeb-descritores/matriz-lp-mt-2001.json) para os testes de busca/filtro, exatamente como
// tests/saeb-interpretacao.test.mjs usa o catálogo real de escalas.
import assert from "node:assert/strict";
import test from "node:test";

import {
  buscarMatriz,
  catalogoDescritores,
  filtrarGrupos,
  listarDescritoresComGrupo,
  normalizarCodigoBusca,
} from "../lib/saeb/descritores.ts";

// ---- buscarMatriz ----

test("buscarMatriz: encontra a matriz de Língua Portuguesa do 5º ano", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  assert.ok(matriz);
  assert.equal(matriz.etapa, "anosIniciais");
  assert.equal(matriz.componente, "lp");
  assert.equal(matriz.rotuloAgrupamento, "topico");
});

test("buscarMatriz: encontra as seis combinações do piloto", () => {
  for (const etapa of ["anosIniciais", "anosFinais", "ensinoMedio"]) {
    for (const componente of ["lp", "mt"]) {
      assert.ok(buscarMatriz(etapa, componente), `${etapa}/${componente} deveria existir`);
    }
  }
});

// ---- normalizarCodigoBusca ----

test("normalizarCodigoBusca: aceita variações de caixa e espaço", () => {
  assert.equal(normalizarCodigoBusca("d1"), "D1");
  assert.equal(normalizarCodigoBusca(" D1 "), "D1");
  assert.equal(normalizarCodigoBusca("D 1"), "D1");
  assert.equal(normalizarCodigoBusca("D21"), "D21");
});

test("normalizarCodigoBusca: rejeita código com zero à esquerda ou fora do vocabulário", () => {
  assert.equal(normalizarCodigoBusca("D01"), null);
  assert.equal(normalizarCodigoBusca("X1"), null);
  assert.equal(normalizarCodigoBusca("proficiência"), null);
  assert.equal(normalizarCodigoBusca(""), null);
});

// ---- listarDescritoresComGrupo ----

test("listarDescritoresComGrupo: achata todos os descritores preservando o grupo de origem", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const lista = listarDescritoresComGrupo(matriz);
  assert.equal(lista.length, matriz.grupos.reduce((soma, g) => soma + g.descritores.length, 0));
  const d1 = lista.find((d) => d.codigo === "D1");
  assert.ok(d1);
  assert.equal(d1.grupoNome, "Procedimentos de leitura");
});

// ---- filtrarGrupos ----

test("filtrarGrupos: consulta vazia devolve todos os grupos originais", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const filtrados = filtrarGrupos(matriz.grupos, "   ");
  assert.deepEqual(filtrados, matriz.grupos);
});

test("filtrarGrupos: busca por código exato retorna só o descritor correspondente", () => {
  const matriz = buscarMatriz("anosFinais", "lp");
  const filtrados = filtrarGrupos(matriz.grupos, "D7");
  const codigos = filtrados.flatMap((g) => g.descritores.map((d) => d.codigo));
  // D7 é prefixo de nenhum outro código nesta matriz (não há D70..D79) — resultado deveria ser único.
  assert.deepEqual(codigos, ["D7"]);
});

test("filtrarGrupos: busca por código em minúsculas e com espaço funciona igual à forma oficial", () => {
  const matriz = buscarMatriz("anosFinais", "lp");
  const porMinuscula = filtrarGrupos(matriz.grupos, "d7").flatMap((g) => g.descritores.map((d) => d.codigo));
  const porEspaco = filtrarGrupos(matriz.grupos, "D 7").flatMap((g) => g.descritores.map((d) => d.codigo));
  assert.deepEqual(porMinuscula, ["D7"]);
  assert.deepEqual(porEspaco, ["D7"]);
});

test("filtrarGrupos: busca por código como prefixo também encontra códigos de duas casas (d1 encontra D1, D10..D19)", () => {
  const matriz = buscarMatriz("anosIniciais", "mt"); // tem D1..D28
  const codigos = filtrarGrupos(matriz.grupos, "d1")
    .flatMap((g) => g.descritores.map((d) => d.codigo))
    .sort();
  assert.deepEqual(codigos, ["D1", "D10", "D11", "D12", "D13", "D14", "D15", "D16", "D17", "D18", "D19"]);
});

test("filtrarGrupos: busca textual encontra descritores pelo conteúdo, sem diferenciar maiúsculas/minúsculas", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const porMinuscula = filtrarGrupos(matriz.grupos, "informações explícitas");
  const porMaiuscula = filtrarGrupos(matriz.grupos, "INFORMAÇÕES EXPLÍCITAS");
  const codigosMin = porMinuscula.flatMap((g) => g.descritores.map((d) => d.codigo));
  const codigosMai = porMaiuscula.flatMap((g) => g.descritores.map((d) => d.codigo));
  assert.deepEqual(codigosMin, codigosMai);
  assert.ok(codigosMin.includes("D1"));
});

test("filtrarGrupos: busca textual ignora acentuação (usuário digita sem acento)", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const comAcento = filtrarGrupos(matriz.grupos, "opinião").flatMap((g) => g.descritores.map((d) => d.codigo));
  const semAcento = filtrarGrupos(matriz.grupos, "opiniao").flatMap((g) => g.descritores.map((d) => d.codigo));
  assert.deepEqual(comAcento, semAcento);
  assert.ok(comAcento.length > 0);
});

test("filtrarGrupos: remove grupos que ficam sem nenhum descritor correspondente", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const filtrados = filtrarGrupos(matriz.grupos, "variação linguística");
  // "Variação linguística" é o nome de um grupo, mas a busca é sobre o TEXTO do descritor, não sobre
  // o nome do grupo — este termo não aparece no texto de nenhum descritor de D10.
  for (const grupo of filtrados) {
    assert.ok(grupo.descritores.length > 0);
  }
});

test("filtrarGrupos: consulta sem nenhuma correspondência devolve lista vazia de grupos", () => {
  const matriz = buscarMatriz("anosIniciais", "lp");
  const filtrados = filtrarGrupos(matriz.grupos, "xilofone-inexistente-9999");
  assert.deepEqual(filtrados, []);
});

// ---- Ausência de associação com resultado de escola (proibições explícitas) ----

test("catálogo de descritores não contém nenhuma menção a domínio/não domínio pela escola, nem a 'descritores deste nível de proficiência'", () => {
  const textoCompleto = JSON.stringify(catalogoDescritores).toLowerCase();
  for (const proibida of ["a escola domina o descritor", "a escola não domina o descritor", "descritores deste nível de proficiência"]) {
    assert.ok(!textoCompleto.includes(proibida), `catálogo não deveria conter "${proibida}"`);
  }
});
