// Testes de lib/saeb/client.ts: limite explícito do cache (lib/saeb/client.ts — LimitesCache).
// Política: LRU por número de entradas CONCLUÍDAS e por um orçamento aproximado de bytes
// (JSON.stringify(valor).length de cada uma) — nunca por requisições em voo, que continuam
// controladas pelo próprio fluxo da ferramenta (ver comentário em CachePorChave). O descarte só
// acontece com uma entrada já concluída, nunca no meio de uma requisição compartilhada em curso.
import assert from "node:assert/strict";
import test from "node:test";

import { createSaebClient } from "../lib/saeb/client.ts";
import { SCHEMA_INDICE_MUNICIPIO, SCHEMA_INDICE_NACIONAL, SCHEMA_VERSAO_ATUAL } from "../lib/saeb/types.ts";

const V = "versao-x";

function current() {
  return { schema: SCHEMA_VERSAO_ATUAL, versao: V, limiteBytesGzip: 51200, municipios: 3 };
}
function indiceNacional() {
  return {
    schema: SCHEMA_INDICE_NACIONAL,
    versao: V,
    limiteBytesGzip: 51200,
    municipios: [
      { codigoIbge: "1100015", nome: "A", uf: "RO", escolas: 1, particoes: 1 },
      { codigoIbge: "2211001", nome: "B", uf: "PI", escolas: 1, particoes: 1 },
      { codigoIbge: "3550308", nome: "C", uf: "SP", escolas: 1, particoes: 1 },
    ],
  };
}
function indiceMunicipal(codigoIbge) {
  return {
    schema: SCHEMA_INDICE_MUNICIPIO,
    versao: V,
    codigoIbge,
    municipio: { codigoIbge, nome: "Município", uf: "SP" },
    escolas: [{ codigoInep: "35000001", nome: "EE UM", rede: "Estadual", particao: "001.json" }],
  };
}

function respostaJson(corpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => corpo };
}

function criarFetchContador() {
  const contagemPorUrl = new Map();
  const fetchImpl = (url) => {
    const urlStr = String(url);
    contagemPorUrl.set(urlStr, (contagemPorUrl.get(urlStr) ?? 0) + 1);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current()));
    if (urlStr.includes("municipios-index.json")) return Promise.resolve(respostaJson(indiceNacional()));
    const match = urlStr.match(/municipios\/(\d+)\/escolas-index\.json/);
    if (match) return Promise.resolve(respostaJson(indiceMunicipal(match[1])));
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  function vezes(padraoUrl) {
    let total = 0;
    for (const [url, n] of contagemPorUrl) if (url.includes(padraoUrl)) total += n;
    return total;
  }
  return { fetchImpl, vezes };
}

test("cache: dentro do limite, todas as entradas concluídas permanecem — nenhuma requisição repetida", async () => {
  const { fetchImpl, vezes } = criarFetchContador();
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 5 } });

  await client.getIndiceMunicipal("1100015");
  await client.getIndiceMunicipal("2211001");
  await client.getIndiceMunicipal("1100015"); // reutilização — dentro do limite
  await client.getIndiceMunicipal("2211001");

  assert.equal(vezes("1100015/escolas-index"), 1);
  assert.equal(vezes("2211001/escolas-index"), 1);
});

test("cache: ULTRAPASSAR maxEntradasConcluidas descarta a entrada menos usada recentemente (LRU) — a esperada, não uma qualquer", async () => {
  const { fetchImpl, vezes } = criarFetchContador();
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 2 } });

  await client.getIndiceMunicipal("1100015"); // A — mais antiga
  await client.getIndiceMunicipal("2211001"); // B
  await client.getIndiceMunicipal("3550308"); // C — ultrapassa o limite de 2, deve descartar A (LRU)

  // Reutilização de uma entrada MANTIDA (B ou C) não gera requisição nova.
  await client.getIndiceMunicipal("2211001");
  assert.equal(vezes("2211001/escolas-index"), 1, "B foi mantida — reutilização não deveria refazer a requisição");
  await client.getIndiceMunicipal("3550308");
  assert.equal(vezes("3550308/escolas-index"), 1, "C foi mantida — reutilização não deveria refazer a requisição");

  // Nova busca da entrada DESCARTADA (A) precisa refazer a requisição de verdade.
  await client.getIndiceMunicipal("1100015");
  assert.equal(vezes("1100015/escolas-index"), 2, "A foi descartada por LRU — buscá-la de novo precisa gerar uma nova requisição");
});

test("cache: acessar uma entrada marca ela como recém-usada — a próxima a ser descartada é sempre a de fato menos recente", async () => {
  const { fetchImpl, vezes } = criarFetchContador();
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 2 } });

  await client.getIndiceMunicipal("1100015"); // A
  await client.getIndiceMunicipal("2211001"); // B
  await client.getIndiceMunicipal("1100015"); // reacessa A — agora A é mais recente que B
  await client.getIndiceMunicipal("3550308"); // C — ultrapassa o limite; B (não A) deveria ser descartada agora

  await client.getIndiceMunicipal("1100015");
  assert.equal(vezes("1100015/escolas-index"), 1, "A foi reacessada antes de C entrar — não deveria ter sido descartada");

  await client.getIndiceMunicipal("2211001");
  assert.equal(vezes("2211001/escolas-index"), 2, "B era a menos recente no momento em que o limite estourou — deveria ter sido descartada");
});

test("cache: orçamento de bytes força descarte mesmo com poucas entradas (contagem dentro do limite)", async () => {
  const { fetchImpl, vezes } = criarFetchContador();
  // Orçamento minúsculo — qualquer entrada real já o ultrapassa, forçando descarte a cada nova.
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 50, orcamentoBytesAprox: 10 } });

  await client.getIndiceMunicipal("1100015");
  await client.getIndiceMunicipal("2211001");

  await client.getIndiceMunicipal("1100015");
  assert.equal(vezes("1100015/escolas-index"), 2, "orçamento de bytes minúsculo deveria ter descartado a primeira entrada antes da reutilização");
});

test("cache: falha real não ocupa espaço no cache nem conta para o limite — nunca fica presa", async () => {
  let falhouUmaVez = false;
  const contagem = new Map();
  const fetchImpl = (url) => {
    const urlStr = String(url);
    contagem.set(urlStr, (contagem.get(urlStr) ?? 0) + 1);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current()));
    if (urlStr.includes("1100015/escolas-index") && !falhouUmaVez) {
      falhouUmaVez = true;
      return Promise.resolve(respostaJson(null, { ok: false, status: 500 }));
    }
    const match = urlStr.match(/municipios\/(\d+)\/escolas-index\.json/);
    if (match) return Promise.resolve(respostaJson(indiceMunicipal(match[1])));
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 1 } });

  await assert.rejects(() => client.getIndiceMunicipal("1100015"));
  const resultado = await client.getIndiceMunicipal("1100015"); // retry
  assert.equal(resultado.indice.codigoIbge, "1100015");
});

test("cache: requisições EM VOO nunca são descartadas pelo limite, mesmo além da contagem máxima — só entradas concluídas contam", async () => {
  const pendentes = [];
  const fetchImpl = (url) => {
    const urlStr = String(url);
    if (urlStr.includes("current.json")) return Promise.resolve(respostaJson(current()));
    const match = urlStr.match(/municipios\/(\d+)\/escolas-index\.json/);
    if (match) {
      return new Promise((resolve) => {
        pendentes.push({ codigoIbge: match[1], resolve: () => resolve(respostaJson(indiceMunicipal(match[1]))) });
      });
    }
    return Promise.reject(new Error(`rota não simulada: ${urlStr}`));
  };
  // Limite de 1 entrada CONCLUÍDA — mas duas requisições ficam em voo SIMULTANEAMENTE antes disso importar.
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 1 } });

  const p1 = client.getIndiceMunicipal("1100015");
  const p2 = client.getIndiceMunicipal("2211001");
  for (let i = 0; i < 50 && pendentes.length < 2; i += 1) await Promise.resolve();
  assert.equal(pendentes.length, 2, "as duas requisições precisam estar de fato em voo ao mesmo tempo, apesar do limite de 1 concluída");

  pendentes.find((p) => p.codigoIbge === "1100015").resolve();
  pendentes.find((p) => p.codigoIbge === "2211001").resolve();

  const [r1, r2] = await Promise.all([p1, p2]);
  assert.equal(r1.indice.codigoIbge, "1100015", "nenhuma das duas em voo pode ser descartada só por exceder o limite de concluídas");
  assert.equal(r2.indice.codigoIbge, "2211001");
});

test("cache: reiniciar() esquece TUDO, inclusive dentro de um limite configurado — não é a mesma coisa que o LRU normal", async () => {
  const { fetchImpl, vezes } = criarFetchContador();
  const client = createSaebClient({ fetchImpl, limitesCache: { maxEntradasConcluidas: 10 } });

  await client.getIndiceMunicipal("1100015");
  client.reiniciar();
  await client.getVersaoAtual();
  await client.getIndiceMunicipal("1100015");

  assert.equal(vezes("1100015/escolas-index"), 2, "reiniciar() precisa esquecer uma entrada que, pelo limite sozinho, ainda caberia tranquilamente");
});
