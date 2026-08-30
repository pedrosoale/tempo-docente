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

const REAL_CARDS = [
  { title: "Educação Infantil", href: "/bncc/educacao-infantil" },
  { title: "Ensino Fundamental", href: "/bncc/ensino-fundamental" },
  { title: "Ensino Médio", href: "/bncc/ensino-medio" },
  { title: "Competências Gerais", href: "/bncc/competencias-gerais" },
  { title: "SARESP", href: "/saresp" },
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

test("Header and Footer only link to real destinations (/, /bncc, /saresp, /sobre, and the four BNCC submenu pages)", () => {
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
];

for (const testCase of ARIA_CURRENT_CASES) {
  test(`aria-current ${testCase.describe} (${testCase.path}): exactly one current element, never a duplicate`, async () => {
    const response = await render(testCase.path);
    assert.equal(response.status, 200, `${testCase.path} should render 200`);
    const html = await response.text();
    const { desktop, mobile } = extractNavBlocks(html);
    assert.ok(desktop, `${testCase.path}: missing desktop nav block`);
    assert.ok(mobile, `${testCase.path}: missing mobile nav block`);

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

      const currentPageCount = (nav.match(/aria-current="page"/g) ?? []).length;
      const expectedCount = testCase.expectBnccPage || testCase.expectedSubmenuPageHref || testCase.path === "/saresp" ? 1 : 0;
      assert.equal(currentPageCount, expectedCount, `${testCase.path} ${navName}: expected exactly ${expectedCount} aria-current="page" element(s), found ${currentPageCount}`);

      if (testCase.expectedSubmenuPageHref) {
        assert.match(nav, new RegExp(`<a href="${testCase.expectedSubmenuPageHref.replace(/\//g, "\\/")}" aria-current="page"`), `${testCase.path} ${navName}: expected submenu link to carry aria-current="page"`);
      }
    }
  });
}

// ---- 4. CTA secundário do Hero aponta para /saresp ----

test("the Hero's secondary CTA points to /saresp", () => {
  assert.match(homeHtml, /href="\/saresp">Consultar o SARESP<\/a>/);
  assert.doesNotMatch(homeHtml, />Ver avaliações externas</);
});

// ---- 5. Busca aparece antes dos acessos principais ----

test("the BNCC search section appears before the 'acesso rápido' cards in the homepage HTML", () => {
  const searchIndex = homeHtml.indexOf("Busca na base oficial da BNCC");
  const accessIndex = homeHtml.indexOf("O que você quer consultar?");
  assert.ok(searchIndex > -1, "search section not found");
  assert.ok(accessIndex > -1, "quick-access section not found");
  assert.ok(searchIndex < accessIndex, "search should render before the quick-access grid");
});

// ---- 6 & 7. Cinco cartões reais, destinos corretos, nenhum "Em breve" ----

test("exactly the five real cards are present, each with the correct destination", () => {
  for (const card of REAL_CARDS) {
    const pattern = new RegExp(`href="${card.href.replace(/\//g, "\\/")}"[^>]*>[^]*?<h3>${card.title}</h3>`);
    assert.match(homeHtml, pattern, `missing card for ${card.title} -> ${card.href}`);
  }
  const accessCardCount = (homeHtml.match(/class="access-card"/g) ?? []).length;
  assert.equal(accessCardCount, 5, "expected exactly 5 access-card elements on the homepage");
});

test("no real card is marked 'Em breve', and no disabled-card markers remain on the homepage", () => {
  assert.doesNotMatch(homeHtml, /Em breve/);
  assert.doesNotMatch(homeHtml, /access-card-soon/);
  assert.doesNotMatch(homeHtml, /aria-disabled/);
  assert.doesNotMatch(homeHtml, /BNCC \+ SAEB/);
});

test("the Ensino Médio card says 'Formação Geral Básica', never the retired 'série' label", () => {
  // /bncc/ensino-medio also appears in the Header dropdown, mobile accordion and Footer, so the
  // card itself is isolated first (no nested <a> inside an access-card) before asserting on it.
  const card = homeHtml.match(/<a class="access-card" href="\/bncc\/ensino-medio">[^]*?<\/a>/)?.[0] ?? "";
  assert.ok(card, "Ensino Médio access-card not found");
  assert.match(card, /class="access-label">Formação Geral Básica</, "missing the 'Formação Geral Básica' label");
  assert.match(card, /<h3>Ensino Médio<\/h3>/);
  assert.match(card, /sem recorte por série/, "description should still explain there's no recorte by série");
  assert.match(card, /Explorar áreas/, "action text should be unchanged");
  assert.doesNotMatch(card, /1ª à 3ª série/, "the retired 'série' label must not reappear");
  assert.doesNotMatch(homeHtml, /1ª à 3ª série/, "the retired label must not reappear anywhere on the page");
});

test("the future-vision sections (DataFlow, DashboardPreview) are clearly labeled 'No roteiro' and not mixed into the quick-access grid", () => {
  const accessSection = homeHtml.match(/<section class="section quick-access"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(accessSection, "quick-access section not found");
  assert.doesNotMatch(accessSection, /No roteiro/);

  // Text content (unlike class names/attributes) gets serialized twice in this framework's SSR
  // output — once rendered, once in the embedded RSC hydration payload — so exact-count assertions
  // on visible copy are checked per structural container instead of as a whole-page total.
  const flowSection = homeHtml.match(/<section class="section flow-section"[^]*?<\/section>/)?.[0] ?? "";
  const dashboardSection = homeHtml.match(/<section class="section dashboard-section"[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(flowSection, "flow-section not found");
  assert.ok(dashboardSection, "dashboard-section not found");
  assert.match(flowSection, /No roteiro/);
  assert.match(dashboardSection, /No roteiro/);
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
