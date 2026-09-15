// Verifica os links oficiais em InterpretacaoResultado.tsx (painel "Entenda este resultado"): o
// link da fonte da escala (catalogoEscalas.fonte.url) e o link do Boletim da Escola (constante
// BOLETIM_ESCOLA_URL, único ponto de acesso à distribuição percentual por nível encontrado na
// auditoria documental — ver relatório do piloto, rodada "2025"). O componente usa "@/lib/saeb/..."
// (alias de bundler) e JSX — nenhum dos dois roda sob `node --experimental-strip-types` puro (sem
// transformação de JSX), então, seguindo o mesmo padrão já usado em tests/navigation.test.mjs para
// SarespReport.tsx, este teste lê o código-fonte do componente como texto e verifica a
// estrutura/atributos dos links diretamente nele — sem renderizar nem acessar rede. A URL da fonte
// (que veio do catálogo real) é conferida separadamente importando lib/saeb/escalas.ts, que não usa
// JSX e roda normalmente.
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

import { catalogoEscalas } from "../lib/saeb/escalas.ts";

const source = readFileSync(new URL("../app/saeb/components/InterpretacaoResultado.tsx", import.meta.url), "utf-8");

// Isola só o bloco "Fonte:" (seção 7 do painel) antes de procurar o <a> dentro dele — o arquivo tem
// dois elementos <a> agora (o do Boletim da Escola, na seção 6, aparece primeiro no código-fonte),
// então um `match` ingênuo do primeiro <a>...</a> pegaria o link errado.
const fonteBlock = source.match(/<p className="saeb-fonte">[^]*?<\/p>/)?.[0] ?? "";
const linkBlock = fonteBlock.match(/<a\s[^]*?<\/a>/)?.[0] ?? "";

// Isola o link do Boletim da Escola (seção 6 — limites da interpretação) do mesmo jeito.
const boletimLinkBlock = source.match(/<a href=\{BOLETIM_ESCOLA_URL\}[^]*?<\/a>/)?.[0] ?? "";

test("o link da fonte existe e usa a URL do catálogo — nunca uma URL escrita à mão no componente", () => {
  assert.ok(linkBlock, "nenhum elemento <a> encontrado no bloco da fonte");
  assert.match(linkBlock, /href=\{catalogoEscalas\.fonte\.url\}/, "href precisa vir de catalogoEscalas.fonte.url, não de uma string literal");
});

test("a única URL escrita à mão no arquivo é a constante nomeada BOLETIM_ESCOLA_URL, declarada uma única vez — nenhuma outra URL literal solta no JSX", () => {
  const semDeclaracaoDoBoletim = source.replace(/const BOLETIM_ESCOLA_URL = "https:\/\/[^"]+";/, "");
  assert.notEqual(semDeclaracaoDoBoletim, source, "a declaração de BOLETIM_ESCOLA_URL não foi encontrada para ser removida da checagem");
  assert.doesNotMatch(semDeclaracaoDoBoletim, /https:\/\//, "nenhuma outra URL deveria estar escrita à mão no componente");
  assert.match(boletimLinkBlock, /href=\{BOLETIM_ESCOLA_URL\}/, "o link do Boletim da Escola precisa usar a constante, não uma string literal no JSX");
});

test("o link do Boletim da Escola abre em nova aba com os atributos de segurança corretos", () => {
  assert.ok(boletimLinkBlock, "nenhum elemento <a href={BOLETIM_ESCOLA_URL}> encontrado no componente");
  assert.match(boletimLinkBlock, /target="_blank"/);
  assert.match(boletimLinkBlock, /rel="noopener noreferrer"/);
});

test("o link abre em nova aba com os atributos de segurança corretos", () => {
  assert.match(linkBlock, /target="_blank"/);
  assert.match(linkBlock, /rel="noopener noreferrer"/);
});

test("o link tem um nome acessível claro, no formato 'Abrir <título> no site do Inep'", () => {
  assert.match(linkBlock, /aria-label=\{`Abrir \$\{catalogoEscalas\.fonte\.titulo\} no site do Inep`\}/);
});

test("o texto visível do link é o título da publicação (catalogoEscalas.fonte.titulo)", () => {
  assert.match(linkBlock, />\s*\{catalogoEscalas\.fonte\.titulo\}\s*</);
});

test("órgão, versão da publicação, quadro e páginas continuam presentes na citação da fonte, fora do link", () => {
  assert.match(source, /catalogoEscalas\.fonte\.orgao/);
  assert.match(source, /catalogoEscalas\.fonte\.versaoPublicacao/);
  assert.match(source, /estado\.escala\.quadro/);
  assert.match(source, /estado\.faixa\.paginasImpressas\.join/);
  assert.match(source, /estado\.faixa\.paginasPdf\.join/);
});

test("o aviso de que a classificação representa a média da escola, não cada estudante, continua presente", () => {
  assert.match(source, /não descreve o desempenho de cada estudante\s*\n?\s*individualmente/);
});

test("a URL usada pelo link é, de fato, a URL real do catálogo gerado (HTTPS, domínio oficial do Inep)", () => {
  const url = new URL(catalogoEscalas.fonte.url);
  assert.equal(url.protocol, "https:");
  assert.ok(url.hostname === "inep.gov.br" || url.hostname.endsWith(".inep.gov.br"), `host inesperado: ${url.hostname}`);
});

// ---- Guardas negativas — revisão técnica final ----
// O componente nunca deve imprimir uma frase que a documentação não sustenta ou que confunda a
// classificação da média da escola com a situação individual de cada estudante. As frases abaixo
// buscam pelo texto literal AUTORADO pelo componente (className, atributos, strings fixas) — o
// texto de descricaoOficial em si (citação oficial do Inep, ex.: "os estudantes provavelmente são
// capazes de") não é varrido aqui porque vem do catálogo, não é escrito à mão neste arquivo.
const jsxLiterals = [...source.matchAll(/>([^{<][^<]*)</g)].map((m) => m[1]).join(" ");

test("nunca afirma que 2025 (ou qualquer edição) é 'incompatível' com a escala", () => {
  assert.doesNotMatch(source.toLowerCase(), /incompat/);
});

test("nunca diz 'a escola está no nível' sem qualificar que é a média — a frase sempre passa por 'a proficiência média da escola'", () => {
  assert.doesNotMatch(jsxLiterals, /\ba escola está no nível\b/i);
  assert.doesNotMatch(jsxLiterals, /\ba escola pertence ao nível\b/i);
  assert.match(source, /A proficiência média da escola foi/);
  assert.match(source, /Esse resultado situa-se/);
});

test("nunca diz que 'os estudantes estão no nível X' (só o vocabulário oficial 'provavelmente são capazes de', citado verbatim do Inep)", () => {
  assert.doesNotMatch(jsxLiterals, /os estudantes est(ã|a)o no n[íi]vel/i);
});

test("nunca cria correspondência automática com códigos da BNCC — nenhuma menção a BNCC ou 'código' no componente", () => {
  assert.doesNotMatch(source, /BNCC/);
  assert.doesNotMatch(jsxLiterals, /código\s+da\s+bncc/i);
});

test("nunca promete que a distribuição percentual por nível está disponível no Tempo Docente — só o link para consulta manual externa", () => {
  assert.doesNotMatch(jsxLiterals, /dispon[íi]vel\s+(aqui|no tempo docente|nesta ferramenta)/i);
  assert.match(source, /não contém a\s*\n?\s*distribuição percentual de estudantes por nível/);
  assert.match(source, /este painel não a preenche automaticamente/);
});

test("o painel nunca troca a edição selecionada — só existe um único useState (o toggle LP/MT), edicao chega e é usada apenas como prop de leitura", () => {
  // Nenhum <select>, nenhum setter de edição, nenhuma chamada a um setter que não seja
  // setComponente (o único estado interno do painel é o toggle LP/MT).
  assert.doesNotMatch(source, /<select/);
  const setters = [...source.matchAll(/\bset[A-Z]\w*\(/g)].map((m) => m[0]);
  for (const setter of setters) {
    assert.match(setter, /^setComponente\(/, `setter inesperado encontrado no painel: ${setter} — só setComponente deveria existir`);
  }
  // `edicao` (a prop) só é lida, nunca reatribuída — nenhuma ocorrência de "edicao =" (atribuição).
  assert.doesNotMatch(source, /\bedicao\s*=(?!=)[^=]/);
});
