import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import test from "node:test";
import schoolsIndex from "../public/data/saresp/schools-index.json" with { type: "json" };
import schoolsAliases from "../public/data/saresp/schools-aliases.json" with { type: "json" };
import { matchSchoolIndex, normalizeSearch, withSearchKey } from "../lib/saresp/analysis.ts";

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

const OLD_ANCHOR_HREFS = ['href="/#avaliacoes"', 'href="/#dados"', 'href="/#ferramentas"', 'href="/#sobre"'];

// Rodada 20: os quatro acessos principais (por tarefa/sistema) nunca se
// misturam, na mesma hierarquia, com as quatro etapas da BNCC (navegação
// secundária e compacta) — ver QuickAccess.tsx.
const PRIMARY_ACCESS_CARDS = [
  { title: "Consultar habilidades da BNCC", href: "/bncc" },
  { title: "Consultar matrizes do SAEB", href: "/saeb/matriz" },
  { title: "Consultar resultados do SAEB", href: "/saeb" },
  { title: "Consultar resultados do SARESP", href: "/saresp" },
];

const ETAPA_LINKS = [
  { title: "Educação Infantil", href: "/bncc/educacao-infantil" },
  { title: "Ensino Fundamental", href: "/bncc/ensino-fundamental" },
  { title: "Ensino Médio", href: "/bncc/ensino-medio" },
  { title: "Competências Gerais", href: "/bncc/competencias-gerais" },
];

const homeResponse = await render("/");
const homeHtml = await homeResponse.text();

test("homepage renders with the reorganized sections", () => {
  assert.equal(homeResponse.status, 200);
});

// ---- 1 & 3. Menu principal contém só destinos reais; nenhuma âncora antiga sobra ----

test("no old anchor link (#avaliacoes, #dados, #ferramentas, #sobre) appears anywhere on the homepage", () => {
  for (const href of OLD_ANCHOR_HREFS) {
    assert.ok(!homeHtml.includes(href), `unexpected leftover anchor: ${href}`);
  }
});

test("Header and Footer only link to real destinations (/, /bncc, /saresp, /saeb, /sobre, and the four BNCC submenu pages)", () => {
  const headerBlock = homeHtml.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
  const footerBlock = homeHtml.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
  assert.ok(headerBlock, "missing <header>");
  assert.ok(footerBlock, "missing <footer>");

  for (const href of OLD_ANCHOR_HREFS) {
    assert.ok(!headerBlock.includes(href), `header still links to ${href}`);
    assert.ok(!footerBlock.includes(href), `footer still links to ${href}`);
  }

  // "Sobre" now exists as a real page — it must link to /sobre, never to the old #sobre anchor.
  assert.match(headerBlock, /href="\/sobre"[^>]*>Sobre</, "header should link 'Sobre' to the real /sobre page");
  assert.match(footerBlock, /href="\/sobre">Sobre</, "footer should link 'Sobre' to the real /sobre page");

  assert.match(headerBlock, /href="\/saresp"/);
  assert.match(footerBlock, /href="\/saresp"/);

  // SAEB: real link to /saeb, never to a search query, an anchor, or "Em breve" copy.
  assert.match(headerBlock, /href="\/saeb"[^>]*>SAEB</, "header should link 'SAEB' to the real /saeb page");
  assert.match(footerBlock, /href="\/saeb">SAEB</, "footer should link 'SAEB' to the real /saeb page");
  assert.doesNotMatch(headerBlock, /href="\/bncc\?q=SAEB"/);
  assert.doesNotMatch(footerBlock, /href="\/bncc\?q=SAEB"/);
  assert.doesNotMatch(headerBlock, /href="#saeb"/);
  assert.doesNotMatch(footerBlock, /href="#saeb"/);

  // SAEB submenu: the matriz/descritores consultation must be reachable from the header too.
  assert.match(headerBlock, /href="\/saeb\/matriz"[^>]*>\s*Matrizes de referência/, "header should link the SAEB submenu to /saeb/matriz");
});

// ---- Privacidade: Footer only, never the main Header menu ----

test("'Privacidade' is a Footer-only link — never added to the main Header menu", () => {
  const headerBlock = homeHtml.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
  const footerBlock = homeHtml.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
  assert.match(footerBlock, /href="\/privacidade">Privacidade</, "footer should link 'Privacidade' to the real /privacidade page");
  assert.ok(!headerBlock.includes("/privacidade"), "the main Header menu should never link to /privacidade");
});

// ---- 2. Submenu BNCC contém exatamente os quatro destinos previstos ----

test("the BNCC submenu contains exactly the four expected destinations, in both the desktop dropdown and the mobile accordion", () => {
  const expectedHrefs = ["/bncc/educacao-infantil", "/bncc/ensino-fundamental", "/bncc/ensino-medio", "/bncc/competencias-gerais"];

  // Note: these hrefs legitimately also appear in the homepage's quick-access cards and Footer, so
  // a whole-page occurrence count isn't meaningful here — each container is checked in isolation.
  const dropdown = homeHtml.match(/<div class="nav-dropdown"[^>]*>[^]*?<\/div>/)?.[0] ?? "";
  assert.ok(dropdown, "missing desktop nav-dropdown");
  for (const href of expectedHrefs) {
    assert.ok(dropdown.includes(`href="${href}"`), `desktop dropdown missing ${href}`);
  }
  assert.equal((dropdown.match(/<a /g) ?? []).length, 4, "desktop dropdown should contain exactly 4 links");

  const mobilePanel = homeHtml.match(/<div class="mobile-accordion-panel"[^>]*>[^]*?<\/div>/)?.[0] ?? "";
  assert.ok(mobilePanel, "missing mobile-accordion-panel");
  for (const href of expectedHrefs) {
    assert.ok(mobilePanel.includes(`href="${href}"`), `mobile accordion panel missing ${href}`);
  }
  assert.equal((mobilePanel.match(/<a /g) ?? []).length, 4, "mobile accordion panel should contain exactly 4 links");
});

test("the BNCC trigger has aria-expanded, an accessible name, and aria-controls pointing at an existing id", () => {
  const toggleMatch = homeHtml.match(/<button[^>]*class="nav-toggle"[^>]*>/)?.[0] ?? "";
  assert.match(toggleMatch, /aria-expanded="false"/);
  assert.match(toggleMatch, /aria-label="Submenu de BNCC"/);
  const controlsId = toggleMatch.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(controlsId, "nav-toggle missing aria-controls");
  assert.ok(homeHtml.includes(`id="${controlsId}"`), "aria-controls does not point to an existing id");
});

// ---- Submenu SAEB: mesmo padrão do submenu BNCC, com "Resultados por escola" e "Matrizes de referência" ----

test("the SAEB submenu contains exactly the two expected destinations, in both the desktop dropdown and the mobile accordion", () => {
  const expectedHrefs = ["/saeb", "/saeb/matriz"];

  // O submenu BNCC é o primeiro .nav-dropdown / .mobile-accordion-panel do documento — o do SAEB é
  // o segundo, na mesma ordem em que os dois aparecem na barra de navegação.
  const dropdowns = [...homeHtml.matchAll(/<div class="nav-dropdown"[^>]*>[^]*?<\/div>/g)].map((m) => m[0]);
  assert.equal(dropdowns.length, 2, `expected exactly 2 nav-dropdown elements (BNCC + SAEB), found ${dropdowns.length}`);
  const saebDropdown = dropdowns[1];
  for (const href of expectedHrefs) {
    assert.ok(saebDropdown.includes(`href="${href}"`), `SAEB desktop dropdown missing ${href}`);
  }
  assert.equal((saebDropdown.match(/<a /g) ?? []).length, 2, "SAEB desktop dropdown should contain exactly 2 links");
  assert.match(saebDropdown, />Resultados por escola</);
  assert.match(saebDropdown, />Matrizes de referência</);

  const panels = [...homeHtml.matchAll(/<div class="mobile-accordion-panel"[^>]*>[^]*?<\/div>/g)].map((m) => m[0]);
  assert.equal(panels.length, 2, `expected exactly 2 mobile-accordion-panel elements (BNCC + SAEB), found ${panels.length}`);
  const saebPanel = panels[1];
  for (const href of expectedHrefs) {
    assert.ok(saebPanel.includes(`href="${href}"`), `SAEB mobile accordion panel missing ${href}`);
  }
  assert.equal((saebPanel.match(/<a /g) ?? []).length, 2, "SAEB mobile accordion panel should contain exactly 2 links");
});

test("the SAEB desktop and mobile triggers have aria-expanded, an accessible name, and aria-controls pointing at an existing id", () => {
  const desktopToggles = [...homeHtml.matchAll(/<button[^>]*class="nav-toggle"[^>]*>/g)].map((m) => m[0]);
  assert.equal(desktopToggles.length, 2, `expected exactly 2 desktop nav-toggle buttons (BNCC + SAEB), found ${desktopToggles.length}`);
  const saebDesktopToggle = desktopToggles[1];
  assert.match(saebDesktopToggle, /aria-expanded="false"/);
  assert.match(saebDesktopToggle, /aria-label="Submenu de SAEB"/);
  const desktopControlsId = saebDesktopToggle.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(desktopControlsId, "SAEB nav-toggle missing aria-controls");
  assert.ok(homeHtml.includes(`id="${desktopControlsId}"`), "SAEB desktop aria-controls does not point to an existing id");

  const mobileTriggers = [...homeHtml.matchAll(/<button[^>]*class="mobile-accordion-trigger"[^>]*>/g)].map((m) => m[0]);
  assert.equal(mobileTriggers.length, 2, `expected exactly 2 mobile-accordion-trigger buttons (BNCC + SAEB), found ${mobileTriggers.length}`);
  const saebMobileTrigger = mobileTriggers[1];
  assert.match(saebMobileTrigger, /aria-expanded="false"/);
  assert.match(saebMobileTrigger, /aria-label="Submenu de SAEB"/);
  const mobileControlsId = saebMobileTrigger.match(/aria-controls="([^"]+)"/)?.[1];
  assert.ok(mobileControlsId, "SAEB mobile-accordion-trigger missing aria-controls");
  assert.ok(homeHtml.includes(`id="${mobileControlsId}"`), "SAEB mobile aria-controls does not point to an existing id");
});

test("the SAEB desktop trigger is a real <button>, and 'SAEB' itself is a plain navigation <a> — never a clickable div", () => {
  const headerBlock = homeHtml.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
  assert.match(headerBlock, /<a href="\/saeb"[^>]*>SAEB<\/a>\s*<button[^>]*class="nav-toggle"/, "SAEB link and its toggle button should be adjacent, distinct elements");
  assert.doesNotMatch(headerBlock, /<div[^>]*onclick/i, "no clickable <div> should be used for navigation");
});

// ---- aria-current: nunca dois elementos "atuais" na mesma navegação ----

function extractNavBlocks(html) {
  const desktop = html.match(/<nav class="desktop-nav"[^]*?<\/nav>/)?.[0] ?? "";
  const mobile = html.match(/<nav aria-label="Navegação móvel"[^]*?<\/nav>/)?.[0] ?? "";
  return { desktop, mobile };
}

const ARIA_CURRENT_CASES = [
  {
    path: "/bncc",
    describe: "on /bncc itself",
    expectBnccPage: true,
    expectBnccSectionClass: false,
    expectedSubmenuPageHref: null,
  },
  {
    path: "/bncc/educacao-infantil",
    describe: "on a submenu destination matched exactly",
    expectBnccPage: false,
    expectBnccSectionClass: true,
    expectedSubmenuPageHref: "/bncc/educacao-infantil",
  },
  {
    path: "/bncc/educacao-infantil/tracos-sons-cores-e-formas",
    describe: "on a campo page, deeper than any submenu link",
    expectBnccPage: false,
    expectBnccSectionClass: true,
    expectedSubmenuPageHref: null,
  },
  {
    path: "/bncc/ei02ts01",
    describe: "on an objetivo detail page, deeper than any submenu link",
    expectBnccPage: false,
    expectBnccSectionClass: true,
    expectedSubmenuPageHref: null,
  },
  {
    path: "/saresp",
    describe: "on /saresp, outside the BNCC section entirely",
    expectBnccPage: false,
    expectBnccSectionClass: false,
    expectedSubmenuPageHref: null,
  },
  {
    path: "/saeb",
    describe: "on /saeb itself",
    expectBnccPage: false,
    expectBnccSectionClass: false,
    expectedSubmenuPageHref: null,
    expectSaebPage: true,
    expectSaebSectionClass: false,
    expectedSaebSubmenuPageHref: null,
  },
  {
    path: "/saeb/matriz",
    describe: "on the SAEB matriz submenu destination matched exactly",
    expectBnccPage: false,
    expectBnccSectionClass: false,
    expectedSubmenuPageHref: null,
    expectSaebPage: false,
    expectSaebSectionClass: true,
    expectedSaebSubmenuPageHref: "/saeb/matriz",
  },
  {
    // A busca de descritores preserva etapa/componente/busca na querystring — usePathname() nunca
    // vê essa parte da URL, então a página ativa precisa continuar identificada corretamente.
    path: "/saeb/matriz?etapa=anosFinais&componente=mt&busca=D1",
    describe: "on the SAEB matriz page with etapa/componente/busca query params",
    expectBnccPage: false,
    expectBnccSectionClass: false,
    expectedSubmenuPageHref: null,
    expectSaebPage: false,
    expectSaebSectionClass: true,
    expectedSaebSubmenuPageHref: "/saeb/matriz",
  },
];

// Único item de nível principal (fora dos dois dropdowns, BNCC e SAEB) que carrega
// aria-current="page" na própria rota.
const SIMPLE_CURRENT_ROUTES = ["/saresp"];

for (const testCase of ARIA_CURRENT_CASES) {
  test(`aria-current ${testCase.describe} (${testCase.path}): exactly one current element, never a duplicate`, async () => {
    const response = await render(testCase.path);
    assert.equal(response.status, 200, `${testCase.path} should render 200`);
    const html = await response.text();
    const { desktop, mobile } = extractNavBlocks(html);
    assert.ok(desktop, `${testCase.path}: missing desktop nav block`);
    assert.ok(mobile, `${testCase.path}: missing mobile nav block`);

    const expectSaebPage = testCase.expectSaebPage ?? false;
    const expectSaebSectionClass = testCase.expectSaebSectionClass ?? false;
    const expectedSaebSubmenuPageHref = testCase.expectedSaebSubmenuPageHref ?? null;

    for (const [navName, nav] of [["desktop", desktop], ["mobile", mobile]]) {
      // "location" was retired entirely — the active section is only ever conveyed visually now.
      assert.doesNotMatch(nav, /aria-current="location"/, `${testCase.path} ${navName}: "location" must never be used`);

      const bnccLinkMatch = nav.match(/<a href="\/bncc"([^>]*)>BNCC<\/a>/);
      assert.ok(bnccLinkMatch, `${testCase.path} ${navName}: BNCC link not found`);
      const bnccAttrs = bnccLinkMatch[1];
      assert.equal(/aria-current="page"/.test(bnccAttrs), testCase.expectBnccPage, `${testCase.path} ${navName}: BNCC aria-current="page" mismatch`);
      assert.equal(/class="is-section-active"/.test(bnccAttrs), testCase.expectBnccSectionClass, `${testCase.path} ${navName}: BNCC is-section-active mismatch`);
      // The two are mutually exclusive by construction, but assert it explicitly too.
      assert.ok(!(/aria-current="page"/.test(bnccAttrs) && /class="is-section-active"/.test(bnccAttrs)), `${testCase.path} ${navName}: BNCC must not carry both aria-current="page" and is-section-active`);

      // Same distinction for the SAEB section — /saeb exact gets aria-current="page" on the parent
      // link; /saeb/matriz (with or without query params) gets is-section-active instead.
      const saebLinkMatch = nav.match(/<a href="\/saeb"([^>]*)>SAEB<\/a>/);
      assert.ok(saebLinkMatch, `${testCase.path} ${navName}: SAEB link not found`);
      const saebAttrs = saebLinkMatch[1];
      assert.equal(/aria-current="page"/.test(saebAttrs), expectSaebPage, `${testCase.path} ${navName}: SAEB aria-current="page" mismatch`);
      assert.equal(/class="is-section-active"/.test(saebAttrs), expectSaebSectionClass, `${testCase.path} ${navName}: SAEB is-section-active mismatch`);
      assert.ok(!(/aria-current="page"/.test(saebAttrs) && /class="is-section-active"/.test(saebAttrs)), `${testCase.path} ${navName}: SAEB must not carry both aria-current="page" and is-section-active`);

      // "Resultados por escola" duplicates the parent SAEB link's href (/saeb) — it must never
      // carry aria-current="page" itself, even when /saeb is the current page, to avoid a second
      // "current" element pointing at the same destination.
      const resultadosMatch = nav.match(/<a href="\/saeb"[^>]*>Resultados por escola<\/a>/);
      assert.ok(resultadosMatch, `${testCase.path} ${navName}: "Resultados por escola" submenu item not found`);
      assert.doesNotMatch(resultadosMatch[0], /aria-current="page"/, `${testCase.path} ${navName}: "Resultados por escola" must never carry aria-current`);

      const currentPageCount = (nav.match(/aria-current="page"/g) ?? []).length;
      const expectedCount =
        (testCase.expectBnccPage ? 1 : 0) +
        (testCase.expectedSubmenuPageHref ? 1 : 0) +
        (expectSaebPage ? 1 : 0) +
        (expectedSaebSubmenuPageHref ? 1 : 0) +
        (SIMPLE_CURRENT_ROUTES.includes(testCase.path) ? 1 : 0);
      assert.equal(currentPageCount, expectedCount, `${testCase.path} ${navName}: expected exactly ${expectedCount} aria-current="page" element(s), found ${currentPageCount}`);

      // Each simple route's own link carries aria-current="page" only when it's the current path.
      for (const route of SIMPLE_CURRENT_ROUTES) {
        const linkMatch = nav.match(new RegExp(`<a href="${route.replace(/\//g, "\\/")}"([^>]*)>SARESP</`));
        assert.ok(linkMatch, `${testCase.path} ${navName}: SARESP link not found`);
        assert.equal(/aria-current="page"/.test(linkMatch[1]), route === testCase.path, `${testCase.path} ${navName}: SARESP aria-current="page" mismatch`);
      }

      if (testCase.expectedSubmenuPageHref) {
        assert.match(nav, new RegExp(`<a href="${testCase.expectedSubmenuPageHref.replace(/\//g, "\\/")}" aria-current="page"`), `${testCase.path} ${navName}: expected BNCC submenu link to carry aria-current="page"`);
      }
      if (expectedSaebSubmenuPageHref) {
        assert.match(nav, new RegExp(`<a href="${expectedSaebSubmenuPageHref.replace(/\//g, "\\/")}" aria-current="page"`), `${testCase.path} ${navName}: expected SAEB submenu link to carry aria-current="page"`);
      }
    }
  });
}

// ---- 4. Hero: menciona BNCC/SAEB/SARESP, três destinos claros, sem CTA ambíguo ----

test("the Hero mentions BNCC, SAEB and SARESP, and offers three unambiguous destinations", () => {
  const heroSection = homeHtml.match(/<section class="hero"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(heroSection, "hero section not found");
  assert.match(heroSection, />BNCC<\/span>/);
  assert.match(heroSection, />SAEB<\/span>/);
  assert.match(heroSection, />SARESP<\/span>/);

  // CTA principal: nunca escolhe entre SAEB e SARESP por si só, e o texto
  // descreve a própria seleção de ferramentas (#acessos), não uma consulta
  // direta — a seção oferece BNCC, matrizes, SAEB e SARESP, não um resultado.
  assert.match(heroSection, /href="#acessos"[^>]*>Escolher uma consulta/);
  assert.doesNotMatch(heroSection, />Consultar resultados por escola</, "the primary CTA must not promise a direct results lookup for a section that offers four different tools");
  // CTA secundário: BNCC, sem ambiguidade.
  assert.match(heroSection, /href="\/bncc">Consultar a BNCC<\/a>/);
  // Terceiro link: acesso direto e visível à matriz do SAEB, já no hero.
  assert.match(heroSection, /href="\/saeb\/matriz"[^>]*>Ver matrizes do SAEB/);

  assert.doesNotMatch(heroSection, />Ver avaliações externas</);
  assert.doesNotMatch(heroSection, /Dados educacionais que fazem sentido/);
});

test("the hero's tertiary link ('Ver matrizes do SAEB') is self-sufficient and no longer depends on the removed .text-link class", () => {
  const heroSection = homeHtml.match(/<section class="hero"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(heroSection, "hero section not found");
  assert.match(heroSection, /class="hero-tertiary" href="\/saeb\/matriz"/);
  assert.doesNotMatch(heroSection, /class="text-link hero-tertiary"/, "hero-tertiary must not depend on the global .text-link class removed with DashboardPreview");
});

test("the Hero's trust line only states claims confirmed elsewhere in the published project (gratuito, sem cadastro)", () => {
  const heroSection = homeHtml.match(/<section class="hero"[^]*?<\/section>/)?.[0] ?? "";
  assert.match(heroSection, /Gratuito · Sem cadastro · Fontes identificadas/);
});

// ---- 5. Acessos principais aparecem logo após o hero, antes da busca ----

test("the four primary access cards render immediately after the hero, before the BNCC search section", () => {
  const heroIndex = homeHtml.indexOf('<section class="hero"');
  const accessIndex = homeHtml.indexOf("O que você quer consultar?");
  const searchIndex = homeHtml.indexOf("Buscar na BNCC");
  assert.ok(heroIndex > -1, "hero section not found");
  assert.ok(accessIndex > -1, "quick-access section not found");
  assert.ok(searchIndex > -1, "search section not found");
  assert.ok(heroIndex < accessIndex, "hero should render before the quick-access grid");
  assert.ok(accessIndex < searchIndex, "the four primary tasks should render before the BNCC search section");
});

// ---- 6 & 7. Quatro cartões principais, destinos corretos, nunca misturados com as etapas ----

test("exactly the four primary access cards are present, each with the correct destination, never mixed with the BNCC etapas", () => {
  const accessSection = homeHtml.match(/<section class="section quick-access"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(accessSection, "quick-access section not found");

  for (const card of PRIMARY_ACCESS_CARDS) {
    const pattern = new RegExp(`href="${card.href.replace(/\//g, "\\/")}"[^>]*>[^]*?<h3>${card.title}</h3>`);
    assert.match(accessSection, pattern, `missing card for ${card.title} -> ${card.href}`);
  }
  const accessCardCount = (accessSection.match(/class="access-card"/g) ?? []).length;
  assert.equal(accessCardCount, 4, "expected exactly 4 access-card elements on the homepage");

  // As etapas da BNCC vivem numa navegação secundária e compacta (.etapa-link),
  // nunca como um quinto/sexto access-card na mesma grade.
  for (const etapa of ETAPA_LINKS) {
    assert.doesNotMatch(accessSection, new RegExp(`class="access-card" href="${etapa.href.replace(/\//g, "\\/")}"`), `${etapa.title} must not be an access-card`);
    assert.match(accessSection, new RegExp(`class="etapa-link" href="${etapa.href.replace(/\//g, "\\/")}"[^>]*>\\s*${etapa.title}`), `missing compact etapa link for ${etapa.title}`);
  }
  const etapaLinkCount = (accessSection.match(/class="etapa-link"/g) ?? []).length;
  assert.equal(etapaLinkCount, 4, "expected exactly 4 compact etapa links");
});

test("the SAEB primary card describes only what's implemented, never descriptors, proficiency levels, territorial comparisons or export", () => {
  const card = homeHtml.match(/<a class="access-card" href="\/saeb">[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(card, "SAEB access-card not found");
  assert.match(card, /<h3>Consultar resultados do SAEB<\/h3>/);
  assert.match(card, /município/i);
  assert.match(card, /escola/i);
  assert.doesNotMatch(card, /descritor/i);
  assert.doesNotMatch(card, /n[íi]vel de profici[êe]ncia/i);
  assert.doesNotMatch(card, /compara(ç|c)[ãa]o territorial|munic[íi]pio, .*UF|Brasil\b/i);
  assert.doesNotMatch(card, /exportar|exporta[çc][ãa]o/i);
  assert.doesNotMatch(card, /Em breve/);
});

test("the SAEB matriz card exists as its own primary access, distinct from the SAEB results card", () => {
  const card = homeHtml.match(/<a class="access-card" href="\/saeb\/matriz">[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(card, "SAEB matriz access-card not found");
  assert.match(card, /<h3>Consultar matrizes do SAEB<\/h3>/);
  assert.match(card, /matriz tradicional/i);
  assert.match(card, /alinhada à BNCC/i);
});

test("no card is marked 'Em breve', and no disabled-card markers remain on the homepage", () => {
  assert.doesNotMatch(homeHtml, /Em breve/);
  assert.doesNotMatch(homeHtml, /access-card-soon/);
  assert.doesNotMatch(homeHtml, /aria-disabled/);
  assert.doesNotMatch(homeHtml, /BNCC \+ SAEB/);
});

test("the future-vision sections (DataFlow, DashboardPreview) were removed — no fake dashboard, no flow-section, no dashboard-section, no demonstrative data closes the homepage", () => {
  assert.doesNotMatch(homeHtml, /class="section flow-section"/);
  assert.doesNotMatch(homeHtml, /class="section dashboard-section"/);
  assert.doesNotMatch(homeHtml, /Da habilidade ao resultado/);
  assert.doesNotMatch(homeHtml, /Dados mais fáceis de interpretar/);
  assert.doesNotMatch(homeHtml, /Indicador ilustrativo|Evolução demonstrativa|Escola demonstrativa/);
  assert.doesNotMatch(homeHtml, /Dados demonstrativos/i);

  // O que as substitui é uma única faixa compacta, claramente secundária, dentro
  // do próprio bloco de confiança — nunca uma seção própria com grade ou números.
  const trustSection = homeHtml.match(/<section class="section trust-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(trustSection, "trust section not found");
  assert.match(trustSection, /class="roadmap-note"/);
  assert.match(trustSection, /Em desenvolvimento:/);
  const roadmapParagraphCount = (trustSection.match(/class="roadmap-note"/g) ?? []).length;
  assert.equal(roadmapParagraphCount, 1, "expected exactly one compact roadmap note, never a full section");
});

test("the trust section's source badges are static (never styled or marked as links) and the authorship line links only 'Conheça a proposta'", () => {
  const trustSection = homeHtml.match(/<section class="section trust-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(trustSection, "trust section not found");

  const chips = trustSection.match(/<div class="source-chips"[^]*?<\/div>/)?.[0] ?? "";
  assert.ok(chips, "source-chips block not found");
  for (const source of ["BNCC", "INEP", "SAEB", "SARESP"]) {
    assert.match(chips, new RegExp(`<span>${source}</span>`), `${source} badge should be a plain, static <span>`);
  }
  assert.doesNotMatch(chips, /<a /, "source badges must never be rendered as links");
  assert.doesNotMatch(chips, /svg/i, "source badges must not carry an ExternalLink icon that implies they're clickable");

  // A autoria linka apenas "Conheça a proposta" para /sobre — nunca expõe a
  // URL como texto visível, e nunca deixa o link do meio da frase ambíguo.
  assert.match(trustSection, /<a href="\/sobre">Conheça a proposta<\/a>/);
  assert.doesNotMatch(trustSection, />\/sobre</, "/sobre must never appear as visible link text");
});

test("'.trust-copy a' has its own visible link styling, independent of hover, and never falls back to inherited/invisible link color", () => {
  const css = readFileSync(new URL("../app/globals.css", import.meta.url), "utf-8");
  const rule = css.match(/\.trust-copy a\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(rule, "'.trust-copy a' rule not found in globals.css — the authorship link would fall back to the global 'a { color: inherit; text-decoration: none; }' and be visually indistinguishable from plain text");
  assert.match(rule, /color:\s*var\(--color-link-strong\)/);
  assert.match(rule, /text-decoration:\s*underline/);
  assert.doesNotMatch(rule, /!important/);

  const hoverRule = css.match(/\.trust-copy a:hover\s*\{[^}]*\}/)?.[0] ?? "";
  assert.ok(hoverRule, "'.trust-copy a:hover' rule not found");
  assert.match(hoverRule, /color:\s*var\(--navy\)/);

  // A correção é local a .trust-copy — nunca restaura a classe global .text-link
  // removida nesta rodada, nem estiliza outros links do site.
  assert.doesNotMatch(css, /\.text-link\s*\{/, ".text-link must not be restored as a global class");
});

// ---- 8. Página 404 genérica ----

test("the global 404 page is neutral and never mentions 'habilidade' or 'código'", async () => {
  const response = await render("/uma-rota-que-nao-existe-em-lugar-nenhum");
  assert.equal(response.status, 404);
  const html = await response.text();
  assert.match(html, /Página não encontrada\./);
  assert.match(html, /Não encontramos o endereço que você tentou acessar\./);
  assert.doesNotMatch(html, /habilidade/i);
  assert.doesNotMatch(html, /código informado/i);
  assert.match(html, /href="\/bncc"/);
  assert.match(html, /href="\/"/);
});

// ---- 9. Skip link ----

test("a skip link to #main-content is the first link rendered on every page", () => {
  const skipMatch = homeHtml.match(/<a class="skip-link" href="#main-content">([^<]+)<\/a>/);
  assert.ok(skipMatch, "skip link not found");
  assert.equal(skipMatch[1], "Pular para o conteúdo");
  // It must come before the header's own first link in source order (first focusable element).
  assert.ok(homeHtml.indexOf(skipMatch[0]) < homeHtml.indexOf("<header"));
});

// ---- 10. Exatamente um #main-content por família de página ----

test("every page family has exactly one #main-content landmark, and the skip link is present on each", async () => {
  const paths = ["/", "/bncc/matematica", "/saresp", "/privacidade", "/rota-inexistente-para-o-404"];
  for (const path of paths) {
    const response = await render(path);
    const html = await response.text();
    const mainContentCount = (html.match(/id="main-content"/g) ?? []).length;
    assert.equal(mainContentCount, 1, `${path} should have exactly one #main-content, found ${mainContentCount}`);
    assert.match(html, /<a class="skip-link" href="#main-content">/, `${path} is missing the skip link`);
  }
});

// ---- 11. Feedback de "nenhuma escola encontrada" no SARESP ----

// ---- 12. Sugestões de busca representam componentes variados da BNCC ----

test("the homepage search examples represent varied BNCC subjects", () => {
  const searchSection = homeHtml.match(/<section class="section search-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(searchSection, "search section not found");

  const examples = ["Língua Portuguesa", "Ciências", "História", "Geografia"];
  for (const example of examples) {
    const encoded = encodeURIComponent(example).replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(searchSection, new RegExp(`href="/bncc\\?q=${encoded}"[^>]*>${example}</a>`));
  }

  assert.doesNotMatch(searchSection, />EF07MA18<|>Equações<|>Frações<|>Matemática 8º ano</);
});

// ---- Busca honesta: título, form e placeholder nunca prometem matriz/descritor/avaliação ----

test("the search is honestly scoped to the BNCC: title, form and placeholder never promise matrices, descritores or avaliações", () => {
  const searchSection = homeHtml.match(/<section class="section search-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(searchSection, "search section not found");

  assert.match(searchSection, /class="section-kicker">Buscar na BNCC</);
  assert.match(searchSection, /<h2>Busque habilidades da BNCC\.<\/h2>/);

  const form = searchSection.match(/<form[^>]*>[^]*?<\/form>/)?.[0] ?? "";
  assert.ok(form, "search form not found");
  assert.match(form, /action="\/bncc"/, "search form must keep action=\"/bncc\"");
  assert.match(form, /method="get"/, "search form must keep method=\"get\" (GET, no JS required)");

  const placeholder = form.match(/placeholder="([^"]*)"/)?.[1] ?? "";
  assert.ok(placeholder, "search input is missing a placeholder");
  assert.doesNotMatch(placeholder, /matriz/i);
  assert.doesNotMatch(placeholder, /descritor/i);
  assert.doesNotMatch(placeholder, /avalia[çc][ãa]o/i);

  assert.doesNotMatch(searchSection, /Uma única busca para navegar por habilidades, matrizes, disciplinas, anos e avalia[çc][õo]es/);
  assert.match(searchSection, /Pesquise por habilidade, componente curricular ou etapa na base oficial da BNCC\./);
});

test("the homepage uses one shared content rail across its principal sections", () => {
  assert.match(homeHtml, /<main id="main-content" class="home-page">/);
  assert.equal(
    (homeHtml.match(/class="container home-rail(?: [^"]*)?"/g) ?? []).length,
    4,
    "Hero, quick access, search and trust must share the same content rail — DataFlow/DashboardPreview no longer exist",
  );
  assert.match(homeHtml, /class="container home-rail search-layout"/);
  assert.doesNotMatch(homeHtml, /home-rail dashboard-layout/);
});

// ---- 13. Acesso à consulta SAEB pela home é navegação, não busca ----

test("the homepage's SAEB access point is a real navigation link, not a BNCC search shortcut and not a mobile menu link left open", () => {
  const searchSection = homeHtml.match(/<section class="section search-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(searchSection, "search section not found");
  // SAEB has its own route and must not be presented as a BNCC search example.
  assert.doesNotMatch(searchSection, />SAEB</);

  // The SAEB quick-access card uses a plain <a href="/saeb">, not a <form>/query-string search.
  const card = homeHtml.match(/<a class="access-card" href="\/saeb">[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(card, "SAEB access-card not found");
  assert.doesNotMatch(card, /<form/);
});

// ---- 14. Rodapé inclui SAEB junto de SARESP ----

test("the Footer's tools navigation includes SAEB right after SARESP, following the existing pattern", () => {
  const footerBlock = homeHtml.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
  assert.ok(footerBlock, "missing <footer>");
  const nav = footerBlock.match(/<nav aria-label="Navegação do rodapé">[^]*?<\/nav>/)?.[0] ?? "";
  assert.ok(nav, "missing footer nav");
  assert.match(nav, /<a href="\/saresp">SARESP<\/a>\s*<a href="\/saeb">SAEB<\/a>/);
});

// ---- 14. Seção de acesso rápido reflete o novo total (Rodada 20: 4 tarefas, não 6 cartões misturados) ----

test("the quick-access section heading reflects four primary tools, never the retired six-card count", () => {
  const accessSection = homeHtml.match(/<section class="section quick-access"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(accessSection, "quick-access section not found");
  assert.match(accessSection, /Quatro ferramentas disponíveis agora/);
  assert.doesNotMatch(homeHtml, /Seis recursos disponíveis agora/);
  assert.doesNotMatch(homeHtml, /Cinco recursos disponíveis agora/);
});

// ---- 15. Recursos do hero (HeroPlatformPreview) são links reais, sem dado fictício ----

test("the hero's 'Disponível agora' panel lists the four real tools as actual links, with no chart or demonstrative value", () => {
  const heroSection = homeHtml.match(/<section class="hero"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(heroSection, "hero section not found");
  assert.match(heroSection, /class="preview-label"/);
  assert.match(heroSection, />Disponível agora</);

  for (const link of PRIMARY_ACCESS_CARDS) {
    assert.match(heroSection, new RegExp(`class="preview-link-item" href="${link.href.replace(/\//g, "\\/")}"`), `missing real preview link for ${link.href}`);
  }
  const previewLinkCount = (heroSection.match(/class="preview-link-item"/g) ?? []).length;
  assert.equal(previewLinkCount, 4, "expected exactly 4 real preview links");

  // Nada que possa ser confundido com dado oficial: sem gráfico de barras ilustrativo,
  // sem valor numérico fictício, sem aviso de "dados demonstrativos" nesta prévia.
  assert.doesNotMatch(heroSection, /mini-bars|insight-panel|skill-panel|matrix-panel/);
  assert.doesNotMatch(heroSection, /Demonstração visual|Dados demonstrativos/i);
});

test("SARESP's 'no school found' copy is still present in the component, and a nonsense query genuinely produces zero matches against the real index", () => {
  // This state only exists after client-side interaction (typing into the school filter), so it
  // can't be reached through a plain SSR fetch — the two checks below are the closest equivalent
  // to "verificar o HTML renderizado" available without driving a real browser in this suite:
  // (a) confirm the exact copy is still in the component that renders it, and (b) confirm, against
  // the real production school index, that a nonsense query actually yields the empty-match
  // condition that copy is gated on (hasSchoolQuery && !hasMatches).
  const source = readFileSync(new URL("../app/saresp/components/SarespReport.tsx", import.meta.url), "utf-8");
  assert.match(source, /Nenhuma escola encontrada para/);
  assert.match(source, /hasSchoolQuery && !hasMatches/);

  const searchable = schoolsIndex.map((entry) => withSearchKey(entry, schoolsAliases));
  const matches = matchSchoolIndex(searchable, normalizeSearch("zzzznenhumaescolapossuiestenome"));
  assert.equal(matches.length, 0, "expected a nonsense query to match zero real schools");
});
