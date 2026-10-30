// Testes da descoberta da BNCC Computação a partir da página principal /bncc (Rodada 38). As rotas são
// renderizadas pelo worker já construído (dist/server/index.js), como em tests/bncc-computacao-interface.test.mjs,
// e as expectativas são derivadas DIRETAMENTE dos JSONs do catálogo — nunca da biblioteca que está sendo testada.
// Nenhum teste aqui escreve em arquivo versionado.
import assert from "node:assert/strict";
import { createHash } from "node:crypto";
import { existsSync, readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";
import { TAMANHO_MAXIMO_BUSCA_HUB, lerBuscaHub, normalizarBuscaHub } from "../lib/bncc/busca-hub.ts";
import { TAMANHO_MAXIMO_BUSCA } from "../lib/bncc/computacao-consulta.ts";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ESCOPOS = ["educacao-infantil", "anos-iniciais", "anos-finais", "ensino-medio"];
const TITULO_SECAO = "BNCC Computação — Complemento à BNCC";
const TITULO_COMP_H2 = TITULO_SECAO;
const NOME_OFICIAL = "Computação na Educação Básica — Complemento à BNCC";
const PREVIA = 6;

const catalogos = Object.fromEntries(ESCOPOS.map((e) => [e, JSON.parse(readFileSync(join(RAIZ, "data", "bncc", `computacao-${e}.json`), "utf-8"))]));
const habilidades = ESCOPOS.flatMap((e) => catalogos[e].registros.filter((r) => r.codigo));
const CODIGOS = habilidades.map((h) => h.codigo);
const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();
const principalDe = (h) => norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2].filter(Boolean).join(" "));
const apoioDe = (h) => norm([h.explicacao, ...h.exemplos].filter(Boolean).join(" "));
// Expectativa independente: todos os termos aparecem em código/texto/objeto/explicação/exemplos (como a consulta própria).
const esperados = (q) => {
  const t = norm(q).split(" ").filter(Boolean);
  return habilidades.filter((h) => t.every((x) => `${principalDe(h)} ${apoioDe(h)}`.includes(x)));
};

// ---- infraestrutura de renderização --------------------------------------------------------------------------
const workerUrl = new URL("../dist/server/index.js", import.meta.url);
workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
const { default: worker } = await import(workerUrl.href);

const cache = new Map();
async function render(path) {
  if (!cache.has(path)) {
    const response = await worker.fetch(
      new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
      { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
      { waitUntil() {}, passThroughOnException() {} },
    );
    const html = (await response.text()).replace(/<!-- -->/g, "");
    cache.set(path, { status: response.status, html });
  }
  return cache.get(path);
}
const principal = (html) => html.match(/<main[^>]*id="main-content"[^>]*>[^]*?<\/main>/)?.[0] ?? "";
const decodificar = (s) =>
  s.replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16))).replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"').replace(/&lt;/g, "<").replace(/&gt;/g, ">").replace(/&amp;/g, "&");
const textoDe = (html) => decodificar((html.includes("<main") ? principal(html) : html).replace(/<script[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const secaoComp = (html) => principal(html).match(/<section class="bncc-comp-secao"[^]*?<\/section>/)?.[0] ?? "";
const cartoesComp = (html) => [...secaoComp(html).matchAll(/<article class="bncc-result-card bncc-comp-card">[^]*?<\/article>/g)].map((m) => m[0]);
const codigosComp = (html) => cartoesComp(html).map((c) => c.match(/<code>([A-Z0-9]+)<\/code>/)[1]);
const secaoCurricular = (html) => principal(html).match(/<section class="bncc-curricular-secao"[^]*?<\/section>/)?.[0] ?? "";
const hrefsDosCartoes = (html) => [...(principal(html).match(/<div class="access-grid">[^]*?<\/div><\/div><\/section>/)?.[0] ?? "").matchAll(/<a class="access-card[^"]*" href="([^"]+)"/g)].map((m) => m[1]);

// ---- 1. acesso visível em /bncc ------------------------------------------------------------------------------
test("/bncc: acesso visível à BNCC Computação com nome, complemento, escopo e link corretos", async () => {
  const { status, html } = await render("/bncc");
  assert.equal(status, 200);
  const cartao = principal(html).match(/<a class="access-card access-card-complemento" href="\/bncc\/computacao">[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(cartao, "cartão de acesso ausente");
  const texto = textoDe(cartao);
  assert.match(cartao, /<h3>BNCC Computação<\/h3>/);
  assert.ok(texto.includes(NOME_OFICIAL));
  assert.ok(texto.includes("Complemento oficial à BNCC"));
  assert.ok(texto.includes(`Consulte ${habilidades.length} objetivos e habilidades da Educação Infantil, do Ensino Fundamental e do Ensino Médio, com as explicações e os exemplos oficiais do documento.`));
  assert.equal(habilidades.length, 141);
  assert.ok(texto.includes("Explorar BNCC Computação"));
  assert.equal((principal(html).match(/href="\/bncc\/computacao"/g) ?? []).length, 1, "um único acesso à rota própria");
});

test("/bncc: o cartão não apresenta a Computação como componente tradicional, matriz do SAEB, Currículo Paulista, avaliação externa ou criação do Tempo Docente", async () => {
  const cartao = principal((await render("/bncc")).html).match(/<a class="access-card access-card-complemento"[^]*?<\/a>/)[0];
  const texto = norm(textoDe(cartao));
  for (const proibido of ["saeb", "saresp", "curriculo paulista", "avaliacao", "tempo docente", "componente curricular", "criado", "criamos"]) {
    assert.ok(!texto.includes(proibido), `o cartão não deveria mencionar "${proibido}"`);
  }
});

test("/bncc: os quatro acessos anteriores continuam, na mesma ordem, e o novo vem depois (largura total, sem seção extra)", async () => {
  const { html } = await render("/bncc");
  assert.deepEqual(hrefsDosCartoes(html), ["/bncc/competencias-gerais", "/bncc/educacao-infantil", "/bncc/ensino-fundamental", "/bncc/ensino-medio", "/bncc/computacao"]);
  assert.equal((principal(html).match(/<section class="section quick-access"/g) ?? []).length, 1, "nenhuma seção nova na landing");
  for (const titulo of ["Competências Gerais", "Educação Infantil", "Ensino Fundamental", "Ensino Médio"]) assert.ok(principal(html).includes(`<h3>${titulo}</h3>`), titulo);
});

test("/bncc: o conteúdo (inclusive o formulário de busca por GET) vem no HTML inicial, não em segmento oculto que depende de JavaScript — com e sem busca", async () => {
  for (const caminho of ["/bncc", "/bncc?q=EF01CO01", "/bncc?q=dados", "/bncc?q=fracoes", "/bncc?q=zzzz-sem-resultado"]) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, caminho);
    const m = principal(html);
    assert.match(m, /<form role="search" action="\/bncc" method="get">/, caminho);
    assert.match(m, /name="q"/, caminho);
    assert.match(m, /<h1>Consulte a BNCC<\/h1>/, caminho);
    assert.ok(!/<template id="B:\d+"><\/template>/.test(m) && !/bncc-loading/.test(m), `${caminho}: conteúdo foi para o segmento oculto`);
    assert.ok(!/<div hidden id="S:\d+">/.test(html), `${caminho}: há segmento oculto de Suspense`);
  }
});

// ---- 2. busca: código, minúsculas, texto, sem acento, explicação/exemplo --------------------------------------------
test("busca por código oficial: EF01CO01 mostra a seção separada, 1 cartão e link para a consulta própria com a busca preservada", async () => {
  const { status, html } = await render("/bncc?q=EF01CO01");
  assert.equal(status, 200);
  const secao = secaoComp(html);
  assert.ok(secao);
  assert.match(secao, /<h2 id="bncc-computacao-titulo">BNCC Computação — Complemento à BNCC<\/h2>/);
  assert.ok(secao.includes(`>${TITULO_SECAO}</h2>`), "título explícito da seção");
  assert.deepEqual(codigosComp(html), ["EF01CO01"]);
  assert.ok(secao.includes('href="/bncc/computacao?q=EF01CO01#resultados"'));
  assert.ok(textoDe(secao).includes("1 resultado"));
  assert.ok(!secao.includes("Ver todos"), "só há 1 resultado");
  const registro = habilidades.find((h) => h.codigo === "EF01CO01");
  assert.ok(textoDe(secao).includes(registro.texto), "texto oficial da habilidade, sem reescrita");
  // não há resultado curricular para o código, e o estado vazio avisa que há resultados acima (a Computação vem antes)
  assert.ok(textoDe(secaoCurricular(html)).includes("Nenhum registro encontrado."));
  assert.ok(textoDe(secaoCurricular(html)).includes("Há resultados na BNCC Computação, logo acima."));
});

test("busca por código em minúsculas: ef01co01 encontra o mesmo registro e o link preserva o que foi digitado", async () => {
  const { html } = await render("/bncc?q=ef01co01");
  assert.deepEqual(codigosComp(html), ["EF01CO01"]);
  assert.ok(secaoComp(html).includes('href="/bncc/computacao?q=ef01co01#resultados"'));
});

test("busca por código com resultado curricular não mistura: EF07MA18 não mostra Computação", async () => {
  const { html } = await render("/bncc?q=EF07MA18");
  assert.equal(secaoComp(html), "");
  assert.ok(principal(html).includes("EF07MA18</code>"));
  assert.ok(!principal(html).includes("bncc-comp-card"));
});

test("busca textual: o total e os primeiros resultados vêm do catálogo, em ordem de catálogo", async () => {
  for (const q of ["algoritmos", "dados", "tecnologias computacionais", "organizar objetos"]) {
    const esperado = esperados(q);
    const { html } = await render(`/bncc?q=${encodeURIComponent(q)}`);
    assert.ok(esperado.length > 0, q);
    assert.deepEqual(codigosComp(html), esperado.slice(0, PREVIA).map((h) => h.codigo), q);
    assert.ok(textoDe(secaoComp(html)).includes(`${esperado.length} ${esperado.length === 1 ? "resultado" : "resultados"}`), q);
  }
});

test("busca sem acento: 'abstracao' e 'abstração' dão exatamente os mesmos resultados", async () => {
  const com = await render(`/bncc?q=${encodeURIComponent("abstração")}`);
  const sem = await render("/bncc?q=abstracao");
  assert.ok(esperados("abstracao").length > 0);
  assert.deepEqual(codigosComp(sem.html), esperados("abstracao").slice(0, PREVIA).map((h) => h.codigo));
  assert.deepEqual(codigosComp(com.html), codigosComp(sem.html));
});

test("busca em explicação ou exemplo: termos que só existem no apoio levam ao registro e o cartão avisa onde o termo foi encontrado", async () => {
  // Procura, no catálogo, um termo longo que NUNCA aparece em código/texto/objeto e aparece só em explicação/exemplo.
  const candidatos = new Set();
  for (const h of habilidades) for (const palavra of apoioDe(h).split(" ")) if (/^[a-z]{9,}$/.test(palavra)) candidatos.add(palavra);
  const soApoio = [...candidatos].filter((t) => habilidades.every((h) => !principalDe(h).includes(t))).find((t) => esperados(t).length > 0);
  assert.ok(soApoio, "o catálogo deveria ter ao menos um termo só de explicação/exemplo");
  const esperado = esperados(soApoio);
  const { html } = await render(`/bncc?q=${soApoio}`);
  assert.deepEqual(codigosComp(html), esperado.slice(0, PREVIA).map((h) => h.codigo));
  for (const cartao of cartoesComp(html)) assert.ok(cartao.includes("Termo encontrado na explicação ou nos exemplos oficiais."), "aviso de apoio");
  // Termo no texto principal NÃO mostra o aviso.
  const direto = await render("/bncc?q=EF01CO01");
  assert.ok(!cartoesComp(direto.html)[0].includes("Termo encontrado na explicação"));
});

test("literal impresso EF05CO011: a busca leva ao código oficial EF05CO11 e nunca a um código inexistente", async () => {
  const { html } = await render("/bncc?q=EF05CO011");
  assert.deepEqual(codigosComp(html), ["EF05CO11"]);
  assert.ok(!CODIGOS.includes("EF05CO011"));
  assert.ok(!/<code>EF05CO011<\/code>/.test(principal(html)));
});

// ---- 3. seção separada, rótulos e ausência de mistura ---------------------------------------------------------------
test("seção separada: a seção BNCC Computação vem antes da seção curricular; Computação só dentro da seção rotulada; nenhum código de um lado aparece no outro", async () => {
  const { html } = await render("/bncc?q=dados");
  const m = principal(html);
  const secao = secaoComp(html);
  // Ordem corrigida após a revisão independente: resumo → Computação → lista curricular (antes a Computação ficava ~19.000 px abaixo).
  assert.ok(secao && m.indexOf(secao) < m.indexOf('<section class="bncc-curricular-secao"'), "a seção de Computação vem antes da lista curricular");
  const curricular = secaoCurricular(html);
  assert.ok(curricular.includes("bncc-result-card"), "a busca 'dados' também tem resultados curriculares");
  const codigosCurriculares = [...curricular.matchAll(/<article class="bncc-result-card" [^>]*>|<article class="bncc-result-card">[^]*?<code>([A-Z0-9]+)<\/code>/g)];
  assert.ok(codigosCurriculares.length > 0);
  for (const codigo of CODIGOS) assert.ok(!curricular.includes(`<code>${codigo}</code>`), `${codigo} apareceu fora da seção de Computação`);
  for (const cartao of cartoesComp(html)) assert.ok(cartao.includes("BNCC Computação"), "cada cartão é rotulado como BNCC Computação");
  // A contagem do resumo continua sendo a da BNCC curricular importada (sem somar Computação).
  const resumo = principal(html).match(/<div class="bncc-results-summary"[^]*?Busca em toda a BNCC importada[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(textoDe(resumo).includes("Busca em toda a BNCC importada"));
  assert.match(principal(html), /<a class="bncc-comp-salto" href="#bncc-computacao-resultados">45 resultados na BNCC Computação<\/a>/);
});

test("prévia: no máximo 6 cartões, com o total real e o link 'Ver todos' mantendo a busca na rota própria", async () => {
  const q = "dados";
  const total = esperados(q).length;
  assert.equal(total, 45);
  const { html } = await render(`/bncc?q=${q}`);
  assert.equal(cartoesComp(html).length, PREVIA);
  const texto = textoDe(secaoComp(html));
  assert.ok(texto.includes(`${total} resultados · mostrando os ${PREVIA} primeiros`));
  assert.match(secaoComp(html), /<a class="button button-secondary" href="\/bncc\/computacao\?q=dados#resultados">Ver todos na BNCC Computação/);
  // Destino: a consulta própria entrega os mesmos 45 resultados.
  const propria = await render("/bncc/computacao?q=dados");
  assert.ok(textoDe(propria.html).includes(`${total} resultados de 141`));
});

test("prévia: 'Ver todos' preserva busca com acento e espaços, codificada na URL", async () => {
  const q = "análise de dados";
  const { html } = await render(`/bncc?q=${encodeURIComponent(q)}`);
  const total = esperados(q).length;
  if (total > PREVIA) {
    assert.ok(secaoComp(html).includes('href="/bncc/computacao?q=an%C3%A1lise+de+dados#resultados">Ver todos'));
  } else {
    assert.ok(!secaoComp(html).includes("Ver todos") || total > PREVIA);
  }
  const abrangente = await render(`/bncc?q=${encodeURIComponent("computacional")}`);
  assert.ok(esperados("computacional").length > PREVIA);
  assert.ok(secaoComp(abrangente.html).includes("Ver todos na BNCC Computação"));
});

test("prévia: com até 6 resultados não há 'Ver todos', mas cada cartão ainda aponta para a consulta própria", async () => {
  const q = ["organizar objetos", "EF01CO01"].find((x) => esperados(x).length > 0 && esperados(x).length <= PREVIA);
  assert.ok(q);
  const { html } = await render(`/bncc?q=${encodeURIComponent(q)}`);
  assert.ok(!secaoComp(html).includes("Ver todos"));
  assert.equal(cartoesComp(html).length, esperados(q).length);
  for (const cartao of cartoesComp(html)) assert.match(cartao, /href="\/bncc\/computacao\?q=[^"#]+#resultados">Ver na BNCC Computação/);
});

test("clique no resultado: o destino é a rota própria com a busca preservada e a página própria mostra o registro", async () => {
  const { html } = await render("/bncc?q=EF01CO01");
  const destino = decodificar(secaoComp(html).match(/<a href="(\/bncc\/computacao\?[^"]+)">Ver na BNCC Computação/)[1]);
  assert.equal(destino, "/bncc/computacao?q=EF01CO01#resultados");
  const propria = await render(destino.split("#")[0]);
  assert.equal(propria.status, 200);
  assert.match(propria.html, /<code class="comp-codigo">EF01CO01<\/code>/);
  assert.ok(textoDe(propria.html).includes("1 resultado de 141"));
});

test("a prévia não duplica explicações nem exemplos: só código, texto oficial e rótulo (o detalhe fica na consulta própria)", async () => {
  const { html } = await render("/bncc?q=EF01CO01");
  const secao = secaoComp(html);
  assert.ok(!secao.includes("<details"));
  const registro = habilidades.find((h) => h.codigo === "EF01CO01");
  assert.ok(!secao.includes(registro.explicacao.slice(0, 60)));
  for (const exemplo of registro.exemplos) assert.ok(!secao.includes(exemplo.slice(0, 60)));
});

// ---- 4. sem termo: nada de Computação ---------------------------------------------------------------------------------
test("sem termo de busca (ausente, vazio, só espaços ou só caracteres de controle) nenhum resultado de Computação é renderizado", async () => {
  for (const caminho of ["/bncc", "/bncc?q=", "/bncc?q=%20%20%20", "/bncc?q=%01%02"]) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, caminho);
    assert.equal(secaoComp(html), "", caminho);
    assert.ok(!principal(html).includes("bncc-comp-card"), caminho);
    for (const codigo of CODIGOS.slice(0, 20)) assert.ok(!principal(html).includes(`<code>${codigo}</code>`), `${caminho}: ${codigo}`);
  }
});

test("busca sem nenhum resultado em lugar nenhum: estado vazio padrão, sem seção de Computação", async () => {
  const { html } = await render("/bncc?q=zzzz-sem-resultado");
  assert.ok(textoDe(html).includes("Nenhum registro encontrado."));
  assert.ok(!textoDe(html).includes("Há resultados na BNCC Computação"));
  assert.equal(secaoComp(html), "");
});

// Versão anterior (permissiva, substituída): aceitava `status === 200 || status === 400` e por isso não pegou que
// /bncc?q=dados&q=algoritmos abria o error boundary. O teste final exige 200 e a ausência do boundary.
test("parâmetros repetidos ou inválidos em /bncc respondem sempre 200, sem abrir o error boundary", async () => {
  const caminhos = [
    "/bncc?q=dados&q=algoritmos", "/bncc?q=", "/bncc?q=%20%20", "/bncc?q=&q=", "/bncc?q=a&q=b&q=c&q=d",
    "/bncc?q=" + "a".repeat(5000), "/bncc?q=da%00dos%1F", "/bncc?q%5B%5D=dados", "/bncc?q[]=dados&q[]=algoritmos",
    "/bncc?__proto__=dados", "/bncc?constructor=dados&q=dados", "/bncc?q=%E0%A4%A", "/bncc?q=EF01CO01&etapa=xyz&pagina=-3",
  ];
  for (const caminho of caminhos) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, `${caminho}: ${status}`);
    assert.ok(!html.includes("Não foi possível carregar a consulta da BNCC"), `${caminho}: abriu o error boundary`);
    assert.match(principal(html), /<h1>Consulte a BNCC<\/h1>/, caminho);
  }
});

// ---- 4b. correções após a revisão independente: parâmetro `q` repetido e posição da Computação -------------------------
const AVISO_REPETIDO = "O filtro “q” foi informado mais de uma vez; foi usado apenas o primeiro valor.";
const AVISO_LIMITE = `A busca foi limitada a ${TAMANHO_MAXIMO_BUSCA_HUB} caracteres.`;
const valorDoCampo = (html) => decodificar(principal(html).match(/<input[^>]*name="q"[^>]*>/)?.[0].match(/value="([^"]*)"/)?.[1] ?? "");
const cartoesCurriculares = (html) => [...secaoCurricular(html).matchAll(/<article class="bncc-result-card">/g)].length;

test("normalizarBuscaHub: string, array, undefined e formatos inesperados nunca lançam e sempre devolvem string", () => {
  assert.equal(TAMANHO_MAXIMO_BUSCA_HUB, 120);
  assert.equal(TAMANHO_MAXIMO_BUSCA_HUB, TAMANHO_MAXIMO_BUSCA, "o limite do hub acompanha o da consulta própria");
  assert.deepEqual(normalizarBuscaHub("dados"), { q: "dados", avisos: [] });
  assert.deepEqual(normalizarBuscaHub("  dados  "), { q: "dados", avisos: [] });
  assert.deepEqual(normalizarBuscaHub(["dados"]), { q: "dados", avisos: [] });
  assert.deepEqual(normalizarBuscaHub(["dados", "algoritmos"]), { q: "dados", avisos: [AVISO_REPETIDO] });
  assert.deepEqual(normalizarBuscaHub([1, "dados", "x"]), { q: "dados", avisos: [AVISO_REPETIDO] }, "primeiro elemento que seja string");
  assert.deepEqual(normalizarBuscaHub(["", "dados"]), { q: "", avisos: [AVISO_REPETIDO] });
  const inesperados = [undefined, null, [], [1, 2], [null], {}, { q: "dados" }, 42, true, Symbol("x"), () => "dados", ["  "], "", "   ", "\u0001\u0002"];
  for (const valor of inesperados) {
    let r;
    assert.doesNotThrow(() => { r = normalizarBuscaHub(valor); }, String(typeof valor));
    assert.equal(r.q, "", `formato inesperado vira busca vazia: ${typeof valor}`);
    assert.ok(Array.isArray(r.avisos));
  }
});

test("normalizarBuscaHub: substitui caracteres de controle por espaço e limita a 120 caracteres com aviso", () => {
  assert.equal(normalizarBuscaHub("da\u0000dos\u001f\u007f").q, "da dos");
  assert.equal(normalizarBuscaHub("\u0007dados\u0008").q, "dados");
  const exato = "a".repeat(120);
  assert.deepEqual(normalizarBuscaHub(exato), { q: exato, avisos: [] });
  const longo = normalizarBuscaHub("a".repeat(121));
  assert.equal(longo.q.length, 120);
  assert.deepEqual(longo.avisos, [AVISO_LIMITE]);
  const enorme = normalizarBuscaHub("b".repeat(5000));
  assert.equal(enorme.q.length, 120);
  assert.deepEqual(enorme.avisos, [AVISO_LIMITE]);
  const ambos = normalizarBuscaHub(["c".repeat(300), "x"]);
  assert.equal(ambos.q.length, 120);
  assert.deepEqual(ambos.avisos, [AVISO_REPETIDO, AVISO_LIMITE]);
  // Determinística: mesma entrada, mesma saída.
  assert.deepEqual(normalizarBuscaHub(["dados", "x"]), normalizarBuscaHub(["dados", "x"]));
});

test("lerBuscaHub: só a propriedade própria `q` conta (q[], __proto__, constructor e herdadas nunca viram busca)", () => {
  assert.equal(lerBuscaHub({ q: "dados" }).q, "dados");
  assert.deepEqual(lerBuscaHub({ q: ["dados", "algoritmos"] }), { q: "dados", avisos: [AVISO_REPETIDO] });
  const herdado = Object.create({ q: "dados" });
  for (const parametros of [undefined, null, "dados", 42, [], {}, { "q[]": "dados" }, herdado, { constructor: "dados" }, JSON.parse('{"__proto__":"dados"}'), { Q: "dados" }]) {
    assert.doesNotThrow(() => lerBuscaHub(parametros));
    assert.equal(lerBuscaHub(parametros).q, "", JSON.stringify(parametros));
  }
});

test("/bncc?q=dados&q=algoritmos: 200, usa só 'dados', campo preenchido, aviso visível e nenhum error boundary", async () => {
  const repetido = await render("/bncc?q=dados&q=algoritmos");
  const simples = await render("/bncc?q=dados");
  assert.equal(repetido.status, 200);
  assert.ok(!repetido.html.includes("Não foi possível carregar a consulta da BNCC"));
  assert.equal(valorDoCampo(repetido.html), "dados");
  assert.ok(textoDe(repetido.html).includes(AVISO_REPETIDO));
  assert.match(principal(repetido.html), /<div class="bncc-avisos" role="status" aria-label="Avisos sobre a busca">/);
  // Curricular e Computação usam o mesmo valor normalizado: resultados idênticos aos de ?q=dados (e não aos de 'algoritmos').
  assert.equal(cartoesCurriculares(repetido.html), cartoesCurriculares(simples.html));
  assert.ok(cartoesCurriculares(repetido.html) > 0);
  assert.deepEqual(codigosComp(repetido.html), codigosComp(simples.html));
  assert.deepEqual(codigosComp(repetido.html), esperados("dados").slice(0, PREVIA).map((h) => h.codigo));
  assert.match(secaoComp(repetido.html), /45 resultados/);
  assert.ok(secaoComp(repetido.html).includes("/bncc/computacao?q=dados#resultados"));
  assert.ok(!principal(repetido.html).includes("q=algoritmos"));
  assert.ok(!textoDe(simples.html).includes(AVISO_REPETIDO), "sem repetição não há aviso");
  assert.ok(!principal(simples.html).includes("bncc-avisos"));
});

test("busca longa em /bncc: 200, truncada em 120, aviso visível e campo com o valor efetivamente usado", async () => {
  const { status, html } = await render("/bncc?q=" + "a".repeat(2000));
  assert.equal(status, 200);
  assert.equal(valorDoCampo(html), "a".repeat(120));
  assert.ok(textoDe(html).includes(AVISO_LIMITE));
  assert.ok(!html.includes("Não foi possível carregar a consulta da BNCC"));
  assert.ok(!principal(html).includes("a".repeat(121)), "o texto bruto de 2.000 caracteres não vai para o HTML");
  const longoERepetido = await render("/bncc?q=" + "b".repeat(300) + "&q=dados");
  assert.equal(longoERepetido.status, 200);
  assert.equal(valorDoCampo(longoERepetido.html).length, 120);
  assert.ok(textoDe(longoERepetido.html).includes(AVISO_REPETIDO) && textoDe(longoERepetido.html).includes(AVISO_LIMITE));
});

test("caracteres de controle, q[], __proto__ e valores só-espaços: 200, sem busca e sem Computação", async () => {
  const controle = await render("/bncc?q=da%00dos%1F");
  assert.equal(controle.status, 200);
  assert.equal(valorDoCampo(controle.html), "da dos");
  for (const caminho of ["/bncc?q%5B%5D=dados", "/bncc?__proto__=dados", "/bncc?constructor=dados", "/bncc?q=%20%20", "/bncc?q="]) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, caminho);
    assert.equal(valorDoCampo(html), "", caminho);
    assert.equal(secaoComp(html), "", caminho);
    assert.equal(secaoCurricular(html), "", caminho);
    assert.ok(!principal(html).includes("bncc-avisos"), caminho);
  }
  // `q` vazio repetido: só o aviso, ainda sem resultados.
  const vazioRepetido = await render("/bncc?q=&q=dados");
  assert.equal(vazioRepetido.status, 200);
  assert.ok(textoDe(vazioRepetido.html).includes(AVISO_REPETIDO));
  assert.equal(secaoComp(vazioRepetido.html), "");
});

test("HTML escapado: a busca digitada vai escapada para o campo e nunca vira marcação", async () => {
  const { status, html } = await render("/bncc?q=" + encodeURIComponent('"><script>alert(1)</script>&x'));
  assert.equal(status, 200);
  const m = principal(html);
  assert.ok(!m.includes("<script>alert(1)"), "script injetado não pode aparecer sem escape");
  assert.ok(m.includes("&lt;script&gt;alert(1)&lt;/script&gt;"), "o valor aparece escapado");
  assert.equal(valorDoCampo(html), '"><script>alert(1)</script>&x');
});

test("ordem nova com busca ampla: resumo → avisos → Computação → seção curricular rotulada (nunca ao contrário)", async () => {
  for (const caminho of ["/bncc?q=dados", "/bncc?q=dados&q=algoritmos"]) {
    const { html } = await render(caminho);
    const m = principal(html);
    const iResumo = m.indexOf('<div class="bncc-results-summary"');
    const iAvisos = m.indexOf('<div class="bncc-avisos"');
    const iComp = m.indexOf('<section class="bncc-comp-secao"');
    const iCurricular = m.indexOf('<section class="bncc-curricular-secao"');
    assert.ok(iResumo > 0 && iComp > iResumo && iCurricular > iComp, `${caminho}: resumo < Computação < curricular`);
    if (caminho.includes("algoritmos")) assert.ok(iAvisos > iResumo && iAvisos < iComp, `${caminho}: avisos entre o resumo e a Computação`);
    else assert.equal(iAvisos, -1);
    // Computação imediatamente depois do resumo (e dos avisos): nenhum cartão curricular nem a seção curricular entre eles.
    const entre = m.slice(iResumo, iComp);
    assert.ok(!entre.includes("bncc-result-card") && !entre.includes("bncc-curricular-secao"), `${caminho}: conteúdo curricular entre o resumo e a Computação`);
    // A seção curricular é rotulada, separada e só tem registros curriculares.
    const curricular = secaoCurricular(html);
    assert.match(curricular, /<h2 id="bncc-curricular-titulo">Resultados na BNCC curricular<\/h2>/);
    assert.match(curricular, /aria-labelledby="bncc-curricular-titulo"/);
    assert.ok(curricular.includes('<article class="bncc-result-card">'));
    assert.ok(!curricular.includes("bncc-comp-card") && !curricular.includes("bncc-comp-secao"));
    for (const codigo of CODIGOS) assert.ok(!curricular.includes(`<code>${codigo}</code>`), `${codigo} dentro da seção curricular`);
    // E a Computação não carrega nenhum código curricular.
    const comp = secaoComp(html);
    assert.ok(codigosComp(html).length > 0 && codigosComp(html).every((c) => CODIGOS.includes(c)));
    assert.ok(!comp.includes("Resultados na BNCC curricular") && !comp.includes('<article class="bncc-result-card">'));
    assert.ok(!comp.includes("Ver registro"), "a Computação não usa o link de registro curricular");
  }
});

test("a contagem curricular não soma a Computação e o resumo mostra as duas contagens separadas", async () => {
  const { html } = await render("/bncc?q=dados");
  const m = principal(html);
  const total = Number(m.match(/<div class="bncc-results-summary"[^>]*><div><strong>(\d+)<\/strong>/)?.[1]);
  assert.equal(total, cartoesCurriculares(html), "o resumo conta só registros curriculares");
  assert.match(secaoCurricular(html), new RegExp(`<strong>${total} registros</strong>`));
  assert.match(m, /<a class="bncc-comp-salto" href="#bncc-computacao-resultados">45 resultados na BNCC Computação<\/a>/);
});

test("rotas dinâmicas e consulta própria seguem como antes das correções", async () => {
  assert.equal((await render("/bncc/ef01co01")).status, 404);
  assert.equal((await render("/bncc/ef05co11")).status, 404);
  assert.equal((await render("/bncc/ef05lp01")).status, 200);
  assert.equal((await render("/bncc/computacao")).status, 200);
});

// ---- 4c. hierarquia de títulos (h1 → h2 → h3) da busca em /bncc, com e sem resultado curricular -----------------------
const titulosDe = (html) => [...principal(html).matchAll(/<h([1-6])\b[^>]*>([^]*?)<\/h\1>/g)].map((m) => ({ nivel: Number(m[1]), texto: textoDe(m[2]) }));
const TITULO_CURRICULAR = "Resultados na BNCC curricular";

test("hierarquia de títulos sem resultado curricular: h1 único, 'Resultados na BNCC curricular' em h2 e 'Nenhum registro encontrado.' em h3 dentro da seção", async () => {
  for (const [caminho, comComputacao] of [["/bncc?q=EF01CO01", true], ["/bncc?q=zzzz-sem-resultado", false]]) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, caminho);
    const titulos = titulosDe(html);
    assert.equal(titulos.filter((t) => t.nivel === 1).length, 1, `${caminho}: um único h1`);
    assert.deepEqual(titulos.filter((t) => t.texto === TITULO_CURRICULAR), [{ nivel: 2, texto: TITULO_CURRICULAR }], `${caminho}: título curricular é h2`);
    assert.deepEqual(titulos.filter((t) => t.texto === "Nenhum registro encontrado."), [{ nivel: 3, texto: "Nenhum registro encontrado." }], `${caminho}: estado vazio é h3`);
    // A sequência de títulos é lógica: o h3 vem logo depois do h2 curricular e nenhum nível é pulado.
    const i = titulos.findIndex((t) => t.texto === TITULO_CURRICULAR);
    assert.equal(titulos[i + 1].texto, "Nenhum registro encontrado.", caminho);
    titulos.forEach((t, k) => k > 0 && assert.ok(t.nivel - titulos[k - 1].nivel <= 1, `${caminho}: salto de nível antes de "${t.texto}"`));
    assert.equal(titulos.filter((t) => t.texto === TITULO_COMP_H2).length, comComputacao ? 1 : 0, caminho);
    // O estado vazio fica DENTRO da seção curricular, sem segundo h2 (nem irmão nem interno) e preserva o aria-labelledby.
    const curricular = secaoCurricular(html);
    assert.match(curricular, /^<section class="bncc-curricular-secao" aria-labelledby="bncc-curricular-titulo">/);
    assert.equal([...curricular.matchAll(/<h2\b/g)].length, 1, `${caminho}: só o h2 da seção`);
    const vazio = curricular.match(/<div class="bncc-empty-state">[^]*?<\/div>/)?.[0] ?? "";
    assert.ok(vazio, `${caminho}: estado vazio dentro da seção curricular`);
    assert.ok(!/<h2\b/.test(vazio), `${caminho}: estado vazio sem h2`);
    assert.match(vazio, /<h3 class="bncc-empty-state-title">Nenhum registro encontrado\.<\/h3>/);
    assert.ok(textoDe(vazio).includes("Tente outro código ou termo de busca."));
    assert.ok(textoDe(vazio).includes("Limpar busca"));
  }
});

test("estado vazio curricular com Computação: ordem resumo → Computação → seção curricular (estado vazio dentro dela) e a frase 'logo acima' continua correta", async () => {
  const { html } = await render("/bncc?q=EF01CO01");
  const m = principal(html);
  const iResumo = m.indexOf('<div class="bncc-results-summary"');
  const iComp = m.indexOf('<section class="bncc-comp-secao"');
  const iCurricular = m.indexOf('<section class="bncc-curricular-secao"');
  const iVazio = m.indexOf('<div class="bncc-empty-state">');
  assert.ok(iResumo >= 0 && iComp > iResumo && iCurricular > iComp && iVazio > iCurricular, "resumo < Computação < curricular < estado vazio");
  assert.ok(textoDe(secaoCurricular(html)).includes("Há resultados na BNCC Computação, logo acima."));
  assert.ok(!textoDe(html).includes(["logo", "abaixo"].join(" ")), "a frase antiga não sobrou na página");
  assert.ok(!m.includes('<div class="bncc-avisos"'), "sem parâmetro repetido não há avisos");
  // Com aviso: resumo → avisos → Computação → seção curricular.
  const repetido = principal((await render("/bncc?q=EF01CO01&q=dados")).html);
  const r = ['<div class="bncc-results-summary"', '<div class="bncc-avisos"', '<section class="bncc-comp-secao"', '<section class="bncc-curricular-secao"'].map((x) => repetido.indexOf(x));
  assert.ok(r.every((x) => x >= 0) && r.every((x, k) => k === 0 || x > r[k - 1]), `ordem com aviso: ${r}`);
});

test("estados vazios dos outros exploradores da BNCC continuam com h2 e o seletor .bncc-empty-state h2 segue intacto no CSS", () => {
  for (const arquivo of ["BnccExplorer.tsx", "BnccExplorerInfantil.tsx", "BnccExplorerMedio.tsx"]) {
    const fonte = readFileSync(join(RAIZ, "app", "bncc", "components", arquivo), "utf-8");
    assert.match(fonte, /<div className="bncc-empty-state">\s*<[A-Za-z]+[^>]*\/>\s*<h2>/, `${arquivo}: o estado vazio segue com h2`);
  }
  const css = readFileSync(join(RAIZ, "app", "bncc", "bncc.css"), "utf-8");
  assert.ok(/\.bncc-empty-state h2,\s*\.bncc-error h1 \{/.test(css), "seletor original preservado");
  assert.equal([...css.matchAll(/bncc-empty-state-title/g)].length, 1, "classe nova declarada uma única vez, sem !important");
  const regra = css.match(/\.bncc-empty-state \.bncc-empty-state-title \{[^}]*\}/)?.[0] ?? "";
  assert.ok(regra && !regra.includes("!important"));
});

test("anti-regressão de texto: o próprio arquivo de testes não afirma mais a ordem antiga", () => {
  const fonte = readFileSync(fileURLToPath(import.meta.url), "utf-8");
  const trecho = (...partes) => partes.join("");
  assert.equal(fonte.split(trecho("curriculares ", "vêm antes")).length - 1, 0, "nome ou comentário afirmando a ordem antiga (curricular primeiro)");
  assert.equal(fonte.split(trecho("resultados ", "abaixo")).length - 1, 0, "comentário apontando a Computação para baixo da lista");
  assert.equal(fonte.split(trecho("logo ", "abaixo")).length - 1, 0, "texto apontando a Computação para baixo do estado vazio");
  assert.equal(fonte.split(trecho("remove caracteres ", "de controle")).length - 1, 0, "formulação incorreta: o código substitui por espaço, não remove");
});

// ---- 5. isolamento: sem duplicação nem mistura com os dados curriculares ------------------------------------------------
test("sem duplicação: nenhum código de Computação existe na BNCC curricular, o agregado antigo segue em 1.616 e data.ts não importa o catálogo", () => {
  const dir = join(RAIZ, "data", "bncc");
  const existentes = new Set();
  for (const nome of readdirSync(dir)) {
    if (!/\.json$/.test(nome) || /report|^computacao-/.test(nome)) continue;
    for (const r of JSON.parse(readFileSync(join(dir, nome), "utf-8")).registros ?? []) if (r.codigo) existentes.add(r.codigo);
  }
  for (const codigo of CODIGOS) assert.ok(!existentes.has(codigo), `${codigo} duplicado na BNCC curricular`);
  assert.equal(JSON.parse(readFileSync(join(dir, "import-report.json"), "utf-8")).total_geral, 1616);
  const dataTs = readFileSync(join(RAIZ, "lib", "bncc", "data.ts"), "utf-8");
  assert.doesNotMatch(dataTs, /computacao/i);
  const importados = [...dataTs.matchAll(/from "@\/data\/bncc\/([^"]+)\.json"/g)].map((m) => m[1]);
  assert.ok(importados.length >= 20);
  assert.ok(importados.every((n) => !n.startsWith("computacao-")));
  assert.doesNotMatch(readFileSync(join(RAIZ, "lib", "bncc", "search.mjs"), "utf-8"), /computacao/i);
  assert.doesNotMatch(readFileSync(join(dir, "import-report.json"), "utf-8"), /computacao/i);
});

test("a integração só usa a biblioteca própria: sem fetch/XHR, sem componente cliente, sem ler data/bncc e sem texto novo copiado", () => {
  const componente = readFileSync(join(RAIZ, "app", "bncc", "components", "ComputacaoDescoberta.tsx"), "utf-8");
  const pagina = readFileSync(join(RAIZ, "app", "(bncc-hub)", "bncc", "page.tsx"), "utf-8");
  for (const [nome, fonte] of [["componente", componente], ["página", pagina]]) {
    assert.doesNotMatch(fonte, /\bfetch\s*\(|XMLHttpRequest|useEffect|\bdata\/bncc\b|computacao-(educacao|anos|ensino)/, nome);
    assert.doesNotMatch(fonte, /^["']use client["']/m, nome);
  }
  assert.match(pagina, /@\/lib\/bncc\/computacao-consulta/);
  assert.doesNotMatch(pagina, /getAllRegistros\(\)\s*,\s*\.\.\./);
  assert.ok(!existsSync(join(RAIZ, "app", "bncc", "[codigo]", "computacao")));
  assert.ok(!readdirSync(join(RAIZ, "public", "data")).some((n) => /bncc|computa/i.test(n)));
});

// ---- 6. rotas, sitemap, Header e Footer -------------------------------------------------------------------------------
test("rotas dinâmicas da BNCC curricular preservadas: /bncc/ef01co01 segue 404 e /bncc/ef05lp01 segue 200; /bncc/computacao continua própria", async () => {
  assert.equal((await render("/bncc/ef01co01")).status, 404);
  assert.equal((await render("/bncc/ef05lp01")).status, 200);
  assert.equal((await render("/bncc/computacao")).status, 200);
  assert.equal((await render("/bncc/ef05co11")).status, 404, "nenhuma página por código de Computação foi criada");
  assert.equal((await render("/bncc/competencias-gerais")).status, 200);
});

test("sitemap: 1.686 URLs, /bncc/computacao exatamente uma vez e nenhuma query string nem paginação", async () => {
  const { status, html } = await render("/sitemap.xml");
  assert.equal(status, 200);
  const locs = [...html.matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => decodificar(m[1]));
  assert.equal(locs.length, 1686);
  assert.equal(locs.filter((u) => u === "https://tempodocente.com.br/bncc/computacao").length, 1);
  assert.ok(locs.every((u) => !u.includes("?") && !u.includes("pagina=")));
  assert.equal(new Set(locs).size, locs.length);
});

test("Header: o submenu BNCC continua com 5 itens e 'BNCC Computação' em quinto (nenhuma regressão)", async () => {
  const { html } = await render("/bncc");
  const header = html.match(/<header[^]*?<\/header>/)?.[0] ?? "";
  const menu = [...header.matchAll(/href="(\/bncc\/[a-z-]+)"[^>]*>([^<]+)</g)].map((m) => [m[1], m[2]]);
  const unicos = [...new Map(menu.map((m) => [m[0], m[1]])).entries()];
  assert.deepEqual(unicos.slice(0, 5), [
    ["/bncc/educacao-infantil", "Educação Infantil"],
    ["/bncc/ensino-fundamental", "Ensino Fundamental"],
    ["/bncc/ensino-medio", "Ensino Médio"],
    ["/bncc/competencias-gerais", "Competências Gerais"],
    ["/bncc/computacao", "BNCC Computação"],
  ]);
  assert.equal((header.match(/href="\/bncc\/computacao"/g) ?? []).length, 2, "uma vez no menu desktop e uma no móvel, como antes");
});

test("Footer: ganhou 'BNCC Computação' junto dos demais acessos BNCC, sem perder nem reordenar nenhum link anterior", async () => {
  const esperado = ["/", "/bncc", "/bncc/educacao-infantil", "/bncc/ensino-fundamental", "/bncc/ensino-medio", "/bncc/competencias-gerais", "/bncc/computacao", "/saresp", "/saeb", "/sobre", "/privacidade", "mailto:tempodocente@gmail.com"];
  for (const caminho of ["/", "/bncc", "/bncc/computacao", "/saeb"]) {
    const rodape = (await render(caminho)).html.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
    const links = [...(rodape.match(/<nav aria-label="Navegação do rodapé">[^]*?<\/nav>/)?.[0] ?? "").matchAll(/href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(links, esperado, caminho);
    assert.match(rodape, /href="\/bncc\/computacao">BNCC Computação<\/a>/, caminho);
  }
});

test("homepage, SAEB e SARESP: continuam 200 e sem conteúdo de Computação (a homepage não foi alterada)", async () => {
  for (const caminho of ["/", "/saeb", "/saeb/matriz", "/saresp"]) {
    const { status, html } = await render(caminho);
    assert.equal(status, 200, caminho);
    assert.doesNotMatch(principal(html), /EF01CO01|bncc-comp-|access-card-complemento/, caminho);
  }
  assert.doesNotMatch(principal((await render("/")).html), /Computa(ç|c)ão/);
  for (const arquivo of [join("app", "page.tsx"), join("app", "components", "Hero.tsx"), join("app", "components", "QuickAccess.tsx"), join("app", "components", "EducationSearch.tsx")]) {
    assert.doesNotMatch(readFileSync(join(RAIZ, arquivo), "utf-8"), /computa(ç|c)ao/i, arquivo);
  }
});

// ---- 7. textos curriculares intocados ---------------------------------------------------------------------------------
// SHA-256 aprovados (Rodada 36/37, em produção): qualquer mudança nas quatro fontes oficiais ou nos quatro catálogos
// pela integração de descoberta é bloqueadora e precisa de nova aprovação explícita.
const HASHES_APROVADOS = {
  "source/official-mec-bncc-computacao-educacao-infantil.json": "b7684dce7ebbfb183ea0b1a280bb4d380fe5714ae94b2c39110e4a3f324902ec",
  "source/official-mec-bncc-computacao-anos-iniciais.json": "bb444a9d17036491a0991b8dcf834fb806ea783bb943b47c641941ca30dfde05",
  "source/official-mec-bncc-computacao-anos-finais.json": "29c7bdd6f2577f336698e525564aade6e9b75727e4ad487b69a4cc3b15f4f527",
  "source/official-mec-bncc-computacao-ensino-medio.json": "25d8ff3cdde2b6ff4a6938bd3f19f1aa4a113fb809d9c8cac4652f4d2e1b363c",
  "computacao-educacao-infantil.json": "703df0f826f1eb6fa570ac4fdcf3eab7f12b8c45c9adbb1eb5b36b09a87f9b9b",
  "computacao-anos-iniciais.json": "601e534d1c31c141c704c762bf7ca8bfac0209f77eda3899965b12f53bacea5c",
  "computacao-anos-finais.json": "4d47d9403320f7944c2a043aac5e4ea0d76dec6eaa99392fb8eb9900cea5dea0",
  "computacao-ensino-medio.json": "326ff7268fcbf80c76b85e8635be9dd5448abad6795820112abc06c3f15b9b30",
};

test("textos curriculares intocados: as quatro fontes oficiais e os quatro catálogos mantêm os hashes aprovados e as contagens (141 / 130 / 160)", () => {
  for (const [arquivo, esperado] of Object.entries(HASHES_APROVADOS)) {
    const bytes = readFileSync(join(RAIZ, "data", "bncc", arquivo));
    // Fim de linha normalizado (checkout com autocrlf no Windows não é mudança de conteúdo).
    const sha = createHash("sha256").update(Buffer.from(bytes.toString("latin1").replaceAll("\r\n", "\n"), "latin1")).digest("hex");
    assert.equal(sha, esperado, `${arquivo} mudou`);
  }
  for (const escopo of ESCOPOS) assert.equal((catalogos[escopo].metadados ?? catalogos[escopo].metadata).publicado_na_interface, true);
  assert.equal(habilidades.length, 141);
  assert.equal(habilidades.filter((h) => h.explicacao).length, 130);
  assert.equal(habilidades.reduce((n, h) => n + h.exemplos.length, 0), 160);
  assert.equal(habilidades.find((h) => h.codigo === "EF05CO11").texto, "Identificar a adequação de diferentes tecnologias computacionais na resolução de problemas.");
});
