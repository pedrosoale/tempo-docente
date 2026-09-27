// Testes end-to-end (via o worker construído) da matriz Saeb ALINHADA À BNCC dentro de
// /saeb/matriz?matriz=bncc — mesma rota da matriz tradicional (Rodada 14: nenhuma rota nova é
// criada; ver tests/saeb-matriz-page.test.mjs para a matriz tradicional, preservada integralmente).
// Mesmo padrão de render-via-worker de tests/saeb-matriz-page.test.mjs. Nenhum teste aqui escreve
// em nenhum catálogo real — são requisições HTTP somente-leitura contra o worker já compilado.
import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}-${Math.random()}`);
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

// ---- 1-3: matriz tradicional continua padrão; matriz=tradicional e matriz=bncc funcionam ----

test("1. absence of 'matriz' query param still selects the matriz tradicional (default preserved)", async () => {
  const response = await render("/saeb/matriz");
  const main = isolateMain(await response.text());
  assert.match(main, /matriz tradicional \(2001\)/);
  // O texto tradicional pré-existente legitimamente MENCIONA "matriz alinhada à BNCC" (explicando a
  // transição de matrizes) — o que nunca deve acontecer é os RESULTADOS da BNCC (seletor ativo nela,
  // ou o parágrafo "Você está consultando a matriz alinhada à BNCC") aparecerem no render padrão.
  assert.doesNotMatch(main, /Você está consultando a.*matriz alinhada à BNCC/s);
  assert.doesNotMatch(main, /saeb-matriz-seletor-opcao is-active">Matriz alinhada à BNCC/);
});

test("2. 'matriz=tradicional' explicitly selects the matriz tradicional", async () => {
  const response = await render("/saeb/matriz?matriz=tradicional");
  const main = isolateMain(await response.text());
  assert.match(main, /matriz tradicional \(2001\)/);
});

test("3. 'matriz=bncc' selects the matriz alinhada à BNCC", async () => {
  const response = await render("/saeb/matriz?matriz=bncc");
  const main = isolateMain(await response.text());
  assert.match(main, /matriz alinhada à BNCC/);
  assert.doesNotMatch(main, /Você está consultando a.*matriz tradicional/s);
});

// ---- 4: as seis combinações BNCC ----

const COMBINACOES = [
  ["2anoEF", "linguagens", 10, "2º ano do Ensino Fundamental", "Linguagens/Língua Portuguesa"],
  ["2anoEF", "matematica", 33, "2º ano do Ensino Fundamental", "Matemática"],
  ["5anoEF", "linguagens", 47, "5º ano do Ensino Fundamental", "Linguagens/Língua Portuguesa"],
  ["5anoEF", "matematica", 56, "5º ano do Ensino Fundamental", "Matemática"],
  ["9anoEF", "linguagens", 57, "9º ano do Ensino Fundamental", "Linguagens/Língua Portuguesa"],
  ["9anoEF", "matematica", 59, "9º ano do Ensino Fundamental", "Matemática"],
];

for (const [etapa, componente, total, etapaLabel, componenteLabel] of COMBINACOES) {
  test(`4. matriz=bncc&etapa=${etapa}&componente=${componente} shows exactly ${total} habilidades`, async () => {
    const response = await render(`/saeb/matriz?matriz=bncc&etapa=${etapa}&componente=${componente}`);
    const main = isolateMain(await response.text());
    assert.match(main, new RegExp(`${total} habilidades, agrupadas em \\d+ eixo`));
    assert.match(main, new RegExp(etapaLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
    assert.match(main, new RegExp(componenteLabel.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
  });
}

// ---- 5-8: busca por código matemático, textual, sem acento; Linguagens sem código oficial ----

test("5. search by Matemática code (e.g. 9G2.7) filters to exactly that habilidade", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica&busca=9G2.7");
  const main = isolateMain(await response.text());
  assert.match(main, /1 de 59 habilidades correspondem/);
  const codigos = [...main.matchAll(/saeb-matriz-habilidade-codigo">([^<]+)</g)].map((m) => m[1]);
  assert.deepEqual(codigos, ["9G2.7"]);
});

test("6. free-text search matches on habilidade text", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica&busca=circunfer%C3%AAncia");
  const main = isolateMain(await response.text());
  assert.match(main, /circunfer[êe]ncia/i);
});

test("7. accent-insensitive search: 'circunferencia' (no accent) matches 'circunferência'", async () => {
  const comAcento = isolateMain(await (await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica&busca=circunfer%C3%AAncia")).text());
  const semAcento = isolateMain(await (await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica&busca=circunferencia")).text());
  const contagem = (html) => html.match(/(\d+) de \d+ habilidades correspondem/)?.[1];
  assert.equal(contagem(comAcento), contagem(semAcento));
  assert.ok(Number(contagem(semAcento)) > 0);
});

test("8. Linguagens habilidades never show an official code, even with a code-shaped search", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=linguagens&busca=9G2.7");
  const main = isolateMain(await response.text());
  assert.doesNotMatch(main, /saeb-matriz-habilidade-codigo/);
  // "9G2.7" não existe em Linguagens — a busca por código só vale para Matemática — então a busca
  // por esse texto em Linguagens deve zerar os resultados (nenhum texto contém esse código como palavra).
  assert.match(main, /0 de 57 habilidades correspondem/);
});

// ---- 9-10: parâmetros inválidos e repetidos ----

test("9. invalid 'etapa'/'componente' query params for matriz=bncc fall back safely, never a 500", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=invalida&componente=xx");
  assert.equal(response.status, 200);
  const main = isolateMain(await response.text());
  assert.match(main, /2º ano do Ensino Fundamental/);
  assert.match(main, /Linguagens\/L[íi]ngua Portuguesa/);
});

test("10a. repeated 'matriz' query param (?matriz=bncc&matriz=tradicional) never crashes — only the first value is used", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&matriz=tradicional");
  assert.equal(response.status, 200);
  const main = isolateMain(await response.text());
  assert.match(main, /matriz alinhada à BNCC/);
});

test("10b. repeated 'busca' query param for matriz=bncc never crashes — only the first value is used", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=5anoEF&componente=matematica&busca=5E2.3&busca=outro");
  assert.equal(response.status, 200);
  const main = isolateMain(await response.text());
  const codigos = [...main.matchAll(/saeb-matriz-habilidade-codigo">([^<]+)</g)].map((m) => m[1]);
  assert.ok(codigos.includes("5E2.3"));
});

test("10c. repeated 'etapa' and 'componente' query params for matriz=bncc never crash — only the first value of each is used", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=2anoEF&etapa=9anoEF&componente=linguagens&componente=matematica");
  assert.equal(response.status, 200);
  const main = isolateMain(await response.text());
  assert.match(main, /2º ano do Ensino Fundamental/);
  assert.match(main, /Linguagens\/L[íi]ngua Portuguesa/);
});

// ---- 11-12: 3ª série EM ausente na BNCC, presente na tradicional ----

test("11. matriz=bncc explicitly states it does not cover 3ª série do Ensino Médio", async () => {
  const response = await render("/saeb/matriz?matriz=bncc");
  const main = isolateMain(await response.text());
  assert.match(main, /não contém a 3ª série do Ensino Médio/);
});

test("12. matriz tradicional (default) still covers and mentions 3ª série do Ensino Médio", async () => {
  const response = await render("/saeb/matriz");
  const main = isolateMain(await response.text());
  assert.match(main, /3ª série do Ensino Médio/);
});

// ---- 13: nomenclatura "descritores" na tradicional, "habilidades" na BNCC ----

test("13. traditional matrix's own count/label uses 'descritores', BNCC matrix's uses 'habilidades' — never crossed", async () => {
  const tradicional = isolateMain(await (await render("/saeb/matriz")).text());
  const bncc = isolateMain(await (await render("/saeb/matriz?matriz=bncc")).text());
  // A contagem de itens (o indicador mais objetivo da nomenclatura técnica de cada matriz) usa a
  // palavra certa em cada uma — nunca "5 habilidades, agrupados" na tradicional, nunca "5
  // descritores, agrupados" na BNCC. (O texto explicativo tradicional pré-existente também usa
  // "habilidades" como substantivo comum — "os descritores indicam habilidades avaliadas" — o que é
  // legítimo e não deve ser testado como ausência total da palavra.)
  assert.match(tradicional, /\d+ descritores, agrupados em/);
  assert.doesNotMatch(tradicional, /\d+ habilidades, agrupadas em/);
  assert.match(bncc, /\d+ habilidades, agrupadas em/);
  assert.doesNotMatch(bncc, /\d+ descritores, agrupados em/);
  // O item de resultado em si nunca troca de rótulo entre as duas matrizes.
  assert.match(tradicional, /saeb-matriz-descritor-codigo/);
  assert.doesNotMatch(tradicional, /saeb-matriz-habilidade-codigo/);
  assert.match(bncc, /saeb-matriz-habilidade/);
  assert.doesNotMatch(bncc, /saeb-matriz-descritor/);
});

// ---- 14: aviso de ausência de equivalência automática ----

test("14. matriz=bncc explicitly warns there is no automatic equivalence with traditional descritores", async () => {
  const response = await render("/saeb/matriz?matriz=bncc");
  const main = isolateMain(await response.text());
  assert.match(main, /não existe convers[ãa]o autom[áa]tica entre um descritor tradicional e uma habilidade/i);
});

// ---- 15: fontes e hashes corretos ----

test("15. matriz=bncc shows both Linguagens and Matemática sources with their own distinct SHA-256 hashes, never mixed", async () => {
  const response = await render("/saeb/matriz?matriz=bncc");
  const main = isolateMain(await response.text());
  const hashes = [...main.matchAll(/SHA-256:\s*<code>([0-9a-f]{64})<\/code>/g)].map((m) => m[1]);
  assert.equal(hashes.length, 2);
  assert.notEqual(hashes[0], hashes[1]);
});

test("15b. no habilidade card shows a technical hash — hashes only appear in the fontes/proveniência section", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica");
  const main = isolateMain(await response.text());
  const habilidadesBlock = main.split("Fontes e proveniência")[0];
  assert.doesNotMatch(habilidadesBlock, /[0-9a-f]{64}/);
});

test("15c. no idInterno is exposed as visible text anywhere on the page", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica");
  const main = isolateMain(await response.text());
  assert.doesNotMatch(main, /matematica\.9anoEF\./);
});

// ---- 16: canonical ----

test("16. canonical stays exactly /saeb/matriz for matriz=bncc too — never a distinct canonical per query string", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica&busca=5E2.3");
  const html = await response.text();
  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonicals.length, 1);
  assert.equal(canonicals[0][1], "https://tempodocente.com.br/saeb/matriz");
});

// ---- 17: sitemap sem duplicação ----

test("17. sitemap.xml includes /saeb/matriz exactly once and no entry for a '?matriz=bncc' variant", async () => {
  const response = await render("/sitemap.xml");
  const xml = await response.text();
  const locs = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  const matrizEntries = locs.filter((l) => l.endsWith("/saeb/matriz"));
  assert.equal(matrizEntries.length, 1);
  assert.ok(!locs.some((l) => l.includes("matriz=bncc")), "sitemap should never contain a matriz=bncc query-string entry");
});

// ---- 18: Header continua apontando para /saeb/matriz ----

test("18. Header's SAEB submenu still links to the bare /saeb/matriz (no new redundant item)", async () => {
  const response = await render("/");
  const html = await response.text();
  assert.match(html, /href="\/saeb\/matriz"/);
});

// ---- 19: nenhuma requisição para /data/saeb-matriz-bncc/** ----

test("19. the BNCC catalog is never referenced as a network path anywhere in the rendered HTML", async () => {
  const response = await render("/saeb/matriz?matriz=bncc&etapa=9anoEF&componente=matematica");
  const html = await response.text();
  assert.doesNotMatch(html, /\/data\/saeb-matriz-bncc/);
});

// ---- 20: regressão da matriz tradicional (reforço — a suíte completa de saeb-matriz-page.test.mjs já cobre isto) ----
//
// IMPORTANTE (correção da revisão independente): a página inteira NÃO é "byte a byte idêntica" —
// o seletor e o cabeçalho global (H1/breadcrumb/metadata) mudaram nesta Rodada 14, deliberadamente,
// para as duas matrizes. O que é preservado byte a byte é só o CONTEÚDO PRÓPRIO DA MATRIZ TRADICIONAL
// (app/saeb/matriz/components/MatrizConsulta.tsx e o texto/estrutura que ele renderiza) — ver também
// a confirmação por hash de arquivo no relatório (Rodada 14, seção de correção).
test("20. matriz tradicional default render preserva o conteúdo e a estrutura essenciais da matriz tradicional", async () => {
  const response = await render("/saeb/matriz");
  const main = isolateMain(await response.text());
  assert.match(main, /5º Ano do Ensino Fundamental/);
  assert.ok(textOnly(main).includes("Localizar informações explícitas em um texto."));
  const detailsCount = (main.match(/<details/g) ?? []).length;
  assert.equal(detailsCount, 6, "5º ano de Língua Portuguesa continua com 6 tópicos");
});

// ---- Seletor de matriz: navegação HTML nativa (formulário GET), sem router client-side ----

test("o seletor expõe aria-pressed='true' na opção ativa e 'false' na inativa, nunca duas 'true' ao mesmo tempo", async () => {
  const tradicional = isolateMain(await (await render("/saeb/matriz")).text());
  const bncc = isolateMain(await (await render("/saeb/matriz?matriz=bncc")).text());
  assert.equal((tradicional.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((tradicional.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.equal((bncc.match(/aria-pressed="true"/g) ?? []).length, 1);
  assert.equal((bncc.match(/aria-pressed="false"/g) ?? []).length, 1);
  assert.match(tradicional, /Matriz tradicional \(2001\)[^]*?aria-pressed="true"|aria-pressed="true"[^]*?Matriz tradicional/);
  assert.match(bncc, /Matriz alinhada à BNCC[^]*?aria-pressed="true"|aria-pressed="true"[^]*?Matriz alinhada à BNCC/);
  // Nenhum aria-current sobrevive nesta rodada — foi substituído por aria-pressed.
  assert.doesNotMatch(tradicional, /saeb-matriz-seletor[^]*?aria-current/);
});

test("preserva o nome acessível do grupo do seletor: 'Selecionar matriz de referência'", async () => {
  const main = isolateMain(await (await render("/saeb/matriz")).text());
  assert.match(main, /aria-label="Selecionar matriz de referência"/);
});

test("o seletor é um <form method=\"get\" action=\"/saeb/matriz\"> com dois <button type=\"submit\">, nunca <a>", async () => {
  const response = await render("/saeb/matriz");
  const main = isolateMain(await response.text());
  const seletor = main.match(/<form class="saeb-matriz-seletor"[^]*?<\/form>/)?.[0];
  assert.ok(seletor, "seletor deveria ser um <form>");
  const formTag = seletor.match(/^<form[^>]*>/)[0];
  assert.match(formTag, /method="get"/);
  assert.match(formTag, /action="\/saeb\/matriz"/);
  assert.equal((seletor.match(/<button[^>]*type="submit"/g) ?? []).length, 2);
  assert.doesNotMatch(seletor, /<a[ >]/);
});

test("o botão 'Matriz tradicional' não tem name (envia a URL limpa /saeb/matriz); o botão BNCC envia name=\"matriz\" value=\"bncc\"", async () => {
  const response = await render("/saeb/matriz");
  const main = isolateMain(await response.text());
  const seletor = main.match(/<form class="saeb-matriz-seletor"[^]*?<\/form>/)?.[0] ?? "";
  const botoes = [...seletor.matchAll(/<button([^>]*)>([^<]*)<\/button>/g)];
  assert.equal(botoes.length, 2);
  const [tradicionalAttrs] = botoes[0];
  assert.doesNotMatch(botoes[0][1], /name=/, "botão tradicional não deve ter atributo name");
  assert.match(botoes[1][1], /name="matriz"/);
  assert.match(botoes[1][1], /value="bncc"/);
  void tradicionalAttrs;
});

test("MatrizSeletor.tsx nunca reintroduz useRouter, router.push, next/link ou navegação client-side", async () => {
  const { readFileSync } = await import("node:fs");
  const fullSource = readFileSync(new URL("../app/saeb/matriz/components/MatrizSeletor.tsx", import.meta.url), "utf-8");
  // Remove comentários de linha antes de checar — o próprio comentário do arquivo DOCUMENTA, em
  // prosa, que essas APIs foram deliberadamente removidas, e citá-las por nome ali é esperado e
  // desejável (não uma reintrodução real). Só o CÓDIGO precisa estar livre delas.
  const source = fullSource
    .split("\n")
    .filter((linha) => !linha.trim().startsWith("//"))
    .join("\n");
  assert.doesNotMatch(source, /useRouter/);
  assert.doesNotMatch(source, /router\.push/);
  assert.doesNotMatch(source, /next\/navigation/);
  assert.doesNotMatch(source, /next\/link/i);
  assert.doesNotMatch(source, /history\.pushState/);
  assert.doesNotMatch(source, /window\.location/);
  assert.doesNotMatch(source, /<a[ >]/);
  assert.match(source, /<form method="get" action="\/saeb\/matriz"/);
});

test("a troca de matriz funciona sem JavaScript: submeter o form GET (sem JS) produz a URL correta para cada botão", async () => {
  // Simula exatamente o que o navegador faz ao submeter um <form method="get"> sem nenhum
  // JavaScript: monta a query string a partir do(s) campo(s) com `name`, ignorando os sem nome.
  // Nunca usa dispatchEvent, .click() programático ou edição manual da URL como prova de teclado —
  // isto testa só o CONTRATO HTML do formulário (action/method/name/value), não a ativação por si.
  const tradicionalUrl = "/saeb/matriz"; // botão sem name -> nenhum campo enviado
  const bnccUrl = "/saeb/matriz?matriz=bncc"; // botão com name="matriz" value="bncc"
  const respTradicional = await render(tradicionalUrl);
  const respBncc = await render(bnccUrl);
  assert.equal(respTradicional.status, 200);
  assert.equal(respBncc.status, 200);
  assert.match(isolateMain(await respTradicional.text()), /matriz tradicional \(2001\)/);
  assert.match(isolateMain(await respBncc.text()), /matriz alinhada à BNCC/);
});
