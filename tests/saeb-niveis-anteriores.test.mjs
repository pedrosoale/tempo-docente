// Testes da rodada "redação e consulta cumulativa aos níveis anteriores" — cobre a nova redação do
// resultado (InterpretacaoResultado.tsx) e a consulta opcional aos níveis anteriores da escala. O
// componente usa JSX e o alias "@/" — nenhum dos dois roda sob `node --experimental-strip-types`
// puro (sem transformação de JSX), então, seguindo o mesmo padrão já usado em
// tests/saeb-interpretacao-fonte-link.test.mjs e tests/navigation.test.mjs (SarespReport.tsx), este
// arquivo lê o código-fonte do componente como texto e confere a estrutura/redação diretamente nele
// — sem renderizar, sem rede. O comportamento puro por trás da consulta aos níveis anteriores
// (ordem, exclusão de níveis posteriores, tratamento do Nível 0, funcionamento nas seis escalas e em
// 2025) já está coberto, com testes unitários de verdade, em tests/saeb-interpretacao.test.mjs
// (faixasAnteriores, linhasDaDescricaoSemIntroducaoOficial, comPreposicao).
import assert from "node:assert/strict";
import test from "node:test";
import { readFileSync } from "node:fs";

const source = readFileSync(new URL("../app/saeb/components/InterpretacaoResultado.tsx", import.meta.url), "utf-8");

// Só o texto de literais JSX (não nomes de classe, não comentários) — mesma técnica já usada em
// tests/saeb-interpretacao-fonte-link.test.mjs para as guardas negativas.
const jsxLiterals = [...source.matchAll(/>([^{<][^<]*)</g)].map((m) => m[1]).join(" ");

// ---- 1, 2, 3 — nova redação, presente ----

test("a nova frase de resultado ('A proficiência média da escola foi...') está presente, com o valor e o componente dinâmicos", () => {
  assert.match(source, /A proficiência média da escola foi <strong>\{formatarValorIndicador\(estado\.valor\)\}<\/strong>/);
  assert.match(source, /Esse resultado situa-se/);
  assert.match(source, /da escala de \{info\.label\} do SAEB/);
});

test("o título da seção usa o padrão dinâmico 'O que caracteriza <nível> na escala do SAEB'", () => {
  assert.match(source, /<h5>O que caracteriza \{comPreposicao\("o", estado\.faixa\.nomeNivel\)\} na escala do SAEB<\/h5>/);
});

test("a explicação de que os níveis são cumulativos está presente, com o número do nível dinâmico", () => {
  assert.match(source, /Na escala do SAEB, os níveis são cumulativos\. Para \{comPreposicao\("o", faixa\.nomeNivel\)\}, o Inep descreve as/);
  assert.match(source, /seguintes habilidades, além das previstas nos níveis anteriores/);
});

test("o intervalo numérico oficial continua presente, como apresentação complementar (não é a frase principal)", () => {
  assert.match(source, /\{estado\.faixa\.nomeNivel\} — intervalo oficial: \{textoIntervalo\(estado\.faixa\)\}/);
});

// ---- 4 — formulação antiga removida ----

test("a formulação isolada antiga ('Além das habilidades anteriormente citadas...') nunca é escrita à mão no componente", () => {
  // A frase ainda existe dentro do catálogo oficial (descricaoOficial) — o que este teste garante é
  // que ela não é uma string AUTORADA no componente (nem hardcoded, nem reintroduzida por engano);
  // a remoção em tempo de exibição é feita por linhasDaDescricaoSemIntroducaoOficial, testada à
  // parte em tests/saeb-interpretacao.test.mjs.
  assert.doesNotMatch(source, /Além das habilidades anteriormente citadas/);
  assert.doesNotMatch(source, /"Os estudantes provavelmente são capazes de:"/);
});

test("o componente usa linhasDaDescricaoSemIntroducaoOficial (de lib/saeb/interpretacao) para toda descrição exibida — nunca .descricaoOficial.split direto", () => {
  assert.match(source, /linhasDaDescricaoSemIntroducaoOficial\(faixa\)\.map/);
  assert.doesNotMatch(source, /faixa\.descricaoOficial\.split/);
  assert.doesNotMatch(source, /estado\.faixa\.descricaoOficial\.split/);
});

// ---- 5–9, 15 — estrutura da consulta aos níveis anteriores ----

test("o nível atual continua sempre visível, fora de qualquer <details> — nunca escondido atrás de um controle", () => {
  const corpo = source.match(/estado\.tipo === "resolvido" && \(\s*<div className="saeb-interpretacao-corpo">[\s\S]*?\n {6}\)\)?\}/)?.[0] ?? "";
  assert.ok(corpo, "bloco do corpo resolvido não encontrado");
  const antesDoToggle = corpo.split("saeb-interpretacao-niveis-anteriores")[0];
  assert.match(antesDoToggle, /<h5>O que caracteriza/, "o título/descrição do nível atual deveria vir antes do toggle de níveis anteriores, sem estar dentro de um <details>");
});

test("o controle 'Ver habilidades dos níveis anteriores' só aparece quando há ao menos um nível anterior (niveisAnteriores.length > 0)", () => {
  assert.match(source, /\{niveisAnteriores\.length > 0 && \(/);
  assert.match(source, /Ver habilidades dos níveis anteriores/);
});

test("cada nível anterior é um <details> independente, com seu próprio <summary> — nunca uma lista única misturando níveis", () => {
  assert.match(source, /<details key=\{faixaAnterior\.nivel\} className="saeb-interpretacao-nivel-anterior">/);
  assert.match(source, /<summary>\s*<ChevronDown[^]*?\{faixaAnterior\.nomeNivel\}/);
});

test("a lista de níveis anteriores vem de faixasAnteriores(estado.escala, estado.faixa.nivel) — nunca de escala.niveis direto (que incluiria o nível atual e os posteriores)", () => {
  assert.match(source, /faixasAnteriores\(estado\.escala, estado\.faixa\.nivel\)/);
  assert.doesNotMatch(source, /estado\.escala\.niveis\.filter/);
  assert.doesNotMatch(source, /estado\.escala\.niveis\.map/);
});

test("o nível atual nunca é duplicado dentro da lista de níveis anteriores — o mesmo componente ConteudoNivel é usado uma vez para o atual e uma vez por nível anterior, nunca os dois num mesmo array", () => {
  const usosDeConteudoNivel = [...source.matchAll(/<ConteudoNivel faixa=\{([^}]+)\}/g)].map((m) => m[1]);
  assert.deepEqual(usosDeConteudoNivel, ["estado.faixa", "faixaAnterior"]);
});

// ---- 12 — tratamento do Nível 0 ----

test("o Nível 0 (descrição geral, sem lista de habilidades) tem um rótulo próprio, sem a frase de cumulatividade", () => {
  assert.match(source, /O Inep descreve este nível da seguinte forma/);
  // A frase de cumulatividade só deve aparecer no branch de nivel > 0.
  const indiceCumulativo = source.indexOf("Na escala do SAEB, os níveis são cumulativos");
  const indiceGeral = source.indexOf("O Inep descreve este nível da seguinte forma");
  assert.ok(indiceCumulativo > -1 && indiceGeral > -1, "as duas frases deveriam estar presentes");
  assert.match(source, /faixa\.nivel > 0 \? \(/, "o branch precisa distinguir nivel > 0 do nível 0");
});

// ---- 13, 14 — ausência do controle / dos acordeões ----

test("o bloco inteiro de níveis (atual + anteriores) só existe quando estado.tipo === 'resolvido' — sem classificação, nada aparece", () => {
  assert.match(source, /\{estado\.tipo === "resolvido" && \(\s*<div className="saeb-interpretacao-corpo">/);
});

// ---- Acessibilidade ----

test("usa <details>/<summary> nativos para os acordeões — nunca uma div clicável", () => {
  assert.match(source, /<details/);
  assert.match(source, /<summary>/);
  assert.doesNotMatch(source, /<div[^>]*onClick/);
});

test("os ícones de chevron são puramente decorativos (aria-hidden) — o nome acessível do controle vem só do texto do <summary>", () => {
  const chevronBlocks = [...source.matchAll(/<ChevronDown[^/]*\/>/g)].map((m) => m[0]);
  assert.ok(chevronBlocks.length >= 2, "esperava pelo menos 2 usos de ChevronDown (toggle externo + cada nível anterior)");
  for (const bloco of chevronBlocks) {
    assert.match(bloco, /aria-hidden="true"/, `ChevronDown sem aria-hidden: ${bloco}`);
  }
});

test("nenhum tabIndex negativo nem manipulação de foco que pudesse prender o usuário nos acordeões", () => {
  assert.doesNotMatch(source, /tabIndex/);
  assert.doesNotMatch(source, /\.focus\(\)/);
});

test("a key do <details> externo inclui o componente (LP/MT) — garante reset ao trocar entre Língua Portuguesa e Matemática", () => {
  assert.match(source, /<details key=\{componente\} className="saeb-interpretacao-niveis-anteriores">/);
});

// ---- 17 — reset de estado ao trocar escola/município/etapa/edição ----

const saebConsultaSource = readFileSync(new URL("../app/saeb/components/SaebConsulta.tsx", import.meta.url), "utf-8");

test("SaebConsulta.tsx remonta todo o painel (e, com ele, os acordeões de níveis anteriores) ao trocar escola, etapa ou edição — o componente LP/MT é coberto à parte pelo key={componente} interno", () => {
  assert.match(
    saebConsultaSource,
    /<InterpretacaoResultado\s*\n\s*key=\{`\$\{escolaAtual\.codigoInep\}-\$\{etapaEfetiva\}-\$\{edicaoEfetiva\}`\}/,
  );
});

test("trocar de município troca a escola selecionada (e, com ela, o codigoInep usado na key) — nunca deixa o painel de uma escola antiga aberto", () => {
  // selecionarMunicipio()/limparEscola() já resetam a escola (e, com o remount por key acima, os
  // acordeões) — este teste confirma que o fluxo de troca de município passa por esse reset.
  assert.match(saebConsultaSource, /setInterpretacaoAberta\(false\)/);
});

// ---- Guardas negativas (frases que a interface nunca deve afirmar) ----

test("nunca afirma que todos os estudantes da escola estão no nível da média", () => {
  assert.doesNotMatch(jsxLiterals, /todos os estudantes.*(est(ã|a)o|se encontram) no n[íi]vel/i);
  assert.doesNotMatch(jsxLiterals, /todos os alunos.*(est(ã|a)o|se encontram) no n[íi]vel/i);
});

test("nunca afirma que os estudantes dominam as habilidades listadas", () => {
  assert.doesNotMatch(jsxLiterals, /dominam as habilidades/i);
  assert.doesNotMatch(jsxLiterals, /todos dominam/i);
});

test("nunca chama a média de nota individual", () => {
  assert.doesNotMatch(jsxLiterals, /nota individual/i);
});

test("nunca chama as habilidades de códigos da BNCC", () => {
  assert.doesNotMatch(source, /BNCC/);
  assert.doesNotMatch(jsxLiterals, /código(s)?\s+d[ae]\s+bncc/i);
});

// ---- Zero novas requisições ----

test("nada na consulta aos níveis anteriores dispara rede — nenhum fetch, nenhum cliente SAEB importado ou referenciado", () => {
  assert.doesNotMatch(source, /fetch\(/);
  assert.doesNotMatch(source, /SaebClient/);
  assert.doesNotMatch(source, /createSaebClient/);
  assert.doesNotMatch(source, /\/data\/saeb\//);
});

// ---- Nenhuma dependência nova ----

test("nenhuma biblioteca nova foi importada — só react, lucide-react (já usado) e módulos internos @/lib e @/lib/saeb", () => {
  const imports = [...source.matchAll(/^import .* from "([^"]+)";$/gm)].map((m) => m[1]);
  for (const origem of imports) {
    const permitido = origem === "react" || origem === "lucide-react" || origem.startsWith("@/");
    assert.ok(permitido, `import de origem inesperada: ${origem}`);
  }
});
