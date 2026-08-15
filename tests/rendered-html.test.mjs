import assert from "node:assert/strict";
import test from "node:test";

async function render(path = "/") {
  const workerUrl = new URL("../dist/server/index.js", import.meta.url);
  workerUrl.searchParams.set("test", `${process.pid}-${Date.now()}`);
  const { default: worker } = await import(workerUrl.href);

  return worker.fetch(
    new Request(`http://localhost${path}`, {
      headers: { accept: "text/html" },
    }),
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

test("server-renders the Tempo Docente homepage", async () => {
  const response = await render();
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);

  const html = await response.text();
  assert.match(html, /<html lang="pt-BR">/i);
  assert.match(html, /<title>Tempo Docente \| Dados, planejamento e inteligência para a educação<\/title>/i);
  assert.match(html, /Dados educacionais que fazem sentido para quem ensina\./);
  assert.match(html, /O que você quer consultar\?/);
  assert.match(html, /Dados mais fáceis de interpretar\./);
  assert.match(html, /Dados demonstrativos/i);
  assert.doesNotMatch(html, /codex-preview|Your site is taking shape|react-loading-skeleton/i);
});

test("includes semantic navigation and source transparency", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /aria-label="Navegação principal"/);
  assert.match(html, /role="search"/);
  assert.match(html, /Busca na base oficial da BNCC/i);
  assert.match(html, /Informação educacional com fonte identificada\./);
  assert.match(html, /BNCC/);
  assert.match(html, /INEP/);
  assert.match(html, /SAEB/);
  assert.match(html, /SARESP/);
});

test("server-renders the SARESP report shell", async () => {
  const response = await render("/saresp");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Relatório SARESP — 2024 x 2025/);
  // SarespReport is a client component that fetches its dataset on mount, so the
  // server-rendered shell only reflects the initial (loading) state, not the report content.
  assert.match(html, /Carregando dados do SARESP/);
});

test("server-renders the BNCC hub with all four etapa cards, Ensino Médio now active", async () => {
  const response = await render("/bncc");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Consulte a BNCC/);
  assert.match(html, /Competências Gerais/);
  assert.match(html, /Educação Infantil/);
  assert.match(html, /Ensino Fundamental/);
  assert.match(html, /Ensino Médio/);
  assert.match(html, /href="\/bncc\/ensino-medio"/);
  // Educação Infantil is still the only "Em breve" card on this hub.
  assert.match(html, /Em breve/);
});

test("server-renders the Competências Gerais page with official text", async () => {
  const response = await render("/bncc/competencias-gerais");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Competências Gerais da Educação Básica/);
  assert.match(html, /Valorizar e utilizar os conhecimentos historicamente construídos/);
  assert.match(html, /Agir pessoal e coletivamente com autonomia/);
  assert.match(html, /id="competencia-1"/);
  assert.match(html, /Ministério da Educação/);
});

test("server-renders the BNCC Matemática explorer and official dataset", async () => {
  const response = await render("/bncc/matematica");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Matemática/);
  assert.match(html, /247 habilidades/);
  assert.match(html, /EF06MA01/);
  assert.match(html, /EF01MA01/);
  assert.match(html, /Dados oficiais/);
  assert.match(html, /Ministério da Educação/);
});

test("server-renders the Ensino Fundamental hub with all nine components", async () => {
  const response = await render("/bncc/ensino-fundamental");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC — Ensino Fundamental/);
  for (const slug of ["matematica", "lingua-portuguesa", "arte", "educacao-fisica", "lingua-inglesa", "ciencias", "geografia", "historia", "ensino-religioso"]) {
    assert.match(html, new RegExp(`href="/bncc/${slug}"`), `missing link to ${slug}`);
  }
});

test("server-renders the Ensino Médio hub with all five imported scopes", async () => {
  const response = await render("/bncc/ensino-medio");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC — Ensino Médio/);
  for (const slug of ["linguagens", "lingua-portuguesa", "matematica", "ciencias-da-natureza", "ciencias-humanas"]) {
    assert.match(html, new RegExp(`href="/bncc/ensino-medio/${slug}"`), `missing link to ${slug}`);
  }
  // React SSR inserts an <!-- --> comment between the {count} expression and
  // the literal " habilidades" text since they're separate JSX children —
  // \D* tolerates that instead of assuming they're textually adjacent.
  assert.match(html, /28\D*habilidades/);
  assert.match(html, /54\D*habilidades/);
  assert.match(html, /43\D*habilidades/);
});

test("server-renders the BNCC Linguagens e suas Tecnologias (Ensino Médio) explorer and official dataset", async () => {
  const response = await render("/bncc/ensino-medio/linguagens");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Linguagens e suas Tecnologias/);
  assert.match(html, /28 habilidades/);
  assert.match(html, /EM13LGG101/);
  assert.match(html, /id="competencia-1"/);
  assert.match(html, /Ministério da Educação/);
});

test("server-renders EM13LGG101 detail with Ensino Médio breadcrumb and competência específica instead of ano", async () => {
  const response = await render("/bncc/em13lgg101");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EM13LGG101/);
  assert.match(html, /href="\/bncc\/ensino-medio"/);
  assert.match(html, /href="\/bncc\/ensino-medio\/linguagens"/);
  assert.match(html, /Competência específica/);
  assert.doesNotMatch(html, /<dt>Ano<\/dt>/);
});

test("server-renders the BNCC Matemática (Ensino Médio) explorer with unidade temática", async () => {
  const response = await render("/bncc/ensino-medio/matematica");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Matemática e suas Tecnologias/);
  assert.match(html, /43 habilidades/);
  assert.match(html, /EM13MAT101/);
});

test("server-renders EM13MAT101 detail with its unidade temática from the official cross-reference table", async () => {
  const response = await render("/bncc/em13mat101");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EM13MAT101/);
  assert.match(html, /Unidade temática/);
  assert.match(html, /Números e álgebra/);
});

test("server-renders the BNCC Ciências da Natureza (Ensino Médio) explorer", async () => {
  const response = await render("/bncc/ensino-medio/ciencias-da-natureza");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Ciências da Natureza e suas Tecnologias/);
  assert.match(html, /26 habilidades/);
  assert.match(html, /EM13CNT101/);
});

test("server-renders the BNCC Ciências Humanas (Ensino Médio) explorer with the ligature typography fix applied", async () => {
  const response = await render("/bncc/ensino-medio/ciencias-humanas");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Ciências Humanas e Sociais Aplicadas/);
  assert.match(html, /32 habilidades/);
  assert.match(html, /EM13CHS101/);
  assert.match(html, /científicos e tecnológicos/);
  assert.doesNotMatch(html, /ﬁ/);
});

test("server-renders the BNCC Língua Portuguesa (Ensino Médio) explorer, organized by campo de atuação", async () => {
  const response = await render("/bncc/ensino-medio/lingua-portuguesa");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Língua Portuguesa/);
  assert.match(html, /54 habilidades/);
  assert.match(html, /EM13LP01/);
  assert.match(html, /Campo de atuação/);
  assert.match(html, /href="\/bncc\/ensino-medio\/linguagens#competencia-1"/);
});

test("server-renders EM13LP12 detail with its multiple competências específicas and campo de atuação", async () => {
  const response = await render("/bncc/em13lp12");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EM13LP12/);
  assert.match(html, /href="\/bncc\/ensino-medio\/lingua-portuguesa"/);
  assert.match(html, /Competências específicas/);
  assert.match(html, /1, 7/);
  assert.match(html, /Todos os Campos de Atuação Social/);
});

test("server-renders the BNCC Arte explorer with the consolidated EF69AR code", async () => {
  const response = await render("/bncc/arte");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Arte/);
  assert.match(html, /61 habilidades/);
  assert.match(html, /EF69AR01/);
  assert.match(html, /EF15AR01/);
});

test("an Educação Física year page surfaces the grade-paired code that applies to it", async () => {
  const response = await render("/bncc/educacao-fisica/6-ano");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EF67EF01/);
  assert.doesNotMatch(html, /<strong>0<\/strong>/);
});

test("server-renders EF69AR01 detail with Arte's breadcrumb and unidade temática", async () => {
  const response = await render("/bncc/ef69ar01");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EF69AR01/);
  assert.match(html, /href="\/bncc\/arte"/);
  assert.match(html, /Artes visuais/);
});

test("server-renders the BNCC Língua Portuguesa explorer and official dataset", async () => {
  const response = await render("/bncc/lingua-portuguesa");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC de Língua Portuguesa/);
  assert.match(html, /391 habilidades/);
  assert.match(html, /EF69LP01/);
  assert.match(html, /EF01LP01/);
  assert.match(html, /Campo de atuação/);
  assert.match(html, /Ministério da Educação/);
});

test("a Língua Portuguesa year page includes single-grade and grade-paired codes that apply to it", async () => {
  const response = await render("/bncc/lingua-portuguesa/7-ano");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EF07LP01/);
  assert.match(html, /EF67LP01/);
  assert.match(html, /EF69LP01/);
  // The initial SSR result count reflects the year filter correctly (108 of 391
  // apply to 7º ano — Anos Iniciais codes only cover 1º-5º, so this count is
  // unaffected by that addition). We don't assert other codes are absent from the raw HTML:
  // BnccExplorer is a client component, so its full dataset prop is necessarily
  // serialized into the page for hydration even though only the filtered subset
  // is rendered as visible result cards.
  assert.match(html, /<strong>108<\/strong>/);
});

test("server-renders EF67LP01 detail with campo de atuação instead of unidade temática", async () => {
  const response = await render("/bncc/ef67lp01");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EF67LP01/);
  assert.match(html, /Analisar a estrutura e funcionamento dos hiperlinks/);
  assert.match(html, /Campo Jornalístico-Midiático/);
  assert.match(html, /href="\/bncc\/lingua-portuguesa"/);
  assert.doesNotMatch(html, /Unidade temática/);
});

test("turns the homepage grade suggestion into hub search results", async () => {
  const response = await render("/bncc?q=Matem%C3%A1tica%208%C2%BA%20ano");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /<strong>27<\/strong>/);
  assert.match(html, /registros encontrados/);
  assert.match(html, /8º ano/);
  assert.match(html, /EF08MA01/);
  assert.doesNotMatch(html, /Nenhum registro encontrado/);
});

test("server-renders EF07MA18 detail with official text", async () => {
  const response = await render("/bncc/ef07ma18");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EF07MA18/);
  assert.match(html, /Resolver e elaborar problemas que possam ser representados por equações polinomiais de 1º grau/);
  assert.match(html, /Equações polinomiais do 1º grau/);
});

test("returns 404 for a nonexistent BNCC code", async () => {
  const response = await render("/bncc/ef00xx00");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Página não encontrada/);
});
