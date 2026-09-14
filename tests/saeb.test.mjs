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

const SAEB_RESULTS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/avaliacao-e-exames-educacionais/saeb/resultados/";
const IDEB_RESULTS_URL = "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados";
const SAEB_MICRODATA_URL = "https://www.gov.br/inep/pt-br/acesso-a-informacao/dados-abertos/microdados/saeb";

const response = await render("/saeb");
const html = await response.text();

// O <main> da própria página, sem Header, sem Footer e sem o payload de
// hidratação. Toda asserção sobre redação roda aqui: no HTML completo, o bundle
// minificado e a carga RSC produzem falsos positivos, e os links do Header não
// são responsabilidade desta página.
const saebMain = html.match(/<main[^>]*id="main-content"[^>]*>[^]*?<\/main>/)?.[0] ?? "";

// Texto legível, com espaços normalizados: as asserções não podem depender de
// onde o JSX quebrou a linha.
const saebText = saebMain
  .replace(/<script[^]*?<\/script>/g, " ")
  .replace(/<[^>]+>/g, " ")
  .replace(/\s+/g, " ")
  .trim();

test("the main landmark was isolated, so every scoped assertion below is meaningful", () => {
  assert.ok(saebMain.length > 0, 'could not isolate <main id="main-content">');
  assert.ok(saebText.length > 2000, `main content looks too short: ${saebText.length} chars`);
});

// ---- Rota e metadados ----

test("/saeb renders with status 200 and an HTML content type", () => {
  assert.equal(response.status, 200);
  assert.match(response.headers.get("content-type") ?? "", /^text\/html\b/i);
});

test("metadata: title, description, canonical and Open Graph point at /saeb", () => {
  assert.match(html, /<title>SAEB e Ideb: como interpretar os indicadores \| Tempo Docente<\/title>/);
  assert.match(html, /<meta name="description" content="[^"]*Página explicativa sobre o SAEB, o Ideb, o Censo Escolar[^"]*"/);

  const canonicals = [...html.matchAll(/<link rel="canonical" href="([^"]+)"/g)];
  assert.equal(canonicals.length, 1, `expected exactly one canonical link, found ${canonicals.length}`);
  assert.equal(canonicals[0][1], "https://tempodocente.com.br/saeb");

  assert.match(html, /<meta property="og:url" content="https:\/\/tempodocente\.com\.br\/saeb"/);
});

test("the title and description accurately reflect that the interactive lookup now exists, without promotional language", () => {
  // A consulta e o histórico foram publicados nesta etapa — o metadado precisa dizer a verdade
  // (a ferramenta existe), sem cair em linguagem promocional ("consulte agora!", "exclusivo").
  const head = html.match(/<head>[^]*?<\/head>/)?.[0] ?? "";
  assert.ok(head, "missing <head>");
  assert.doesNotMatch(head, /em construção/);
  assert.match(head, /consulta interativa por escola/);
  assert.doesNotMatch(head, /consulte (agora|já) (sua escola|a sua escola)/i);
  assert.doesNotMatch(head, /revolucionári|inovador|imperdível|exclusivo/i);
});

// ---- Estrutura semântica ----

test("the page has exactly one H1, with the approved headline", () => {
  const h1s = [...html.matchAll(/<h1[^>]*>/g)];
  assert.equal(h1s.length, 1, `expected exactly one <h1>, found ${h1s.length}`);
  assert.match(html, /<h1>SAEB: resultados educacionais com contexto<\/h1>/);
});

test("all required H2 sections are present, and every H3 lives under an H2", () => {
  const requiredH2 = [
    "O que é o SAEB",
    "SAEB, Ideb e Censo Escolar",
    "O que significa proficiência",
    "Por que uma escola pode não ter resultado divulgado",
    "Como o Tempo Docente pretende apresentar esses dados",
    "Uso responsável dos indicadores",
    "Fontes e metodologia",
  ];
  for (const heading of requiredH2) {
    assert.ok(html.includes(`<h2>${heading}</h2>`), `missing <h2>${heading}</h2>`);
  }

  const firstH2 = html.indexOf("<h2>");
  const firstH3 = html.indexOf("<h3>");
  assert.ok(firstH2 > -1, "no <h2> found");
  if (firstH3 > -1) {
    assert.ok(firstH3 > firstH2, "an <h3> appears before the first <h2>");
  }
});

test("the breadcrumb is Início / SAEB, with the current page marked", () => {
  const nav = html.match(/<nav class="saeb-breadcrumb" aria-label="Breadcrumb">[^]*?<\/nav>/)?.[0] ?? "";
  assert.ok(nav, "breadcrumb nav not found");
  assert.match(nav, /<a href="\/">Início<\/a>/);
  assert.match(nav, /aria-current="page">SAEB</);
});

test("the page renders inside exactly one #main-content landmark and keeps the skip link", () => {
  assert.equal((html.match(/id="main-content"/g) ?? []).length, 1);
  assert.match(html, /<a class="skip-link" href="#main-content">/);
});

// ---- Natureza do SAEB e divulgação por escola ----

test("the SAEB is described as an assessment of systems and networks, in the plural", () => {
  assert.match(saebText, /O SAEB é uma avaliação de sistemas e redes de ensino/);
  assert.match(saebText, /desenhado para descrever o conjunto — redes, etapas e territórios/);
  // A formulação antiga, no singular, tratava o SAEB como avaliação de "um sistema".
  assert.doesNotMatch(saebText, /avaliação de sistema(?!s)/);
});

test("per-school disclosure is described as conditional on Inep's criteria, never as guaranteed", () => {
  assert.match(
    saebText,
    /Resultados agregados também podem ser divulgados por escola quando os critérios definidos pelo Inep são atendidos/,
  );
  assert.match(saebText, /não faz da escola uma unidade individualmente avaliada/);
  assert.match(saebText, /não significa que toda escola terá resultado em toda edição/);

  // Nenhuma promessa de cobertura universal.
  assert.doesNotMatch(saebText, /todas as escolas (terão|têm|possuem) resultado/i);
  assert.doesNotMatch(saebText, /resultado para (todas|cada uma) as escolas/i);
});

test("the SAEB is not presented as a measure of an individual teacher or of a school's total quality", () => {
  assert.match(saebText, /não para medir o trabalho de um professor específico/);
  assert.match(saebText, /nem para resumir a qualidade total de uma escola/);
});

// ---- Áreas avaliadas: variam entre edições ----

test("the set of assessed areas is presented as varying between editions, never as a fixed pair", () => {
  assert.match(saebText, /O conjunto de áreas e etapas avaliadas varia de uma edição para outra/);
  assert.match(saebText, /o SAEB não se limita a elas em caráter permanente/);
  assert.match(saebText, /Ciências Humanas e Ciências da Natureza/);
  assert.match(saebText, /o 2º ano do ensino fundamental tem recorte próprio, voltado à alfabetização/);
});

test("Língua Portuguesa and Matemática are framed as the focus of the future lookup, not as the whole SAEB", () => {
  assert.match(
    saebText,
    /Língua Portuguesa e Matemática são as que formam as séries históricas mais longas e contínuas, e por isso serão o foco da futura consulta/,
  );
});

test("the retired absolute claims about two areas are gone", () => {
  assert.doesNotMatch(saebText, /observa duas áreas do conhecimento/);
  assert.doesNotMatch(saebText, /teste padronizado de duas áreas/);
  assert.doesNotMatch(saebText, /(somente|apenas|só) duas áreas/i);
  assert.doesNotMatch(saebText, /avalia duas áreas/i);
});

test("the responsible-use section describes the SAEB as covering part of the curriculum", () => {
  assert.match(saebText, /O SAEB observa parte do currículo — as áreas avaliadas em cada edição/);
});

// ---- Conceitos: SAEB, Ideb e Censo Escolar são distintos ----

test("SAEB, Ideb and Censo Escolar are presented as three distinct concepts, each with its own H3", () => {
  assert.match(html, /<h3>SAEB<\/h3>/);
  assert.match(html, /<h3>Censo Escolar<\/h3>/);
  assert.match(html, /<h3>Ideb<\/h3>/);

  assert.match(saebText, /Origem: avaliação aplicada a estudantes/);
  assert.match(saebText, /Origem: declaração das redes e escolas/);
  assert.match(saebText, /Origem: cálculo que combina as duas anteriores/);
});

test("the Ideb is described as combining SAEB performance with school rendimento, never as a SAEB grade", () => {
  assert.match(saebText, /combina o desempenho medido pelo SAEB com o rendimento escolar apurado pelo Censo Escolar/);
  assert.match(saebText, /O Ideb não é uma nota do SAEB/);

  assert.doesNotMatch(saebText, /\bIdeb é a nota do SAEB\b/i);
  assert.doesNotMatch(saebText, /\bIdeb é uma nota do SAEB\b/i);
  assert.doesNotMatch(saebText, /nota do SAEB\s*[,.]?\s*(chamada|conhecida) como Ideb/i);
});

test("the Censo Escolar is credited as the source of rendimento, not as an assessment", () => {
  assert.match(saebText, /taxas de aprovação, reprovação e abandono/);
  assert.match(saebText, /rendimento escolar/);
});

// ---- Proficiência e escalas ----

test("proficiência is explained as a scaled measure, never as a percentage of correct answers or a school grade", () => {
  assert.match(saebText, /Proficiência é uma medida de desempenho expressa em uma escala/);
  assert.match(saebText, /não é a porcentagem de acertos/);
  assert.match(saebText, /não é uma nota escolar comum/);
  assert.match(saebText, /não vai de zero a dez/);
});

test("the scale is tied to both etapa and componente, with the 2º ano called out as its own", () => {
  assert.match(
    saebText,
    /A escala usada e a forma de interpretá-la dependem da etapa e do componente avaliado/,
  );
  assert.match(saebText, /o 2º ano do ensino fundamental, por exemplo, tem escala específica, própria do recorte de alfabetização/);
  assert.match(
    saebText,
    /Resultados de recortes incompatíveis não devem ser comparados diretamente, nem somados, nem convertidos entre si/,
  );
});

test("the retired 'one scale per etapa' formulation is gone", () => {
  assert.doesNotMatch(saebText, /Cada etapa avaliada tem sua própria escala/);
  assert.doesNotMatch(saebText, /cada etapa tem (a )?sua (própria )?escala/i);
});

test("comparisons between editions are presented as conditional on the official ressalvas", () => {
  assert.match(saebText, /nem toda comparação entre edições é direta/i);
  assert.match(saebText, /O conjunto de etapas e componentes avaliados mudou ao longo das edições/);
});

test("the page invents no proficiency bands or levels of its own", () => {
  // Nenhuma faixa numérica nem rótulo de nível pedagógico: a documentação
  // oficial do Inep é a única referência para cortes de escala.
  assert.doesNotMatch(saebText, /nível (adequado|básico|insuficiente|avançado)/i);
  assert.doesNotMatch(saebText, /faixa (de proficiência|adequada)/i);
  assert.doesNotMatch(saebText, /\b(abaixo|acima) de \d{2,3} pontos\b/i);
  assert.doesNotMatch(saebText, /\bescala de 0 a \d+\b/i);
});

// ---- Ausência de resultado ----

test("all six reasons for a missing result are listed, in plain language", () => {
  const reasons = [
    "Poucos estudantes presentes",
    "Participação abaixo do exigido",
    "Etapa não avaliada naquela edição",
    "Escola não existia ou não ofertava a etapa",
    "Pedido de não divulgação previsto em norma",
    "Problema na aplicação ou no material",
  ];
  for (const reason of reasons) {
    assert.ok(saebText.includes(reason), `missing reason: ${reason}`);
  }
});

test("a missing result is explicitly decoupled from low performance", () => {
  assert.match(saebText, /Ausência de resultado não significa baixo desempenho/);
});

test("the raw non-disclosure codes are not dumped on the reader", () => {
  assert.doesNotMatch(saebText, /\bND\b/);
  assert.doesNotMatch(saebText, /ND\*/);
});

// ---- Compromissos da ferramenta futura ----

test("the future tool's commitments are all stated, including the four allowed comparisons", () => {
  assert.match(saebText, /Permitir selecionar o município e, dentro dele, a escola/);
  assert.match(saebText, /Mostrar a trajetória histórica da escola/);
  assert.match(saebText, /Comparar essa trajetória com o município, a unidade da Federação e o Brasil/);
  assert.match(saebText, /Identificar a fonte oficial de cada indicador/);
  assert.match(saebText, /Explicar cada ausência de resultado e cada ressalva metodológica/);
  assert.match(saebText, /Permitir exportar os dados consultados com os códigos oficiais/);
});

test("the no-ranking policy is stated explicitly and framed as a project decision", () => {
  assert.match(saebText, /Não produzir ranking, ordenação competitiva nem qualquer lista de melhores ou piores escolas/);
  assert.match(saebText, /decisão de projeto, não uma limitação técnica/);
});

test("the lookup tool is described as available now, with no leftover development-round language", () => {
  // A consulta e o painel histórico foram publicados nesta etapa — a redação de rodadas
  // anteriores ("primeira versão local", "esta rodada", "ainda não publicada") ficaria falsa a
  // partir de agora e precisou mudar. Este teste protege contra os dois erros possíveis: a página
  // nunca deve dizer que a ferramenta não existe (ver o outro teste, "ainda está sendo
  // construída"), e nunca deve carregar linguagem de rascunho/rodada de trabalho interno.
  assert.doesNotMatch(saebText, /ainda está sendo construída e não está disponível/);
  assert.doesNotMatch(saebText, /primeira versão local/i);
  assert.doesNotMatch(saebText, /ainda não publicada/);
  assert.doesNotMatch(saebText, /esta rodada/i);
  assert.match(saebText, /A consulta por escola está disponível logo abaixo/);
  assert.match(saebText, /A ferramenta de consulta, acima, já cobre parte destes compromissos/);
});

test("the tool's page never promises descriptors, proficiency levels, territorial comparisons or export as already implemented", () => {
  // As quatro referências/recursos abaixo continuam no roteiro (aspiracional, ver o teste de
  // compromissos futuros) — o que este teste garante é que a página nunca os apresente como algo
  // que a ferramenta JÁ faz hoje.
  assert.doesNotMatch(saebText, /já compara(m)? (a|essa) trajetória com o município/i);
  assert.doesNotMatch(saebText, /já permite exportar/i);
  assert.doesNotMatch(saebText, /descritor(es)? (já )?(disponív|implementad)/i);
  assert.doesNotMatch(saebText, /n[íi]vel(is)? de proficiência (já )?(disponív|implementad)/i);
  assert.match(saebText, /continuam pendentes/);
});

// ---- Uso responsável ----

test("the responsible-use section states the limits of the indicators", () => {
  assert.match(saebText, /Todo indicador é um recorte da realidade/);
  assert.match(saebText, /a taxa de participação naquela aplicação e a trajetória ao longo do tempo/);
  assert.match(saebText, /apoiar a reflexão coletiva, orientar o planejamento/);
  assert.match(
    saebText,
    /não devem ser usados isoladamente para responsabilizar professores, estudantes ou comunidades escolares/,
  );
});

// ---- Fontes oficiais e atribuição ----

test("the three official Inep sources are linked, each opening safely in a new tab", () => {
  for (const url of [SAEB_RESULTS_URL, IDEB_RESULTS_URL, SAEB_MICRODATA_URL]) {
    const escaped = url.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
    const anchor = saebMain.match(new RegExp(`<a href="${escaped}"[^>]*>`))?.[0];
    assert.ok(anchor, `missing link to ${url}`);
    assert.match(anchor, /target="_blank"/, `${url} should open in a new tab`);
    assert.match(anchor, /rel="noopener noreferrer"/, `${url} is missing rel="noopener noreferrer"`);
  }
});

test("every external link in the page body carries the project's safe rel attribute", () => {
  const externalAnchors = [...saebMain.matchAll(/<a href="https?:\/\/[^"]+"[^>]*>/g)].map((match) => match[0]);
  assert.ok(externalAnchors.length >= 3, "expected at least the three official source links");
  for (const anchor of externalAnchors) {
    assert.match(anchor, /rel="noopener noreferrer"/, `unsafe external anchor: ${anchor}`);
  }
});

test("the MEC/Inep attribution is present, verbatim", () => {
  assert.match(
    saebText,
    /Fonte: Ministério da Educação — Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira \(MEC\/Inep\)\./,
  );
});

test("the project's handling of official values is described precisely: unmodified, but organized and contextualized", () => {
  assert.match(
    saebText,
    /O Tempo Docente não modifica os valores oficiais; organiza e contextualiza os dados, preservando a edição e o arquivo de origem de cada indicador/,
  );

  // A redação antiga prometia ausência de qualquer interpretação — algo que a
  // futura ferramenta não pode cumprir, já que normaliza e contextualiza.
  assert.doesNotMatch(saebText, /não produz, altera nem reinterpreta/);
  assert.doesNotMatch(saebText, /não interpreta os (dados|valores)/i);
});

// ---- Tom: sem linguagem promocional ----

test("the page avoids promotional and competitive vocabulary", () => {
  assert.doesNotMatch(saebText, /revolucionári/i);
  assert.doesNotMatch(saebText, /melhores escolas/i);
  assert.doesNotMatch(saebText, /a plataforma definitiva|inovador|imperdível|exclusivo/i);
  // "ranking" só pode aparecer numa frase que o recusa/descarta, nunca como funcionalidade —
  // seja na promessa do roteiro ("Não produzir ranking...") ou na descrição da própria
  // ferramenta implementada ("sem ranking e sem comparação entre escolas").
  for (const match of saebText.matchAll(/.{40}ranking/gi)) {
    assert.match(match[0], /Não produzir|sem ranking/, `"ranking" used outside the refusal: …${match[0]}`);
  }
});

// ---- Renderização no servidor ----

test("the essential content is present in the server-rendered HTML, with no client component boundary", () => {
  assert.match(saebText, /O SAEB é o Sistema de Avaliação da Educação Básica/);
  assert.match(saebText, /Proficiência é uma medida de desempenho/);
  assert.match(saebText, /Fonte: Ministério da Educação/);
  assert.doesNotMatch(html, /react-loading-skeleton|Carregando\.\.\./);
});

// ---- Navegação: menu, homepage, Footer e sitemap (a partir da rodada de navegação) ----

test("/saeb is linked from the Header (desktop and mobile) and the Footer", async () => {
  const homeHtml = await (await render("/")).text();
  const headerBlock = homeHtml.match(/<header class="site-header">[^]*?<\/header>/)?.[0] ?? "";
  const footerBlock = homeHtml.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
  assert.ok(headerBlock, "missing <header>");
  assert.ok(footerBlock, "missing <footer>");
  assert.ok(headerBlock.includes('href="/saeb"'), "the Header should link to /saeb");
  assert.ok(footerBlock.includes('href="/saeb"'), "the Footer should link to /saeb");

  const desktopNav = headerBlock.match(/<nav class="desktop-nav"[^]*?<\/nav>/)?.[0] ?? "";
  const mobileNav = headerBlock.match(/<nav aria-label="Navegação móvel"[^]*?<\/nav>/)?.[0] ?? "";
  assert.match(desktopNav, /<a href="\/saeb"[^>]*>SAEB</, "desktop nav missing the SAEB link");
  assert.match(mobileNav, /<a href="\/saeb"[^>]*>SAEB</, "mobile nav missing the SAEB link");
});

test("/saeb appears in the sitemap exactly once, with the canonical domain and no query string", async () => {
  const sitemapResponse = await render("/sitemap.xml");
  const xml = await sitemapResponse.text();
  assert.equal(sitemapResponse.status, 200);
  const matches = [...xml.matchAll(/<loc>([^<]+)<\/loc>/g)].map((match) => match[1]).filter((loc) => loc.includes("/saeb"));
  assert.deepEqual(matches, ["https://tempodocente.com.br/saeb"], "/saeb should appear exactly once, as the bare canonical route");
});

test("the SAEB page body links to no internal route other than the breadcrumb home", () => {
  const bodyOnly = saebMain.replace(/<script[^]*?<\/script>/g, " ");
  const internalHrefs = [...bodyOnly.matchAll(/<a href="(\/[^"]*)"/g)].map((match) => match[1]);
  assert.ok(internalHrefs.length > 0, "expected at least the breadcrumb link");
  for (const href of internalHrefs) {
    assert.equal(href, "/", `unexpected internal link on /saeb: ${href}`);
  }
});

// ---- Sem regressão nas páginas existentes ----

test("the existing pages still render after the new route was added", async () => {
  for (const path of ["/", "/bncc", "/saresp", "/sobre", "/privacidade"]) {
    const pageResponse = await render(path);
    assert.equal(pageResponse.status, 200, `${path} should still render 200`);
  }
});
