// Regressão estrutural dos dois overflows horizontais pré-existentes corrigidos na Rodada 29:
//   1. /saresp em ~375px: .component-grid usava minmax(360px, 1fr) num contêiner de 335px;
//   2. submenu SAEB do Header em larguras desktop intermediárias: o painel ancorado com
//      left: 0 podia ultrapassar a viewport (confirmado em 960, 1024, 1100 e 1280 px).
//   3. rótulos do eixo X do gráfico por série/ano: com a coluna mais estreita o Recharts omitia o tick
//      intermediário (5º Ano EF) no intervalo automático; interval={0} força todos os ticks.
// Estes testes verificam a ESTRUTURA do CSS/JSX (sem geometria real: o `npm test` não tem navegador).
// A geometria é validada à parte, em navegador real, e documentada no relatório da rodada.
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import { groupAverage } from "../lib/saresp/analysis.ts";

const read = (path) => readFileSync(new URL(path, import.meta.url), "utf-8");
const globalsCss = read("../app/globals.css");
const sarespCss = read("../app/saresp/saresp.css");
const headerSource = read("../app/components/Header.tsx");

// Devolve o corpo da primeira regra cujo seletor é exatamente `selector` (sem aninhamento).
function rule(css, selector) {
  const escaped = selector.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  return css.match(new RegExp(`(?:^|\\n)${escaped}\\s*\\{([^}]*)\\}`))?.[1] ?? "";
}

async function render(path) {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);
  return worker.fetch(
    new Request(`http://localhost${path}`, { headers: { accept: "text/html" } }),
    { ASSETS: { fetch: async () => new Response("Not found", { status: 404 }) } },
    { waitUntil() {}, passThroughOnException() {} },
  );
}

// ---- SARESP ----

test("SARESP: .component-grid limita o mínimo da coluna ao próprio contêiner (min(360px, 100%))", () => {
  const body = rule(sarespCss, ".component-grid");
  assert.ok(body, ".component-grid rule not found in saresp.css");
  assert.match(body, /display:\s*grid/);
  assert.match(
    body,
    /grid-template-columns:\s*repeat\(\s*auto-fit\s*,\s*minmax\(\s*min\(\s*360px\s*,\s*100%\s*\)\s*,\s*1fr\s*\)\s*\)/,
    "the column minimum must be min(360px, 100%) so a container narrower than 360px never overflows",
  );
  // O defeito original: um mínimo fixo de 360px dentro do minmax().
  assert.doesNotMatch(body, /minmax\(\s*360px\s*,/, "a bare minmax(360px, …) reintroduces the 375px overflow");
});

test("SARESP: .chart-panel mantém min-width: 0 e o desktop continua com colunas de 360px+", () => {
  assert.match(rule(sarespCss, ".chart-panel"), /min-width:\s*0/);
  // O layout desktop não mudou: o tamanho preferido da coluna continua sendo 360px.
  assert.match(rule(sarespCss, ".component-grid"), /min\(\s*360px/);
});

test("SARESP e Header: o overflow não é escondido com overflow-x: hidden em html, body, main ou nos painéis", () => {
  for (const [name, css] of [["globals.css", globalsCss], ["saresp.css", sarespCss]]) {
    for (const selector of ["html", "body", ".saresp-main", ".component-grid", ".chart-panel", ".site-header", ".header-inner", ".desktop-nav", ".nav-item", ".nav-dropdown"]) {
      const body = rule(css, selector);
      assert.doesNotMatch(body, /overflow(-x)?:\s*(hidden|clip)/, `${name}: ${selector} must not hide overflow`);
    }
  }
  assert.doesNotMatch(rule(globalsCss, ".nav-dropdown[data-align=\"end\"]"), /overflow/);
});

test("SARESP: os componentes de gráfico continuam usando component-grid e chart-panel", () => {
  const charts = read("../app/saresp/components/Charts.tsx");
  const evolution = read("../app/saresp/components/EvolutionChart.tsx");
  assert.match(charts, /className="component-grid"/);
  assert.match(charts, /className="panel chart-panel"/);
  assert.match(evolution, /className="component-grid"/);
  assert.match(evolution, /className="panel chart-panel"/);
});

test("SARESP: o XAxis por série/ano força todos os ticks (interval={0}) e as três séries chegam ao eixo", () => {
  const charts = read("../app/saresp/components/Charts.tsx");
  const axes = (charts.match(/<XAxis\b[\s\S]*?\/>/g) ?? []).filter((axis) => /dataKey="name"/.test(axis));
  assert.equal(axes.length, 1, 'exactly one <XAxis dataKey="name" /> in Charts.tsx');
  const [axis] = axes;
  assert.match(axis, /\binterval=\{0\}/, "interval={0} shows every tick; the default drops the middle label on narrow columns");
  // Nenhuma outra configuração de intervalo/densidade que volte a permitir a omissão automática.
  assert.equal((axis.match(/\binterval=/g) ?? []).length, 1, "a single interval prop, and it is {0}");
  assert.doesNotMatch(axis, /\b(minTickGap|tickCount|preserveStart|preserveEnd|equidistantPreserve)/);
  assert.match(axis, /\btick=\{axisTick\}/, "the shared tick style stays");
  assert.match(charts, /const axisTick = \{ fontSize: 11,/, "tick font size is not shrunk to fit");

  // Fluxo normal: o eixo recebe uma linha por série/ano, e nenhuma é descartada na agregação.
  assert.match(charts, /groupAverage\(rows, "serieAno"\)/);
  const rows = ["9º Ano EF", "2º Ano EF", "5º Ano EF", "5º Ano EF"].map((serieAno) => ({ serieAno, prof2024: 200, prof2025: 210, diff: 10 }));
  const names = groupAverage(rows, "serieAno")
    .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"))
    .map((row) => row.name);
  assert.deepEqual(names, ["2º Ano EF", "5º Ano EF", "9º Ano EF"]);
});

test("SARESP: a página /saresp continua renderizando (200) com o cabeçalho e o menu intactos", async () => {
  const response = await render("/saresp");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /<main[^>]*class="saresp-main"|class="saresp-main"/);
  assert.match(html, /aria-label="Navegação principal"/);
});

// ---- Header / submenu SAEB ----

test("Header: só o submenu SAEB (último dropdown antes de 'Sobre') é ancorado pela direita", () => {
  const anchored = headerSource.match(/<div className="nav-dropdown"[^>]*data-align="end"[^>]*>/g) ?? [];
  assert.equal(anchored.length, 1, "exactly one desktop dropdown should be end-anchored");
  assert.match(anchored[0], /id=\{desktopSaebDropdownId\}/, "the end-anchored dropdown must be the SAEB one");
  const bncc = headerSource.match(/<div className="nav-dropdown"[^>]*id=\{desktopDropdownId\}[^>]*>/)?.[0] ?? "";
  assert.ok(bncc, "BNCC dropdown not found");
  assert.doesNotMatch(bncc, /data-align/, "the BNCC dropdown keeps its default left anchoring");
});

test("Header: regra de ancoragem pela direita no CSS; o padrão (BNCC) continua left:0 com min-width 216px", () => {
  const end = rule(globalsCss, '.nav-dropdown[data-align="end"]');
  assert.ok(end, 'rule .nav-dropdown[data-align="end"] not found');
  assert.match(end, /left:\s*auto/);
  assert.match(end, /right:\s*0/);
  const base = rule(globalsCss, ".nav-dropdown");
  assert.match(base, /position:\s*absolute/);
  assert.match(base, /left:\s*0/);
  assert.match(base, /min-width:\s*216px/);
  assert.doesNotMatch(end, /min-width|width:|transform|translate/, "the end anchor must not resize or shift the panel");
  // A regra de ancoragem vem depois da base, senão o left:0 da base a anularia (mesma especificidade não ocorre:
  // o seletor com atributo é mais específico, mas mantemos a ordem natural base -> variação).
  assert.ok(globalsCss.indexOf(".nav-dropdown {") < globalsCss.indexOf('.nav-dropdown[data-align="end"]'));
});

test("Header: o posicionamento é só CSS — sem cálculo manual de viewport nem listener de resize", () => {
  assert.doesNotMatch(headerSource, /getBoundingClientRect|innerWidth|clientWidth|ResizeObserver|addEventListener\(\s*["']resize/);
});

test("Header: semântica preservada — aria-expanded, aria-controls, hidden, exclusão mútua, Escape e clique fora", () => {
  assert.match(headerSource, /aria-expanded=\{desktopSaebOpen\}/);
  assert.match(headerSource, /aria-controls=\{desktopSaebDropdownId\}/);
  assert.match(headerSource, /aria-expanded=\{desktopBnccOpen\}/);
  assert.match(headerSource, /hidden=\{!desktopSaebOpen\}/);
  assert.match(headerSource, /hidden=\{!desktopBnccOpen\}/);
  // Exclusão mútua BNCC <-> SAEB.
  assert.match(headerSource, /function toggleDesktopBncc\(\)\s*\{\s*setDesktopSaebOpen\(false\);/);
  assert.match(headerSource, /function toggleDesktopSaeb\(\)\s*\{\s*setDesktopBnccOpen\(false\);/);
  // Escape fecha e devolve o foco ao botão; clique fora só fecha.
  assert.match(headerSource, /event\.key !== "Escape"/);
  assert.match(headerSource, /desktopSaebToggleRef\.current\?\.focus\(\)/);
  assert.match(headerSource, /closeDesktopSaeb\(true\)/);
  assert.match(headerSource, /closeDesktopSaeb\(false\)/);
});

test("Header: o HTML renderizado mantém 2 dropdowns fechados, um deles ancorado, e o menu mobile com acordeões", async () => {
  const html = await (await render("/")).text();
  const dropdowns = [...html.matchAll(/<div class="nav-dropdown"[^>]*>[^]*?<\/div>/g)].map((m) => m[0]);
  assert.equal(dropdowns.length, 2);
  const anchored = dropdowns.filter((d) => /data-align="end"/.test(d));
  assert.equal(anchored.length, 1);
  assert.match(anchored[0], /href="\/saeb\/matriz"/, "the anchored dropdown is the SAEB one");
  for (const dropdown of dropdowns) assert.match(dropdown, /hidden/, "dropdowns stay hidden until opened");
  assert.match(html, /aria-label="Submenu de SAEB"[^>]*>|aria-expanded="false"[^>]*aria-label="Submenu de SAEB"/);
  // O painel do menu mobile e seus acordeões não usam a ancoragem do desktop.
  const mobileNav = html.match(/<nav aria-label="Navegação móvel"[^]*?<\/nav>/)?.[0] ?? "";
  assert.ok(mobileNav, "mobile nav not found");
  assert.equal((mobileNav.match(/mobile-accordion-panel/g) ?? []).length, 2);
  assert.doesNotMatch(mobileNav, /data-align/);
});
