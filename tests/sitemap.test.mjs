import assert from "node:assert/strict";
import test from "node:test";
import { uniqueSorted } from "../lib/bncc/search.mjs";

const BASE_URL = "https://tempodocente.com.br";

// Mirrors the componente → dataset mapping in lib/bncc/data.ts (COMPONENTES_ANOS_FINAIS),
// but reads the raw JSON directly so this test doesn't depend on the same code
// it's meant to catch regressions in.
const FUNDAMENTAL_COMPONENTES = [
  { slug: "matematica", datasets: ["matematica-anos-iniciais", "matematica-anos-finais"] },
  { slug: "lingua-portuguesa", datasets: ["lingua-portuguesa-anos-iniciais", "lingua-portuguesa-anos-finais"] },
  { slug: "arte", datasets: ["arte-anos-iniciais", "arte-anos-finais"] },
  { slug: "educacao-fisica", datasets: ["educacao-fisica-anos-iniciais", "educacao-fisica-anos-finais"] },
  { slug: "lingua-inglesa", datasets: ["lingua-inglesa-anos-finais"] },
  { slug: "ciencias", datasets: ["ciencias-anos-iniciais", "ciencias-anos-finais"] },
  { slug: "geografia", datasets: ["geografia-anos-iniciais", "geografia-anos-finais"] },
  { slug: "historia", datasets: ["historia-anos-iniciais", "historia-anos-finais"] },
  { slug: "ensino-religioso", datasets: ["ensino-religioso-anos-iniciais", "ensino-religioso-anos-finais"] },
];

const ENSINO_MEDIO_AREAS = ["linguagens", "lingua-portuguesa", "matematica", "ciencias-da-natureza", "ciencias-humanas"];

const ALL_DATASET_FILES = [
  ...FUNDAMENTAL_COMPONENTES.flatMap((componente) => componente.datasets),
  ...ENSINO_MEDIO_AREAS.map((slug) => `ensino-medio-${slug}`),
  "competencias-gerais",
];

async function loadDataset(name) {
  return (await import(`../data/bncc/${name}.json`, { with: { type: "json" } })).default;
}

async function fetchSitemapXml() {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request("http://localhost/sitemap.xml", { headers: { accept: "application/xml" } }),
    {
      ASSETS: {
        fetch: async () => new Response("Not found", { status: 404 }),
      },
    },
    {
      waitUntil() {},
      passThroughOnException() {},
    },
  );
}

function extractLocs(xml) {
  return [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]);
}

async function fundamentalYearsFor({ datasets }) {
  const skills = (await Promise.all(datasets.map(loadDataset))).flatMap((dataset) => dataset.registros);
  return uniqueSorted(skills.flatMap((skill) => skill.anos_aplicaveis ?? [skill.ano]));
}

async function expectedCodeSet() {
  const datasets = await Promise.all(ALL_DATASET_FILES.map(loadDataset));
  return new Set(
    datasets
      .flatMap((dataset) => dataset.registros)
      .filter((registro) => registro.codigo)
      .map((registro) => registro.codigo.toLowerCase()),
  );
}

const response = await fetchSitemapXml();
const xml = await response.text();
const locs = extractLocs(xml);

test("sitemap.xml is served with a 200 and an XML content type", () => {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /xml/i);
});

test("includes the core public routes", () => {
  const expected = ["", "/bncc", "/bncc/competencias-gerais", "/bncc/ensino-fundamental", "/bncc/ensino-medio", "/saresp"];
  for (const route of expected) {
    assert.ok(locs.includes(`${BASE_URL}${route}`), `missing ${route}`);
  }
});

test("includes every Ensino Fundamental componente hub page", () => {
  for (const { slug } of FUNDAMENTAL_COMPONENTES) {
    assert.ok(locs.includes(`${BASE_URL}/bncc/${slug}`), `missing /bncc/${slug}`);
  }
});

test("includes every Ensino Médio área page", () => {
  for (const slug of ENSINO_MEDIO_AREAS) {
    assert.ok(locs.includes(`${BASE_URL}/bncc/ensino-medio/${slug}`), `missing /bncc/ensino-medio/${slug}`);
  }
});

test("includes a page for every year each Ensino Fundamental componente actually covers", async () => {
  for (const componente of FUNDAMENTAL_COMPONENTES) {
    const years = await fundamentalYearsFor(componente);
    assert.ok(years.length > 0, `${componente.slug} has no years`);
    for (const year of years) {
      const expectedUrl = `${BASE_URL}/bncc/${componente.slug}/${year[0]}-ano`;
      assert.ok(locs.includes(expectedUrl), `missing ${expectedUrl}`);
    }
  }
});

test("does not include year pages a componente doesn't cover (Língua Inglesa has no Anos Iniciais)", () => {
  for (const year of ["1", "2", "3", "4", "5"]) {
    assert.ok(!locs.includes(`${BASE_URL}/bncc/lingua-inglesa/${year}-ano`));
  }
});

test("includes a detail page for every BNCC registro (Fundamental and Médio) that has a código", async () => {
  const expectedCodes = await expectedCodeSet();
  assert.ok(expectedCodes.size > 0);
  for (const code of expectedCodes) {
    assert.ok(locs.includes(`${BASE_URL}/bncc/${code}`), `missing /bncc/${code}`);
  }

  const sitemapCodeUrls = locs.filter((loc) => /^https:\/\/tempodocente\.com\.br\/bncc\/(ef|em13)[a-z0-9]+$/.test(loc));
  assert.equal(sitemapCodeUrls.length, expectedCodes.size);
});

test("has no duplicate URLs", () => {
  assert.equal(new Set(locs).size, locs.length);
});

test("every URL uses the canonical domain, a valid path, no query string and no fragment", () => {
  assert.ok(locs.length > 0);
  for (const loc of locs) {
    assert.ok(loc === BASE_URL || loc.startsWith(`${BASE_URL}/`), `unexpected origin: ${loc}`);
    assert.ok(!loc.includes("?"), `has query params: ${loc}`);
    assert.ok(!loc.includes("#"), `has fragment: ${loc}`);
    assert.match(loc.slice(BASE_URL.length), /^$|^\/[a-z0-9/-]+$/, `unexpected path shape: ${loc}`);
  }
});

test("does not include routes for unimplemented ('Em breve') or non-page functionality", () => {
  const disallowedFragments = [
    "/bncc/educacao-infantil",
    "/saeb",
    "/ia",
    "/login",
    "/planejamento",
    "/atividades",
    "/avaliacoes",
    "/dados",
    "/busca",
    "/search",
  ];
  for (const fragment of disallowedFragments) {
    assert.ok(!locs.some((loc) => loc.includes(fragment)), `unexpectedly found ${fragment}`);
  }
});

test("total URL count matches exactly what the current BNCC/SARESP data supports", async () => {
  const staticRouteCount =
    1 + // home
    1 + // /bncc
    1 + // /bncc/competencias-gerais
    1 + // /bncc/ensino-fundamental
    1 + // /bncc/ensino-medio
    1 + // /saresp
    FUNDAMENTAL_COMPONENTES.length; // one hub page per componente

  let yearPageCount = 0;
  for (const componente of FUNDAMENTAL_COMPONENTES) {
    yearPageCount += (await fundamentalYearsFor(componente)).length;
  }

  const expectedCodes = await expectedCodeSet();
  const expectedTotal = staticRouteCount + yearPageCount + ENSINO_MEDIO_AREAS.length + expectedCodes.size;

  assert.equal(locs.length, expectedTotal);
});
