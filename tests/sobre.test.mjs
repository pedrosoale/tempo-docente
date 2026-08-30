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

const LATTES_URL = "https://lattes.cnpq.br/9478556199676330";
const CONTACT_EMAIL = "tempodocente@gmail.com";
const OLD_EMAIL = "contato@tempodocente.com.br";

const response = await render("/sobre");
const html = await response.text();

test("/sobre renders with status 200", () => {
  assert.equal(response.status, 200);
});

// ---- Título e apresentação profissional ----

test("title, professional presentation, and headline are correct", () => {
  assert.match(html, /<title>Sobre o Tempo Docente \| Professor Alexandre Pedroso<\/title>/);
  assert.match(html, /<h1>Professor Alexandre Pedroso<\/h1>/);
  assert.match(html, /Sobre o Tempo Docente/);
  assert.match(html, /Professor de Matemática, mestre em Matemática e criador do Tempo Docente\./);
});

// ---- Motivação ----

test("includes the approved 'Por que criei o Tempo Docente' copy", () => {
  assert.match(html, /Por que criei o Tempo Docente/);
  assert.match(html, /O Tempo Docente nasceu da experiência cotidiana com os desafios enfrentados por professores/);
  assert.match(html, /ajudando professores a encontrar referências curriculares, compreender resultados e tomar decisões/);
});

// ---- Trajetória e formação ----

test("includes all four trajectory blocks and the formação acadêmica summary, with no long timeline of dates", () => {
  assert.match(html, /Uma trajetória entre educação e tecnologia/);
  assert.match(html, /<h3>Educação Básica<\/h3>/);
  assert.match(html, /<h3>Ensino Superior<\/h3>/);
  assert.match(html, /<h3>Formação acadêmica<\/h3>/);
  assert.match(html, /<h3>Tecnologia educacional<\/h3>/);
  assert.match(html, /PROFMAT da Universidade Federal do Triângulo Mineiro/);
  assert.match(html, /Universidade Estadual de Campinas/);
  assert.match(html, /Análise e Desenvolvimento de Sistemas/);
  // No employer/school of employment named anywhere on the page.
  assert.doesNotMatch(html, /\bEscola\b/);
  assert.doesNotMatch(html, /\bColégio\b/);
  assert.doesNotMatch(html, /\bE\.E\.\b/i);
});

// ---- Três destaques de pesquisa ----

test("presents exactly three research highlights, with no fabricated DOI/journal/year/award, and a Lattes link closing the section", () => {
  const researchSection = html.match(/<h2>Pesquisa aplicada ao ensino e à tecnologia<\/h2>[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(researchSection, "research section not found");
  assert.match(researchSection, /Equações diferenciais em problemas de vazão e mistura de fluidos/);
  assert.match(researchSection, /Simulações computacionais no ensino de Física/);
  assert.match(researchSection, /Desempenho de algoritmos de ordenação/);
  assert.equal((researchSection.match(/class="sobre-research-item"/g) ?? []).length, 3, "expected exactly 3 research highlight cards");
  assert.doesNotMatch(researchSection, /\bDOI\b/i);
  assert.doesNotMatch(researchSection, /\bISSN\b/i);
  assert.match(researchSection, new RegExp(`href="${LATTES_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Ver a produção acadêmica completa`));
});

// ---- Transparência ----

test("includes the transparency section and its four principles", () => {
  assert.match(html, /Transparência como princípio/);
  assert.match(html, /O Tempo Docente organiza informações provenientes de documentos e bases oficiais/);
  assert.match(html, /<h3>Utilidade<\/h3>/);
  assert.match(html, /<h3>Transparência<\/h3>/);
  assert.match(html, /<h3>Clareza<\/h3>/);
  assert.match(html, /<h3>Responsabilidade<\/h3>/);
});

// ---- Encerramento ----

test("closing section has the four expected actions", () => {
  const closing = html.match(/<section class="section sobre-closing">[^]*?<\/section>/)?.[0] ?? "";
  assert.ok(closing, "closing section not found");
  assert.match(closing, /O Tempo Docente é um projeto independente/);
  assert.match(closing, /href="\/bncc">Explorar a BNCC/);
  assert.match(closing, /href="\/saresp">Consultar o SARESP/);
  assert.match(closing, new RegExp(`href="${LATTES_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"[^>]*>Conhecer o currículo Lattes`));
  assert.match(closing, /href="mailto:tempodocente@gmail\.com">Enviar um e-mail/);
});

// ---- Links de Lattes e e-mail em toda a página ----

test("every Lattes link points to the approved HTTPS URL, and every mailto uses the approved provisional address", () => {
  const lattesLinks = [...html.matchAll(/href="(https?:\/\/[^"]*lattes[^"]*)"/gi)].map((m) => m[1]);
  assert.ok(lattesLinks.length > 0, "no Lattes links found");
  for (const href of lattesLinks) {
    assert.equal(href, LATTES_URL, `Lattes link should use the approved HTTPS URL, found ${href}`);
  }

  const mailtoLinks = [...html.matchAll(/href="mailto:([^"]+)"/g)].map((m) => m[1]);
  assert.ok(mailtoLinks.length > 0, "no mailto links found on /sobre");
  for (const address of mailtoLinks) {
    assert.equal(address, CONTACT_EMAIL, `mailto should use ${CONTACT_EMAIL}, found ${address}`);
  }
});

test("the old non-functional email never appears on /sobre", () => {
  assert.doesNotMatch(html, new RegExp(OLD_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")));
});

// ---- Metadata e canonical ----

test("metadata: title, description, canonical, and Open Graph are set correctly", () => {
  assert.match(html, /<link rel="canonical" href="https:\/\/tempodocente\.com\.br\/sobre"/);
  assert.match(html, /<meta name="description" content="Conheça o Professor Alexandre Pedroso, mestre em Matemática e criador do Tempo Docente/);
  assert.match(html, /<meta property="og:title" content="Sobre o Tempo Docente \| Professor Alexandre Pedroso"/);
  assert.match(html, /<meta property="og:url" content="https:\/\/tempodocente\.com\.br\/sobre"/);
});

// ---- JSON-LD ----

test("JSON-LD ProfilePage/Person is present, valid, and contains only approved fields", () => {
  const scriptMatch = html.match(/<script type="application\/ld\+json">([^]*?)<\/script>/);
  assert.ok(scriptMatch, "JSON-LD script tag not found");
  let data;
  assert.doesNotThrow(() => { data = JSON.parse(scriptMatch[1]); }, "JSON-LD must be valid, parseable JSON");

  assert.equal(data["@type"], "ProfilePage");
  assert.equal(data.url, "https://tempodocente.com.br/sobre");
  assert.equal(data.isPartOf?.name, "Tempo Docente");

  const person = data.mainEntity;
  assert.equal(person["@type"], "Person");
  assert.equal(person.name, "Alexandre Pedroso");
  assert.equal(person.alternateName, undefined, "alternateName should not be published — only the approved professional name is used");
  assert.equal(person.jobTitle, "Professor de Matemática");
  assert.deepEqual(person.sameAs, [LATTES_URL]);

  // Nothing not on the approved list: no employer, school, phone, address, personal
  // email, nonexistent social profile, or unproven credential/award.
  const serialized = JSON.stringify(data);
  assert.doesNotMatch(serialized, /telefone|phone|address|endereco|endereço/i);
  assert.doesNotMatch(serialized, /@gmail|@hotmail|@yahoo|mailto/i);
  assert.doesNotMatch(serialized, /linkedin|instagram|facebook|twitter|x\.com/i);
  assert.doesNotMatch(serialized, /\bEscola\b|\bColégio\b/);
  assert.doesNotMatch(serialized, /prêmio|premiação|award/i);
  assert.doesNotMatch(serialized, /Alexandre da Silva Pedroso/);

  // The script tag itself must not be prematurely closed by an unescaped "<" — the
  // page escapes "<" to < specifically to guarantee this.
  assert.doesNotMatch(scriptMatch[1], /<\/script/i);
});

test("the full legal name never appears anywhere on /sobre — only 'Alexandre Pedroso' is published", () => {
  assert.doesNotMatch(html, /Alexandre da Silva Pedroso/);
});

// ---- Navegação: Sobre no menu mobile também ----

test("the mobile menu also includes a 'Sobre' link to the real page", () => {
  const mobileNav = html.match(/<nav aria-label="Navegação móvel"[^]*?<\/nav>/)?.[0] ?? "";
  assert.ok(mobileNav, "mobile nav not found");
  assert.match(mobileNav, /href="\/sobre"[^>]*>Sobre</);
});

// ---- aria-current apenas no destino exato ----

test("aria-current=\"page\" appears on the Sobre link only when the URL is exactly /sobre, in both desktop and mobile nav", async () => {
  for (const [path, expectSobrePage] of [["/sobre", true], ["/", false], ["/bncc", false], ["/saresp", false]]) {
    const resp = await render(path);
    const pageHtml = await resp.text();
    const desktopNav = pageHtml.match(/<nav class="desktop-nav"[^]*?<\/nav>/)?.[0] ?? "";
    const mobileNav = pageHtml.match(/<nav aria-label="Navegação móvel"[^]*?<\/nav>/)?.[0] ?? "";

    for (const [navName, nav] of [["desktop", desktopNav], ["mobile", mobileNav]]) {
      const sobreMatch = nav.match(/<a href="\/sobre"([^>]*)>Sobre<\/a>/);
      assert.ok(sobreMatch, `${path} ${navName}: Sobre link not found`);
      assert.equal(/aria-current="page"/.test(sobreMatch[1]), expectSobrePage, `${path} ${navName}: Sobre aria-current mismatch`);

      // Never more than one aria-current="page" in the same nav at once.
      const currentCount = (nav.match(/aria-current="page"/g) ?? []).length;
      assert.ok(currentCount <= 1, `${path} ${navName}: more than one aria-current="page" found`);
    }
  }
});

// ---- Regressão: páginas e testes existentes continuam funcionando ----

test("homepage, /bncc and /saresp still render correctly alongside the new /sobre page", async () => {
  for (const path of ["/", "/bncc", "/saresp"]) {
    const resp = await render(path);
    assert.equal(resp.status, 200, `${path} should still render 200`);
  }
});
