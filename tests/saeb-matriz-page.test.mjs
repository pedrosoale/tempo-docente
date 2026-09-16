// Testes end-to-end (via o worker construído) da página /saeb/matriz e dos links contextuais que
// apontam para ela. Mesmo padrão de tests/saeb.test.mjs e tests/navigation.test.mjs: renderiza a
// rota através do worker já compilado em dist/server/index.js e faz asserções sobre o HTML.
import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

function isolateMain(html) {
  return html.match(/<main[^>]*id="main-content"[^>]*>[^]*?<\/main>/)?.[0] ?? "";
}

function textOnly(html) {
  return html
    .replace(/<script[^]*?<\/script>/g, " ")
    .replace(/<[^>]+>/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const PROIBIDAS = ["a escola domina o descritor", "a escola não domina o descritor", "descritores deste nível de proficiência"];

// ---- Rota base, metadados e conteúdo padrão (5º ano / Língua Portuguesa) ----

const defaultResponse = await render("/saeb/matriz");
const defaultHtml = await defaultResponse.text();
const defaultMain = isolateMain(defaultHtml);
const defaultText = textOnly(defaultMain);

test("/saeb/matriz renders with status 200 and an HTML content type", () => {
  assert.equal(defaultResponse.status, 200);
  assert.match(defaultResponse.headers.get("content-type") ?? "", /^text\/html\b/i);
});

test("metadata: title, description and canonical point at /saeb/matriz", () => {
  assert.match(defaultHtml, /<title>Matriz de referência e descritores do SAEB \| Tempo Docente<\/title>/);
  const canonicals = [...defaultHtml.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonicals.length, 1, `expected exactly one canonical link, found ${canonicals.length}`);
  assert.equal(canonicals[0][1], "https://tempodocente.com.br/saeb/matriz");
});

test("default render (no query params) shows the 5º ano / Língua Portuguesa matriz, identified as tradicional (2001)", () => {
  assert.match(defaultMain, /matriz tradicional \(2001\)/);
  assert.ok(defaultText.includes("5º Ano do Ensino Fundamental"));
  assert.ok(defaultText.includes("Localizar informações explícitas em um texto."));
});

test("mentions the BNCC transition without inventing the term \"matriz híbrida\"", () => {
  assert.match(defaultText, /BNCC/);
  assert.match(defaultText, /transição/i);
  assert.doesNotMatch(defaultText, /matriz híbrida/i);
});

test("cites the 2025 continuity claim with a direct link to the specific official 'Diretrizes da edição' cartilha, plus the general 'Matrizes e Escalas' page", () => {
  assert.match(
    defaultMain,
    /href="https:\/\/download\.inep\.gov\.br\/publicacoes\/institucionais\/avaliacoes_e_exames_da_educacao_basica\/cartilha_saeb_2025_diretrizes_da_edicao\.pdf"/,
  );
  assert.match(defaultMain, /href="https:\/\/www\.gov\.br\/inep\/pt-br\/areas-de-atuacao\/avaliacao-e-exames-educacionais\/saeb\/matrizes-e-escalas"/);
  // A cartilha oficial (pág. 14, impressa 12) afirma que o conteúdo é "o mesmo conteúdo das edições
  // anteriores do Saeb, alinhadas à BNCC e 2001" — conferido visualmente contra a página renderizada
  // do PDF (a extração de texto automática corrompe esse trecho, como em outros PDFs do Inep usados
  // neste piloto). A citação na página precisa preservar as DUAS referências (BNCC e 2001), nunca
  // reescrever a frase para implicar uma associação exclusiva a 2001.
  assert.match(defaultText, /3ª e 4ª série do Ensino Médio/);
  assert.match(defaultText, /mesmo conteúdo das edições anteriores do Saeb/);
  assert.match(defaultText, /BNCC/);
  assert.match(defaultText, /matriz de 2001/);
  // E precisa deixar explícito, nesta mesma citação, que a consulta cobre só a matriz tradicional —
  // nunca implicar que os descritores mostrados aqui representam a matriz alinhada à BNCC.
  assert.match(defaultText, /consulta cobre apenas a matriz tradicional/);
  assert.match(defaultText, /não representam a matriz alinhada à BNCC/);
});

test("shows the pedagogical explanation: matriz as a recorte, descritor vs. currículo, média não diagnostica descritor", () => {
  assert.match(defaultText, /recorte/);
  assert.match(defaultText, /não permite diagnosticar diretamente/);
  assert.match(defaultText, /não substitui uma análise pedagógica/);
});

test("links to both official Inep PDFs (Língua Portuguesa and Matemática), never to a third-party mirror", () => {
  assert.match(defaultMain, /href="https:\/\/download\.inep\.gov\.br\/educacao_basica\/saeb\/matriz-de-referencia-de-lingua-portuguesa_2001\.pdf"/);
  assert.match(defaultMain, /href="https:\/\/download\.inep\.gov\.br\/educacao_basica\/saeb\/matriz-de-referencia-de-matematica_2001\.pdf"/);
});

test("groups render as native <details>/<summary> accordions — one per tópico, all open by default", () => {
  const detailsCount = (defaultMain.match(/<details/g) ?? []).length;
  const summaryCount = (defaultMain.match(/<summary/g) ?? []).length;
  assert.equal(detailsCount, 6, "5º ano de Língua Portuguesa tem 6 tópicos");
  assert.equal(summaryCount, 6);
  assert.equal((defaultMain.match(/<details[^>]* open/g) ?? []).length, 6, "all groups should be open by default");
});

test("never associates a descriptor with the school's result, and never uses the forbidden phrasing", () => {
  const lowered = defaultText.toLowerCase();
  for (const proibida of PROIBIDAS) {
    assert.ok(!lowered.includes(proibida), `should never contain "${proibida}"`);
  }
  // The pedagogical caveat legitimately mentions "uma escola" (in the abstract, about proficiency
  // averages in general) — what must never appear is the school's own name/código INEP next to a
  // descriptor, which this page never has access to in the first place (it renders only the static
  // catalogue, never a school record).
  assert.doesNotMatch(defaultText, /código inep/i);
});

test("does not implement territorial comparison, export, percentage distribution by level, or ranking", () => {
  assert.doesNotMatch(defaultText, /compara(ç|c)[ãa]o territorial/i);
  assert.doesNotMatch(defaultText, /exportar|exporta[çc][ãa]o/i);
  assert.doesNotMatch(defaultText, /distribui(ç|c)[ãa]o percentual/i);
  assert.doesNotMatch(defaultText, /ranking/i);
});

// ---- Filtros por etapa/componente via querystring, refletidos no HTML já no primeiro render ----

test("etapa and componente query params select the corresponding matriz on first render (no extra request needed)", async () => {
  const response = await render("/saeb/matriz?etapa=anosFinais&componente=mt");
  const html = await response.text();
  const main = isolateMain(html);
  assert.match(main, /9º Ano do Ensino Fundamental/);
  assert.match(main, /Matemática/);
  // Um descritor exclusivo do 9º ano de Matemática (D19 nesta etapa é "significados naturais" —
  // usa-se um texto que só existe nesse recorte para confirmar que o filtro realmente trocou o
  // conjunto de dados, não só o rótulo).
  assert.match(main, /Reconhecer círculo\/circunferência/);
});

test("busca query param filters descriptors by code on first render", async () => {
  const response = await render("/saeb/matriz?etapa=anosFinais&componente=mt&busca=D7");
  const html = await response.text();
  const main = isolateMain(html);
  assert.match(main, /1 de 37 descritores correspondem à busca\./);
  const codes = [...main.matchAll(/saeb-matriz-descritor-codigo">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(codes, ["D7"]);
});

test("busca query param filters descriptors by free text on first render", async () => {
  const response = await render("/saeb/matriz?etapa=anosIniciais&componente=lp&busca=opini%C3%A3o");
  const html = await response.text();
  const main = isolateMain(html);
  const codes = [...main.matchAll(/saeb-matriz-descritor-codigo">([^<]+)</g)].map((m) => m[1]);
  assert.ok(codes.includes("D11"), "D11 (\"Distinguir um fato da opinião...\") should match a search for 'opinião'");
});

test("invalid etapa/componente query params fall back safely to the default matriz, never a 500 or blank page", async () => {
  const response = await render("/saeb/matriz?etapa=invalida&componente=xx");
  assert.equal(response.status, 200);
  const html = await response.text();
  const main = isolateMain(html);
  assert.match(main, /5º Ano do Ensino Fundamental/);
  assert.match(main, /Língua Portuguesa/);
});

test("a repeated 'busca' query param (?busca=D1&busca=D2) never crashes the route with a 500 — only the first value is used", async () => {
  const response = await render("/saeb/matriz?etapa=anosFinais&componente=mt&busca=D1&busca=D2");
  assert.equal(response.status, 200);
  const html = await response.text();
  const main = isolateMain(html);
  // "D1" casa por prefixo com D1 e D10..D19 (mesmo comportamento já coberto para uma busca simples
  // por "D1") — o que importa aqui é que filtrou pelo PRIMEIRO valor ("D1"), nunca pelo segundo
  // ("D2"), e que a rota não caiu com 500.
  const codes = [...main.matchAll(/saeb-matriz-descritor-codigo">([^<]+)</g)].map((m) => m[1]);
  assert.ok(codes.includes("D1"), "should match the first 'busca' value (D1)");
  assert.ok(!codes.includes("D2"), "should never fall through to the second 'busca' value (D2)");
});

test("repeated 'etapa' and 'componente' query params never crash the route — only the first value of each is used", async () => {
  const response = await render("/saeb/matriz?etapa=anosIniciais&etapa=ensinoMedio&componente=lp&componente=mt");
  assert.equal(response.status, 200);
  const html = await response.text();
  const main = isolateMain(html);
  assert.match(main, /5º Ano do Ensino Fundamental/);
  assert.match(main, /Língua Portuguesa/);
});

// ---- Distinção matriz tradicional vs. escala de proficiência: nunca no mesmo vocabulário ----

test("never calls a descriptor a 'nível de proficiência', and never gives a descriptor a numeric score range", () => {
  assert.doesNotMatch(defaultText, /D1[^0-9].{0,40}n[íi]vel de profici[êe]ncia/i);
  assert.doesNotMatch(defaultMain, /limiteInferior|limiteSuperior/);
});

// ---- Link contextual em /saeb ----

test("/saeb includes a clear entry point to the matriz/descritores page", async () => {
  const response = await render("/saeb");
  const html = await response.text();
  const main = isolateMain(html);
  assert.match(main, /<a[^>]*href="\/saeb\/matriz"[^>]*>\s*Consultar matriz e descritores do SAEB/);
});

// ---- Link contextual dentro do painel "Entenda este resultado" ----

test("InterpretacaoResultado.tsx links to /saeb/matriz preserving etapa and componente, without hardcoding a specific descriptor", async () => {
  const { readFileSync } = await import("node:fs");
  const source = readFileSync(new URL("../app/saeb/components/InterpretacaoResultado.tsx", import.meta.url), "utf-8");
  assert.match(source, /\/saeb\/matriz\?etapa=\$\{etapa\}&componente=\$\{componente\}/);
  assert.match(source, /Consultar os descritores da matriz desta etapa/);
  for (const proibida of PROIBIDAS) {
    assert.ok(!source.toLowerCase().includes(proibida), `InterpretacaoResultado.tsx should never contain "${proibida}"`);
  }
});
