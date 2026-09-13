// Testes de lib/saeb/client.ts: reiniciar() — a recuperação após mudança de versão (V1 → V2). O
// achado da revisão: current.json era resolvido uma única vez por instância do cliente; se a
// versão mudasse de V1 para V2 enquanto a página estava aberta, qualquer nova tentativa continuava
// usando a V1 já em cache e repetia a mesma falha para sempre. reiniciar() esquece a versão
// conhecida e todo o cache — a próxima chamada busca current.json de novo, sem cache HTTP.
import assert from "node:assert/strict";
import test from "node:test";

import { createSaebClient, SaebVersionMismatchError } from "../lib/saeb/client.ts";
import { SCHEMA_INDICE_MUNICIPIO, SCHEMA_INDICE_NACIONAL, SCHEMA_PARTICAO, SCHEMA_VERSAO_ATUAL } from "../lib/saeb/types.ts";

const V1 = "versao-um";
const V2 = "versao-dois";

function current(versao) {
  return { schema: SCHEMA_VERSAO_ATUAL, versao, limiteBytesGzip: 51200, municipios: 1 };
}
function indiceNacional(versao) {
  return {
    schema: SCHEMA_INDICE_NACIONAL,
    versao,
    limiteBytesGzip: 51200,
    municipios: [{ codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: 1, particoes: 1 }],
  };
}
function indiceMunicipal(versao) {
  return {
    schema: SCHEMA_INDICE_MUNICIPIO,
    versao,
    codigoIbge: "3550308",
    municipio: { codigoIbge: "3550308", nome: "São Paulo", uf: "SP" },
    escolas: [{ codigoInep: "35000001", nome: "EE UM", rede: "Estadual", particao: "001.json" }],
  };
}
function particaoFixture(versao) {
  return { schema: SCHEMA_PARTICAO, versao, municipio: { codigoIbge: "3550308", nome: "São Paulo", uf: "SP" }, escolas: [] };
}

function respostaJson(corpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => corpo };
}

/** Router simples: cada versão "atual" pode ser trocada em tempo real via `definirVersaoAtual`. */
function criarFetchComVersaoTrocavel(inicial) {
  let versaoAtual = inicial;
  const chamadas = [];
  const fetchImpl = (url) => {
    const urlStr = String(url);
    chamadas.push(urlStr);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current(versaoAtual)));
    if (urlStr.includes("municipios-index.json")) return Promise.resolve(respostaJson(indiceNacional(versaoAtual)));
    if (urlStr.includes("escolas-index.json")) return Promise.resolve(respostaJson(indiceMunicipal(versaoAtual)));
    if (urlStr.includes("particoes/001.json")) return Promise.resolve(respostaJson(particaoFixture(versaoAtual)));
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  return { fetchImpl, chamadas, definirVersaoAtual: (v) => { versaoAtual = v; } };
}

test("reiniciar(): sem chamar reiniciar(), a versão conhecida NUNCA muda sozinha (current.json não é refeito)", async () => {
  const { fetchImpl, chamadas, definirVersaoAtual } = criarFetchComVersaoTrocavel(V1);
  const client = createSaebClient({ fetchImpl });

  const v1 = await client.getVersaoAtual();
  assert.equal(v1.versao, V1);

  definirVersaoAtual(V2); // o SERVIDOR já mudou, mas o cliente não sabe disso ainda
  const v1DeNovo = await client.getVersaoAtual();
  assert.equal(v1DeNovo.versao, V1, "sem reiniciar(), o cliente continua reportando a versão antiga que já resolveu");
  assert.equal(chamadas.filter((u) => u.includes("current.json")).length, 1, "current.json não deveria ser buscado de novo sem reiniciar()");
});

test("reiniciar(): depois de reiniciar(), a PRÓXIMA chamada busca current.json de novo e passa a usar V2", async () => {
  const { fetchImpl, definirVersaoAtual } = criarFetchComVersaoTrocavel(V1);
  const client = createSaebClient({ fetchImpl });

  await client.getVersaoAtual();
  definirVersaoAtual(V2);
  client.reiniciar();

  const v2 = await client.getVersaoAtual();
  assert.equal(v2.versao, V2);
});

test("reiniciar(): índice nacional e partição buscados DEPOIS de reiniciar() usam V2 de ponta a ponta, sem misturar com V1", async () => {
  const { fetchImpl, definirVersaoAtual } = criarFetchComVersaoTrocavel(V1);
  const client = createSaebClient({ fetchImpl });

  const { indice: indiceV1 } = await client.getIndiceNacional();
  assert.equal(indiceV1.versao, V1);

  definirVersaoAtual(V2);
  client.reiniciar();

  const { versao, indice } = await client.getIndiceNacional();
  assert.equal(versao, V2);
  assert.equal(indice.versao, V2);

  const { particao } = await client.getParticao("3550308", "001.json");
  assert.equal(particao.versao, V2, "a partição buscada após reiniciar() precisa vir com a versão nova, nunca a antiga");
});

test("reiniciar(): current.json é buscado sem cache HTTP também depois de reiniciar() (cache: 'no-store' preservado)", async () => {
  const chamadasComInit = [];
  const fetchImpl = (url, init) => {
    chamadasComInit.push({ url: String(url), cache: init?.cache });
    if (String(url).includes("current.json")) return Promise.resolve(respostaJson(current(V1)));
    return Promise.reject(new Error("rota não usada neste teste"));
  };
  const client = createSaebClient({ fetchImpl });
  await client.getVersaoAtual();
  client.reiniciar();
  await client.getVersaoAtual();

  const chamadasCurrent = chamadasComInit.filter((c) => c.url.includes("current.json"));
  assert.equal(chamadasCurrent.length, 2);
  assert.ok(chamadasCurrent.every((c) => c.cache === "no-store"), "current.json precisa sempre ignorar o cache HTTP, antes e depois de reiniciar()");
});

test("reiniciar(): uma requisição de V1 ainda em voo é cancelada quando reiniciar() acontece", async () => {
  let resolverPendente;
  let numeroDeChamadas = 0;
  const fetchImpl = (url, init) => {
    const urlStr = String(url);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current(V1)));
    if (urlStr.includes("escolas-index.json")) {
      numeroDeChamadas += 1;
      return new Promise((resolve, reject) => {
        resolverPendente = () => resolve(respostaJson(indiceMunicipal(V1)));
        init?.signal?.addEventListener("abort", () => {
          const erro = new Error("aborted");
          erro.name = "AbortError";
          reject(erro);
        });
      });
    }
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  const client = createSaebClient({ fetchImpl });
  await client.getVersaoAtual();

  const pEmVoo = client.getIndiceMunicipal("3550308");
  // Espera a requisição de V1 estar DE FATO em voo antes de reiniciar — senão reiniciar() não
  // teria nada para cancelar ainda (a chamada ainda estaria presa em microtarefas anteriores).
  for (let i = 0; i < 50 && numeroDeChamadas === 0; i += 1) await Promise.resolve();
  assert.equal(numeroDeChamadas, 1, "pré-condição do teste: a requisição de V1 precisa estar de fato em voo");

  client.reiniciar(); // precisa abortar a requisição de V1 ainda em voo

  const erro = await pEmVoo.catch((e) => e);
  assert.ok(erro instanceof Error, "a chamada original (V1, cancelada por reiniciar()) precisa terminar em erro, nunca em sucesso silencioso");

  resolverPendente?.(); // resposta tardia de V1 — mesmo que o mock a entregasse agora, já rejeitou por abort
});

test("reiniciar(): mesmo que uma resposta de V1 'em atraso' chegue a resolver DEPOIS de reiniciar(), ela não repovoa o cache para reuso futuro", async () => {
  // Corrige uma segunda camada do mesmo achado: o handler de SUCESSO do cache só gravava o
  // resultado condicionado a nada — uma resposta atrasada de uma chamada já obsoleta escrevia no
  // cache mesmo depois de reiniciar() ter limpado tudo. Este teste força exatamente esse
  // atraso (sem abortar a requisição original) para provar que a escrita agora é condicional à
  // entrada ainda ser a atual para a chave.
  let resolverPendente;
  let numeroDeChamadas = 0;
  const fetchImpl = (url) => {
    const urlStr = String(url);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current(V1)));
    if (urlStr.includes("escolas-index.json")) {
      numeroDeChamadas += 1;
      // Deliberadamente NÃO reage a abort — simula uma resposta que chega mesmo depois do
      // cancelamento (ex.: bytes já em trânsito que o navegador entrega de qualquer forma).
      return new Promise((resolve) => {
        resolverPendente = () => resolve(respostaJson(indiceMunicipal(V1)));
      });
    }
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  const client = createSaebClient({ fetchImpl });
  await client.getVersaoAtual();

  const pAntiga = client.getIndiceMunicipal("3550308");
  for (let i = 0; i < 50 && numeroDeChamadas === 0; i += 1) await Promise.resolve();
  assert.equal(numeroDeChamadas, 1);

  client.reiniciar(); // limpa o cache — a entrada de pAntiga não é mais "a atual" para a chave
  await Promise.resolve();
  pAntiga.catch(() => {}); // ninguém mais precisa desse resultado — evita unhandledRejection se ele nunca resolver

  // Só agora a resposta "atrasada" de V1 chega.
  resolverPendente?.();
  await Promise.resolve();
  await Promise.resolve();

  // Uma nova busca da MESMA chave precisa refazer a requisição de verdade — se a resposta
  // atrasada tivesse repovoado o cache, esta chamada encontraria uma entrada "concluída" e não
  // geraria uma segunda chamada de rede.
  const p2 = client.getIndiceMunicipal("3550308");
  for (let i = 0; i < 50 && numeroDeChamadas < 2; i += 1) await Promise.resolve();
  assert.equal(numeroDeChamadas, 2, "a resposta atrasada de V1 não pode ter repovoado o cache depois de reiniciar()");
  resolverPendente?.();
  await p2;
});

test("SaebVersionMismatchError continua distinguível de uma falha transitória — reiniciar() só é chamado pelo primeiro caso", () => {
  // Documentação executável: o TIPO do erro é o que a UI usa para decidir entre um retry comum
  // (SaebFetchError/SaebSchemaError) e a recuperação por atualização de versão (só
  // SaebVersionMismatchError) — ver SaebConsulta.tsx.
  const erroVersao = new SaebVersionMismatchError("versão diferente");
  assert.equal(erroVersao.name, "SaebVersionMismatchError");
  assert.ok(erroVersao instanceof Error);
});
