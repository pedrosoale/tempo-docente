// Testes de mutação ponta a ponta do gerador da matriz Saeb-BNCC (scripts/saeb-matriz-bncc/gerar.mjs).
//
// Diferença em relação a tests/saeb-matriz-bncc-catalogo.test.mjs: aqueles testes exercitam os
// validadores individuais isoladamente; estes partem de uma CÓPIA TEMPORÁRIA da fonte real (262
// habilidades já aprovadas), aplicam uma mutação pontual que um erro de transcrição ou uma
// adulteração poderiam produzir, e provam que `gerar()` — de ponta a ponta, com toda a cadeia de
// validação (sintática + semântica + o conjunto de hashes SHA-256 aprovados) — rejeita o resultado.
//
// Nenhum teste aqui escreve no catálogo real: `fontePath` aponta para um arquivo-fonte mutado em
// diretório temporário (mkdtempSync) e `saidaPath` também aponta para esse mesmo diretório temporário
// (nunca para data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json). Mesmo que uma mutação
// deixasse de ser rejeitada por um bug futuro, o pior caso seria gravar um arquivo perdido em /tmp.
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import { MatrizBnccGeracaoError, gerar } from "../scripts/saeb-matriz-bncc/gerar.mjs";

const FONTE_REAL_PATH = join(process.cwd(), "data/saeb-matriz-bncc/source/official-inep-matrizes-bncc.json");

let dir;
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "saeb-matriz-bncc-mutacao-"));
});
test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

function carregarFonteReal() {
  return JSON.parse(readFileSync(FONTE_REAL_PATH, "utf-8"));
}

function encontrarHabilidadePorCodigo(fonte, { componente, etapa, codigoOficial }) {
  const matriz = fonte.matrizes.find((m) => m.componente === componente && m.etapa === etapa);
  assert.ok(matriz, `matriz ${componente}/${etapa} deveria existir na fonte real`);
  const habilidade = matriz.habilidades.find((h) => h.codigoOficial === codigoOficial);
  assert.ok(habilidade, `código ${codigoOficial} deveria existir em ${componente}/${etapa} na fonte real`);
  return habilidade;
}

function encontrarHabilidadePorEixo(fonte, { componente, etapa, eixoConhecimento, eixoCognitivo, ordemEditorial }) {
  const matriz = fonte.matrizes.find((m) => m.componente === componente && m.etapa === etapa);
  assert.ok(matriz, `matriz ${componente}/${etapa} deveria existir na fonte real`);
  const habilidade = matriz.habilidades.find(
    (h) => h.eixoConhecimento === eixoConhecimento && h.eixoCognitivo === eixoCognitivo && h.ordemEditorial === ordemEditorial,
  );
  assert.ok(habilidade, `habilidade ${componente}/${etapa}/${eixoConhecimento}/${eixoCognitivo}#${ordemEditorial} deveria existir na fonte real`);
  return habilidade;
}

// Escreve `fonteMutada` num arquivo-fonte temporário e chama gerar() apontando fontePath e saidaPath
// para o mesmo diretório temporário — nunca toca a fonte real nem o catálogo real.
function gerarComFonteMutada(fonteMutada) {
  const fontePath = join(dir, "fonte-mutada.json");
  const saidaPath = join(dir, "catalogo-mutado.json");
  writeFileSync(fontePath, JSON.stringify(fonteMutada));
  return gerar({ fontePath, saidaPath, escrever: false });
}

test("sanidade: gerar() a partir de uma cópia INALTERADA da fonte real, em arquivo temporário, não lança (prova que o arnês de teste em si funciona)", () => {
  const fonte = carregarFonteReal();
  assert.doesNotThrow(() => gerarComFonteMutada(fonte));
});

test("mutação: troca de código entre 9N1.1 e 9G1.1 (habilidade de Números arquivada com código de Geometria e vice-versa) é rejeitada", () => {
  const fonte = carregarFonteReal();
  const n1 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "9anoEF", codigoOficial: "9N1.1" });
  const g1 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "9anoEF", codigoOficial: "9G1.1" });
  [n1.codigoOficial, g1.codigoOficial] = [g1.codigoOficial, n1.codigoOficial];
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});

test("mutação: troca de código entre 9N1.1 e 9N2.1 (mesmo eixo do conhecimento, eixo cognitivo trocado) é rejeitada", () => {
  const fonte = carregarFonteReal();
  const n1 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "9anoEF", codigoOficial: "9N1.1" });
  const n2 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "9anoEF", codigoOficial: "9N2.1" });
  [n1.codigoOficial, n2.codigoOficial] = [n2.codigoOficial, n1.codigoOficial];
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});

test("mutação: troca de código entre etapas (5N1.1 do 5º ano e 9N1.1 do 9º ano) é rejeitada", () => {
  const fonte = carregarFonteReal();
  const codigo5 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "5anoEF", codigoOficial: "5N1.1" });
  const codigo9 = encontrarHabilidadePorCodigo(fonte, { componente: "matematica", etapa: "9anoEF", codigoOficial: "9N1.1" });
  [codigo5.codigoOficial, codigo9.codigoOficial] = [codigo9.codigoOficial, codigo5.codigoOficial];
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});

test("mutação: troca de textos entre Leitura e Arte (5º ano de Linguagens), preservando todas as contagens por eixo e por eixo cognitivo, é rejeitada", () => {
  const fonte = carregarFonteReal();
  const leitura = encontrarHabilidadePorEixo(fonte, {
    componente: "linguagens",
    etapa: "5anoEF",
    eixoConhecimento: "Leitura",
    eixoCognitivo: "Reconhecer",
    ordemEditorial: 1,
  });
  const arte = encontrarHabilidadePorEixo(fonte, {
    componente: "linguagens",
    etapa: "5anoEF",
    eixoConhecimento: "Arte",
    eixoCognitivo: "Reconhecer",
    ordemEditorial: 1,
  });
  // Confirma a premissa do teste: mesma etapa e mesmo eixo cognitivo em ambos os lados, então a troca
  // de texto abaixo não altera NENHUMA contagem por etapa/eixo/eixo cognitivo — só a identidade.
  assert.equal(leitura.eixoCognitivo, arte.eixoCognitivo);
  [leitura.textoHabilidade, arte.textoHabilidade] = [arte.textoHabilidade, leitura.textoHabilidade];
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});

test("mutação: alteração de uma palavra no texto oficial (habilidade de Educação Física, página real 10) é rejeitada", () => {
  const fonte = carregarFonteReal();
  const habilidade = encontrarHabilidadePorEixo(fonte, {
    componente: "linguagens",
    etapa: "5anoEF",
    eixoConhecimento: "Educação física",
    eixoCognitivo: "Reconhecer",
    ordemEditorial: 1,
  });
  assert.equal(habilidade.textoHabilidade, "Identificar elementos constitutivos dos esportes, da ginástica e das lutas.");
  habilidade.textoHabilidade = "Identificar elementos constitutivos das modalidades esportivas, da ginástica e das lutas.";
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});

test("mutação: alteração de página real mantendo-a dentro do intervalo geral do PDF (não dispara a checagem de intervalo, só a de identidade) é rejeitada", () => {
  const fonte = carregarFonteReal();
  const fonteLinguagens = fonte.fontes.linguagens;
  const habilidade = encontrarHabilidadePorEixo(fonte, {
    componente: "linguagens",
    etapa: "5anoEF",
    eixoConhecimento: "Educação física",
    eixoCognitivo: "Reconhecer",
    ordemEditorial: 1,
  });
  const paginaOriginal = habilidade.paginaRealPdf;
  const paginaAlterada = paginaOriginal + 1;
  assert.ok(paginaAlterada <= fonteLinguagens.totalPaginasPdf, "a página alterada precisa permanecer dentro do intervalo do PDF para isolar a checagem de identidade");
  habilidade.paginaRealPdf = paginaAlterada;
  assert.throws(() => gerarComFonteMutada(fonte), MatrizBnccGeracaoError);
});
