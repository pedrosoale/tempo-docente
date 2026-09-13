import assert from "node:assert/strict";
import test from "node:test";

import { buscarEscolasNaParticao, buscarEscolasNoIndiceMunicipal, buscarMunicipios, normalizarBusca } from "../lib/saeb/busca.ts";

test("normalizarBusca: remove acentos, ignora caixa e espaços nas pontas", () => {
  assert.equal(normalizarBusca("  São Paulo  "), "sao paulo");
  assert.equal(normalizarBusca("ARIQUEMES"), "ariquemes");
});

const MUNICIPIOS = [
  { codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: 1800, particoes: 11 },
  { codigoIbge: "4314902", nome: "Porto Alegre", uf: "RS", escolas: 300, particoes: 3 },
  // Homônimos de UFs diferentes — nome igual, código e UF diferentes.
  { codigoIbge: "2211001", nome: "Barra", uf: "PI", escolas: 5, particoes: 1 },
  { codigoIbge: "2903201", nome: "Barra", uf: "BA", escolas: 8, particoes: 1 },
];

test("buscarMunicipios: consulta vazia não devolve nada (evita listar 5.571 municípios de uma vez)", () => {
  assert.deepEqual(buscarMunicipios(MUNICIPIOS, ""), []);
  assert.deepEqual(buscarMunicipios(MUNICIPIOS, "   "), []);
});

test("buscarMunicipios: encontra por substring, ignorando acento e caixa", () => {
  const resultado = buscarMunicipios(MUNICIPIOS, "sao pau");
  assert.equal(resultado.length, 1);
  assert.equal(resultado[0].codigoIbge, "3550308");
});

test("buscarMunicipios: municípios homônimos de UFs diferentes aparecem os DOIS, distinguíveis por codigoIbge/UF", () => {
  const resultado = buscarMunicipios(MUNICIPIOS, "barra");
  assert.equal(resultado.length, 2);
  const codigos = resultado.map((m) => m.codigoIbge).sort();
  assert.deepEqual(codigos, ["2211001", "2903201"]);
  const ufs = resultado.map((m) => m.uf).sort();
  assert.deepEqual(ufs, ["BA", "PI"]);
});

const ESCOLAS_INDICE = [
  { codigoInep: "35000002", nome: "EMEF Santos Dumont", rede: "Municipal", particao: "002.json" },
  { codigoInep: "35000001", nome: "EMEF Santos Dumont", rede: "Estadual", particao: "001.json" },
  { codigoInep: "35000003", nome: "EE Outra Escola", rede: "Estadual", particao: "003.json" },
];

test("buscarEscolasNoIndiceMunicipal: sem consulta, devolve a lista inteira ordenada por nome (ordem estável entre homônimos)", () => {
  const resultado = buscarEscolasNoIndiceMunicipal(ESCOLAS_INDICE, "");
  // "EE Outra Escola" vem antes de "EMEF Santos Dumont" (O < S); as duas escolas homônimas
  // mantêm a ordem relativa original de ESCOLAS_INDICE (sort estável): 35000002 antes de 35000001.
  assert.deepEqual(resultado.map((e) => e.codigoInep), ["35000003", "35000002", "35000001"]);
});

test("buscarEscolasNoIndiceMunicipal: escolas homônimas (mesmo nome) continuam as duas, distinguíveis por codigoInep e rede", () => {
  const resultado = buscarEscolasNoIndiceMunicipal(ESCOLAS_INDICE, "santos dumont");
  assert.equal(resultado.length, 2);
  const codigos = resultado.map((e) => e.codigoInep).sort();
  assert.deepEqual(codigos, ["35000001", "35000002"]);
  assert.notEqual(resultado[0].rede, undefined);
});

test("buscarEscolasNaParticao: mesma lógica sobre o array de escolas de uma partição já carregada", () => {
  const escolas = [
    { codigoInep: "11000001", nome: "EE Alfa", rede: "Estadual", etapas: {} },
    { codigoInep: "11000002", nome: "EE Beta", rede: "Municipal", etapas: {} },
  ];
  assert.equal(buscarEscolasNaParticao(escolas, "beta").length, 1);
  assert.equal(buscarEscolasNaParticao(escolas, "").length, 2);
});
