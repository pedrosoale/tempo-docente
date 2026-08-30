import assert from "node:assert/strict";
import { readFileSync, readdirSync } from "node:fs";
import { join } from "node:path";
import test from "node:test";
import { fileURLToPath } from "node:url";

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

const CONTACT_EMAIL = "tempodocente@gmail.com";
const CLOUDFLARE_PRIVACY_URL = "https://www.cloudflare.com/privacypolicy/";

const response = await render("/privacidade");
const html = await response.text();

test("/privacidade renders with status 200", () => {
  assert.equal(response.status, 200);
});

// ---- Título, description e canonical ----

test("metadata: title, description and canonical are correct", () => {
  assert.match(html, /<title>Privacidade \| Tempo Docente<\/title>/);
  assert.match(html, /<meta name="description" content="Como o Tempo Docente utiliza métricas agregadas da Cloudflare/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tempodocente\.com\.br\/privacidade"/);
});

test("metadata describes metric use in the present tense, without a blanket no-personal-data promise", () => {
  const metaDescriptions = [...html.matchAll(/<meta (?:name="description"|property="og:description") content="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(metaDescriptions.length >= 2, "expected both a description and an og:description");
  for (const description of metaDescriptions) {
    // Present tense: Web Analytics IS active, so "pretende utilizar" would now be wrong.
    assert.match(description, /utiliza métricas agregadas da Cloudflare/i, `metadata should describe metric use in the present: ${description}`);
    assert.doesNotMatch(description, /pretende utilizar/i, `metadata should not frame metrics as merely planned: ${description}`);
    assert.doesNotMatch(description, /sem coleta de dados pessoais/i, `metadata should not make a blanket no-personal-data promise: ${description}`);
  }
});

// ---- Heading principal ----

test("the main heading is exactly 'Privacidade'", () => {
  assert.match(html, /<h1>Privacidade<\/h1>/);
});

// ---- Informações essenciais obrigatórias ----

test("states there is no signup/login for the tools", () => {
  assert.match(html, /sem cadastro e\s+sem login/i);
  assert.match(html, /Não exige cadastro ou login/i);
});

test("states the absence of ads, remarketing and individual profiles", () => {
  assert.match(html, /Não exibe publicidade nem faz remarketing/);
  assert.match(html, /Não cria nem pretende criar perfis individuais de visitantes/);
});

test("states the absence of analytics cookies", () => {
  assert.match(html, /Não usa nem pretende usar cookies de analytics/);
});

test("names Cloudflare as the party that processes the metrics, in the present, with an HTTPS link to its policy", () => {
  assert.match(html, /Quem processa essas métricas é a Cloudflare/i);
  assert.match(html, /<h2>Quem processa essas métricas<\/h2>/);
  assert.doesNotMatch(html, /fornecedor de métricas planejado/i, "Cloudflare is no longer merely 'planned' — Web Analytics is active");
  const hrefPattern = new RegExp(`href="${CLOUDFLARE_PRIVACY_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  assert.match(html, hrefPattern);
  assert.match(html, /href="https:\/\/www\.cloudflare\.com\/privacypolicy\/"/, "Cloudflare link must use HTTPS");
});

// ---- Estado atual: Web Analytics ATIVO, eventos próprios ainda não ----

test("declares unambiguously, near the top, that Cloudflare Web Analytics IS active on the domain", () => {
  assert.match(html, /No domínio tempodocente\.com\.br, o Cloudflare Web Analytics está ativo por injeção automática da\s+infraestrutura da Cloudflare/);
  assert.match(html, /Os eventos próprios de métricas do Tempo Docente ainda não existem/);

  // "Near the top": the status must appear before the first <h2>, i.e. still in the intro section.
  const statusIndex = html.indexOf("está ativo por injeção automática");
  const firstH2Index = html.indexOf("<h2>");
  assert.ok(statusIndex > -1, "status sentence not found");
  assert.ok(firstH2Index > -1, "no <h2> found");
  assert.ok(statusIndex < firstH2Index, "the status must appear before the first section heading");
});

test("no longer claims the beacon is disabled, planned, or merely upcoming", () => {
  // Web Analytics is demonstrably active in production (beacon.min.js + POSTs to /cdn-cgi/rum),
  // so every "not enabled yet / planned" formulation would now be false.
  assert.doesNotMatch(html, /beacon[^.]{0,80}ainda não está habilitado/i);
  assert.doesNotMatch(html, /ainda não estão habilitados/i);
  assert.doesNotMatch(html, /Cloudflare Web Analytics planejado/i);
  assert.doesNotMatch(html, /fornecedor de métricas planejado/i);
  assert.doesNotMatch(html, /Nenhuma métrica está sendo processada hoje/);
  assert.doesNotMatch(html, /Nenhuma ferramenta de\s+medição está ativa/);
});

test("keeps the three measurement layers clearly distinguished", () => {
  // 1) infrastructure operational metrics
  assert.match(html, /Métricas operacionais da infraestrutura\./);
  assert.match(html, /pode produzir métricas agregadas sobre requisições e tráfego/);
  // 2) Cloudflare Web Analytics — active
  assert.match(html, /Cloudflare Web Analytics — ativo\./);
  // 3) own product events — do not exist yet
  assert.match(html, /Eventos próprios do Tempo Docente — ainda não existem\./);
  assert.match(html, /não devem ser confundidas com o\s+Cloudflare Web Analytics/);
});

test("explains how the beacon works: edge-injected by the zone config, not in the repo, measuring pageviews and performance via /cdn-cgi/rum", () => {
  assert.match(html, /inserido automaticamente na borda da rede da Cloudflare, pela configuração da\s+zona/);
  assert.match(html, /não está incorporado manualmente ao repositório do projeto/);
  assert.match(html, /mede visualizações de páginas e indicadores de\s+desempenho/);
  assert.match(html, /\/cdn-cgi\/rum/);
  assert.match(html, /não aparece\s+nas versões de teste/);
});

test("does not claim the project lacks control over Web Analytics — only that it is not embedded in the repo", () => {
  // The zone owner can enable, disable and configure Web Analytics in the Cloudflare dashboard,
  // so framing it as outside the project's control would be inaccurate.
  assert.doesNotMatch(html, /só a terceira\s+depende de uma decisão do Tempo Docente/);
  assert.doesNotMatch(html, /não depende(m)? (de uma decisão|do controle) do Tempo Docente/i);
  assert.doesNotMatch(html, /fora do controle do Tempo Docente/i);
});

test("separates the three layers by origin, purpose and level of control", () => {
  assert.match(html, /Vale separá-las porque possuem origens,\s+finalidades e níveis de controle diferentes/);
});

test("keeps only the project's OWN future events in conditional language", () => {
  assert.match(html, /ainda não existem/i);
  assert.match(html, /possibilidade futura/i);
  // The active layers must be described in the present, not as something planned.
  assert.match(html, /<h2>O que é medido<\/h2>/);
  assert.match(html, /<h2>Para que essas informações são usadas<\/h2>/);
});

test("never presents the Analytics Engine or own product events as already active", () => {
  assert.doesNotMatch(html, /Analytics Engine/i);
  assert.doesNotMatch(html, /eventos próprios(?![^.]*não)[^.]{0,40}(está|estão) (ativos?|habilitados?)/i);
});

test("promises to update the page before OWN events start, not when the beacon gets enabled", () => {
  assert.match(html, /se\s+o Tempo Docente passar a coletar eventos próprios de produto, esta página será atualizada antes de\s+isso entrar em vigor/);
  assert.doesNotMatch(html, /será atualizado no mesmo momento em que a medição for efetivamente ativada/);
});

test("scopes the search-text, school and persistent-identifier commitments to the project's OWN product events", () => {
  // These are things the Tempo Docente controls (what it chooses to send), not blanket promises
  // about what the infrastructure may process.
  assert.match(html, /Não incluirá o texto livre digitado nas buscas nos eventos próprios de métricas do produto/);
  assert.match(html, /Não incluirá nome ou código de escola nos eventos próprios de métricas do produto/);
  assert.match(html, /Não criará identificador persistente de visitante nos eventos próprios de métricas do produto/);
  assert.match(html, /Não usa nem pretende usar técnicas de fingerprinting/i);
  assert.match(html, /Não usa nem pretende usar cookies de analytics/);
  assert.match(html, /Não cria nem pretende criar perfis individuais de visitantes/);
});

test("never promises, in absolute terms, that search text or school identity are never collected anywhere", () => {
  assert.doesNotMatch(html, /Não coletará o texto que você digita nos campos de busca/);
  assert.doesNotMatch(html, /Não registrará nome ou código de escola nas informações de uso/);
});

test("frames the limits as the project's own decisions, valid today and if own events ever exist", () => {
  assert.match(html, /compromissos que dependem de decisões do próprio Tempo Docente/);
  assert.match(html, /Valem hoje e\s+continuarão valendo caso os eventos próprios de produto venham a existir/);
});

// ---- URLs e caminhos: processados tecnicamente pela infraestrutura ----

test("discloses that the requested URL and request path are among the technical data processed", () => {
  assert.match(html, /Entre essas informações técnicas estão a URL solicitada e o caminho da requisição/);
});

test("explains concretely why that matters: BNCC search is a URL parameter and SARESP loads a per-school path", () => {
  assert.match(html, /a busca da BNCC aparece como\s+parâmetro no endereço da página/);
  assert.match(html, /carrega um arquivo de dados cujo\s+caminho contém o código dessa escola/);
  assert.match(html, /o Tempo Docente não tem como impedir isso/);
});

test("locates the project's real commitment in what it chooses to send, not in what infrastructure processes", () => {
  assert.match(html, /O compromisso do projeto está no que ele decide enviar/);
  assert.match(html, /caso esses eventos passem a\s+existir, não incluirão o texto livre de busca, nem nome ou código de escola, nem identificador\s+persistente/);
});

test("attributes the 'improvement' purpose specifically to the Web Analytics reports available to the project", () => {
  assert.match(html, /As métricas agregadas disponibilizadas ao Tempo Docente pelo Cloudflare Web Analytics são usadas pelo\s+projeto para orientar melhorias no conteúdo, na navegação, no desempenho e nas ferramentas/);
});

test("keeps the infrastructure's own purposes (delivery, security, operation, abuse prevention) distinct from product improvement", () => {
  assert.match(html, /O processamento técnico realizado pela infraestrutura da Cloudflare também atende à entrega das\s+páginas, à segurança, à operação do serviço e à prevenção de abusos/);
});

test("keeps the no-advertising / no-resale / no-individual-identification commitment", () => {
  assert.match(html, /Nada disso é usado pelo Tempo Docente para publicidade, venda a terceiros ou qualquer forma de\s+identificação individual/);
});

test("limits the 'collective use' claim to the Web Analytics reports, not to operational metrics generally", () => {
  assert.match(html, /Os relatórios agregados do Cloudflare Web Analytics descrevem o uso coletivo do site e não têm a\s+finalidade de identificar uma pessoa específica/);
  assert.doesNotMatch(html, /As métricas das duas primeiras camadas descrevem o comportamento coletivo/);
  assert.doesNotMatch(html, /métricas operacionais[^.]{0,60}comportamento coletivo/i);
});

// ---- Explicação sobre endereço IP e infraestrutura ----

test("explains IP processing by purpose (delivery, security, abuse detection, infrastructure), not by a made-up duration", () => {
  assert.match(html, /endereço IP de\s+origem, para entregar as páginas, manter a segurança, detectar abusos e operar a infraestrutura/);
  // The earlier, over-promising wording must be gone.
  assert.doesNotMatch(html, /pelo tempo necessário para responder à requisição/);
});

test("defers retention periods to Cloudflare's own policies, without inventing a deadline", () => {
  assert.match(html, /períodos de retenção[^]{0,80}seguem as políticas da própria\s+Cloudflare/);
  assert.match(html, /O Tempo Docente não\s+define esses prazos\./);
  // No invented concrete retention window.
  assert.doesNotMatch(html, /retid[oa]s? por \d+|retenção de \d+\s*(dias|meses|anos)/i);
});

test("states the project does not intend to use IP for individual profiles or to identify teachers", () => {
  assert.match(html, /não pretende usar o endereço IP para criar perfis individuais nem para\s+identificar professores/);
});

test("keeps the distinction between infrastructure processing and the not-yet-existing own product events", () => {
  assert.match(html, /processamento técnico de infraestrutura é diferente dos eventos próprios de produto, que ainda\s+não existem/);
});

// ---- Nenhuma promessa ampla de "sem coleta de dados pessoais" ----

test("makes no blanket 'no personal data is collected' promise anywhere on the page", () => {
  assert.doesNotMatch(html, /sem coleta de dados pessoais/i);
  assert.doesNotMatch(html, /não coletamos nenhum dado pessoal/i);
  assert.doesNotMatch(html, /nenhum dado pessoal é coletado/i);
});

test("has the correct contact channel and an updated-on date", () => {
  assert.match(html, new RegExp(`mailto:${CONTACT_EMAIL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}`));
  assert.match(html, /Última atualização: 30 de agosto de 2026\./);
});

// ---- Cuidados de redação: nada de parecer jurídico, nada de ferramentas ainda não usadas ----

test("makes no categorical legal claims and cites no LGPD legal basis", () => {
  assert.doesNotMatch(html, /base legal|fundamento legal|art(igo)?\.?\s*\d+.{0,20}(LGPD|lei)/i);
  assert.doesNotMatch(html, /garantimos legalmente|em conformidade com a LGPD/i);
});

test("never claims the Analytics Engine or Phase 2 product events are already active", () => {
  assert.doesNotMatch(html, /Analytics Engine/i);
  assert.doesNotMatch(html, /já (coletamos|medimos|registramos) (eventos|interações)/i);
});

test("never mentions GA4, Google Analytics, Google Tag Manager, Zaraz or Plausible", () => {
  assert.doesNotMatch(html, /\bGA4\b|Google Analytics|Google Tag Manager|\bZaraz\b|\bPlausible\b/i);
});

// ---- Ausência de scripts/beacons de analytics e de tokens ----

// IMPORTANT — what this test does and does NOT assert.
//
// It asserts only that THE PROJECT does not embed any analytics script, token or beacon
// attribute of its own into the HTML it produces. That is the part the codebase controls.
//
// It deliberately does NOT assert that no beacon reaches the visitor's browser in production.
// On tempodocente.com.br the Cloudflare Web Analytics beacon IS active: Cloudflare injects it
// automatically at the edge of its zone, as the HTML response passes through, and the browser
// then POSTs to /cdn-cgi/rum. That injection happens after this HTML leaves the Worker, so it
// is invisible both to this render and to the workers.dev preview, which sits outside the zone.
// Asserting "no beacon in production" here would therefore be false — see the page copy, which
// documents the active beacon explicitly.
test("the project itself embeds no analytics script, token or beacon attribute in the HTML it produces", () => {
  assert.doesNotMatch(html, /cloudflareinsights\.com/i, "the project must not hardcode the Cloudflare beacon script");
  assert.doesNotMatch(html, /gtag\(|googletagmanager\.com|google-analytics\.com/i);
  assert.doesNotMatch(html, /data-cf-beacon|data-token/i, "the project must not hardcode a beacon token/attribute");
  assert.doesNotMatch(html, /\bZaraz\b|\bPlausible\b/i);
  // No JSON-LD or other inline <script> block either — this page deliberately ships none
  // (the app's own /_next/static/chunks/*.js module scripts are the framework runtime, not analytics).
  assert.doesNotMatch(html, /<script type="application\/ld\+json">/i);
});

test("the repository contains no manual analytics implementation anywhere in app/ or worker/", () => {
  // Complements the render-level check above: guards the source itself, so a beacon can never be
  // added by hand without this test failing. Edge injection by Cloudflare is out of scope here.
  const offenders = [];
  for (const root of ["app", "worker"]) {
    const rootDir = fileURLToPath(new URL(`../${root}`, import.meta.url));
    for (const entry of readdirSync(rootDir, { recursive: true, withFileTypes: true })) {
      if (!entry.isFile() || !/\.(tsx?|jsx?|mjs|css)$/.test(entry.name)) continue;
      const full = join(entry.parentPath ?? entry.path, entry.name);
      if (/cloudflareinsights\.com|data-cf-beacon|googletagmanager|google-analytics\.com|gtag\(/i.test(readFileSync(full, "utf-8"))) {
        offenders.push(full);
      }
    }
  }
  assert.deepEqual(offenders, [], `unexpected analytics implementation found in: ${offenders.join(", ")}`);
});

// ---- Link no Footer ----

test("the Footer links to /privacidade with the label 'Privacidade'", () => {
  const footerBlock = html.match(/<footer class="footer">[^]*?<\/footer>/)?.[0] ?? "";
  assert.ok(footerBlock, "footer not found");
  assert.match(footerBlock, /href="\/privacidade">Privacidade</);
});

// ---- Regressão: Header, Footer e demais páginas continuam funcionando ----

test("homepage, /bncc, /saresp and /sobre still render correctly alongside the new /privacidade page", async () => {
  for (const path of ["/", "/bncc", "/saresp", "/sobre"]) {
    const resp = await render(path);
    assert.equal(resp.status, 200, `${path} should still render 200`);
  }
});
