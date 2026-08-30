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

test("the homepage has exactly one canonical link, pointing to the domain root", async () => {
  const response = await render();
  const html = await response.text();
  const matches = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(matches.length, 1, `expected exactly one canonical link, found ${matches.length}`);
  assert.equal(matches[0][1], "https://tempodocente.com.br");
});

test("the homepage JSON-LD is a single, valid WebSite entry with the approved Person as creator", async () => {
  const response = await render();
  const html = await response.text();

  const scriptMatches = [...html.matchAll(/<script type="application\/ld\+json">([^]*?)<\/script>/g)];
  assert.equal(scriptMatches.length, 1, `expected exactly one JSON-LD script tag, found ${scriptMatches.length}`);

  let data;
  assert.doesNotThrow(() => { data = JSON.parse(scriptMatches[0][1]); }, "homepage JSON-LD must be valid, parseable JSON");

  assert.equal(data["@context"], "https://schema.org");
  assert.equal(data["@type"], "WebSite");
  assert.equal(data.name, "Tempo Docente");
  assert.equal(data.url, "https://tempodocente.com.br");
  assert.equal(data.inLanguage, "pt-BR");
  assert.equal(typeof data.description, "string");
  assert.ok(data.description.length > 0);

  const person = data.creator;
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, "Alexandre Pedroso");
  assert.equal(person.jobTitle, "Professor de Matemática");
  assert.equal(person.url, "https://tempodocente.com.br/sobre");
  assert.deepEqual(person.sameAs, ["https://lattes.cnpq.br/9478556199676330"]);

  // Nothing beyond the approved fields: no Organization, no alternateName, no full
  // legal name, no email/phone/address, no logo, no nonexistent social profile.
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /"@type":"Organization"/);
  assert.doesNotMatch(serialized, /alternateName/i);
  assert.doesNotMatch(serialized, /Alexandre da Silva Pedroso/);
  assert.doesNotMatch(serialized, /telefone|phone|address|endereco|endereço|logo/i);
  assert.doesNotMatch(serialized, /@gmail|@hotmail|@yahoo|mailto/i);
  assert.doesNotMatch(serialized, /linkedin|instagram|facebook|twitter|x\.com/i);

  // The script tag itself must not be prematurely closed by an unescaped "<".
  assert.doesNotMatch(scriptMatches[0][1], /<\/script/i);
});

test("includes semantic navigation and source transparency", async () => {
  const response = await render();
  const html = await response.text();

  assert.match(html, /aria-label="Navegação principal"/);
  assert.match(html, /role="search"/);
  assert.match(html, /Busca na base oficial da BNCC/i);
  // The homepage search blurb must reflect that Educação Infantil is now
  // searchable too — not just Ensino Fundamental, as it claimed before.
  assert.match(html, /Busca na base oficial da BNCC — Educação Infantil, Ensino Fundamental e Ensino Médio\./);
  assert.doesNotMatch(html, /Busca na base oficial da BNCC — Ensino Fundamental, todos os componentes curriculares\./);
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

test("server-renders the BNCC hub with all four etapa cards, all active", async () => {
  const response = await render("/bncc");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /Consulte a BNCC/);
  assert.match(html, /Competências Gerais/);
  assert.match(html, /Educação Infantil/);
  assert.match(html, /Ensino Fundamental/);
  assert.match(html, /Ensino Médio/);
  assert.match(html, /href="\/bncc\/ensino-medio"/);
  assert.match(html, /href="\/bncc\/educacao-infantil"/);
  // Educação Infantil's card is active now — no etapa card should be disabled.
  assert.doesNotMatch(html, /Em breve/);
  assert.doesNotMatch(html, /access-card-soon/);
  assert.doesNotMatch(html, /aria-disabled/);
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

// ---- Educação Infantil ----

test("server-renders the Educação Infantil hub with the six direitos, three faixas and five campos", async () => {
  const response = await render("/bncc/educacao-infantil");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /BNCC — Educação Infantil/);
  assert.match(html, /93\D*objetivos/);

  for (const nome of ["Conviver", "Brincar", "Participar", "Explorar", "Expressar", "Conhecer-se"]) {
    assert.match(html, new RegExp(`id="direito-${nome.toLowerCase()}"`), `missing anchor for direito ${nome}`);
    assert.match(html, new RegExp(nome), `missing direito name ${nome}`);
  }
  assert.match(html, /Brincar cotidianamente de diversas formas/);

  for (const [nome, descricao] of [
    ["Bebês", "zero a 1 ano e 6 meses"],
    ["Crianças bem pequenas", "1 ano e 7 meses a 3 anos e 11 meses"],
    ["Crianças pequenas", "4 anos a 5 anos e 11 meses"],
  ]) {
    assert.match(html, new RegExp(nome));
    assert.match(html, new RegExp(descricao));
  }
  assert.match(html, /não podem ser considerados de forma rígida/);
  assert.match(html, /Nota oficial da BNCC/);

  for (const [slug, count] of [
    ["o-eu-o-outro-e-o-nos", 20],
    ["corpo-gestos-e-movimentos", 15],
    ["tracos-sons-cores-e-formas", 9],
    ["escuta-fala-pensamento-e-imaginacao", 27],
    ["espacos-tempos-quantidades-relacoes-e-transformacoes", 22],
  ]) {
    assert.match(html, new RegExp(`href="/bncc/educacao-infantil/${slug}"`), `missing link to ${slug}`);
    assert.match(html, new RegExp(`${count}\\D*objetivos`), `missing count ${count} for ${slug}`);
  }

  assert.match(html, /Fonte oficial/);
  assert.match(html, /BNCC Educação Infantil e Ensino Fundamental/);
  assert.doesNotMatch(html, /Habilidade/);
});

test("the six direitos are presented as a non-hierarchical bullet list (<ul>), never a numbered one (<ol>)", async () => {
  const response = await render("/bncc/educacao-infantil");
  const html = await response.text();

  assert.match(html, /<ul class="bncc-direitos-list">/, "expected the direitos list to be a <ul>");
  assert.doesNotMatch(html, /<ol class="bncc-direitos-list">/, "the direitos list must not be an <ol> — the BNCC presents them unordered, with no hierarchy");

  const listBlock = html.match(/<ul class="bncc-direitos-list">[^]*?<\/ul>/)?.[0] ?? "";
  assert.ok(listBlock, "could not find the closed <ul> block");
  for (const nome of ["Conviver", "Brincar", "Participar", "Explorar", "Expressar", "Conhecer-se"]) {
    assert.match(listBlock, new RegExp(`id="direito-${nome.toLowerCase()}"`), `missing anchor for direito ${nome} inside the <ul>`);
  }
});

test("server-renders each of the five Educação Infantil campo pages with the official name, sigla and count", async () => {
  const campos = [
    { slug: "o-eu-o-outro-e-o-nos", nome: "O eu, o outro e o nós", sigla: "EO", total: 20 },
    { slug: "corpo-gestos-e-movimentos", nome: "Corpo, gestos e movimentos", sigla: "CG", total: 15 },
    { slug: "tracos-sons-cores-e-formas", nome: "Traços, sons, cores e formas", sigla: "TS", total: 9 },
    { slug: "escuta-fala-pensamento-e-imaginacao", nome: "Escuta, fala, pensamento e imaginação", sigla: "EF", total: 27 },
    { slug: "espacos-tempos-quantidades-relacoes-e-transformacoes", nome: "Espaços, tempos, quantidades, relações e transformações", sigla: "ET", total: 22 },
  ];

  for (const campo of campos) {
    const response = await render(`/bncc/educacao-infantil/${campo.slug}`);
    assert.equal(response.status, 200, `${campo.slug} should render`);
    const html = await response.text();

    assert.match(html, new RegExp(campo.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `missing nome for ${campo.slug}`);
    assert.match(html, new RegExp(`sigla ${campo.sigla}`, "i"), `missing sigla for ${campo.slug}`);
    assert.match(html, new RegExp(`${campo.total}\\D*objetivos`), `missing total for ${campo.slug}`);
    assert.match(html, /Todos/, `missing "Todos" filter state for ${campo.slug}`);
    assert.match(html, /Bebês/);
    assert.match(html, /Crianças bem pequenas/);
    assert.match(html, /Crianças pequenas/);
    assert.doesNotMatch(html, /Habilidade/, `${campo.slug} should never say "Habilidade"`);
  }
});

test("every campo page shows the full four-level breadcrumb (Início / BNCC / Educação Infantil / campo)", async () => {
  const campos = [
    { slug: "o-eu-o-outro-e-o-nos", nome: "O eu, o outro e o nós" },
    { slug: "corpo-gestos-e-movimentos", nome: "Corpo, gestos e movimentos" },
    { slug: "tracos-sons-cores-e-formas", nome: "Traços, sons, cores e formas" },
    { slug: "escuta-fala-pensamento-e-imaginacao", nome: "Escuta, fala, pensamento e imaginação" },
    { slug: "espacos-tempos-quantidades-relacoes-e-transformacoes", nome: "Espaços, tempos, quantidades, relações e transformações" },
  ];

  for (const campo of campos) {
    const response = await render(`/bncc/educacao-infantil/${campo.slug}`);
    const html = await response.text();
    const breadcrumb = html.match(/<nav class="bncc-breadcrumb"[^]*?<\/nav>/)?.[0] ?? "";
    assert.ok(breadcrumb, `${campo.slug} is missing a breadcrumb nav`);
    assert.match(breadcrumb, /<a href="\/">Início<\/a>/, `${campo.slug} breadcrumb missing Início`);
    assert.match(breadcrumb, /<a href="\/bncc">BNCC<\/a>/, `${campo.slug} breadcrumb missing BNCC`);
    assert.match(breadcrumb, /<a href="\/bncc\/educacao-infantil">Educação Infantil<\/a>/, `${campo.slug} breadcrumb missing Educação Infantil link`);
    const nomePattern = campo.nome.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    assert.match(breadcrumb, new RegExp(`<span aria-current="page">${nomePattern}</span>`), `${campo.slug} breadcrumb current crumb wrong`);
  }

  // Fundamental/Médio and the hub itself keep their existing (shorter) breadcrumb — unaffected by the optional parent level.
  const fundamentalHtml = await (await render("/bncc/matematica")).text();
  const fundamentalBreadcrumb = fundamentalHtml.match(/<nav class="bncc-breadcrumb"[^]*?<\/nav>/)?.[0] ?? "";
  assert.doesNotMatch(fundamentalBreadcrumb, /Educação Infantil/);

  const hubHtml = await (await render("/bncc/educacao-infantil")).text();
  const hubBreadcrumb = hubHtml.match(/<nav class="bncc-breadcrumb"[^]*?<\/nav>/)?.[0] ?? "";
  assert.match(hubBreadcrumb, /<span aria-current="page">Educação Infantil<\/span>/);
  assert.equal((hubBreadcrumb.match(/<a /g) ?? []).length, 2, "hub breadcrumb should stay at 3 levels (Início, BNCC, current)");
});

test("a campo page opened with a direct URL keeps its query-string filters through the first render (no clobbering on hydration)", async () => {
  const base = "/bncc/educacao-infantil/tracos-sons-cores-e-formas"; // TS: 3 Bebês / 3 Crianças bem pequenas / 3 Crianças pequenas = 9

  // ?faixa=01 shows Bebês active and only its 3 objetivos.
  {
    const html = await (await render(`${base}?faixa=01`)).text();
    assert.match(html, /class="active" aria-pressed="true"[^>]*>Bebês/);
    assert.match(html, /<strong>3<\/strong>/);
  }

  // ?faixa=02 shows Crianças bem pequenas active.
  {
    const html = await (await render(`${base}?faixa=02`)).text();
    assert.match(html, /class="active" aria-pressed="true"[^>]*>Crianças bem pequenas/);
    assert.match(html, /<strong>3<\/strong>/);
  }

  // ?faixa=03 shows Crianças pequenas active.
  {
    const html = await (await render(`${base}?faixa=03`)).text();
    assert.match(html, /class="active" aria-pressed="true"[^>]*>Crianças pequenas/);
    assert.match(html, /<strong>3<\/strong>/);
  }

  // ?q=sons applies the search (every TS objetivo matches, since "sons" is part of the campo's own official name).
  {
    const html = await (await render(`${base}?q=sons`)).text();
    assert.match(html, /id="bncc-search"[^>]*value="sons"/);
    assert.match(html, /<strong>9<\/strong>/);
    assert.match(html, /class="active" aria-pressed="true">Todos/);
  }

  // ?faixa=02&q=sons combines both filters.
  {
    const html = await (await render(`${base}?faixa=02&q=sons`)).text();
    assert.match(html, /id="bncc-search"[^>]*value="sons"/);
    assert.match(html, /class="active" aria-pressed="true"[^>]*>Crianças bem pequenas/);
    assert.match(html, /<strong>3<\/strong>/);
  }

  // ?faixa=99 (invalid) is discarded safely — falls back to "Todos" with no error.
  {
    const response = await render(`${base}?faixa=99`);
    assert.equal(response.status, 200);
    const html = await response.text();
    assert.match(html, /class="active" aria-pressed="true">Todos/);
    assert.match(html, /<strong>9<\/strong>/);
  }

  // The canonical link never carries the query string, regardless of what was requested.
  {
    const html = await (await render(`${base}?faixa=01&q=sons`)).text();
    const canonical = html.match(/rel="canonical" href="([^"]+)"/)?.[1];
    assert.ok(canonical, "missing canonical link");
    assert.equal(canonical, "https://tempodocente.com.br/bncc/educacao-infantil/tracos-sons-cores-e-formas");
  }
});

test("returns 404 for an invalid Educação Infantil campo slug", async () => {
  const response = await render("/bncc/educacao-infantil/campo-inexistente");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Página não encontrada/);
});

test("server-renders EI02TS01 (the BNCC's own worked example for the code format) with full detail", async () => {
  const response = await render("/bncc/ei02ts01");
  assert.equal(response.status, 200);
  const html = await response.text();

  assert.match(html, /EI02TS01/);
  assert.match(html, /Objetivo de aprendizagem e desenvolvimento/);
  assert.match(html, /Criar sons com materiais, objetos e instrumentos musicais/);
  assert.match(html, /Traços, sons, cores e formas/);
  assert.match(html, /Crianças bem pequenas/);
  assert.match(html, /1 ano e 7 meses a 3 anos e 11 meses/);
  assert.match(html, /href="\/"/);
  assert.match(html, /href="\/bncc"/);
  assert.match(html, /href="\/bncc\/educacao-infantil"/);
  assert.match(html, /href="\/bncc\/educacao-infantil\/tracos-sons-cores-e-formas"/);
  assert.match(html, /Ministério da Educação/);
  assert.match(html, /basenacionalcomum\.mec\.gov\.br/);
  assert.match(html, /Ordem de apresentação no documento/);
  assert.doesNotMatch(html, /Habilidade/);
});

test("EI02TS01 has a next objetivo link within the same campo and faixa, since it's the first of its group", async () => {
  const response = await render("/bncc/ei02ts01");
  const html = await response.text();
  assert.match(html, /href="\/bncc\/ei02ts02"/);
});

test("a middle-of-group objetivo (EI02EO04) shows both previous and next within the same campo and faixa", async () => {
  const response = await render("/bncc/ei02eo04");
  assert.equal(response.status, 200);
  const html = await response.text();
  assert.match(html, /href="\/bncc\/ei02eo03"/);
  assert.match(html, /href="\/bncc\/ei02eo05"/);
});

test("spot-checks objetivo detail pages across the five campos and three faixas", async () => {
  const samples = [
    { code: "ei01eo01", campo: "O eu, o outro e o nós", faixa: "Bebês", texto: "Perceber que suas ações têm efeitos nas outras crianças e nos adultos." },
    { code: "ei02cg01", campo: "Corpo, gestos e movimentos", faixa: "Crianças bem pequenas", texto: "Apropriar-se de gestos e movimentos de sua cultura no cuidado de si e nos jogos e brincadeiras." },
    { code: "ei03ts01", campo: "Traços, sons, cores e formas", faixa: "Crianças pequenas", texto: "Utilizar sons produzidos por materiais, objetos e instrumentos musicais durante brincadeiras de faz de conta" },
    { code: "ei02ef05", campo: "Escuta, fala, pensamento e imaginação", faixa: "Crianças bem pequenas", texto: "Relatar experiências e fatos acontecidos, histórias ouvidas, filmes ou peças teatrais assistidos" },
    { code: "ei01et01", campo: "Espaços, tempos, quantidades, relações e transformações", faixa: "Bebês", texto: "Explorar e descobrir as propriedades de objetos e materiais" },
  ];

  for (const sample of samples) {
    const response = await render(`/bncc/${sample.code}`);
    assert.equal(response.status, 200, `${sample.code} should render`);
    const html = await response.text();
    assert.match(html, new RegExp(sample.code.toUpperCase()), sample.code);
    assert.match(html, new RegExp(sample.faixa), `${sample.code} faixa`);
    assert.match(html, new RegExp(sample.texto.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), `${sample.code} texto`);
    assert.doesNotMatch(html, /Habilidade/, `${sample.code} should never say "Habilidade"`);
  }
});

test("returns 404 for a well-formed but nonexistent Educação Infantil code (EI01EO07 was never invented)", async () => {
  const response = await render("/bncc/ei01eo07");
  assert.equal(response.status, 404);
  assert.match(await response.text(), /Página não encontrada/);
});

test("a direito de aprendizagem never resolves at /bncc/[codigo] — it has no código", async () => {
  for (const attempted of ["/bncc/brincar", "/bncc/conhecer-se", "/bncc/direito-brincar"]) {
    const response = await render(attempted);
    assert.equal(response.status, 404, attempted);
  }
});

test("global BNCC search finds Educação Infantil objetivos and direitos with the correct labels", async () => {
  const byCode = await render("/bncc?q=EI02TS01");
  const htmlByCode = await byCode.text();
  assert.match(htmlByCode, /Objetivo de aprendizagem e desenvolvimento/);
  assert.match(htmlByCode, /href="\/bncc\/ei02ts01"/);
  assert.doesNotMatch(htmlByCode, /Nenhum registro encontrado/);

  const byDireito = await render("/bncc?q=Conhecer-se");
  const htmlByDireito = await byDireito.text();
  assert.match(htmlByDireito, /Direito de aprendizagem e desenvolvimento/);
  assert.match(htmlByDireito, /href="\/bncc\/educacao-infantil#direito-conhecer-se"/);

  const byBrincar = await render("/bncc?q=Brincar");
  const htmlByBrincar = await byBrincar.text();
  assert.doesNotMatch(htmlByBrincar, /Nenhum registro encontrado/);
  assert.match(htmlByBrincar, /Direito de aprendizagem e desenvolvimento/);

  const byCampo = await render("/bncc?q=" + encodeURIComponent("Corpo, gestos e movimentos"));
  const htmlByCampo = await byCampo.text();
  assert.doesNotMatch(htmlByCampo, /Nenhum registro encontrado/);

  const byFaixa = await render("/bncc?q=" + encodeURIComponent("Bebês"));
  const htmlByFaixa = await byFaixa.text();
  assert.doesNotMatch(htmlByFaixa, /Nenhum registro encontrado/);

  // None of the above search-result HTML ever labels an Educação Infantil
  // result as "Habilidade".
  for (const html of [htmlByCode, htmlByDireito, htmlByBrincar]) {
    assert.doesNotMatch(html, /Habilidade[^<]*Educação Infantil/);
  }
});

test("Fundamental and Médio searches still work unaffected by the Educação Infantil integration", async () => {
  const response = await render("/bncc?q=EF07MA18");
  const html = await response.text();
  assert.match(html, /EF07MA18/);
  assert.doesNotMatch(html, /Nenhum registro encontrado/);
});
