// Testes de INTEGRAÇÃO entre lib/saeb/client.ts (cache por chave) e lib/saeb/selection.ts
// (descarte de seleção antiga) — não apenas os dois módulos isolados. Cobre o achado da revisão:
// escola A inicia o download de uma partição; antes de terminar, escola B (MESMA partição) é
// selecionada; a seleção antiga (A) é cancelada; a seleção nova (B) não pode herdar uma promessa
// já abortada por causa de A.
//
// Usa um fetch controlável manualmente (sem temporizador real) para forçar interleavings
// específicos — cada teste resolve/rejeita exatamente a chamada de rede que quer, na ordem que
// quer, para provar o comportamento sob condições de corrida reais, não só "no caminho feliz".
import assert from "node:assert/strict";
import test from "node:test";

import { createSaebClient } from "../lib/saeb/client.ts";
import { createSelectionController, eDescartado } from "../lib/saeb/selection.ts";
import { SCHEMA_INDICE_MUNICIPIO, SCHEMA_PARTICAO, SCHEMA_VERSAO_ATUAL } from "../lib/saeb/types.ts";

const V = "versao-abc123";

function current(sobrepor = {}) {
  return { schema: SCHEMA_VERSAO_ATUAL, versao: V, limiteBytesGzip: 51200, municipios: 2, ...sobrepor };
}
function indiceMunicipal(codigoIbge, sobrepor = {}) {
  return {
    schema: SCHEMA_INDICE_MUNICIPIO,
    versao: V,
    codigoIbge,
    municipio: { codigoIbge, nome: "São Paulo", uf: "SP" },
    escolas: [
      { codigoInep: "35000001", nome: "EE UM", rede: "Estadual", particao: "001.json" },
      { codigoInep: "35000002", nome: "EE DOIS", rede: "Estadual", particao: "002.json" },
    ],
    ...sobrepor,
  };
}
function particaoFixture(codigoIbge, escolas, sobrepor = {}) {
  return { schema: SCHEMA_PARTICAO, versao: V, municipio: { codigoIbge, nome: "Município", uf: "SP" }, escolas, ...sobrepor };
}
function escolaFixture(codigoInep) {
  return { codigoInep, nome: `Escola ${codigoInep}`, rede: "Estadual", etapas: {} };
}

function respostaJson(corpo, { ok = true, status = 200 } = {}) {
  return { ok, status, json: async () => corpo };
}

function erroAbortDom() {
  const e = new Error("The operation was aborted.");
  e.name = "AbortError";
  return e;
}

/**
 * Fetch controlável: cada chamada fica pendente até o teste decidir resolver ou rejeitar,
 * casando por SUBSTRING da URL (a query string `?v=` não importa para o teste escolher qual
 * chamada destravar). Também rejeita automaticamente com AbortError se o `signal` passado
 * abortar — exatamente como um `fetch` real se comportaria.
 */
function criarFetchControlavel() {
  const chamadas = [];
  const emVoo = [];
  const fetchImpl = (url, init) => {
    const urlStr = String(url);
    chamadas.push(urlStr);
    return new Promise((resolve, reject) => {
      const entrada = { url: urlStr, resolve, reject, resolvida: false };
      emVoo.push(entrada);
      init?.signal?.addEventListener("abort", () => {
        if (entrada.resolvida) return;
        entrada.resolvida = true;
        reject(erroAbortDom());
      });
    });
  };
  function achar(padraoUrl) {
    const idx = emVoo.findIndex((e) => !e.resolvida && e.url.includes(padraoUrl));
    if (idx === -1) throw new Error(`nenhuma chamada pendente casa com "${padraoUrl}" — pendentes: ${emVoo.filter((e) => !e.resolvida).map((e) => e.url).join(", ")}`);
    return emVoo[idx];
  }
  function resolverUrl(padraoUrl, corpo, opts) {
    const entrada = achar(padraoUrl);
    entrada.resolvida = true;
    entrada.resolve(respostaJson(corpo, opts));
  }
  function rejeitarUrl(padraoUrl, erro) {
    const entrada = achar(padraoUrl);
    entrada.resolvida = true;
    entrada.reject(erro);
  }
  return { fetchImpl, chamadas, resolverUrl, rejeitarUrl };
}

async function clienteComVersaoResolvida() {
  const mock = criarFetchControlavel();
  const client = createSaebClient({ fetchImpl: mock.fetchImpl, baseUrl: "/data/saeb" });
  const p = client.getVersaoAtual();
  mock.resolverUrl("current.json", current());
  await p;
  return { client, ...mock };
}

// Deixa qualquer cadeia de .then/.catch/.finally já agendada terminar de rodar, sem depender de
// um timer real — usado para garantir que a limpeza interna do cache (que roda em reação a um
// abort) já aconteceu antes de fazer a próxima asserção.
async function drenarMicrotarefas(voltas = 8) {
  for (let i = 0; i < voltas; i += 1) await Promise.resolve();
}

/**
 * `client.getX()` passa por várias etapas assíncronas (resolverVersao → cache.obter do
 * "current" → cache.obter da chave real) antes de a chamada de rede de verdade acontecer — cada
 * `async function` intermediária custa pelo menos uma microtarefa. Em vez de adivinhar quantas
 * voltas bastam, espera ativamente (sem timer real) até a URL esperada aparecer em `chamadas`.
 */
async function esperarChamada(chamadas, padraoUrl, { tentativas = 50 } = {}) {
  for (let i = 0; i < tentativas; i += 1) {
    if (chamadas.some((u) => u.includes(padraoUrl))) return;
    await Promise.resolve();
  }
  throw new Error(`a chamada esperada ("${padraoUrl}") não aconteceu a tempo — chamadas até agora: ${chamadas.join(", ")}`);
}

/** Como esperarChamada, mas espera até a CONTAGEM de ocorrências atingir `quantidade` — usado para detectar uma SEGUNDA chamada à mesma URL. */
async function esperarContagem(chamadas, padraoUrl, quantidade, { tentativas = 50 } = {}) {
  for (let i = 0; i < tentativas; i += 1) {
    if (chamadas.filter((u) => u.includes(padraoUrl)).length >= quantidade) return;
    await Promise.resolve();
  }
  throw new Error(`a ${quantidade}ª chamada esperada ("${padraoUrl}") não aconteceu a tempo — chamadas até agora: ${chamadas.join(", ")}`);
}

// ---- 1. O achado da revisão: A → B na MESMA partição, ainda em voo -----------------------------

test("integração: escola A → escola B na MESMA partição ainda em voo — B recebe o dado real, nunca herda o AbortError de A", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pA = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  const pB = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));

  await esperarChamada(chamadas, "particoes/001.json");
  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 1, "as duas seleções devem compartilhar UMA única requisição de rede");

  resolverUrl("particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001"), escolaFixture("35000002")]));

  const [resultadoA, resultadoB] = await Promise.all([pA, pB]);
  assert.ok(eDescartado(resultadoA), "A é a seleção antiga — deve ser descartada, não reportada como erro");
  assert.ok(!eDescartado(resultadoB), "B é a seleção atual — nunca pode receber AbortError por causa do cancelamento de A");
  assert.equal(resultadoB.particao.municipio.codigoIbge, "3550308");
  assert.equal(resultadoB.particao.escolas.length, 2);
});

test("integração: A → B → C na MESMA partição, todas ainda em voo — só C recebe o resultado, uma única requisição de rede", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pA = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  const pB = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  const pC = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));

  await esperarChamada(chamadas, "particoes/001.json");
  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 1);
  resolverUrl("particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001")]));

  const [resultadoA, resultadoB, resultadoC] = await Promise.all([pA, pB, pC]);
  assert.ok(eDescartado(resultadoA));
  assert.ok(eDescartado(resultadoB));
  assert.ok(!eDescartado(resultadoC));
});

// ---- 2. A → B em partições DIFERENTES, respostas fora de ordem ---------------------------------

test("integração: A → B em PARTIÇÕES DIFERENTES — a requisição de A é cancelada de verdade (ninguém mais a usa), B segue independente", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pA = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  const pB = controller.run((signal) => client.getParticao("3550308", "002.json", { signal }));

  // B resolve primeiro — a resposta "correta" chega antes da requisição de A sequer terminar.
  await esperarChamada(chamadas, "particoes/002.json");
  resolverUrl("particoes/002.json", particaoFixture("3550308", [escolaFixture("35000002")]));
  const resultadoB = await pB;
  assert.ok(!eDescartado(resultadoB));
  assert.equal(resultadoB.particao.escolas[0].codigoInep, "35000002");

  // A requisição de A (chave diferente, sem mais ninguém interessado) já devia ter sido
  // abortada de verdade quando B começou — confirmando que o cancelamento ainda acontece
  // quando é seguro (chave exclusiva de uma seleção obsoleta).
  const resultadoA = await pA;
  assert.ok(eDescartado(resultadoA), "A precisa ser descartado — nunca aparecer como sucesso nem como erro visível");
});

test("integração: duas chaves DIFERENTES, sem SelectionController, resolvidas fora de ordem — nenhuma interfere na outra", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();

  const pA = client.getParticao("3550308", "001.json");
  const pB = client.getParticao("3550308", "002.json");

  await esperarChamada(chamadas, "particoes/001.json");
  await esperarChamada(chamadas, "particoes/002.json");
  resolverUrl("particoes/002.json", particaoFixture("3550308", [escolaFixture("35000002")]));
  resolverUrl("particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001")]));

  const [resultadoA, resultadoB] = await Promise.all([pA, pB]);
  assert.equal(resultadoA.particao.escolas[0].codigoInep, "35000001");
  assert.equal(resultadoB.particao.escolas[0].codigoInep, "35000002");
});

// ---- 3. Troca rápida de município ---------------------------------------------------------------

test("integração: troca rápida de MUNICÍPIO (partição única em cada) — o município antigo é descartado, o novo resolve normalmente", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pRO = controller.run((signal) => client.getParticao("1100015", "001.json", { signal }));
  const pSP = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));

  await esperarChamada(chamadas, "3550308/particoes/001.json");
  resolverUrl("3550308/particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001")]));
  const resultadoSP = await pSP;
  assert.ok(!eDescartado(resultadoSP));
  assert.equal(resultadoSP.particao.municipio.codigoIbge, "3550308");

  const resultadoRO = await pRO;
  assert.ok(eDescartado(resultadoRO));
});

test("integração: troca rápida de município SUBDIVIDIDO — busca do índice municipal antigo é descartada, a nova prossegue", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pPrimeiro = controller.run((signal) => client.getIndiceMunicipal("3550308", { signal }));
  const pSegundo = controller.run((signal) => client.getIndiceMunicipal("3550308", { signal }));

  await esperarChamada(chamadas, "escolas-index.json");
  resolverUrl("escolas-index.json", indiceMunicipal("3550308"));
  const [resultadoPrimeiro, resultadoSegundo] = await Promise.all([pPrimeiro, pSegundo]);
  assert.ok(eDescartado(resultadoPrimeiro));
  assert.ok(!eDescartado(resultadoSegundo));
  assert.equal(resultadoSegundo.indice.escolas.length, 2);
});

// ---- 4. Cancelamento seguido imediatamente de nova chamada para a MESMA chave -------------------

test("integração: cancelar() (com a requisição já de fato em voo) seguido IMEDIATAMENTE de uma nova chamada para a MESMA chave inicia uma requisição nova, não reaproveita a abortada", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pA = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  await esperarChamada(chamadas, "particoes/001.json"); // garante que A já é uma requisição real em voo, não só uma intenção
  controller.cancelar(); // única referência à chave — cancela a requisição de A de verdade
  await drenarMicrotarefas(); // deixa a limpeza de A (liberar -> abortar o controller interno -> apagar a entrada) terminar antes de B começar
  const pB = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));

  await esperarContagem(chamadas, "particoes/001.json", 2);
  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 2, "cancelar() + nova chamada para a mesma chave precisa gerar uma SEGUNDA requisição");

  resolverUrl("particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001")]));
  const resultadoB = await pB;
  assert.ok(!eDescartado(resultadoB));

  const resultadoA = await pA;
  assert.ok(eDescartado(resultadoA));

  // A rejeição tardia da requisição CANCELADA de A não pode apagar a entrada de cache que B
  // acabou de deixar pronta — buscar de novo a mesma chave não deve gerar nenhuma requisição nova.
  await drenarMicrotarefas();
  await client.getParticao("3550308", "001.json");
  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 2, "reutilizar a chave depois não pode ter disparado uma terceira requisição");
});

// ---- 5. Falha seguida de retry -------------------------------------------------------------------

test("integração: falha REAL (não abort) seguida de retry — o retry refaz a requisição e tem sucesso", async () => {
  const { client, chamadas, resolverUrl, rejeitarUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pFalha = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  await esperarChamada(chamadas, "particoes/001.json");
  rejeitarUrl("particoes/001.json", new Error("HTTP 500"));
  await assert.rejects(() => pFalha);

  const pRetry = controller.run((signal) => client.getParticao("3550308", "001.json", { signal }));
  await esperarContagem(chamadas, "particoes/001.json", 2);
  assert.equal(chamadas.filter((u) => u.includes("particoes/001.json")).length, 2, "retry precisa refazer a requisição de verdade");
  resolverUrl("particoes/001.json", particaoFixture("3550308", [escolaFixture("35000001")]));
  const resultado = await pRetry;
  assert.ok(!eDescartado(resultado));
});

// ---- 6. Garantia explícita: rejeição antiga nunca apaga entrada mais nova -----------------------

test("integração: a rejeição de uma promessa ANTIGA (abortada) nunca apaga uma entrada CONCLUÍDA mais nova para a mesma chave", async () => {
  const { client, chamadas, resolverUrl } = await clienteComVersaoResolvida();
  const controller = createSelectionController();

  const pAntiga = controller.run((signal) => client.getIndiceMunicipal("3550308", { signal }));
  await esperarChamada(chamadas, "escolas-index.json");
  controller.cancelar(); // aborta a antiga de verdade (única referência)
  await drenarMicrotarefas(); // deixa a limpeza de fato apagar a entrada antiga antes de criar a nova
  const pNova = controller.run((signal) => client.getIndiceMunicipal("3550308", { signal }));
  await esperarContagem(chamadas, "escolas-index.json", 2);
  resolverUrl("escolas-index.json", indiceMunicipal("3550308"));

  const [resultadoNova] = await Promise.all([pNova, pAntiga.catch(() => {})]);
  assert.ok(!eDescartado(resultadoNova));

  // Dá tempo da limpeza da promessa antiga (que rejeitou por abort) rodar por completo —
  // se ela apagasse a entrada nova por engano, a chamada abaixo dispararia uma TERCEIRA
  // requisição (a antiga já gerou 1, a nova gerou a 2ª — ver esperarContagem acima).
  await drenarMicrotarefas();
  await client.getIndiceMunicipal("3550308");
  assert.equal(
    chamadas.filter((u) => u.includes("escolas-index.json")).length,
    2,
    "a entrada concluída pela seleção nova não pode ter sido apagada pela limpeza tardia da antiga",
  );
});
