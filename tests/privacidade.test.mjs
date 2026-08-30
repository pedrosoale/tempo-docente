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
  assert.match(html, /<meta name="description" content="Como o Tempo Docente protege a privacidade e pretende utilizar métricas agregadas/);
  assert.match(html, /<link rel="canonical" href="https:\/\/tempodocente\.com\.br\/privacidade"/);
});

test("metadata never claims the site already measures usage, nor promises no personal data collection at all", () => {
  const metaDescriptions = [...html.matchAll(/<meta (?:name="description"|property="og:description") content="([^"]*)"/g)].map((m) => m[1]);
  assert.ok(metaDescriptions.length >= 2, "expected both a description and an og:description");
  for (const description of metaDescriptions) {
    assert.doesNotMatch(description, /\bmede o uso\b|\bmedimos\b|\bcoleta(mos)? dados de uso\b/i, `metadata should not claim measurement is active: ${description}`);
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

test("names Cloudflare as the planned metrics provider, with an HTTPS link to its privacy policy", () => {
  assert.match(html, /fornecedor de métricas planejado para o Tempo Docente é a Cloudflare/i);
  const hrefPattern = new RegExp(`href="${CLOUDFLARE_PRIVACY_URL.replace(/[.*+?^${}()|[\]\\]/g, "\\$&")}"`);
  assert.match(html, hrefPattern);
  assert.match(html, /href="https:\/\/www\.cloudflare\.com\/privacypolicy\/"/, "Cloudflare link must use HTTPS");
});

test("explains that only aggregated access, usage and performance information is planned", () => {
  assert.match(html, /pretende utilizar\s+métricas agregadas de uso do site/);
  assert.match(html, /números de acesso, páginas visitadas e indicadores de desempenho\s+técnico/);
});

// ---- Estado atual: métricas ainda NÃO habilitadas ----

test("states unambiguously, near the top of the page, exactly WHAT is not enabled yet", () => {
  // The status must be specific: the Web Analytics beacon and the project's own product events —
  // not a blanket claim that no measurement of any kind exists.
  assert.match(html, /o beacon do Cloudflare Web Analytics e os eventos próprios de métricas do Tempo Docente\s+ainda não estão habilitados/);

  // "Near the top": the status must appear before the first <h2>, i.e. still in the intro section.
  const statusIndex = html.indexOf("ainda não estão habilitados");
  const firstH2Index = html.indexOf("<h2>");
  assert.ok(statusIndex > -1, "status sentence not found");
  assert.ok(firstH2Index > -1, "no <h2> found");
  assert.ok(statusIndex < firstH2Index, "the 'not enabled yet' status must appear before the first section heading");
});

test("never makes the over-broad claim that no measurement at all exists", () => {
  // The domain is proxied through Cloudflare, which can produce edge/operational traffic metrics
  // regardless of the Web Analytics beacon — so these blanket sentences would be inaccurate.
  assert.doesNotMatch(html, /Nenhuma ferramenta de\s+medição está ativa/);
  assert.doesNotMatch(html, /Nenhuma métrica está sendo processada hoje/);
  assert.doesNotMatch(html, /nenhuma contagem de acessos?/i);
});

test("acknowledges that Cloudflare's infrastructure can already produce aggregated operational metrics", () => {
  assert.match(html, /pode produzir métricas operacionais agregadas\s+sobre requisições e tráfego/);
  assert.match(html, /diferente do Cloudflare Web Analytics planejado e dos futuros\s+eventos próprios de produto/);
});

test("describes future metric use in conditional/planned language, never as already happening", () => {
  assert.match(html, /pretende utilizar/i);
  assert.match(html, /Quando habilitadas/i);
  assert.match(html, /poderão ser utilizadas/i);
});

test("never asserts in the present tense that the site already measures usage", () => {
  assert.doesNotMatch(html, /o Tempo Docente mede o uso do site/i);
  assert.doesNotMatch(html, /informações são medidas sobre o uso/i);
  assert.doesNotMatch(html, /Essas medições descrevem/i);
  assert.doesNotMatch(html, /<h2>O que medimos<\/h2>/);
});

test("never presents Web Analytics, Analytics Engine or own events as already active", () => {
  // "Cloudflare Web Analytics" may now be named — but only as the thing that is NOT yet enabled.
  assert.match(html, /O beacon do Cloudflare Web Analytics ainda não está habilitado, e os eventos próprios de\s+produto ainda não existem/);
  assert.doesNotMatch(html, /Analytics Engine/i);
  // An "is enabled/active" claim only counts as a violation when it is NOT negated before the
  // sentence ends — otherwise "os eventos próprios ainda não estão habilitados" would trip it.
  assert.doesNotMatch(html, /Web Analytics(?![^.]*não)[^.]{0,40}(está|estão) (ativo|habilitado)/i);
  assert.doesNotMatch(html, /eventos próprios(?![^.]*não)[^.]{0,40}(está|estão) (ativos?|habilitados?)/i);
});

test("records that the status will be updated when measurement is actually enabled", () => {
  assert.match(html, /será atualizado no mesmo momento em que a medição for efetivamente ativada/);
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

test("frames the limits as the project's own decisions, valid today and after metrics are enabled", () => {
  assert.match(html, /compromissos que dependem de decisões do próprio Tempo Docente/);
  assert.match(html, /Valem hoje e continuarão\s+valendo quando as métricas forem habilitadas/);
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
  assert.match(html, /os eventos próprios de\s+métricas não incluirão o texto livre de busca, nem nome ou código de escola, nem identificador\s+persistente/);
});

test("states metrics could only be used to improve content, navigation, performance and tools", () => {
  assert.match(html, /orientar melhorias no\s+conteúdo, na navegação, no desempenho e nas ferramentas/);
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

test("keeps the distinction between infrastructure processing and the planned product metrics", () => {
  assert.match(html, /processamento técnico de infraestrutura é diferente das métricas de produto/);
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

test("has no third-party analytics script, beacon, or token of any kind", () => {
  assert.doesNotMatch(html, /cloudflareinsights\.com/i);
  assert.doesNotMatch(html, /gtag\(|googletagmanager\.com|google-analytics\.com/i);
  assert.doesNotMatch(html, /data-cf-beacon|data-token/i);
  // No JSON-LD or other inline <script> block either — this page deliberately ships none
  // (the app's own /_next/static/chunks/*.js module scripts are the framework runtime, not analytics).
  assert.doesNotMatch(html, /<script type="application\/ld\+json">/i);
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
