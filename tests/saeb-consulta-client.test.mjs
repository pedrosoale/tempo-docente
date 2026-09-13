// Testes de lib/saeb/client.ts com um `fetch` falso — sem rede, sem arquivos reais. Cobre
// validação de schema, os três tipos de erro explícito (nunca resultado vazio silencioso), cache
// por versão, e a quantidade de requisições por fluxo (município de partição única, subdividido, e
// reutilização da partição ao trocar de escola dentro do mesmo arquivo).
import assert from "node:assert/strict";
import test from "node:test";

import { createSaebClient, SaebFetchError, SaebSchemaError, SaebVersionMismatchError } from "../lib/saeb/client.ts";
import { SCHEMA_INDICE_MUNICIPIO, SCHEMA_INDICE_NACIONAL, SCHEMA_PARTICAO, SCHEMA_VERSAO_ATUAL } from "../lib/saeb/types.ts";

const VERSAO = "abc123";

function respostaJson(corpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => corpo };
}

function current(versao = VERSAO) {
  return { schema: SCHEMA_VERSAO_ATUAL, versao, limiteBytesGzip: 51200, municipios: 2 };
}

function indiceNacional({ versao = VERSAO } = {}) {
  return {
    schema: SCHEMA_INDICE_NACIONAL,
    versao,
    limiteBytesGzip: 51200,
    municipios: [
      { codigoIbge: "1100015", nome: "Alta Floresta D'Oeste", uf: "RO", escolas: 1, particoes: 1 },
      { codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: 2, particoes: 2 },
    ],
  };
}

function indiceMunicipal(codigoIbge, { versao = VERSAO } = {}) {
  return {
    schema: SCHEMA_INDICE_MUNICIPIO,
    versao,
    codigoIbge,
    municipio: { codigoIbge, nome: "São Paulo", uf: "SP" },
    escolas: [
      { codigoInep: "35000001", nome: "EE UM", rede: "Estadual", particao: "001.json" },
      { codigoInep: "35000002", nome: "EE DOIS", rede: "Estadual", particao: "002.json" },
    ],
  };
}

function particao(codigoIbge, escolas, { versao = VERSAO } = {}) {
  return { schema: SCHEMA_PARTICAO, versao, municipio: { codigoIbge, nome: "Município", uf: "SP" }, escolas };
}

/** Roteador simples por padrão de URL — cada teste registra só as rotas que usa. */
function criarFetchFalso(rotas) {
  const chamadas = [];
  const fetchImpl = async (url) => {
    chamadas.push(String(url));
    for (const [padrao, resolver] of rotas) {
      if (padrao.test(String(url))) return resolver(String(url));
    }
    throw new Error(`rota não simulada: ${url}`);
  };
  return { fetchImpl, chamadas };
}

test("getVersaoAtual: valida schema e devolve a versão", async () => {
  const { fetchImpl } = criarFetchFalso([[/current\.json$/, () => respostaJson(current())]]);
  const client = createSaebClient({ fetchImpl, baseUrl: "/data/saeb" });
  const versao = await client.getVersaoAtual();
  assert.equal(versao.versao, VERSAO);
});

test("getVersaoAtual: schema inesperado lança SaebSchemaError explícito, nunca um resultado vazio", async () => {
  const { fetchImpl } = criarFetchFalso([[/current\.json$/, () => respostaJson({ schema: "outra-coisa", versao: "x" })]]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getVersaoAtual(), SaebSchemaError);
});

test("getIndiceNacional: HTTP não-ok vira SaebFetchError explícito", async () => {
  const { fetchImpl } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/municipios-index\.json/, () => respostaJson(null, { ok: false, status: 500 })],
  ]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getIndiceNacional(), SaebFetchError);
});

test("getIndiceNacional: JSON malformado vira SaebSchemaError explícito, nunca um índice vazio silencioso", async () => {
  const { fetchImpl } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [
      /municipios-index\.json/,
      () => ({
        ok: true,
        status: 200,
        json: async () => {
          throw new SyntaxError("Unexpected token");
        },
      }),
    ],
  ]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getIndiceNacional(), SaebSchemaError);
});

test("getIndiceNacional: URL de requisição carrega ?v=<versao> — consistência no próprio caminho solicitado, não só em cache de memória", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/municipios-index\.json/, () => respostaJson(indiceNacional())],
  ]);
  const client = createSaebClient({ fetchImpl });
  await client.getIndiceNacional();
  const urlIndice = chamadas.find((u) => u.includes("municipios-index.json"));
  assert.equal(urlIndice, `/data/saeb/municipios-index.json?v=${VERSAO}`);
});

test("getIndiceMunicipal: detecta versão inconsistente embutida no próprio arquivo (defesa em profundidade além da query string)", async () => {
  const { fetchImpl } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/escolas-index\.json/, () => respostaJson(indiceMunicipal("3550308", { versao: "versao-velha-servida-por-cache" }))],
  ]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getIndiceMunicipal("3550308"), SaebVersionMismatchError);
});

test("getParticao: detecta versão inconsistente embutida na partição", async () => {
  const { fetchImpl } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/particoes\/001\.json/, () => respostaJson(particao("1100015", [], { versao: "versao-velha" }))],
  ]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getParticao("1100015", "001.json"), SaebVersionMismatchError);
});

test("cache: duas chamadas concorrentes para o MESMO índice municipal fazem só UMA requisição de rede", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/escolas-index\.json/, () => respostaJson(indiceMunicipal("3550308"))],
  ]);
  const client = createSaebClient({ fetchImpl });
  const [a, b] = await Promise.all([client.getIndiceMunicipal("3550308"), client.getIndiceMunicipal("3550308")]);
  assert.deepEqual(a.indice, b.indice);
  assert.equal(chamadas.filter((u) => u.includes("escolas-index.json")).length, 1);
});

test("cache: uma requisição que FALHA não fica presa em cache — tentar de novo refaz a requisição de verdade", async () => {
  let tentativa = 0;
  const { fetchImpl } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [
      /escolas-index\.json/,
      () => {
        tentativa += 1;
        if (tentativa === 1) return respostaJson(null, { ok: false, status: 500 });
        return respostaJson(indiceMunicipal("3550308"));
      },
    ],
  ]);
  const client = createSaebClient({ fetchImpl });
  await assert.rejects(() => client.getIndiceMunicipal("3550308"), SaebFetchError);
  const segunda = await client.getIndiceMunicipal("3550308"); // "tentar novamente" do usuário
  assert.equal(segunda.indice.codigoIbge, "3550308");
  assert.equal(tentativa, 2);
});

test("fluxo — município de PARTIÇÃO ÚNICA: current.json + índice nacional + 1 partição = 3 requisições, sem buscar escolas-index.json", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/municipios-index\.json/, () => respostaJson(indiceNacional())],
    [/particoes\/001\.json/, () => respostaJson(particao("1100015", [{ codigoInep: "11000001", nome: "EE ÚNICA", rede: "Municipal", etapas: {} }]))],
  ]);
  const client = createSaebClient({ fetchImpl });

  await client.getVersaoAtual();
  const { indice } = await client.getIndiceNacional();
  const entrada = indice.municipios.find((m) => m.codigoIbge === "1100015");
  assert.equal(entrada.particoes, 1, "particoes é uma contagem, não um array");
  await client.getParticao("1100015", "001.json");

  assert.equal(chamadas.length, 3);
  assert.ok(!chamadas.some((u) => u.includes("escolas-index.json")), "partição única nunca deveria buscar o índice municipal");
});

test("fluxo — município SUBDIVIDIDO: current.json + índice nacional + índice municipal + 1 partição = 4 requisições", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/municipios-index\.json/, () => respostaJson(indiceNacional())],
    [/escolas-index\.json/, () => respostaJson(indiceMunicipal("3550308"))],
    [/particoes\/001\.json/, () => respostaJson(particao("3550308", [{ codigoInep: "35000001", nome: "EE UM", rede: "Estadual", etapas: {} }]))],
  ]);
  const client = createSaebClient({ fetchImpl });

  await client.getVersaoAtual();
  await client.getIndiceNacional();
  const { indice: indiceMun } = await client.getIndiceMunicipal("3550308");
  const apontamento = indiceMun.escolas.find((e) => e.codigoInep === "35000001");
  await client.getParticao("3550308", apontamento.particao);

  assert.equal(chamadas.length, 4);
});

test("fluxo — trocar de escola DENTRO da mesma partição não gera nova requisição (reutilização da partição já carregada)", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [
      /particoes\/001\.json/,
      () =>
        respostaJson(
          particao("3550308", [
            { codigoInep: "35000001", nome: "EE UM", rede: "Estadual", etapas: {} },
            { codigoInep: "35000002", nome: "EE DOIS", rede: "Estadual", etapas: {} },
          ]),
        ),
    ],
  ]);
  const client = createSaebClient({ fetchImpl });

  await client.getParticao("3550308", "001.json"); // escola 1 está aqui
  await client.getParticao("3550308", "001.json"); // troca para escola 2 — MESMO arquivo

  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 1);
});

test("fluxo — trocar de escola para OUTRA partição do mesmo município gera exatamente uma requisição a mais", async () => {
  const { fetchImpl, chamadas } = criarFetchFalso([
    [/current\.json$/, () => respostaJson(current())],
    [/particoes\/001\.json/, () => respostaJson(particao("3550308", [{ codigoInep: "35000001", nome: "EE UM", rede: "Estadual", etapas: {} }]))],
    [/particoes\/002\.json/, () => respostaJson(particao("3550308", [{ codigoInep: "35000002", nome: "EE DOIS", rede: "Estadual", etapas: {} }]))],
  ]);
  const client = createSaebClient({ fetchImpl });

  await client.getParticao("3550308", "001.json");
  await client.getParticao("3550308", "002.json");

  assert.equal(chamadas.filter((u) => u.includes("particoes/")).length, 2);
});
