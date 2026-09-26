// Testes do gerador determinístico do catálogo da matriz Saeb ALINHADA À BNCC
// (scripts/saeb-matriz-bncc/gerar.mjs). Nenhuma rede, nenhum PDF — só o arquivo-fonte já verificado
// (data/saeb-matriz-bncc/source/official-inep-matrizes-bncc.json) para os testes de integração/
// contagem, e validadores individuais exportados para os testes de rejeição (o gerador exige
// contagens globais literais — 10/47/57 para Linguagens, 33/56/59 para Matemática — que uma fixture
// pequena não consegue replicar; testar cada validador isoladamente é mais direto e mais claro do
// que construir uma fixture de 262 habilidades só para mudar um campo por vez).
//
// Nenhum teste aqui escreve no catálogo real — `saidaPath` é sempre um arquivo em diretório
// temporário (mkdtempSync), exceto quando testamos explicitamente que a fonte REAL do projeto gera
// um catálogo consistente (nesse caso `escrever: false`, então nada é gravado em lugar nenhum).
import assert from "node:assert/strict";
import test from "node:test";
import { mkdtempSync, readFileSync, rmSync, statSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";

import {
  MatrizBnccGeracaoError,
  calcularHashSha256,
  gerar,
  validarFonte,
  validarHabilidadeLinguagens,
  validarHabilidadeMatematica,
  validarTexto,
  verificar,
  verificarHashPdfLocal,
} from "../scripts/saeb-matriz-bncc/gerar.mjs";

// Cópia INDEPENDENTE das contagens oficiais, reescrita aqui (não importada de gerar.mjs) — mesmo
// padrão de tests/saeb-descritores-catalogo.test.mjs: este arquivo não deve validar o gerador contra
// os próprios números que deveria estar testando. Os valores vêm da Rodada 9 do relatório do piloto.
const CONTAGEM_ESPERADA_POR_ETAPA_REAL = {
  "linguagens/2anoEF": 10,
  "linguagens/5anoEF": 47,
  "linguagens/9anoEF": 57,
  "matematica/2anoEF": 33,
  "matematica/5anoEF": 56,
  "matematica/9anoEF": 59,
};
const TOTAL_LINGUAGENS_REAL = 114;
const TOTAL_MATEMATICA_REAL = 148;
const TOTAL_GERAL_REAL = 262;
const CONTAGEM_POR_EIXO_MATEMATICA_REAL = { Números: 42, Álgebra: 25, Geometria: 33, "Grandezas e Medidas": 26, "Probabilidade e Estatística": 22 };
const CONTAGEM_POR_COGNITIVO_MATEMATICA_REAL = { "Compreender e aplicar conceitos e procedimentos": 95, "Resolver problemas e argumentar": 53 };

let dir;
test.beforeEach(() => {
  dir = mkdtempSync(join(tmpdir(), "saeb-matriz-bncc-teste-"));
});
test.afterEach(() => {
  rmSync(dir, { recursive: true, force: true });
});

// ---------------------------------------------------------------------------------------------
// Geração a partir da fonte REAL do projeto — determinismo, contagens, idempotência, --check.
// Todos os testes abaixo passam `saidaPath` apontando para o diretório temporário (nunca para
// data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json), mesmo quando `fontePath` é a fonte
// real — assim nenhum teste nesta suíte jamais escreve no catálogo versionado.
// ---------------------------------------------------------------------------------------------

test("gerar (fonte real): determinístico — duas gerações produzem bytes idênticos", () => {
  const primeira = gerar({ escrever: false });
  const segunda = gerar({ escrever: false });
  assert.equal(primeira.texto, segunda.texto);
});

test("gerar (fonte real): total geral é exatamente 262, com 114 em Linguagens e 148 em Matemática", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.equal(catalogo.habilidades.length, TOTAL_GERAL_REAL);
  assert.equal(catalogo.catalogo.totalHabilidades, TOTAL_GERAL_REAL);
  assert.equal(catalogo.habilidades.filter((h) => h.componente === "linguagens").length, TOTAL_LINGUAGENS_REAL);
  assert.equal(catalogo.habilidades.filter((h) => h.componente === "matematica").length, TOTAL_MATEMATICA_REAL);
  assert.equal(catalogo.catalogo.totalPorComponente.linguagens, TOTAL_LINGUAGENS_REAL);
  assert.equal(catalogo.catalogo.totalPorComponente.matematica, TOTAL_MATEMATICA_REAL);
});

test("gerar (fonte real): contagem exata por etapa/componente, conferida contra a Rodada 9", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const [chave, esperado] of Object.entries(CONTAGEM_ESPERADA_POR_ETAPA_REAL)) {
    const [componente, etapa] = chave.split("/");
    const total = catalogo.habilidades.filter((h) => h.componente === componente && h.etapa === etapa).length;
    assert.equal(total, esperado, `${chave}: esperado ${esperado}, encontrado ${total}`);
  }
});

test("gerar (fonte real): Matemática tem exatamente 148 códigos únicos, todos no padrão oficial, sem lacuna nem repetição em nenhum cruzamento", () => {
  const { catalogo } = gerar({ escrever: false });
  const codigos = catalogo.habilidades.filter((h) => h.componente === "matematica").map((h) => h.codigoOficial);
  assert.equal(codigos.length, 148);
  assert.equal(new Set(codigos).size, 148, "não deveria haver código duplicado");
  const CODIGO_MATEMATICA = /^[259][A-Z]{1,2}[12]\.\d{1,2}$/;
  for (const codigo of codigos) assert.match(codigo, CODIGO_MATEMATICA, `código fora do padrão: ${codigo}`);

  const grupos = {};
  for (const codigo of codigos) {
    const [prefixo, sufixo] = codigo.split(".");
    (grupos[prefixo] ??= []).push(Number(sufixo));
  }
  assert.equal(Object.keys(grupos).length, 28, "esperado exatamente 28 cruzamentos etapa×eixo×eixoCognitivo");
  for (const [prefixo, sufixos] of Object.entries(grupos)) {
    const ordenados = [...sufixos].sort((a, b) => a - b);
    for (let i = 0; i < ordenados.length; i += 1) {
      assert.equal(ordenados[i], i + 1, `${prefixo}: lacuna ou repetição na sequência (${JSON.stringify(ordenados)})`);
    }
  }
});

test("gerar (fonte real): Linguagens nunca tem codigoOficial; Matemática sempre tem", () => {
  const { catalogo } = gerar({ escrever: false });
  for (const h of catalogo.habilidades) {
    if (h.componente === "linguagens") assert.equal(h.codigoOficial, null, `Linguagens ${h.idInterno} deveria ter codigoOficial null`);
    else assert.equal(typeof h.codigoOficial, "string", `Matemática ${h.idInterno} deveria ter codigoOficial string`);
  }
});

test("gerar (fonte real): reconciliação por eixo do conhecimento e por eixo cognitivo de Matemática (segunda e terceira via, independentes da soma por etapa)", () => {
  const { catalogo } = gerar({ escrever: false });
  const mat = catalogo.habilidades.filter((h) => h.componente === "matematica");
  const porEixo = {};
  const porCognitivo = {};
  for (const h of mat) {
    porEixo[h.eixoConhecimento] = (porEixo[h.eixoConhecimento] ?? 0) + 1;
    porCognitivo[h.eixoCognitivo] = (porCognitivo[h.eixoCognitivo] ?? 0) + 1;
  }
  assert.deepEqual(porEixo, CONTAGEM_POR_EIXO_MATEMATICA_REAL);
  assert.deepEqual(porCognitivo, CONTAGEM_POR_COGNITIVO_MATEMATICA_REAL);
});

test("gerar (fonte real): nenhum código de Matemática colide com o padrão D<n> da matriz tradicional", () => {
  const { catalogo } = gerar({ escrever: false });
  const codigos = catalogo.habilidades.filter((h) => h.componente === "matematica").map((h) => h.codigoOficial);
  for (const codigo of codigos) assert.doesNotMatch(codigo, /^D[1-9][0-9]*$/, `código "${codigo}" colide com o padrão da matriz tradicional`);
});

test("gerar (fonte real): idInterno é único para as 262 habilidades e nunca é confundido com codigoOficial", () => {
  const { catalogo } = gerar({ escrever: false });
  const ids = catalogo.habilidades.map((h) => h.idInterno);
  assert.equal(new Set(ids).size, 262);
  for (const h of catalogo.habilidades) {
    assert.notEqual(h.idInterno, h.codigoOficial);
    assert.ok(h.idInterno.startsWith(`${h.componente}.${h.etapa}.`), `idInterno "${h.idInterno}" deveria começar com "${h.componente}.${h.etapa}."`);
  }
});

test("gerar (fonte real): notasEditoriais nunca aparecem como habilidade", () => {
  const { catalogo } = gerar({ escrever: false });
  assert.ok(Array.isArray(catalogo.notasEditoriais));
  assert.ok(catalogo.notasEditoriais.length >= 1, "deveria preservar ao menos a nota de Álgebra/9º ano");
  const textosHabilidades = new Set(catalogo.habilidades.map((h) => h.textoHabilidade));
  for (const nota of catalogo.notasEditoriais) {
    assert.ok(!textosHabilidades.has(nota.texto), "texto de nota editorial não deveria coincidir com texto de habilidade");
  }
});

test("gerar (fonte real): primeira gravação em tmpdir escreve; regravar sem mudança não toca o arquivo (mtime preservado) — nunca grava no catálogo real", () => {
  const saida = join(dir, "matriz-linguagens-matematica-bncc.json");
  const primeira = gerar({ saidaPath: saida, escrever: true });
  assert.equal(primeira.escrito, true);
  const mtimeAntes = statSync(saida).mtimeMs;
  const conteudoAntes = readFileSync(saida, "utf-8");

  const segunda = gerar({ saidaPath: saida, escrever: true });
  assert.equal(segunda.escrito, false);
  assert.equal(statSync(saida).mtimeMs, mtimeAntes);
  assert.equal(readFileSync(saida, "utf-8"), conteudoAntes);
});

test("verificar (fonte real): --check equivalente passa contra o catálogo já versionado no repositório", () => {
  // Usa o saidaPath REAL só para leitura (verificar nunca escreve) — exatamente o que
  // `npm run saeb:matriz-bncc:check` faz.
  const { texto } = verificar();
  assert.ok(texto.length > 0);
});

test("verificar: lança quando o catálogo de destino não existe", () => {
  const saida = join(dir, "inexistente.json");
  assert.throws(() => verificar({ saidaPath: saida }), MatrizBnccGeracaoError);
});

test("gerar: nenhuma chamada de rede é feita — gerar contra a fonte real é síncrono e não usa fetch/http", () => {
  const originalFetch = globalThis.fetch;
  let chamado = false;
  globalThis.fetch = () => {
    chamado = true;
    throw new Error("gerar() não deveria fazer rede");
  };
  try {
    gerar({ escrever: false });
  } finally {
    globalThis.fetch = originalFetch;
  }
  assert.equal(chamado, false);
});

// ---------------------------------------------------------------------------------------------
// Validadores individuais — cada classe de rejeição exigida, testada diretamente (a fixture de 262
// habilidades necessária para exercitar `gerar()` de ponta a ponta com um só campo alterado não é
// prática; os validadores abaixo são as mesmas funções que `gerar()` chama internamente).
// ---------------------------------------------------------------------------------------------

function fonteValida(overrides = {}) {
  return {
    id: "linguagens-bncc-2022",
    titulo: "Título de teste",
    orgao: "Órgão de teste",
    componente: "linguagens",
    anoPublicacao: 2022,
    url: "https://download.inep.gov.br/educacao_basica/saeb/teste.pdf",
    hashSha256: "a".repeat(64),
    tamanhoBytes: 1000,
    totalPaginasPdf: 16,
    dataConsulta: "2026-09-26",
    etapasCobertas: ["2anoEF", "5anoEF", "9anoEF"],
    situacaoAplicacao: "Situação de teste.",
    distintaDaMatrizTradicional: true,
    ...overrides,
  };
}

test("validarFonte: aceita uma fonte estruturalmente válida", () => {
  assert.doesNotThrow(() => validarFonte(fonteValida(), "linguagens", "teste"));
});

test("validarFonte: rejeita SHA-256 fora do formato de 64 caracteres hexadecimais", () => {
  assert.throws(() => validarFonte(fonteValida({ hashSha256: "abc123" }), "linguagens", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarFonte(fonteValida({ hashSha256: "g".repeat(64) }), "linguagens", "teste"), MatrizBnccGeracaoError, "'g' não é hex");
  assert.throws(() => validarFonte(fonteValida({ hashSha256: "a".repeat(63) }), "linguagens", "teste"), MatrizBnccGeracaoError, "63 caracteres, não 64");
  assert.throws(() => validarFonte(fonteValida({ hashSha256: "a".repeat(65) }), "linguagens", "teste"), MatrizBnccGeracaoError, "65 caracteres, não 64");
});

test("validarFonte: rejeita URL fora do domínio oficial do Inep", () => {
  assert.throws(() => validarFonte(fonteValida({ url: "https://example.com/matriz.pdf" }), "linguagens", "teste"), MatrizBnccGeracaoError);
});

test("validarFonte: rejeita URL não-HTTPS", () => {
  assert.throws(() => validarFonte(fonteValida({ url: "http://download.inep.gov.br/matriz.pdf" }), "linguagens", "teste"), MatrizBnccGeracaoError);
});

test("validarFonte: rejeita etapa desconhecida em etapasCobertas", () => {
  assert.throws(() => validarFonte(fonteValida({ etapasCobertas: ["3serieEM"] }), "linguagens", "teste"), MatrizBnccGeracaoError);
});

test("validarFonte: rejeita distintaDaMatrizTradicional diferente de true", () => {
  assert.throws(() => validarFonte(fonteValida({ distintaDaMatrizTradicional: false }), "linguagens", "teste"), MatrizBnccGeracaoError);
});

function habilidadeLinguagensValida(overrides = {}) {
  return {
    codigoOficial: null,
    eixoConhecimento: "Leitura",
    eixoCognitivo: "Reconhecer",
    ordemEditorial: 1,
    paginaRealPdf: 7,
    textoHabilidade: "Identificar a ideia central do texto.",
    ...overrides,
  };
}

test("validarHabilidadeLinguagens: aceita uma habilidade estruturalmente válida (5º ano, com eixo cognitivo)", () => {
  assert.doesNotThrow(() => validarHabilidadeLinguagens(habilidadeLinguagensValida(), "5anoEF", 16, "teste"));
});

test("validarHabilidadeLinguagens: rejeita código presente em Linguagens (nunca deveria existir)", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ codigoOficial: "5L1.1" }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeLinguagens: rejeita eixo do conhecimento desconhecido para a etapa", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ eixoConhecimento: "Eixo Inventado" }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeLinguagens: rejeita eixo do conhecimento que só existe em outra etapa (ex.: 'Língua inglesa' fora do 9º ano)", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ eixoConhecimento: "Língua inglesa" }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeLinguagens: rejeita eixo cognitivo desconhecido", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ eixoCognitivo: "Memorizar" }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeLinguagens: 2º ano exige eixoCognitivo null — rejeita quando presente", () => {
  assert.throws(
    () => validarHabilidadeLinguagens(habilidadeLinguagensValida({ eixoConhecimento: "Leitura", eixoCognitivo: "Reconhecer" }), "2anoEF", 16, "teste"),
    MatrizBnccGeracaoError,
  );
});

test("validarHabilidadeLinguagens: rejeita página fora do intervalo do PDF", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ paginaRealPdf: 999 }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeLinguagens: rejeita ordemEditorial não inteira ou não positiva", () => {
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ ordemEditorial: 0 }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarHabilidadeLinguagens(habilidadeLinguagensValida({ ordemEditorial: 1.5 }), "5anoEF", 16, "teste"), MatrizBnccGeracaoError);
});

function habilidadeMatematicaValida(overrides = {}) {
  return {
    codigoOficial: "9G2.7",
    eixoConhecimento: "Geometria",
    eixoCognitivo: "Resolver problemas e argumentar",
    ordemEditorial: 7,
    paginaRealPdf: 17,
    textoHabilidade: "Resolver problemas que envolvam relações entre os elementos de uma circunferência.",
    ...overrides,
  };
}

test("validarHabilidadeMatematica: aceita uma habilidade estruturalmente válida", () => {
  assert.doesNotThrow(() => validarHabilidadeMatematica(habilidadeMatematicaValida(), "9anoEF", 20, "teste"));
});

test("validarHabilidadeMatematica: rejeita código ausente", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: null }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita código fora do padrão oficial", () => {
  for (const codigo of ["9g2.7", "9G2", "G9.2.7", "9GG2.7x", ""]) {
    assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: codigo }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError, `deveria rejeitar "${codigo}"`);
  }
});

test("validarHabilidadeMatematica: rejeita código no formato D<n> da matriz tradicional (nunca misturar)", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "D7" }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita eixo do conhecimento desconhecido", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ eixoConhecimento: "Trigonometria" }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita eixo cognitivo desconhecido (inclusive vocabulário de Linguagens)", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ eixoCognitivo: "Reconhecer" }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita sufixo do código divergente de ordemEditorial", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "9G2.7", ordemEditorial: 3 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita página fora do intervalo do PDF", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ paginaRealPdf: 21 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError);
});

test("validarHabilidadeMatematica: rejeita código cujo dígito de etapa não corresponde à etapa do registro (código de outra etapa arquivado aqui)", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida(), "5anoEF", 20, "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "2N1.1", eixoConhecimento: "Números", eixoCognitivo: "Compreender e aplicar conceitos e procedimentos", ordemEditorial: 1 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError, "código iniciado por 2 dentro da matriz do 9º ano");
});

test("validarHabilidadeMatematica: rejeita código cuja letra de eixo não corresponde ao eixoConhecimento do registro (habilidade arquivada no eixo errado)", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "9N1.1", eixoConhecimento: "Geometria", eixoCognitivo: "Compreender e aplicar conceitos e procedimentos", ordemEditorial: 1 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError, "9N1.1 arquivado em Geometria");
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "9G1.1", eixoConhecimento: "Números", eixoCognitivo: "Compreender e aplicar conceitos e procedimentos", ordemEditorial: 1 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError, "9G1.1 arquivado em Números");
});

test("validarHabilidadeMatematica: rejeita código cujo dígito cognitivo não corresponde ao eixoCognitivo do registro (habilidade arquivada no eixo cognitivo errado)", () => {
  assert.throws(() => validarHabilidadeMatematica(habilidadeMatematicaValida({ codigoOficial: "9N1.1", eixoConhecimento: "Números", eixoCognitivo: "Resolver problemas e argumentar", ordemEditorial: 1 }), "9anoEF", 20, "teste"), MatrizBnccGeracaoError, "9N1.1 com eixo cognitivo 2");
});

test("validarTexto: aceita texto oficial bem formado", () => {
  assert.doesNotThrow(() => validarTexto("Identificar a ideia central do texto.", "teste"));
});

test("validarTexto: rejeita texto vazio ou ausente", () => {
  assert.throws(() => validarTexto("", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto("   ", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto(undefined, "teste"), MatrizBnccGeracaoError);
});

test("validarTexto: rejeita caractere de substituição U+FFFD", () => {
  assert.throws(() => validarTexto("Reconhecer a finalidade de um texto�.", "teste"), MatrizBnccGeracaoError);
});

test("validarTexto: rejeita reticências (placeholder/truncamento editorial)", () => {
  assert.throws(() => validarTexto("Identificar o assunto de um texto...", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto("Identificar o assunto de um texto…", "teste"), MatrizBnccGeracaoError);
});

test("validarTexto: rejeita espaçamento não normalizado (bordas ou espaços duplos)", () => {
  assert.throws(() => validarTexto(" Identificar a ideia central do texto.", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto("Identificar a ideia central do texto. ", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto("Identificar a ideia  central do texto.", "teste"), MatrizBnccGeracaoError);
});

test("validarTexto: rejeita texto que não termina em pontuação (possível truncamento)", () => {
  assert.throws(() => validarTexto("Identificar a ideia central do texto", "teste"), MatrizBnccGeracaoError);
});

test("validarTexto: rejeita colchetes de placeholder ou marcação HTML", () => {
  assert.throws(() => validarTexto("Identificar [algo] no texto.", "teste"), MatrizBnccGeracaoError);
  assert.throws(() => validarTexto("Identificar <b>algo</b> no texto.", "teste"), MatrizBnccGeracaoError);
});

// ---------------------------------------------------------------------------------------------
// calcularHashSha256 / verificarHashPdfLocal — mesmo padrão de saeb-descritores, sem rede.
// ---------------------------------------------------------------------------------------------

test("calcularHashSha256: calcula o SHA-256 real de um arquivo local, sem rede", () => {
  const caminho = join(dir, "arquivo.txt");
  writeFileSync(caminho, "conteudo de teste");
  const hash = calcularHashSha256(caminho);
  assert.match(hash, /^[0-9a-f]{64}$/);
});

test("verificarHashPdfLocal: aceita quando o hash calculado confere; rejeita quando diverge", () => {
  const caminho = join(dir, "arquivo.txt");
  writeFileSync(caminho, "conteudo de teste");
  const hashReal = calcularHashSha256(caminho);
  assert.doesNotThrow(() => verificarHashPdfLocal({ caminhoArquivo: caminho, hashEsperado: hashReal }));
  assert.throws(() => verificarHashPdfLocal({ caminhoArquivo: caminho, hashEsperado: "0".repeat(64) }), MatrizBnccGeracaoError);
});
