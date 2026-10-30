// Testes da interface pública /bncc/computacao ("BNCC Computação"). A rota é renderizada pelo worker
// já construído (dist/server/index.js), como em tests/saeb-matriz-page.test.mjs e tests/navigation.test.mjs,
// e as expectativas são derivadas DIRETAMENTE dos JSONs do catálogo — nunca da biblioteca que está sendo
// testada. Nenhum teste aqui escreve em arquivo versionado.
import assert from "node:assert/strict";
import { existsSync, readFileSync, readdirSync, statSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

import * as Consulta from "../lib/bncc/computacao-consulta.ts";

const RAIZ = fileURLToPath(new URL("..", import.meta.url));
const ESCOPOS = ["educacao-infantil", "anos-iniciais", "anos-finais", "ensino-medio"];
const CANONICAL = "https://tempodocente.com.br/bncc/computacao";
const TITULO_OFICIAL = "Computação na Educação Básica — Complemento à BNCC";

const catalogos = Object.fromEntries(ESCOPOS.map((e) => [e, JSON.parse(readFileSync(join(RAIZ, "data", "bncc", `computacao-${e}.json`), "utf-8"))]));
const habilidades = ESCOPOS.flatMap((e) => catalogos[e].registros.filter((r) => r.codigo).map((r) => ({ ...r, escopo: e })));
const porEscopo = (e) => habilidades.filter((h) => h.escopo === e);
const CODIGOS = new Set(habilidades.map((h) => h.codigo));
const norm = (s) => String(s).normalize("NFD").replace(/[\u0300-\u036f]/g, "").toLocaleLowerCase("pt-BR").replace(/\s+/g, " ").trim();

// ---- infraestrutura de renderização -----------------------------------------------------------------
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
    // O React separa nós de texto adjacentes com <!-- -->; removê-los não muda o texto visível.
    const html = (await response.text()).replace(/<!-- -->/g, "");
    cache.set(path, { status: response.status, type: response.headers.get("content-type") ?? "", html });
  }
  return cache.get(path);
}

function decodificar(s) {
  return s
    .replace(/&#x([0-9a-f]+);/gi, (_, h) => String.fromCodePoint(parseInt(h, 16)))
    .replace(/&#(\d+);/g, (_, d) => String.fromCodePoint(Number(d)))
    .replace(/&quot;/g, '"')
    .replace(/&lt;/g, "<")
    .replace(/&gt;/g, ">")
    .replace(/&amp;/g, "&");
}
const principal = (html) => html.match(/<main[^>]*id="main-content"[^>]*>[^]*?<\/main>/)?.[0] ?? "";
const resultadosDe = (html) => principal(html).split('id="resultados"')[1] ?? "";
const codigosRenderizados = (html) => [...resultadosDe(html).matchAll(/<code class="comp-codigo">([A-Z0-9]+)<\/code>/g)].map((m) => m[1]);
const textoDe = (html) =>
  decodificar(principal(html).replace(/<script[^]*?<\/script>/g, " ").replace(/<[^>]+>/g, " ")).replace(/\s+/g, " ").trim();
const contagemDe = (html) => {
  const m = resultadosDe(html).match(/<strong>(\d+)<\/strong> (resultados?)/);
  return m ? Number(m[1]) : null;
};
const ocorrencias = (texto, trecho) => texto.split(trecho).length - 1;
const totalDePaginas = (html) => Number(resultadosDe(html).match(/\(página 1 de (\d+)\)/)?.[1] ?? 1);

/** Renderiza TODAS as páginas de uma consulta (a página, de 24 em 24, é o recorte server-side). */
async function renderTodasAsPaginas(caminho) {
  const primeira = await render(caminho);
  const total = totalDePaginas(primeira.html);
  const paginas = [primeira];
  for (let n = 2; n <= total; n++) paginas.push(await render(`${caminho}${caminho.includes("?") ? "&" : "?"}pagina=${n}`));
  return paginas;
}
const todosOsCodigos = async (caminho) => (await renderTodasAsPaginas(caminho)).flatMap((p) => codigosRenderizados(p.html));

// ---- catálogo: contagens ---------------------------------------------------------------------------------
test("catálogo: 141 habilidades/objetivos = 11 (Educação Infantil) + 50 (Anos Iniciais) + 54 (Anos Finais) + 26 (Ensino Médio)", () => {
  assert.equal(habilidades.length, 141);
  assert.deepEqual(ESCOPOS.map((e) => porEscopo(e).length), [11, 50, 54, 26]);
  assert.deepEqual(Consulta.contarPorEtapa().map((e) => e.total), [11, 50, 54, 26]);
  assert.equal(CODIGOS.size, 141);
});

// ---- rota e metadados -------------------------------------------------------------------------------------
const base = await render("/bncc/computacao");
const paginasTodas = await renderTodasAsPaginas("/bncc/computacao?etapa=todas");
const pagina1 = paginasTodas[0];
// "todas" = os resultados das 6 páginas juntos (para auditar os 141 itens); a página 1 isolada é `pagina1`.
const todas = {
  status: pagina1.status,
  type: pagina1.type,
  html: `<main class="bncc-main" id="main-content"><div class="comp-resultados" id="resultados">${paginasTodas.map((p) => resultadosDe(p.html).replace(/<\/main>$/, "")).join("")}</div></main>`,
};

test("/bncc/computacao responde 200 em HTML, com o título oficial do documento no h1 e 'BNCC Computação' como nome curto", () => {
  assert.equal(base.status, 200);
  assert.match(base.type, /^text\/html\b/i);
  assert.ok(principal(base.html).includes(`<h1>${TITULO_OFICIAL}</h1>`));
  assert.match(principal(base.html), /<span aria-current="page">BNCC Computação<\/span>/);
});

test("o conteúdo está no HTML inicial (dentro de <main>), não num segmento oculto que só o JavaScript revela", () => {
  assert.doesNotMatch(base.html, /<div hidden id="S:\d+"/);
  for (const p of paginasTodas) assert.doesNotMatch(p.html, /<div hidden id="S:\d+"/);
  assert.doesNotMatch(principal(base.html), /bncc-loading/);
  assert.ok(principal(base.html).includes('<form class="comp-form"'));
  assert.ok(principal(pagina1.html).includes('id="resultados"'));
});

test("metadados: title, description, Open Graph e Twitter próprios; canonical único e igual a https://tempodocente.com.br/bncc/computacao", () => {
  assert.match(base.html, /<title>BNCC Computação: habilidades e objetivos oficiais \| Tempo Docente<\/title>/);
  const canonicals = [...base.html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonicals.length, 1);
  assert.equal(canonicals[0][1], CANONICAL);
  const description = base.html.match(/<meta name="description" content="([^"]+)"/)?.[1] ?? "";
  assert.match(description, /Computação na Educação Básica/);
  assert.match(description, /explicações e exemplos do documento oficial/);
  assert.match(base.html, /<meta property="og:title" content="BNCC Computação: habilidades e objetivos oficiais \| Tempo Docente"/);
  assert.match(base.html, /<meta property="og:url" content="https:\/\/tempodocente\.com\.br\/bncc\/computacao"/);
  assert.match(base.html, /<meta name="twitter:card"/);
  assert.match(base.html, /<meta name="twitter:title" content="BNCC Computação/);
});

test("o canonical continua sendo a rota base (único) mesmo com filtros e busca na URL", async () => {
  for (const path of ["/bncc/computacao?etapa=anos-iniciais&ano=3", "/bncc/computacao?q=algoritmo", "/bncc/computacao?etapa=zzz&q=a&q=b"]) {
    const { html } = await render(path);
    const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]);
    assert.deepEqual(canonicals, [CANONICAL], path);
  }
});

// ---- sitemap e navegação ------------------------------------------------------------------------------------
test("sitemap: /bncc/computacao aparece exatamente uma vez, sem query string", async () => {
  const response = await worker.fetch(
    new Request("http://localhost/sitemap.xml", { headers: { accept: "application/xml" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
  const locs = [...(await response.text()).matchAll(/<loc>([^<]+)<\/loc>/g)].map((m) => m[1]);
  assert.equal(locs.filter((l) => l === CANONICAL).length, 1);
  assert.equal(locs.filter((l) => /computa/i.test(l)).length, 1, "nenhuma outra URL de Computação (nem por código)");
  assert.ok(!locs.some((l) => l.includes("?")));
});

test("submenu BNCC: os 4 destinos anteriores continuam, na mesma ordem, e 'BNCC Computação' é o quinto — no dropdown de desktop e no accordion mobile", async () => {
  const esperados = [
    ["/bncc/educacao-infantil", "Educação Infantil"],
    ["/bncc/ensino-fundamental", "Ensino Fundamental"],
    ["/bncc/ensino-medio", "Ensino Médio"],
    ["/bncc/competencias-gerais", "Competências Gerais"],
    ["/bncc/computacao", "BNCC Computação"],
  ];
  for (const path of ["/", "/bncc/computacao", "/saeb"]) {
    const { html } = await render(path);
    const header = html.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
    for (const [nome, bloco] of [
      ["desktop", header.match(/<div class="nav-dropdown"[^>]*>[^]*?<\/div>/)?.[0] ?? ""],
      ["mobile", header.match(/<div class="mobile-accordion-panel"[^>]*>[^]*?<\/div>/)?.[0] ?? ""],
    ]) {
      const links = [...bloco.matchAll(/<a href="([^"]+)"[^>]*>([^<]+)<\/a>/g)].map((m) => [m[1], m[2].trim()]);
      assert.deepEqual(links, esperados, `${path} (${nome})`);
    }
  }
});

test("na própria página, o item do submenu é o 'atual' (aria-current=page) e o link BNCC só carrega a classe de seção ativa", () => {
  const header = base.html.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
  assert.match(header, /<a href="\/bncc\/computacao" aria-current="page"[^>]*>BNCC Computação<\/a>/);
  assert.match(header, /<a href="\/bncc" class="is-section-active">BNCC<\/a>/);
  assert.equal((header.match(/aria-current="page"/g) ?? []).length, 2, "um no submenu desktop e um no accordion mobile");
});

test("menu mobile: o item novo usa o mesmo mapa do dropdown e fecha o menu ao navegar (closeMobile), sem alterar Escape nem foco", () => {
  const fonte = readFileSync(join(RAIZ, "app", "components", "Header.tsx"), "utf-8");
  assert.equal((fonte.match(/\["BNCC Computação", "\/bncc\/computacao"\]/g) ?? []).length, 1);
  assert.equal((fonte.match(/BNCC_SUBMENU\.map/g) ?? []).length, 2, "desktop e mobile percorrem a mesma lista");
  const mobile = fonte.match(/id=\{mobileBnccPanelId\}[^]*?<\/div>/)?.[0] ?? "";
  assert.match(mobile, /onClick=\{\(\) => closeMobile\(false\)\}/);
  assert.match(fonte, /if \(event\.key !== "Escape"\) return;[^]*?closeMobile\(true\)/);
});

// ---- textos públicos ----------------------------------------------------------------------------------------
test("texto público: explica o que é o documento, sem apresentá-lo como Currículo Paulista, matriz do SAEB ou associação com avaliações externas", () => {
  const texto = textoDe(base.html);
  for (const trecho of [
    "complemento nacional à BNCC",
    "Educação Infantil, o Ensino Fundamental e o Ensino Médio",
    "objetivos de aprendizagem e desenvolvimento (Educação Infantil) ou habilidades (Ensino Fundamental e Médio)",
    "transcritos do documento oficial e conferidos com ele página a página",
    "Não é a matriz do SAEB",
    "não representa associação automática com avaliações externas",
  ]) {
    assert.ok(texto.includes(trecho), trecho);
  }
  // "Educação digital e midiática" nunca aparece como se fosse o título do documento.
  assert.doesNotMatch(texto, /educa(ç|c)ão digital e midi/i);
});

test("ausência de Currículo Paulista: a única menção é a negação explícita; nenhuma SEDUC-SP, nem dado ou módulo de terceiros", () => {
  for (const { html } of [base, pagina1]) {
    const texto = textoDe(html);
    assert.equal(ocorrencias(texto, "Currículo Paulista"), 1);
    assert.ok(texto.includes("Não é o Currículo Paulista nem o currículo de qualquer rede de ensino"));
    assert.doesNotMatch(texto, /SEDUC|Secretaria (da|de) Educa/i);
  }
  const dirs = [join(RAIZ, "app", "(bncc-computacao)"), join(RAIZ, "lib", "bncc", "computacao-consulta.ts")];
  const fontes = dirs.flatMap((d) => (statSync(d).isDirectory() ? arquivosDe(d) : [d])).filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(fontes.length >= 4);
  const mencoes = fontes.flatMap((f) => [...readFileSync(f, "utf-8").matchAll(/Curr[ií]culo Paulista|SEDUC/gi)].map(() => f));
  assert.equal(mencoes.length, 1, "só a frase de negação na página");
});

function arquivosDe(dir) {
  return readdirSync(dir, { withFileTypes: true }).flatMap((e) => (e.isDirectory() ? arquivosDe(join(dir, e.name)) : [join(dir, e.name)]));
}

// ---- listagem completa, códigos e campos exibidos ---------------------------------------------------------------
test("etapa=todas, somadas as 6 páginas, lista exatamente os 141 códigos oficiais do catálogo, uma vez cada, e nenhum código inventado", () => {
  const codigos = codigosRenderizados(todas.html);
  assert.equal(codigos.length, 141);
  assert.deepEqual([...codigos].sort(), [...CODIGOS].sort());
  assert.equal(contagemDe(todas.html), 141);
  const padroes = new Set(habilidades.map((h) => h.codigo.replace(/\d+$/, "")));
  assert.equal(padroes.size, 13);
  // Qualquer coisa com o formato de um código de Computação na página inteira é oficial — a única exceção
  // é o literal impresso de EF05CO11, que só aparece dentro da nota.
  const texto = textoDe(todas.html);
  const encontrados = new Set(texto.match(/\b(?:EI03|EF\d\dCO|EM13)CO?\d{2,3}\b/g) ?? []);
  for (const c of [...texto.matchAll(/\b[A-Z]{2}\d{2}CO\d{2,3}\b/g)].map((m) => m[0])) {
    assert.ok(CODIGOS.has(c) || c === "EF05CO011", `código inesperado: ${c}`);
  }
  assert.ok(encontrados.size > 0);
});

test("EF05CO11: o código exibido é EF05CO11; EF05CO011 só aparece, uma vez, na nota discreta sobre o literal impresso", () => {
  const texto = textoDe(todas.html);
  assert.equal(ocorrencias(texto, "EF05CO011"), 1);
  assert.ok(texto.includes("no documento oficial este código aparece impresso como “EF05CO011” (com um dígito a mais)"));
  assert.ok(!codigosRenderizados(todas.html).includes("EF05CO011"));
  assert.equal(codigosRenderizados(todas.html).filter((c) => c === "EF05CO11").length, 1);
});

test("cada item mostra código, texto integral, etapa/ano, eixo e objeto de conhecimento — e nenhum campo interno", () => {
  const html = todas.html;
  const texto = decodificar(principal(html));
  for (const h of habilidades) assert.ok(texto.includes(h.texto), `texto de ${h.codigo}`);
  const contexto = (h) => ({ "educacao-infantil": "Educação Infantil", "anos-iniciais": "Ensino Fundamental · Anos Iniciais", "anos-finais": "Ensino Fundamental · Anos Finais", "ensino-medio": "Ensino Médio" })[h.escopo];
  for (const h of habilidades) {
    const bloco = texto.split(`<code class="comp-codigo">${h.codigo}</code>`)[1]?.split('<li class="comp-item"')[0] ?? "";
    assert.ok(bloco.includes(contexto(h)), `etapa de ${h.codigo}`);
    if (h.ano) assert.ok(bloco.includes(`· ${h.ano}</span>`), `ano de ${h.codigo}`);
    if (h.bloco_anos) assert.ok(bloco.includes(`· ${h.bloco_anos}</span>`), `bloco de ${h.codigo}`);
    if (h.eixo) assert.ok(bloco.includes(`<dt>Eixo</dt><dd>${h.eixo}</dd>`), `eixo de ${h.codigo}`);
    else assert.ok(!bloco.includes("<dt>Eixo</dt>"), `${h.codigo} não tem eixo`);
    if (h.objeto_conhecimento) assert.ok(bloco.includes("<dt>Objeto de conhecimento</dt>") && bloco.includes(h.objeto_conhecimento), `objeto de ${h.codigo}`);
    else assert.ok(!bloco.includes("<dt>Objeto de conhecimento</dt>"), `${h.codigo} não tem objeto`);
    if (h.competencia_especifica) assert.ok(bloco.includes(`<dt>Competência específica</dt><dd>${h.competencia_especifica}</dd>`), `competência de ${h.codigo}`);
  }
  // Campos internos nunca aparecem no HTML inteiro.
  assert.doesNotMatch(todas.html, /id_interno|computacao\.(ei|ef\d|em)|documento_sha256|pagina_fonte|pagina_impressa|quadro_fonte|publicado_na_interface|nota_de_interface|enunciado_agrupador/);
  assert.doesNotMatch(principal(todas.html), /\b[0-9a-f]{64}\b/);
});

test("Educação Infantil não tem explicação, objeto nem ano: só exemplos; o rótulo muda e nenhum bloco fica vazio", () => {
  const ei = porEscopo("educacao-infantil");
  assert.equal(ei.length, 11);
  assert.ok(ei.every((h) => h.explicacao === null && h.exemplos.length > 0 && h.eixo && !h.objeto_conhecimento && !h.ano));
  const secoes = principal(todas.html).split('<li class="comp-item"').slice(1);
  assert.equal(secoes.length, 141);
  for (const secao of secoes) {
    const codigo = secao.match(/<code class="comp-codigo">([A-Z0-9]+)<\/code>/)[1];
    const h = habilidades.find((x) => x.codigo === codigo);
    const rotulo = secao.match(/<summary>([^<]+)<\/summary>/)?.[1];
    if (h.explicacao && h.exemplos.length) assert.equal(rotulo, "Explicação e exemplo do documento oficial", codigo);
    else if (h.exemplos.length) assert.equal(rotulo, "Exemplo do documento oficial", codigo);
    else if (h.explicacao) assert.equal(rotulo, "Explicação do documento oficial", codigo);
    else assert.equal(rotulo, undefined, codigo);
    assert.equal(secao.includes("<h4>Explicação</h4>"), Boolean(h.explicacao), `bloco Explicação de ${codigo}`);
    assert.equal(/<h4>Exemplos?<\/h4>/.test(secao), h.exemplos.length > 0, `bloco Exemplo de ${codigo}`);
  }
  assert.equal(ocorrencias(principal(todas.html), "Exemplo do documento oficial"), 11);
  assert.equal(ocorrencias(principal(todas.html), "Explicação e exemplo do documento oficial"), 130);
  assert.equal((principal(todas.html).match(/<details class="comp-apoio"/g) ?? []).length, 141);
});

test("explicações e exemplos oficiais aparecem integralmente, sem reescrita, dentro de <details>", () => {
  const texto = decodificar(principal(todas.html));
  for (const h of habilidades) {
    if (h.explicacao) assert.ok(texto.includes(h.explicacao), `explicação de ${h.codigo}`);
    for (const exemplo of h.exemplos) assert.ok(texto.includes(exemplo), `exemplo de ${h.codigo}`);
  }
});

test("divergências do documento oficial preservadas: EF05CO06/07 (conteúdo possivelmente trocado), EF69CO01 (explicação = exemplo), EF06CO01 (sem ponto final), EM13CO05 (relação)", () => {
  const texto = textoDe(todas.html);
  const por = (c) => habilidades.find((h) => h.codigo === c);
  for (const c of ["EF05CO06", "EF05CO07", "EF69CO01"]) {
    assert.ok(por(c).notas_documentais.length > 0);
    for (const nota of por(c).notas_documentais) assert.ok(texto.includes(`Nota sobre o documento oficial: ${nota}`), c);
  }
  // Mantida a associação posicional impressa: nada foi trocado entre as duas habilidades.
  const bloco06 = decodificar(principal(todas.html)).split('<code class="comp-codigo">EF05CO06</code>')[1].split('<li class="comp-item"')[0];
  assert.ok(bloco06.includes(por("EF05CO06").explicacao) && !bloco06.includes(por("EF05CO07").explicacao));
  const ef69 = por("EF69CO01");
  assert.equal(ef69.explicacao, ef69.exemplos.join(" "));
  const bloco69 = decodificar(principal(todas.html)).split('<code class="comp-codigo">EF69CO01</code>')[1].split('<li class="comp-item"')[0];
  assert.equal(ocorrencias(bloco69, ef69.explicacao), 2, "explicação e exemplo idênticos aparecem os dois, como impressos");
  assert.ok(!por("EF06CO01").texto.endsWith("."));
  assert.ok(decodificar(principal(todas.html)).includes(`${por("EF06CO01").texto}</p>`), "sem ponto final inventado");
  const bloco05 = principal(todas.html).split('<code class="comp-codigo">EM13CO05</code>')[1].split('<li class="comp-item"')[0];
  assert.match(bloco05, /<a href="\/bncc\/em13mat315">EM13MAT315<\/a>/);
  assert.match(bloco05, /não uma equivalência/);
});

// ---- filtros ---------------------------------------------------------------------------------------------------
test("filtro por etapa: 11 / 50 / 54 / 26, só com os códigos da etapa, e a seleção atual identificada", async () => {
  const esperado = { "educacao-infantil": ["Educação Infantil", 11], "anos-iniciais": ["Anos Iniciais do Ensino Fundamental", 50], "anos-finais": ["Anos Finais do Ensino Fundamental", 54], "ensino-medio": ["Ensino Médio", 26] };
  for (const [escopo, [rotulo, n]] of Object.entries(esperado)) {
    const { status, html } = await render(`/bncc/computacao?etapa=${escopo}`);
    assert.equal(status, 200);
    assert.equal(contagemDe(html), n, escopo);
    assert.deepEqual((await todosOsCodigos(`/bncc/computacao?etapa=${escopo}`)).sort(), porEscopo(escopo).map((h) => h.codigo).sort(), escopo);
    assert.ok(textoDe(html).includes(`${n} resultados de 141`) || textoDe(html).includes(`${n} resultado de 141`));
    assert.ok(textoDe(html).includes(`Seleção atual: ${rotulo}`), escopo);
  }
});

test("filtro por ano/bloco: um ano inclui as habilidades do bloco que o contém; 'Somente o bloco' mostra só o bloco", async () => {
  const esperado = (pred) => habilidades.filter(pred).map((h) => h.codigo).sort();
  const casos = [
    ["3", (h) => h.ano === "3º ano" || (h.anos_aplicaveis ?? []).includes("3º ano")],
    ["9", (h) => h.ano === "9º ano" || (h.anos_aplicaveis ?? []).includes("9º ano")],
    ["1-5", (h) => h.bloco_anos === "1º ao 5º ano"],
    ["6-9", (h) => h.bloco_anos === "6º ao 9º ano"],
  ];
  for (const [valor, pred] of casos) {
    assert.deepEqual((await todosOsCodigos(`/bncc/computacao?ano=${valor}`)).sort(), esperado(pred), `ano=${valor}`);
    assert.ok(esperado(pred).length > 0);
  }
  assert.equal(contagemDe((await render("/bncc/computacao?ano=3")).html), 18, "3º ano (9) + bloco 1º ao 5º ano (9)");
  assert.equal(contagemDe((await render("/bncc/computacao?ano=1-5")).html), 9);
  assert.equal(contagemDe((await render("/bncc/computacao?etapa=anos-finais&ano=9")).html), 22, "9º ano (10) + bloco 6º ao 9º ano (12)");
});

test("filtro por eixo e por competência específica", async () => {
  for (const [slug, eixo] of [["pensamento-computacional", "Pensamento Computacional"], ["mundo-digital", "Mundo Digital"], ["cultura-digital", "Cultura Digital"]]) {
    assert.deepEqual((await todosOsCodigos(`/bncc/computacao?eixo=${slug}`)).sort(), habilidades.filter((h) => h.eixo === eixo).map((h) => h.codigo).sort(), slug);
  }
  const porComp = { 1: 6, 2: 2, 3: 3, 4: 5, 5: 2, 6: 4, 7: 4 };
  for (const [n, total] of Object.entries(porComp)) {
    const { html } = await render(`/bncc/computacao?etapa=ensino-medio&competencia=${n}`);
    assert.equal(contagemDe(html), total, `competência ${n}`);
    assert.deepEqual(codigosRenderizados(html).sort(), habilidades.filter((h) => h.competencia_especifica === Number(n)).map((h) => h.codigo).sort());
  }
});

test("filtros combinados e incompatíveis: o que não se aplica é ignorado com aviso visível, nunca zera a página nem gera erro", async () => {
  const comEixoNoMedio = await render("/bncc/computacao?etapa=ensino-medio&eixo=mundo-digital");
  assert.equal(contagemDe(comEixoNoMedio.html), 26);
  assert.ok(textoDe(comEixoNoMedio.html).includes("O Ensino Médio não é organizado por eixos"));
  const anoNoMedio = await render("/bncc/computacao?etapa=ensino-medio&ano=3");
  assert.equal(contagemDe(anoNoMedio.html), 26);
  assert.ok(textoDe(anoNoMedio.html).includes("não se aplica à etapa escolhida"));
  const compNoFundamental = await render("/bncc/computacao?etapa=anos-iniciais&competencia=2");
  assert.equal(contagemDe(compNoFundamental.html), 50);
  const esperado =habilidades.filter((h) => h.escopo === "anos-iniciais" && (h.anos_aplicaveis ?? []).includes("5º ano") && h.eixo === "Cultura Digital" && norm([h.codigo, h.texto, h.objeto_conhecimento, h.explicacao, ...h.exemplos].join(" ")).includes("tecnologia"));
  assert.deepEqual((await todosOsCodigos("/bncc/computacao?etapa=anos-iniciais&ano=5&eixo=cultura-digital&q=tecnologia")).sort(), esperado.map((h) => h.codigo).sort());
  assert.ok(esperado.length > 0);
});

// ---- busca ---------------------------------------------------------------------------------------------------
test("busca por código oficial: cada um dos 13 padrões é encontrado, em maiúsculas ou minúsculas", async () => {
  const primeiroDe = new Map();
  for (const h of habilidades) if (!primeiroDe.has(h.codigo.replace(/\d+$/, ""))) primeiroDe.set(h.codigo.replace(/\d+$/, ""), h.codigo);
  assert.equal(primeiroDe.size, 13);
  for (const codigo of primeiroDe.values()) {
    for (const forma of [codigo, codigo.toLowerCase()]) {
      const { html } = await render(`/bncc/computacao?q=${forma}`);
      assert.deepEqual(codigosRenderizados(html), [codigo], forma);
    }
  }
  assert.deepEqual(codigosRenderizados((await render("/bncc/computacao?q=EF05CO")).html).sort(), habilidades.filter((h) => /^EF05CO/.test(h.codigo)).map((h) => h.codigo).sort());
  assert.equal(contagemDe((await render("/bncc/computacao?q=XX99ZZ00")).html), 0);
});

test("busca pelo literal impresso 'EF05CO011' leva a EF05CO11 — sem tratá-lo como código válido nem como prefixo de outros", async () => {
  const { html } = await render("/bncc/computacao?q=EF05CO011");
  assert.deepEqual(codigosRenderizados(html), ["EF05CO11"]);
  assert.equal(Consulta.buscar(Consulta.lerConsulta({ q: "EF05CO01" }).filtros).map((i) => i.codigo).includes("EF05CO11"), false);
});

test("busca textual: todos os termos, no texto, objeto de conhecimento, explicação e exemplos — igual ao resultado calculado direto do catálogo", async () => {
  for (const q of ["algoritmo", "dados", "internet segurança", "robô"]) {
    const termos = norm(q).split(" ");
    const esperado = habilidades.filter((h) => {
      const alvo = norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2, h.explicacao, ...h.exemplos].filter(Boolean).join(" "));
      return termos.every((t) => alvo.includes(t));
    });
    const { status } = await render(`/bncc/computacao?q=${encodeURIComponent(q)}`);
    assert.equal(status, 200);
    assert.deepEqual((await todosOsCodigos(`/bncc/computacao?q=${encodeURIComponent(q)}`)).sort(), esperado.map((h) => h.codigo).sort(), q);
  }
});

test("busca sem acento e sem diferenciar maiúsculas: 'organização' = 'organizacao' = 'ORGANIZAÇÃO'", async () => {
  const a = await todosOsCodigos(`/bncc/computacao?q=${encodeURIComponent("organização")}`);
  const b = await todosOsCodigos("/bncc/computacao?q=organizacao");
  const c = await todosOsCodigos(`/bncc/computacao?q=${encodeURIComponent("ORGANIZAÇÃO")}`);
  assert.ok(a.length > 5);
  assert.deepEqual(a, b);
  assert.deepEqual(a, c);
  const esperado = habilidades.filter((h) => norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2, h.explicacao, ...h.exemplos].filter(Boolean).join(" ")).includes("organizacao"));
  assert.deepEqual([...a].sort(), esperado.map((h) => h.codigo).sort());
});

test("busca em explicação/exemplo: um termo que só existe no material de apoio encontra a habilidade e avisa onde apareceu", async () => {
  const principais = habilidades.map((h) => norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2].filter(Boolean).join(" ")));
  const candidato = habilidades.flatMap((h) => norm(h.exemplos.join(" ")).split(" ")).find((t) => t.length >= 7 && /^[a-z]+$/.test(t) && !principais.some((p) => p.includes(t)));
  assert.ok(candidato, "existe ao menos um termo só de exemplos");
  const { html } = await render(`/bncc/computacao?q=${candidato}`);
  const esperado = habilidades.filter((h) => norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2, h.explicacao, ...h.exemplos].filter(Boolean).join(" ")).includes(candidato));
  assert.deepEqual((await todosOsCodigos(`/bncc/computacao?q=${candidato}`)).sort(), esperado.map((h) => h.codigo).sort());
  assert.ok(textoDe(html).includes("Os termos buscados aparecem na explicação ou nos exemplos desta habilidade."));
});

// ---- parâmetros inválidos, repetidos e esquisitos ---------------------------------------------------------------------
test("parâmetros repetidos (?q=EF01CO01&q=EF05CO01): usa só o primeiro valor, avisa, e nunca retorna 500", async () => {
  const { status, html } = await render("/bncc/computacao?q=EF01CO01&q=EF05CO01");
  assert.equal(status, 200);
  assert.deepEqual(codigosRenderizados(html), ["EF01CO01"]);
  assert.ok(textoDe(html).includes("O filtro “q” foi informado mais de uma vez; foi usado apenas o primeiro valor."));
  const caminhoVarias = "/bncc/computacao?etapa=anos-iniciais&etapa=ensino-medio&ano=1&ano=9&eixo=mundo-digital&eixo=cultura-digital&competencia=1&competencia=2";
  const varias = await render(caminhoVarias);
  assert.equal(varias.status, 200);
  const codigosVarias = await todosOsCodigos(caminhoVarias);
  assert.ok(codigosVarias.length > 0);
  assert.ok(codigosVarias.every((c) => /^EF0[1-5]CO|^EF15CO/.test(c)), "etapa e ano: primeiro valor");
});

test("parâmetros inválidos: fallback seguro e previsível, aviso visível, HTML escapado, nunca 500", async () => {
  const perigoso = encodeURIComponent('<script>alert("x")</script>');
  const casos = [
    `/bncc/computacao?etapa=${perigoso}&ano=${perigoso}&eixo=${perigoso}&competencia=${perigoso}&q=${perigoso}`,
    "/bncc/computacao?etapa=zzz",
    "/bncc/computacao?ano=0&eixo=nada&competencia=99",
    "/bncc/computacao?competencia=1.5&ano=1e1&etapa=TODAS",
    "/bncc/computacao?etapa=&ano=&eixo=&competencia=&q=",
    `/bncc/computacao?q=${"a".repeat(2000)}`,
    "/bncc/computacao?q=%00%01%1f&etapa=%E0%A4%A",
    "/bncc/computacao?q[]=a&etapa[x]=y&ano[]=1",
    "/bncc/computacao?__proto__=x&constructor=y&q=toString",
    `/bncc/computacao?q=${encodeURIComponent("coração 🚀 日本語")}`,
  ];
  for (const path of casos) {
    const { status, html } = await render(path);
    assert.equal(status, 200, path);
    assert.doesNotMatch(html, /Internal Server Error|Application error|Não foi possível carregar/i, path);
    assert.doesNotMatch(principal(html), /<script>alert/, path);
    assert.ok(principal(html).includes(`<h1>${TITULO_OFICIAL}</h1>`), path);
  }
  const invalida = await render("/bncc/computacao?etapa=zzz&ano=0&eixo=nada&competencia=99");
  assert.equal(Consulta.lerConsulta({ etapa: "zzz", ano: "0", eixo: "nada", competencia: "99" }).avisos.length, 4);
  assert.equal(codigosRenderizados(invalida.html).length, 0);
  assert.ok(textoDe(invalida.html).includes("Escolha uma etapa"), "sem filtro válido: resumo por etapa");
  assert.ok(textoDe(invalida.html).includes("A etapa “zzz” não existe neste documento e foi ignorada."));
  const longa = await render(`/bncc/computacao?q=${"a".repeat(2000)}`);
  assert.ok(textoDe(longa.html).includes("A busca foi limitada a 120 caracteres."));
  assert.equal(contagemDe((await render("/bncc/computacao?etapa=TODAS")).html), 141, "valores de etapa não diferenciam maiúsculas");
});

test("lerConsulta e buscar nunca lançam, para qualquer formato de entrada", () => {
  const entradas = [undefined, null, {}, [], "x", 1, { q: [] }, { q: [1, 2] }, { q: [null, "ok"] }, { etapa: {} }, { ano: Symbol.iterator.toString() }, { q: "x".repeat(10000) }, { __proto__: { q: "y" } }, Object.create(null)];
  for (const entrada of entradas) {
    const consulta = Consulta.lerConsulta(entrada);
    assert.ok(Array.isArray(consulta.avisos));
    assert.ok(Array.isArray(Consulta.buscar(consulta.filtros)));
  }
  assert.equal(Consulta.lerConsulta({ q: [1, "ok"] }).filtros.q, "ok");
});

test("query string canônica e compartilhável: ordem fixa, só filtros válidos, ida e volta sem perda", () => {
  const consulta = Consulta.lerConsulta({ q: "dados", ano: "5", etapa: "anos-iniciais", eixo: "mundo-digital" });
  const qs = Consulta.montarQueryString(consulta.filtros);
  assert.equal(qs, "?etapa=anos-iniciais&ano=5&eixo=mundo-digital&q=dados");
  const volta = Consulta.lerConsulta(Object.fromEntries(new URLSearchParams(qs)));
  assert.deepEqual(volta.filtros, consulta.filtros);
  assert.equal(Consulta.montarQueryString(Consulta.lerConsulta({}).filtros), "");
});

// ---- premissas e competências ------------------------------------------------------------------------------------------
test("premissas (4) e competências (7 do Ensino Fundamental, 7 do Ensino Médio) aparecem uma única vez cada, em accordions nativos, fora dos resultados", () => {
  const texto = textoDe(pagina1.html);
  const premissas = catalogos["educacao-infantil"].registros.filter((r) => r.tipo === "premissa");
  assert.equal(premissas.length, 4);
  for (const p of premissas) assert.equal(ocorrencias(texto, p.texto), 1, `premissa ${p.numero}`);

  const blocos = principal(pagina1.html).split('<details class="comp-docs-bloco"').slice(1).map((b) => decodificar(b.replace(/<[^>]+>/g, " ")).replace(/\s+/g, " "));
  assert.equal(blocos.length, 3);
  const [blocoPremissas, blocoEf, blocoEm] = blocos;
  for (const p of premissas) assert.equal(ocorrencias(blocoPremissas, p.texto), 1);
  const fisicasEf = [...catalogos["anos-iniciais"].registros, ...catalogos["anos-finais"].registros].filter((r) => r.tipo === "competencia_especifica");
  assert.equal(fisicasEf.length, 14, "duplicadas fisicamente no catálogo");
  const distintasEf = new Map(fisicasEf.map((c) => [c.numero, c.texto]));
  assert.equal(distintasEf.size, 7);
  // Cada competência do EF aparece uma vez no bloco do Ensino Fundamental (e em nenhum outro bloco da etapa).
  for (const [n, t] of distintasEf) {
    assert.equal(ocorrencias(blocoEf, t), 1, `competência do EF ${n}`);
    assert.equal(ocorrencias(blocoPremissas, t), 0);
  }

  const medio = catalogos["ensino-medio"].registros.filter((r) => r.tipo === "competencia_especifica");
  assert.equal(medio.length, 7);
  for (const c of medio) {
    assert.equal(ocorrencias(blocoEm, c.texto), 1, `competência do EM ${c.numero}`);
    if (c.textos_divergem) assert.equal(ocorrencias(blocoEm, c.texto_no_quadro_de_habilidades), 1, `texto no quadro, EM ${c.numero}`);
    assert.equal(ocorrencias(blocoEf, c.texto), 0, "o texto do EM não é repetido no bloco do EF");
  }
  assert.deepEqual(medio.filter((c) => c.textos_divergem).map((c) => c.numero), [4, 5, 7]);
  assert.equal(ocorrencias(texto, "Texto repetido no quadro de habilidades (difere do texto da lista)"), 3);

  assert.equal((principal(pagina1.html).match(/<details class="comp-docs-bloco"/g) ?? []).length, 3);
  assert.equal((principal(pagina1.html).match(/<ol class="comp-docs-lista"/g) ?? []).length, 3);
  // Separadas dos resultados: ficam antes do formulário e do bloco de resultados.
  const html = principal(pagina1.html);
  assert.ok(html.indexOf("comp-docs-bloco") < html.indexOf('<form class="comp-form"'));
  assert.ok(html.indexOf('<form class="comp-form"') < html.indexOf('id="resultados"'));
});

test("a página sem filtros mostra o resumo por etapa (11 / 50 / 54 / 26) com links compartilháveis e nenhum resultado", () => {
  const html = principal(base.html);
  assert.equal(codigosRenderizados(base.html).length, 0);
  for (const [escopo, n] of [["educacao-infantil", 11], ["anos-iniciais", 50], ["anos-finais", 54], ["ensino-medio", 26]]) {
    assert.match(html, new RegExp(`<a href="/bncc/computacao\\?etapa=${escopo}#resultados"><span>[^<]+</span><strong>${n}</strong></a>`));
  }
  assert.match(html, /<a class="comp-todas" href="\/bncc\/computacao\?etapa=todas#resultados">Ver todos os 141/);
});

// ---- funciona sem JavaScript, sem fetch, sem dados públicos ------------------------------------------------------------------
test("a consulta é um formulário GET (funciona sem JavaScript), com rótulos associados e sem ação por script", () => {
  const html = principal(base.html);
  const form = html.match(/<form[^>]*class="comp-form"[^>]*>/)?.[0] ?? "";
  assert.match(form, /method="get"/);
  assert.match(form, /action="\/bncc\/computacao#resultados"/);
  for (const id of ["comp-q", "comp-etapa", "comp-ano", "comp-eixo", "comp-competencia"]) {
    assert.match(html, new RegExp(`<label for="${id}">`), id);
    assert.match(html, new RegExp(`id="${id}"`), id);
  }
  for (const nome of ["q", "etapa", "ano", "eixo", "competencia"]) assert.match(html, new RegExp(`name="${nome}"`));
  assert.doesNotMatch(html, /onclick=|onsubmit=|javascript:/i);
});

test("valores atuais permanecem nos campos (URL compartilhada reabre a mesma consulta)", async () => {
  const { html } = await render("/bncc/computacao?etapa=anos-finais&ano=7&eixo=mundo-digital&q=redes");
  const m = principal(html);
  assert.match(m, /<option value="anos-finais" selected="">/);
  assert.match(m, /<option value="7" selected="">/);
  assert.match(m, /<option value="mundo-digital" selected="">/);
  assert.match(m, /name="q"[^>]*value="redes"/);
});

test("nenhum fetch/XHR público para data/bncc/**: a rota é server-side, sem componente cliente, e o HTML não referencia os JSONs", () => {
  const dir = join(RAIZ, "app", "(bncc-computacao)");
  const fontes = [...arquivosDe(dir), join(RAIZ, "lib", "bncc", "computacao-consulta.ts")].filter((f) => /\.(ts|tsx)$/.test(f));
  assert.ok(fontes.length >= 5);
  for (const f of fontes) {
    const s = readFileSync(f, "utf-8");
    assert.doesNotMatch(s, /\bfetch\s*\(|XMLHttpRequest|axios|useEffect|\bdata\/bncc\b/, f);
    assert.doesNotMatch(s, /^["']use client["']/m, f);
  }
  assert.doesNotMatch(todas.html, /data\/bncc|computacao-(educacao|anos|ensino)/);
  assert.ok(!existsSync(join(RAIZ, "public", "data", "bncc")));
  assert.ok(!readdirSync(join(RAIZ, "public", "data")).some((n) => /bncc|computa/i.test(n)), "nenhum diretório de dados de Computação em public/data");
  // O catálogo não vai para nenhum bundle de cliente: procuramos frases dos registros nos assets estáticos.
  const frases = [habilidades.find((h) => h.codigo === "EF01CO01").explicacao.slice(0, 60), habilidades.find((h) => h.codigo === "EM13CO01").explicacao.slice(0, 60)];
  // (só dist/client/_next: dist/client/data guarda os arquivos por escola do SARESP, dezenas de milhares.)
  const estaticos = join(RAIZ, "dist", "client", "_next");
  if (existsSync(estaticos)) {
    const publicos = arquivosDe(estaticos).filter((x) => /\.(js|css|json|html|txt)$/.test(x));
    assert.ok(publicos.length > 10);
    for (const f of publicos) {
      const s = readFileSync(f, "utf-8");
      for (const frase of frases) assert.ok(!s.includes(frase), `${f} contém texto do catálogo`);
      assert.ok(!/computacao-(educacao-infantil|anos-iniciais|anos-finais|ensino-medio)\.json/.test(s), f);
    }
  }
});

// ---- projeção pública (unidade) -------------------------------------------------------------------------------------------------
test("projeção pública: nenhum campo interno/editorial do catálogo escapa para os itens da interface", () => {
  const itens = Consulta.buscar(Consulta.lerConsulta({ etapa: "todas" }).filtros);
  assert.equal(itens.length, 141);
  const permitidos = new Set(["codigo", "escopo", "etapaRotulo", "natureza", "texto", "grupo", "eixo", "objeto", "competenciaEspecifica", "explicacao", "exemplos", "relacoes", "notasDoDocumento", "codigoImpresso", "normalizacoes", "encontradoSoEmApoio"]);
  for (const item of itens) {
    for (const chave of Object.keys(item)) assert.ok(permitidos.has(chave), `campo inesperado: ${chave}`);
  }
  assert.doesNotMatch(JSON.stringify(itens), /id_interno|computacao\.e|sha256|pagina_|quadro_fonte/);
  assert.equal(itens.filter((i) => i.codigoImpresso).length, 1);
  assert.equal(itens.find((i) => i.codigoImpresso).codigo, "EF05CO11");
  assert.deepEqual(Consulta.obterCompetenciasEnsinoFundamental().map((c) => c.numero), [1, 2, 3, 4, 5, 6, 7]);
  assert.deepEqual(Consulta.obterCompetenciasEnsinoMedio().map((c) => c.numero), [1, 2, 3, 4, 5, 6, 7]);
  assert.equal(Consulta.obterPremissas().itens.length, 4);
  assert.ok(Consulta.obterFontesPublicas().every((f) => /^https:\/\/www\.gov\.br\//.test(f.url)));
});

// ---- sem regressão nas demais rotas ---------------------------------------------------------------------------------------------
test("sem regressão: /, /bncc, /saeb, /saeb/matriz e /saresp continuam 200 com o seu conteúdo, e a homepage não ganhou conteúdo de Computação", async () => {
  const esperado = [
    ["/", /<h1[^>]*>[^<]*Tempo|<h1/],
    ["/bncc", /Consulte a BNCC/],
    ["/saeb", /SAEB/],
    ["/saeb/matriz", /Matrizes de referência do SAEB/],
    ["/saresp", /SARESP/],
  ];
  for (const [path, padrao] of esperado) {
    const { status, html } = await render(path);
    assert.equal(status, 200, path);
    assert.match(principal(html), padrao, path);
    assert.ok(!principal(html).includes("comp-intro"), path);
  }
  const home = principal((await render("/")).html);
  assert.doesNotMatch(home, /Computa(ç|c)ão|EF01CO01/);
  // (Rodada 38: o rodapé ganhou o link "BNCC Computação" — coberto em tests/bncc-computacao-descoberta.test.mjs.)
  for (const arquivo of ["page.tsx", join("components", "Hero.tsx"), join("components", "QuickAccess.tsx")]) {
    assert.doesNotMatch(readFileSync(join(RAIZ, "app", arquivo), "utf-8"), /computa(ç|c)ao/i, arquivo);
  }
  // Rodada 38: a busca de /bncc passou a mostrar Computação, mas só numa seção separada e rotulada — nunca entre os
  // resultados curriculares (a lista curricular continua sem o código).
  const busca = await render("/bncc?q=EF01CO01");
  assert.equal(busca.status, 200);
  const secaoComp = principal(busca.html).match(/<section class="bncc-comp-secao"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(secaoComp.includes("EF01CO01</code>"));
  assert.ok(!principal(busca.html).replace(secaoComp, "").includes("EF01CO01</code>"));
  // Rota dinâmica por código continua com o seu comportamento (código inexistente → 404 próprio).
  assert.equal((await render("/bncc/ef01co01")).status, 404);
  assert.equal((await render("/bncc/ef05lp01")).status, 200);
});

// ---- paginação server-side por GET (Rodada 35, sub-rodada de correção) ------------------------------------------------------------
const TAMANHO_PAGINA = 24;
const itensDe = (html) => (resultadosDe(html).match(/<li class="comp-item"/g) ?? []).length;
const textoFinal = "Habilidades, objetivos, explicações e exemplos foram transcritos do documento oficial e conferidos com ele página a página. Normalizações apenas tipográficas e divergências do próprio documento são sinalizadas nesta consulta.";

test("paginação: a primeira página tem 24 dos 141 resultados, mostra o intervalo e só oferece 'Próxima'", () => {
  assert.equal(TAMANHO_PAGINA, Consulta.TAMANHO_PAGINA);
  assert.equal(paginasTodas.length, 6);
  assert.deepEqual(paginasTodas.map((p) => itensDe(p.html)), [24, 24, 24, 24, 24, 21]);
  const texto = textoDe(pagina1.html);
  assert.ok(texto.includes("141 resultados de 141 · mostrando 1–24 (página 1 de 6)"));
  const nav = principal(pagina1.html).match(/<nav class="comp-paginacao"[^]*?<\/nav>/)?.[0] ?? "";
  assert.ok(nav, "nav de paginação");
  assert.match(nav, /aria-label="Paginação dos resultados"/);
  assert.match(nav, /<span aria-disabled="true">[^]*?Anterior<\/span>/);
  assert.match(nav, /<a href="\/bncc\/computacao\?etapa=todas&amp;pagina=2#resultados" rel="next">/);
  assert.match(nav, /<span class="comp-pagina-atual" aria-current="page">/);
  assert.equal((nav.match(/<a href=/g) ?? []).length, 6, "5 números + Próxima");
});

test("paginação: página intermediária e última — itens, intervalo e links anterior/próxima", () => {
  const meio = paginasTodas[2];
  assert.ok(textoDe(meio.html).includes("mostrando 49–72 (página 3 de 6)"));
  const navMeio = principal(meio.html).match(/<nav class="comp-paginacao"[^]*?<\/nav>/)?.[0] ?? "";
  assert.match(navMeio, /pagina=2#resultados" rel="prev"/);
  assert.match(navMeio, /pagina=4#resultados" rel="next"/);
  assert.deepEqual(codigosRenderizados(meio.html), habilidades.slice(48, 72).map((h) => h.codigo));

  const ultima = paginasTodas[5];
  assert.ok(textoDe(ultima.html).includes("mostrando 121–141 (página 6 de 6)"));
  const navUltima = principal(ultima.html).match(/<nav class="comp-paginacao"[^]*?<\/nav>/)?.[0] ?? "";
  assert.match(navUltima, /pagina=5#resultados" rel="prev"/);
  assert.match(navUltima, /<span aria-disabled="true">Próxima/);
  assert.deepEqual(codigosRenderizados(ultima.html), habilidades.slice(120).map((h) => h.codigo));
});

test("paginação: nenhum item se repete nem se perde entre as páginas — as 6 páginas somam exatamente os 141, em ordem de catálogo", () => {
  const todos = paginasTodas.flatMap((p) => codigosRenderizados(p.html));
  assert.equal(todos.length, 141);
  assert.equal(new Set(todos).size, 141);
  assert.deepEqual(todos, habilidades.map((h) => h.codigo));
});

test("paginação: a URL preserva etapa, ano, eixo, competência e busca em todos os links, e a busca em si não muda", async () => {
  const paginas = await renderTodasAsPaginas("/bncc/computacao?q=dados");
  assert.equal(paginas.length, 2, "45 resultados = 2 páginas");
  const esperado = habilidades.filter((h) => norm([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2, h.explicacao, ...h.exemplos].filter(Boolean).join(" ")).includes("dados"));
  assert.equal(esperado.length, 45);
  assert.deepEqual(paginas.flatMap((p) => codigosRenderizados(p.html)), esperado.map((h) => h.codigo));
  assert.ok(textoDe(paginas[0].html).includes("45 resultados de 141 · mostrando 1–24 (página 1 de 2)"));
  const nav = principal(paginas[0].html).match(/<nav class="comp-paginacao"[^]*?<\/nav>/)[0];
  assert.match(nav, /href="\/bncc\/computacao\?q=dados&amp;pagina=2#resultados"/);

  const filtros = Consulta.lerConsulta({ etapa: "todas", eixo: "mundo-digital", q: "a" }).filtros;
  assert.equal(Consulta.montarQueryString(filtros, 2), "?etapa=todas&eixo=mundo-digital&q=a&pagina=2");
  assert.equal(Consulta.montarQueryString(filtros, 1), "?etapa=todas&eixo=mundo-digital&q=a", "a página 1 não aparece na URL");
  const comAno = Consulta.lerConsulta({ etapa: "anos-iniciais", ano: "3" }).filtros;
  assert.equal(Consulta.montarQueryString(comAno, 3), "?etapa=anos-iniciais&ano=3&pagina=3");
  const comCompetencia = Consulta.lerConsulta({ etapa: "ensino-medio", competencia: "1" }).filtros;
  assert.equal(Consulta.montarQueryString(comCompetencia, 2), "?etapa=ensino-medio&competencia=1&pagina=2");
});

test("paginação: página inválida, repetida, negativa ou excessiva nunca gera erro e cai num valor previsível", async () => {
  for (const [valor, esperadaPagina, avisoEsperado] of [
    ["0", 1, "A página “0” não é válida; foi mostrada a primeira."],
    ["-1", 1, "A página “-1” não é válida; foi mostrada a primeira."],
    ["abc", 1, "A página “abc” não é válida; foi mostrada a primeira."],
    ["1.5", 1, "A página “1.5” não é válida; foi mostrada a primeira."],
    ["1e3", 1, "A página “1e3” não é válida; foi mostrada a primeira."],
    ["%3Cscript%3E", 1, "A página “<script>” não é válida; foi mostrada a primeira."],
    ["999", 6, "A página 999 não existe (há 6); foi mostrada a última."],
    ["99999999999999999999", 1, "não é válida"],
  ]) {
    const { status, html } = await render(`/bncc/computacao?etapa=todas&pagina=${valor}`);
    assert.equal(status, 200, valor);
    assert.ok(textoDe(html).includes(`(página ${esperadaPagina} de 6)`), valor);
    assert.ok(textoDe(html).includes(avisoEsperado), valor);
    assert.doesNotMatch(principal(html), /<script>/, valor);
  }
  const vazio = await render("/bncc/computacao?etapa=todas&pagina=");
  assert.ok(textoDe(vazio.html).includes("(página 1 de 6)"));
  assert.doesNotMatch(textoDe(vazio.html), /A página “/);
  const repetida = await render("/bncc/computacao?etapa=todas&pagina=2&pagina=5");
  assert.equal(repetida.status, 200);
  assert.ok(textoDe(repetida.html).includes("(página 2 de 6)"));
  assert.ok(textoDe(repetida.html).includes("O filtro “pagina” foi informado mais de uma vez; foi usado apenas o primeiro valor."));
  const semFiltro = await render("/bncc/computacao?pagina=3");
  assert.equal(semFiltro.status, 200);
  assert.doesNotMatch(principal(semFiltro.html), /comp-paginacao/);
  const nenhum = await render("/bncc/computacao?q=zzzzzz&pagina=4");
  assert.equal(nenhum.status, 200);
  assert.doesNotMatch(principal(nenhum.html), /comp-paginacao/);
  assert.equal(contagemDe(nenhum.html), 0);
});

test("paginar() nunca lança e limita a página: vazio, NaN, negativo, fracionário e gigantesco", () => {
  const lista = Array.from({ length: 50 }, (_, i) => i);
  assert.deepEqual(Consulta.paginar(lista, 1).itens, lista.slice(0, 24));
  assert.equal(Consulta.paginar(lista, 3).itens.length, 2);
  assert.equal(Consulta.paginar(lista, 3).totalPaginas, 3);
  for (const ruim of [0, -5, NaN, Infinity, -Infinity, 1.7, 1e12]) {
    const p = Consulta.paginar(lista, ruim);
    assert.ok(p.pagina >= 1 && p.pagina <= 3, String(ruim));
    assert.ok(p.itens.length > 0);
  }
  const vazio = Consulta.paginar([], 7);
  assert.deepEqual([vazio.itens.length, vazio.pagina, vazio.totalPaginas, vazio.de, vazio.ate, vazio.total], [0, 1, 1, 0, 0, 0]);
  assert.equal(Consulta.paginar(lista, 9).aviso, "A página 9 não existe (há 3); foi mostrada a última.");
  assert.equal(Consulta.paginar(lista, 2).aviso, null);
});

test("paginação reduz o HTML: só a página atual leva explicações e exemplos — nada dos itens de outras páginas vai para o HTML", () => {
  const ANTES_BRUTO = 635691; // medido antes da paginação: ?etapa=todas, 141 itens
  for (const p of paginasTodas) assert.ok(p.html.length < 200_000, `página com ${p.html.length} bytes`);
  assert.ok(pagina1.html.length < ANTES_BRUTO / 3);
  const ultimo = habilidades.find((h) => h.codigo === "EM13CO26");
  assert.ok(!pagina1.html.includes(ultimo.explicacao.slice(0, 80)), "explicação do último item não está na página 1");
  assert.ok(!pagina1.html.includes("EM13CO26"), "o código do último item só aparece na página 6");
  assert.ok(paginasTodas[5].html.includes(ultimo.explicacao.slice(0, 80)));
  const primeiro = habilidades[0];
  assert.ok(!paginasTodas[5].html.includes(primeiro.exemplos[0].slice(0, 60)), "exemplos do primeiro item não estão na página 6");
});

test("canonical: continua único e igual à rota base em todas as páginas da consulta", () => {
  for (const p of paginasTodas) {
    assert.deepEqual([...p.html.matchAll(/<link rel="canonical" href="([^"]+)"/g)].map((m) => m[1]), [CANONICAL]);
  }
});

test("paginação: com 24 resultados ou menos não há navegação de páginas (Educação Infantil, 11)", async () => {
  const { html } = await render("/bncc/computacao?etapa=educacao-infantil");
  assert.doesNotMatch(principal(html), /comp-paginacao/);
  assert.doesNotMatch(textoDe(html), /mostrando/);
  assert.equal(itensDe(html), 11);
});

// ---- metadados operacionais coerentes e texto público corrigido -------------------------------------------------------------------
test("texto público: a frase incorreta sobre 'erros de digitação' não existe mais, e o texto final aprovado está na página", () => {
  const antigo = /erros de digitação do original foram mantidos/i;
  for (const { html } of [base, pagina1]) {
    assert.doesNotMatch(textoDe(html), antigo);
    assert.ok(textoDe(html).includes(textoFinal));
  }
  const fontes = [...arquivosDe(join(RAIZ, "app", "(bncc-computacao)")), join(RAIZ, "lib", "bncc", "computacao-consulta.ts"), join(RAIZ, "data", "bncc", "README.md")].filter((f) => /\.(ts|tsx|md)$/.test(f));
  for (const f of fontes) assert.doesNotMatch(readFileSync(f, "utf-8"), antigo, f);
  assert.doesNotMatch(textoDe(base.html), /integral e sem reescrita|reprodução integral/i, "nenhuma promessa absoluta além do auditado");
});

test("normalizações tipográficas são sinalizadas: 'responsabilidade' quebrada (EF09CO06–09) e marcador '(cont.)' (EF09CO05); o texto das habilidades não muda", () => {
  const itens = Consulta.buscar(Consulta.lerConsulta({ etapa: "todas" }).filtros);
  const com = itens.filter((i) => i.normalizacoes.length > 0).map((i) => i.codigo);
  assert.deepEqual(com, ["EF09CO05", "EF09CO06", "EF09CO07", "EF09CO08", "EF09CO09"]);
  const texto = textoDe(todas.html);
  assert.equal(ocorrencias(texto, "Normalização: no documento, o objeto de conhecimento aparece com a palavra “responsabilidade” quebrada entre duas linhas"), 4);
  assert.equal(ocorrencias(texto, "Normalização: no documento, as células de objeto de conhecimento desta linha trazem o marcador de continuação de tabela “(cont.)”"), 1);
  for (const item of itens) assert.equal(item.texto, habilidades.find((h) => h.codigo === item.codigo).texto);
});

test("metadados de publicação coerentes: gerador, catálogos, biblioteca, README e fontes oficiais", () => {
  const gerador = readFileSync(join(RAIZ, "scripts", "bncc-computacao", "gerar.mjs"), "utf-8");
  assert.match(gerador, /publicado_na_interface: true,/);
  assert.doesNotMatch(gerador, /publicado_na_interface: false/);
  assert.match(gerador, /exclusivamente na página \/bncc\/computacao/);
  assert.doesNotMatch(gerador, /Este catálogo é interno|nenhuma página, rota, busca, menu/);
  const lib = readFileSync(join(RAIZ, "lib", "bncc", "computacao.ts"), "utf-8");
  assert.match(lib, /publicado_na_interface: true;/);
  assert.doesNotMatch(lib, /publicado_na_interface: false/);
  for (const e of ESCOPOS) {
    const m = catalogos[e].metadata;
    assert.equal(m.publicado_na_interface, true, e);
    assert.match(m.nota_de_interface, /\/bncc\/computacao/);
    assert.doesNotMatch(m.nota_de_interface, /é interno|nenhuma página, rota/);
  }
  const readme = readFileSync(join(RAIZ, "data", "bncc", "README.md"), "utf-8");
  assert.doesNotMatch(readme, /catálogo interno, sem interface|não integrada à interface|Computação não está publicada/);
  assert.doesNotMatch(readme, /foram escritos antes\s+da interface/);
  for (const e of ESCOPOS) {
    const fonte = readFileSync(join(RAIZ, "data", "bncc", "source", `official-mec-bncc-computacao-${e}.json`), "utf-8");
    assert.doesNotMatch(fonte, /publicado_na_interface|nota_de_interface/, e);
  }
});
