// Testes do importador do SAEB.
//
// Nenhum teste toca a rede nem lê os 211 MB dos pacotes oficiais: tudo roda sobre
// fixtures sintéticas construídas em memória por tests/helpers/saeb-fixtures.mjs
// e gravadas num diretório temporário do sistema, fora do repositório.
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { spawnSync } from "node:child_process";
import { cp } from "node:fs/promises";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, writeFile } from "node:fs/promises";
import { tmpdir } from "node:os";
import path from "node:path";

import { assertSafeEntryName, LIMITES, openZip, readZipDirectory, ZipError } from "../scripts/saeb/lib/zip.mjs";
import { openWorkbook, XlsxError } from "../scripts/saeb/lib/xlsx.mjs";
import {
  MARCADORES_AUSENCIA,
  NormalizeError,
  normalizarIdentificador,
  normalizarIndicador,
  normalizarNumero,
  serializar,
} from "../scripts/saeb/lib/normalize.mjs";
import { EDICOES, INDICADORES } from "../scripts/saeb/lib/sources.mjs";

// Cobertura da fixture: mesma do Ensino Fundamental — todas as edições, metas
// de 2007 a 2021. Declarada aqui para que a fixture não dependa do registro
// oficial e continue válida se um pacote real mudar de cobertura.
const METAS_FIXTURE = ["2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021"];
const temMeta = (edicao) => METAS_FIXTURE.includes(edicao);
import { executar, extrairMd5Oficial } from "../scripts/saeb/import.mjs";
import { buildXlsx, buildZip, colunasTecnicas, linhaDeEscola, md5Txt } from "./helpers/saeb-fixtures.mjs";

const md5 = (buffer) => createHash("md5").update(buffer).digest("hex");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

const COLUNAS = colunasTecnicas(EDICOES, INDICADORES, temMeta);

// Duas escolas em municípios diferentes, cobrindo de propósito: vírgula decimal
// gravada como texto, ausência com marcador oficial, ausência simples, e um
// código IBGE com zero à esquerda.
const ESCOLA_A = {
  uf: "RO",
  codigoIbge: "1100015",
  municipio: "Alta Floresta D'Oeste",
  codigoInep: "11024682",
  nome: "EEEFM EURIDICE LOPES PEDROSO",
  rede: "Estadual",
};
const ESCOLA_B = {
  uf: "SP",
  codigoIbge: "0350030",
  municipio: "Municipio Com Zero A Esquerda",
  codigoInep: "35000010",
  nome: "EMEF EXEMPLO",
  rede: "Municipal",
};

function planilhaPadrao({ colunas = COLUNAS, linhas } = {}) {
  const rows = { 1: ["Ministério da Educação"], 9: ["1º ao 5º ano"], [10]: colunas };
  linhas.forEach((valores, indice) => {
    rows[11 + indice] = valores;
  });
  rows[11 + linhas.length + 1] = ["Fonte: MEC/Inep"];
  return buildXlsx(rows, { sheetName: "IDEB_Escolas (Anos_Iniciais)" });
}

function linhasPadrao() {
  return [
    linhaDeEscola(
      ESCOLA_A,
      {
        2023: { lp: "215.4", mt: "228,04", n: "6.12", p: "0.981", ideb: "6.0" },
        2025: { lp: "ND", mt: "ND", n: "-", p: "0.97", ideb: "-" },
        2021: { lp: "210.1", mt: "220.2", n: "5.9", p: "0.95", ideb: "5.6", meta: "5.5" },
      },
      EDICOES,
      INDICADORES,
      temMeta,
    ),
    linhaDeEscola(
      ESCOLA_B,
      {
        2025: { lp: "240.0", mt: "250.5", n: "7.1", p: "0.99", ideb: "7.0" },
        2009: { lp: "ND***", mt: "ND*", n: "-", p: "-", ideb: "-" },
      },
      EDICOES,
      INDICADORES,
      temMeta,
    ),
  ];
}

/**
 * Monta um pacote completo (ZIP + planilha + md5.txt) e o registro de fonte
 * correspondente, com tamanhos e hash calculados a partir dos bytes reais.
 */
function montarPacote({ xlsx = planilhaPadrao({ linhas: linhasPadrao() }), extras = [], md5Sobrescrito = null } = {}) {
  const innerDir = "divulgacao_teste_escolas_2025";
  const xlsxName = "divulgacao_teste_escolas_2025.xlsx";
  const md5Name = "md5_divulgacao_teste_escolas_2025.txt";
  const hash = md5Sobrescrito ?? md5(xlsx);

  const zip = buildZip([
    { name: `${innerDir}/`, data: "" },
    { name: `${innerDir}/${xlsxName}`, data: xlsx },
    { name: `${innerDir}/${md5Name}`, data: md5Txt(hash, xlsxName) },
    ...extras,
  ]);

  const pacote = {
    id: "fixture-2025",
    etapa: "anosIniciais",
    etapaLabel: "Fixture",
    url: "https://download.inep.gov.br/ideb/resultados/fixture.zip",
    zipName: "fixture.zip",
    zipBytes: zip.length,
    zipSha256: sha256(zip),
    edicoes: EDICOES,
    edicoesComMeta: METAS_FIXTURE,
    innerDir,
    xlsxName,
    xlsxBytes: xlsx.length,
    xlsxSha256: sha256(xlsx),
    xlsxMd5: hash,
    md5Name,
  };
  return { zip, pacote, xlsx };
}

async function comCache(zip, pacote, fn) {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const cache = path.join(base, "cache");
  const out = path.join(base, "out");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, pacote.zipName), zip);
  try {
    return await fn({ base, cache, out });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

// cwd e outDir são diretórios distintos, como em produção: o manifesto vive em
// <cwd>/data/saeb/ e as partições em <outDir>/municipios/.
const rodar = (argv, { base, cache, out, pacote }) =>
  executar({ argv: ["--cache", cache, "--out", out, ...argv], cwd: base, pacotes: [pacote] });

const manifestoDe = (base) => path.join(base, "data", "saeb", "manifest.json");

// ---- 1. Importação válida --------------------------------------------------

test("importação válida produz partições por município, índice e manifesto", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });

    assert.equal(resultado.modo, "normal");
    // 2 partições + 1 índice + 1 manifesto
    assert.equal(resultado.artefatos, 4);
    assert.equal(resultado.escritos, 4);
    assert.equal(resultado.manifesto.dataset.municipios, 2);
    assert.equal(resultado.manifesto.dataset.escolas, 2);

    const particao = JSON.parse(await readFile(path.join(out, "municipios", "1100015.json"), "utf8"));
    assert.equal(particao.municipio.codigoIbge, "1100015");
    assert.equal(particao.escolas.length, 1);
    assert.equal(particao.escolas[0].codigoInep, "11024682");
    assert.equal(particao.escolas[0].etapas.anosIniciais["2023"].lp, 215.4);
  });
});

// ---- 2. MD5 incorreto ------------------------------------------------------

test("MD5 oficial divergente da cópia fixada no registro aborta antes de qualquer processamento", async () => {
  const { zip, pacote } = montarPacote({ md5Sobrescrito: "0".repeat(32) });
  // O md5.txt do pacote declara zeros; a cópia fixada no registro espera outro
  // valor. Os fingerprints SHA-256 continuam corretos, para que a falha isolada
  // seja mesmo a do checksum oficial.
  pacote.xlsxMd5 = md5(Buffer.from("outro conteudo"));
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /MD5 oficial declarado no pacote/.test(error.message) && /cópia fixada no registro de fontes/.test(error.message),
    );
    assert.equal(await stat(out).catch(() => null), null, "nada pode ter sido escrito");
  });
});

test("MD5 oficial que não corresponde aos bytes da planilha aborta o import", async () => {
  const xlsx = planilhaPadrao({ linhas: linhasPadrao() });
  const hashFalso = md5(Buffer.from("planilha diferente"));
  const { zip, pacote } = montarPacote({ xlsx, md5Sobrescrito: hashFalso });
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /MD5 da planilha extraída/.test(error.message),
    );
  });
});

// ---- 3. Tamanho / SHA-256 divergente ---------------------------------------

test("tamanho de ZIP diferente do declarado aborta antes de abrir o pacote", async () => {
  const { zip, pacote } = montarPacote();
  pacote.zipBytes = zip.length + 1;
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /tamanho \d+ bytes, esperado \d+/.test(error.message),
    );
  });
});

test("tamanho de planilha diferente do declarado aborta o import", async () => {
  const { zip, pacote } = montarPacote();
  pacote.xlsxBytes = pacote.xlsxBytes + 10;
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /planilha com \d+ bytes, esperado \d+/.test(error.message),
    );
  });
});

test("o SHA-256 registrado no manifesto é o dos bytes efetivamente usados", async () => {
  const { zip, pacote, xlsx } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const integridade = resultado.manifesto.pacotes[0].integridade;
    assert.equal(integridade.zip_sha256_local, sha256(zip));
    assert.equal(integridade.xlsx_sha256_local, sha256(xlsx));
    assert.equal(integridade.xlsx_md5_oficial, md5(xlsx));
    assert.equal(integridade.md5_oficial_conferido, true);
    assert.equal(integridade.fingerprints_locais_conferidos, true);
  });
});

// ---- 4. ZIP corrompido -----------------------------------------------------

/** Localiza a faixa de bytes comprimidos de uma entrada, para corrompê-la. */
function faixaDeDados(zip, sufixo) {
  const entrada = readZipDirectory(zip).find((item) => item.name.endsWith(sufixo));
  const nameLength = zip.readUInt16LE(entrada.localHeaderOffset + 26);
  const extraLength = zip.readUInt16LE(entrada.localHeaderOffset + 28);
  return entrada.localHeaderOffset + 30 + nameLength + extraLength;
}

test("ZIP adulterado mantendo exatamente o mesmo tamanho é detectado pelo fingerprint SHA-256", async () => {
  // É este o caso que a checagem de tamanho, sozinha, deixaria passar: um byte
  // trocado por outro, arquivo do mesmo comprimento.
  const { zip, pacote } = montarPacote();
  const adulterado = Buffer.from(zip);
  const inicio = faixaDeDados(zip, ".xlsx");
  adulterado[inicio + 64] ^= 0xff;

  assert.equal(adulterado.length, zip.length, "a fixture precisa preservar o tamanho");
  assert.notEqual(sha256(adulterado), sha256(zip));

  await comCache(adulterado, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /fingerprint SHA-256 do ZIP diverge/.test(error.message),
    );
    assert.equal(await stat(out).catch(() => null), null, "nada pode ter sido escrito");
  });
});

test("fingerprint SHA-256 divergente do fixado aborta mesmo com MD5 oficial correto", async () => {
  const { zip, pacote } = montarPacote();
  pacote.zipSha256 = "0".repeat(64);
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /fingerprint SHA-256 do ZIP diverge/.test(error.message),
    );
  });
});

test("fingerprint SHA-256 divergente da planilha interna aborta o import", async () => {
  const { zip, pacote } = montarPacote();
  pacote.xlsxSha256 = "0".repeat(64);
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /fingerprint SHA-256 da planilha diverge/.test(error.message),
    );
  });
});

test("dados comprimidos corrompidos são detectados por inflate ou CRC32, nunca aceitos em silêncio", () => {
  // Verificado no leitor de ZIP, e não no importador: lá o fingerprint SHA-256
  // barraria o arquivo antes, e esta é a defesa de quem abre um ZIP cujo
  // fingerprint ainda não se conhece.
  const zip = buildXlsx({ 10: ["A", "B"], 11: ["x", "y"] });
  const corrompido = Buffer.from(zip);
  const inicio = faixaDeDados(zip, "sheet1.xml");
  corrompido.fill(0x41, inicio + 8, inicio + 40);

  assert.throws(
    () => openZip(corrompido).read("xl/worksheets/sheet1.xml"),
    (error) => /descomprimir|CRC32|tamanho descomprimido/.test(error.message),
  );
});

test("ZIP truncado é rejeitado antes de qualquer leitura de entrada", () => {
  const zip = buildXlsx({ 10: ["A"], 11: ["x"] });
  const truncado = zip.subarray(0, Math.floor(zip.length / 2));
  assert.throws(
    () => openZip(truncado),
    (error) => /fim de diretório central|truncado/.test(error.message),
  );
});

test("buffer sem assinatura de diretório central não é aceito como ZIP", () => {
  assert.throws(() => readZipDirectory(Buffer.alloc(64)), ZipError);
});

// ---- 5. Path traversal e nomes hostis --------------------------------------

test("entrada com path traversal é recusada", () => {
  const zip = buildZip([{ name: "../fora.txt", data: "x" }]);
  assert.throws(() => openZip(zip), (error) => error instanceof ZipError && /path traversal/.test(error.message));
});

test("caminho absoluto, unidade de disco e separador invertido são recusados", () => {
  for (const nome of ["/etc/passwd", "C:/Windows/x.txt", "pasta\\arquivo.txt", "a//b.txt"]) {
    assert.throws(() => assertSafeEntryName(nome), ZipError, `deveria recusar ${nome}`);
  }
});

test("nome de entrada duplicado é recusado", () => {
  const zip = buildZip([
    { name: "dir/a.txt", data: "1" },
    { name: "dir/a.txt", data: "2" },
  ]);
  assert.throws(() => openZip(zip), (error) => /duplicado/.test(error.message));
});

test("entrada marcada como link simbólico é recusada", () => {
  const zip = buildZip([{ name: "link", data: "/etc/passwd", unixMode: 0o120777 }]);
  assert.throws(() => openZip(zip), (error) => /link simbólico/.test(error.message));
});

test("método de compressão desconhecido é recusado", () => {
  const zip = buildZip([{ name: "a.txt", data: "x", method: 0 }]);
  // Reescreve o método na entrada do diretório central para um valor inválido.
  const eocd = zip.length - 22;
  const central = zip.readUInt32LE(eocd + 16);
  zip.writeUInt16LE(99, central + 10);
  assert.throws(() => openZip(zip), (error) => /método de compressão não suportado/.test(error.message));
});

// ---- 6. Arquivo obrigatório ausente ----------------------------------------

test("pacote sem a planilha obrigatória aborta com mensagem explícita", async () => {
  const xlsx = planilhaPadrao({ linhas: linhasPadrao() });
  const innerDir = "divulgacao_teste_escolas_2025";
  const zip = buildZip([
    { name: `${innerDir}/md5_divulgacao_teste_escolas_2025.txt`, data: md5Txt(md5(xlsx), "divulgacao_teste_escolas_2025.xlsx") },
  ]);
  const pacote = {
    id: "fixture-2025", etapa: "anosIniciais", etapaLabel: "Fixture",
    url: "https://download.inep.gov.br/x.zip", zipName: "fixture.zip", zipBytes: zip.length, zipSha256: sha256(zip),
    edicoes: EDICOES, edicoesComMeta: METAS_FIXTURE,
    innerDir, xlsxName: "divulgacao_teste_escolas_2025.xlsx", xlsxBytes: xlsx.length,
    xlsxSha256: sha256(xlsx), xlsxMd5: md5(xlsx), md5Name: "md5_divulgacao_teste_escolas_2025.txt",
  };
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /arquivo obrigatório ausente/.test(error.message),
    );
  });
});

test("pacote sem o arquivo de checksum aborta", async () => {
  const xlsx = planilhaPadrao({ linhas: linhasPadrao() });
  const innerDir = "divulgacao_teste_escolas_2025";
  const zip = buildZip([{ name: `${innerDir}/divulgacao_teste_escolas_2025.xlsx`, data: xlsx }]);
  const pacote = {
    id: "fixture-2025", etapa: "anosIniciais", etapaLabel: "Fixture",
    url: "https://download.inep.gov.br/x.zip", zipName: "fixture.zip", zipBytes: zip.length, zipSha256: sha256(zip),
    edicoes: EDICOES, edicoesComMeta: METAS_FIXTURE,
    innerDir, xlsxName: "divulgacao_teste_escolas_2025.xlsx", xlsxBytes: xlsx.length,
    xlsxSha256: sha256(xlsx), xlsxMd5: md5(xlsx), md5Name: "md5_divulgacao_teste_escolas_2025.txt",
  };
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(() => rodar([], { base, cache, out, pacote }), (error) => /arquivo obrigatório ausente/.test(error.message));
  });
});

// ---- 7. Coluna obrigatória ausente -----------------------------------------

test("coluna obrigatória ausente no cabeçalho técnico aborta antes de emitir registros", async () => {
  const semColuna = COLUNAS.filter((nome) => nome !== "VL_NOTA_MATEMATICA_2025");
  const linhas = linhasPadrao().map((linha) => linha.slice(0, semColuna.length));
  const xlsx = planilhaPadrao({ colunas: semColuna, linhas });
  const { zip, pacote } = montarPacote({ xlsx });
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /coluna obrigatória ausente/.test(error.message) && /VL_NOTA_MATEMATICA_2025/.test(error.message),
    );
  });
});

test("planilha com mais de uma aba é recusada — a estrutura oficial tem exatamente uma", () => {
  const xlsx = buildXlsx({ 10: COLUNAS }, { sheetCount: 2 });
  assert.throws(() => openWorkbook(xlsx), XlsxError);
});

// ---- 8. Encoding e vírgula decimal -----------------------------------------

test("vírgula decimal é convertida e acentuação é preservada", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const particao = JSON.parse(await readFile(path.join(out, "municipios", "1100015.json"), "utf8"));
    // "228,04" na origem precisa virar o número 228.04.
    assert.equal(particao.escolas[0].etapas.anosIniciais["2023"].mt, 228.04);
    assert.equal(particao.municipio.nome, "Alta Floresta D'Oeste");
  });
});

test("separador de milhar e notação científica são recusados em vez de adivinhados", () => {
  for (const valor of ["1.234,56", "1e3", "12 345", "R$ 10"]) {
    assert.throws(() => normalizarNumero(valor), NormalizeError, `deveria recusar ${valor}`);
  }
  assert.equal(normalizarNumero("243,20"), 243.2);
  assert.equal(normalizarNumero("243.20"), 243.2);
});

// ---- 9. Identificador com zero à esquerda ----------------------------------

test("código com zero à esquerda é preservado como texto, no arquivo e no índice", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const arquivos = await readdir(path.join(out, "municipios"));
    assert.ok(arquivos.includes("0350030.json"), `esperado 0350030.json, encontrados: ${arquivos.join(", ")}`);

    const particao = JSON.parse(await readFile(path.join(out, "municipios", "0350030.json"), "utf8"));
    assert.equal(particao.municipio.codigoIbge, "0350030");
    assert.equal(typeof particao.municipio.codigoIbge, "string");

    const indice = JSON.parse(await readFile(path.join(out, "municipios-index.json"), "utf8"));
    assert.ok(indice.municipios.some((item) => item.codigoIbge === "0350030"));
  });
});

test("normalizarIdentificador preenche à esquerda e recusa valor não numérico ou longo demais", () => {
  assert.equal(normalizarIdentificador("350030", { digitos: 7, campo: "CO_MUNICIPIO" }), "0350030");
  assert.equal(normalizarIdentificador(3550308, { digitos: 7, campo: "CO_MUNICIPIO" }), "3550308");
  assert.throws(() => normalizarIdentificador("35X0308", { digitos: 7, campo: "CO_MUNICIPIO" }), NormalizeError);
  assert.throws(() => normalizarIdentificador("12345678", { digitos: 7, campo: "CO_MUNICIPIO" }), NormalizeError);
});

// ---- 10. Ausência nunca vira zero ------------------------------------------

test("cada marcador oficial vira um estado nomeado distinto, nunca zero nem null", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });

    const a = JSON.parse(await readFile(path.join(out, "municipios", "1100015.json"), "utf8"));
    const e2025 = a.escolas[0].etapas.anosIniciais["2025"];
    assert.deepEqual(Object.keys(e2025).sort(), ["ideb", "lp", "mt", "n", "p"]);
    assert.equal(e2025.lp.estado, "participacao_insuficiente");
    assert.equal(e2025.n.estado, "ausente");
    assert.notEqual(e2025.lp, 0);
    // O motivo em linguagem corrente vive no manifesto, indexado por estado —
    // repeti-lo em cada célula custaria centenas de MB sem acrescentar nada.
    assert.equal(e2025.lp.motivo, undefined);

    const b = JSON.parse(await readFile(path.join(out, "municipios", "0350030.json"), "utf8"));
    const e2009 = b.escolas[0].etapas.anosIniciais["2009"];
    assert.equal(e2009.lp.estado, "nao_divulgado_material_extraviado");
    assert.equal(e2009.mt.estado, "nao_divulgado_por_norma");
  });
});

test("os cinco marcadores oficiais são reconhecidos e nenhum token desconhecido passa", () => {
  const estados = MARCADORES_AUSENCIA.map((item) => normalizarIndicador(item.marcador).estado);
  assert.equal(new Set(estados).size, MARCADORES_AUSENCIA.length);
  assert.throws(() => normalizarIndicador("N/D"), NormalizeError);
  assert.throws(() => normalizarIndicador("s/inf"), NormalizeError);
  assert.deepEqual(normalizarIndicador(""), { tipo: "vazio" });
  assert.deepEqual(normalizarIndicador(undefined), { tipo: "vazio" });
});

test("o sufixo * de avaliação estadual preserva o valor e anexa a observação oficial", () => {
  const resultado = normalizarIndicador("187,89*");
  assert.equal(resultado.tipo, "valor");
  assert.equal(resultado.valor, 187.89);
  assert.match(resultado.observacao, /avaliações estaduais/);
});

test("ND* continua sendo não-divulgação por norma, e não ND com sufixo de asterisco", () => {
  // A ordem de detecção importa: despir o asterisco antes de casar o marcador
  // transformaria dois motivos oficiais distintos em um só.
  assert.equal(normalizarIndicador("ND*").estado, "nao_divulgado_por_norma");
  assert.equal(normalizarIndicador("ND").estado, "participacao_insuficiente");
  assert.equal(normalizarIndicador("ND**").estado, "nao_divulgado_a_pedido");
  assert.equal(normalizarIndicador("ND***").estado, "nao_divulgado_material_extraviado");
  assert.equal(normalizarIndicador("ND*").tipo, "ausente");
});

test("célula numérica aceita notação científica; célula de texto, não", () => {
  // O XML do xlsx serializa doubles pequenos em notação científica — é a forma
  // canônica, não um valor suspeito.
  assert.deepEqual(normalizarIndicador({ valor: "3.7999999999999999E-2", numerico: true }), {
    tipo: "valor",
    valor: 0.038,
  });
  assert.throws(() => normalizarIndicador({ valor: "3.8E-2", numerico: false }), NormalizeError);
});

// ---- 11. Ordenação estável -------------------------------------------------

test("partições, escolas e chaves saem em ordem determinística, independente da ordem de leitura", async () => {
  const invertidas = linhasPadrao().reverse();
  const xlsx = planilhaPadrao({ linhas: invertidas });
  const { zip, pacote } = montarPacote({ xlsx });
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const indice = JSON.parse(await readFile(path.join(out, "municipios-index.json"), "utf8"));
    const codigos = indice.municipios.map((item) => item.codigoIbge);
    assert.deepEqual(codigos, [...codigos].sort(), "índice deve estar ordenado por código IBGE");

    const bruto = await readFile(path.join(out, "municipios", "1100015.json"), "utf8");
    const chaves = Object.keys(JSON.parse(bruto));
    assert.deepEqual(chaves, [...chaves].sort(), "chaves de topo devem estar ordenadas");
  });
});

test("serializar produz chaves ordenadas e termina em LF, sem CRLF", () => {
  const texto = serializar({ b: 1, a: { d: 2, c: 3 } });
  assert.equal(texto, '{\n  "a": {\n    "c": 3,\n    "d": 2\n  },\n  "b": 1\n}\n');
  assert.ok(texto.endsWith("\n"));
  assert.ok(!texto.includes("\r"));
});

// ---- 12. Manifesto sem campos voláteis -------------------------------------

test("o manifesto não contém timestamp, caminho local nem nome de usuário", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const bruto = await readFile(manifestoDe(base), "utf8");

    for (const proibido of ["geradoEm", "importadoEm", "gerado_em", "importado_em", "timestamp", "executadoEm"]) {
      assert.ok(!bruto.includes(proibido), `manifesto não pode conter ${proibido}`);
    }
    assert.doesNotMatch(bruto, /\d{4}-\d{2}-\d{2}T\d{2}:\d{2}/, "sem timestamp ISO");
    assert.doesNotMatch(bruto, /[A-Za-z]:\\\\/, "sem caminho absoluto do Windows");
    assert.doesNotMatch(bruto, new RegExp(tmpdir().replace(/[.*+?^${}()|[\]\\]/g, "\\$&")), "sem caminho temporário");

    assert.equal(resultado.manifesto.schema_manifesto, 1);
    assert.equal(resultado.manifesto.edicao, "2025");
    assert.match(resultado.manifesto.fonte.atribuicao, /MEC\/Inep/);
    assert.ok(resultado.manifesto.criterios.inclusao.length > 0);
    assert.ok(resultado.manifesto.criterios.exclusao.length > 0);
    assert.ok(resultado.manifesto.ordenacao.particoes.length > 0);

    // A tabela de estados e o texto das observações ficam no manifesto: é lá que
    // a UI resolve o motivo legível de cada ausência.
    const estados = resultado.manifesto.dataset.estados_de_ausencia;
    assert.equal(estados.length, 5);
    for (const item of estados) {
      assert.ok(item.marcador && item.estado && item.motivo, "cada estado precisa de marcador, chave e motivo");
    }
    assert.match(resultado.manifesto.dataset.observacoes.avaliacao_estadual, /avaliações estaduais/);
  });
});

// ---- 13. Duas execuções byte a byte idênticas ------------------------------

test("duas execuções sobre a mesma entrada deixam todos os artefatos byte a byte idênticos", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });

    const hashes = async () => {
      const arquivos = [
        path.join(out, "municipios-index.json"),
        manifestoDe(base),
        ...(await readdir(path.join(out, "municipios"))).sort().map((nome) => path.join(out, "municipios", nome)),
      ];
      const saida = {};
      for (const arquivo of arquivos) {
        saida[path.basename(arquivo)] = sha256(await readFile(arquivo));
      }
      return saida;
    };

    const primeira = await hashes();
    const segunda = await rodar([], { base, cache, out, pacote });
    const depois = await hashes();

    assert.deepEqual(depois, primeira, "os artefatos mudaram entre duas execuções idênticas");
    assert.equal(segunda.escritos, 0, "a segunda execução não deveria reescrever nada");
  });
});

test("execução repetida não altera mtime de artefato sem mudança real", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const alvo = path.join(out, "municipios", "1100015.json");
    const antes = (await stat(alvo)).mtimeMs;
    await rodar([], { base, cache, out, pacote });
    assert.equal((await stat(alvo)).mtimeMs, antes);
  });
});

// ---- 14. Modo --check ------------------------------------------------------

test("--check não escreve nada quando os artefatos ainda não existem", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar(["--check"], { base, cache, out, pacote });
    assert.equal(resultado.modo, "check");
    assert.equal(resultado.escritos, 0);
    assert.equal(resultado.divergentes.length, resultado.artefatos, "todos ausentes");
    assert.equal(await stat(out).catch(() => null), null, "--check não pode criar o diretório de saída");
  });
});

test("--check aprova artefatos íntegros e não toca em mtime nem conteúdo", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const alvo = path.join(out, "municipios", "1100015.json");
    const antes = { mtime: (await stat(alvo)).mtimeMs, hash: sha256(await readFile(alvo)) };

    const resultado = await rodar(["--check"], { base, cache, out, pacote });
    assert.deepEqual(resultado.divergentes, []);
    assert.equal(resultado.escritos, 0);

    const depois = { mtime: (await stat(alvo)).mtimeMs, hash: sha256(await readFile(alvo)) };
    assert.deepEqual(depois, antes);
  });
});

test("--check detecta artefato adulterado e não o corrige", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const alvo = path.join(out, "municipios", "1100015.json");
    await writeFile(alvo, "{}\n");

    const resultado = await rodar(["--check"], { base, cache, out, pacote });
    assert.equal(resultado.divergentes.length, 1);
    assert.match(resultado.divergentes[0].caminho, /1100015\.json$/);
    assert.equal(resultado.divergentes[0].motivo, "conteudo_diverge");
    assert.equal(await readFile(alvo, "utf8"), "{}\n", "--check não pode reescrever o arquivo");
  });
});

test("--check e --download são mutuamente exclusivos", async () => {
  await assert.rejects(
    () => executar({ argv: ["--check", "--download"] }),
    (error) => /mutuamente exclusivos/.test(error.message),
  );
});

test("argumento desconhecido é recusado em vez de ignorado", async () => {
  await assert.rejects(() => executar({ argv: ["--forca"] }), (error) => /argumento desconhecido/.test(error.message));
});

// ---- 15. Falha antes da geração --------------------------------------------

test("nenhum artefato é gerado quando a integridade não é comprovada", async () => {
  const { zip, pacote } = montarPacote();
  pacote.xlsxMd5 = "f".repeat(32);
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(() => rodar([], { base, cache, out, pacote }));
    assert.equal(await stat(out).catch(() => null), null, "o diretório de saída não pode existir");
  });
});

test("pacote ausente no cache instrui o download explícito em vez de baixar sozinho", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const { pacote } = montarPacote();
  try {
    await assert.rejects(
      () => executar({ argv: ["--cache", base, "--out", path.join(base, "out")], cwd: base, pacotes: [pacote] }),
      (error) => /--download/.test(error.message),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ---- Leitura do checksum oficial -------------------------------------------

test("extrairMd5Oficial lê o formato publicado pelo Inep e ignora a linha do .ods", () => {
  const conteudo = md5Txt("6b4ce48ddcc02b1d4daf08428427342b", "divulgacao_anos_iniciais_escolas_2025.xlsx", "a".repeat(32));
  assert.equal(
    extrairMd5Oficial(conteudo, "divulgacao_anos_iniciais_escolas_2025.xlsx"),
    "6b4ce48ddcc02b1d4daf08428427342b",
  );
  assert.throws(() => extrairMd5Oficial(conteudo, "outro.xlsx"), (error) => /não encontrado/.test(error.message));
});

// ---- Proteção do cache -----------------------------------------------------

test("um pacote já em cache com conteúdo divergente nunca é sobrescrito em silêncio", async () => {
  const { pacote } = montarPacote();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const destino = path.join(base, pacote.zipName);
  // Arquivo com o nome certo e tamanho errado: o importador precisa parar, e não
  // apagar bytes que alguém pode ter posto ali de propósito.
  await writeFile(destino, Buffer.alloc(pacote.zipBytes - 1, 0x5a));
  const antes = await readFile(destino);

  try {
    await assert.rejects(
      () => executar({ argv: ["--download", "--cache", base], cwd: base, pacotes: [pacote] }),
      (error) => /não passou na validação/.test(error.message) && /não sobrescreve/.test(error.message),
    );
    assert.deepEqual(await readFile(destino), antes, "o arquivo existente não pode ter sido tocado");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("o importador nunca baixa nada sem --download explícito", async () => {
  // Sem --download e sem cache, a única saída é parar com instrução — jamais
  // buscar a rede por conta própria durante build, teste ou install.
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const { pacote } = montarPacote();
  try {
    await assert.rejects(
      () => executar({ argv: ["--cache", base, "--out", path.join(base, "out")], cwd: base, pacotes: [pacote] }),
      (error) => /pacote ausente no cache/.test(error.message),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ---- Cache: validação completa antes de aceitar ou gravar ------------------

test("cache já validado evita novo download, sem tocar a rede", async () => {
  const { zip, pacote } = montarPacote();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  await writeFile(path.join(base, pacote.zipName), zip);
  const antes = (await stat(path.join(base, pacote.zipName))).mtimeMs;

  // Se tentasse baixar, falharia: a URL da fixture não existe.
  try {
    const resultado = await executar({ argv: ["--download", "--cache", base], cwd: base, pacotes: [pacote] });
    assert.equal(resultado.modo, "download");
    assert.equal(resultado.baixados[0].baixado, false, "não deveria ter baixado");
    assert.equal((await stat(path.join(base, pacote.zipName))).mtimeMs, antes, "arquivo em cache foi tocado");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("cache de mesmo tamanho mas conteúdo divergente é recusado, e o arquivo é preservado", async () => {
  const { zip, pacote } = montarPacote();
  const adulterado = Buffer.from(zip);
  adulterado[faixaDeDados(zip, ".xlsx") + 32] ^= 0xff;
  assert.equal(adulterado.length, zip.length);

  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const destino = path.join(base, pacote.zipName);
  await writeFile(destino, adulterado);

  try {
    await assert.rejects(
      () => executar({ argv: ["--download", "--cache", base], cwd: base, pacotes: [pacote] }),
      (error) => /não passou na validação/.test(error.message) && /fingerprint SHA-256/.test(error.message),
    );
    assert.deepEqual(await readFile(destino), adulterado, "o arquivo existente não pode ter sido alterado");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("download inválido não deixa arquivo algum no cache", async () => {
  const { zip, pacote } = montarPacote();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const destino = path.join(base, pacote.zipName);

  // fetch substituído por uma resposta que devolve bytes adulterados de mesmo
  // tamanho — o pior caso, que só o fingerprint pega.
  const adulterado = Buffer.from(zip);
  adulterado[faixaDeDados(zip, ".xlsx") + 16] ^= 0xff;
  const fetchOriginal = globalThis.fetch;
  globalThis.fetch = async () => new Response(adulterado, { status: 200 });

  try {
    await assert.rejects(
      () => executar({ argv: ["--download", "--cache", base], cwd: base, pacotes: [pacote] }),
      (error) => /fingerprint SHA-256 do ZIP diverge/.test(error.message),
    );
    assert.equal(await stat(destino).catch(() => null), null, "nenhum arquivo pode ter sido criado");
    assert.deepEqual(await readdir(base), [], "o diretório de cache deve ter ficado vazio");
  } finally {
    globalThis.fetch = fetchOriginal;
    await rm(base, { recursive: true, force: true });
  }
});

// ---- Artefatos órfãos ------------------------------------------------------

test("--check detecta partição órfã sem removê-la", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const orfa = path.join(out, "municipios", "9999999.json");
    await writeFile(orfa, '{"schema":"saeb-escolas-municipio/1"}\n');

    const resultado = await rodar(["--check"], { base, cache, out, pacote });
    const achado = resultado.divergentes.find((item) => item.caminho === orfa);
    assert.ok(achado, `órfã não detectada: ${JSON.stringify(resultado.divergentes)}`);
    assert.equal(achado.motivo, "orfao");
    assert.equal(resultado.escritos, 0);
    assert.ok(await stat(orfa).catch(() => null), "--check não pode remover a órfã");
  });
});

test("o modo normal remove a partição órfã e nada mais", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const legitimas = (await readdir(path.join(out, "municipios"))).sort();

    const orfa = path.join(out, "municipios", "9999999.json");
    await writeFile(orfa, '{"schema":"saeb-escolas-municipio/1"}\n');

    const resultado = await rodar([], { base, cache, out, pacote });
    assert.equal(resultado.removidos, 1);
    assert.equal(resultado.escritos, 0, "nenhuma partição legítima deveria ser reescrita");
    assert.equal(await stat(orfa).catch(() => null), null, "a órfã deveria ter sido removida");
    assert.deepEqual((await readdir(path.join(out, "municipios"))).sort(), legitimas);
  });
});

test("arquivo estranho no diretório de saída aborta em vez de ser apagado", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const estranho = path.join(out, "municipios", "anotacoes.txt");
    await writeFile(estranho, "trabalho de alguém\n");

    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /não reconhecido/.test(error.message) && /não remove o que não gerou/.test(error.message),
    );
    assert.ok(await stat(estranho).catch(() => null), "o arquivo estranho precisa continuar lá");
  });
});

test("nome fora do padrão NNNNNNN.json nunca é removido, nem quando parece partição", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    // Seis dígitos, oito dígitos e com sufixo: nenhum casa com o padrão exato.
    for (const nome of ["350303.json", "355030812.json", "3550308.json.bak"]) {
      await writeFile(path.join(out, "municipios", nome), "{}\n");
    }
    await assert.rejects(() => rodar([], { base, cache, out, pacote }), (error) => /não reconhecido/.test(error.message));
    for (const nome of ["350303.json", "355030812.json", "3550308.json.bak"]) {
      assert.ok(await stat(path.join(out, "municipios", nome)).catch(() => null), `${nome} foi removido indevidamente`);
    }
  });
});

test("subdiretório inesperado dentro da saída é reportado, nunca percorrido nem removido", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const intruso = path.join(out, "outra-coisa");
    await mkdir(intruso, { recursive: true });
    await writeFile(path.join(intruso, "dado.json"), "{}\n");

    const resultado = await rodar(["--check"], { base, cache, out, pacote });
    assert.ok(resultado.divergentes.some((item) => item.caminho === intruso && item.motivo === "arquivo_estranho"));
    await assert.rejects(() => rodar([], { base, cache, out, pacote }), (error) => /não reconhecido/.test(error.message));
    assert.ok(await stat(path.join(intruso, "dado.json")).catch(() => null), "o conteúdo do subdiretório precisa sobreviver");
  });
});

test("nenhuma remoção escapa do diretório de saída", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    // Um arquivo irmão do outDir, com nome de partição válido: se a limpeza
    // usasse caminho calculado sem checar o prefixo, ele seria candidato.
    const vizinho = path.join(base, "1100015.json");
    await writeFile(vizinho, "{}\n");
    await rodar([], { base, cache, out, pacote });
    assert.ok(await stat(vizinho).catch(() => null), "arquivo fora do outDir foi tocado");
  });
});

// ---- Duplicidades e conflitos entre escolas --------------------------------

/** Monta dois pacotes de etapas diferentes, cada um com sua própria escola. */
function doisPacotes(linhasA, linhasB) {
  const xlsxA = planilhaPadrao({ linhas: linhasA });
  const xlsxB = planilhaPadrao({ linhas: linhasB });
  const monta = (xlsx, id, etapa) => {
    const innerDir = `divulgacao_${etapa}_escolas_2025`;
    const xlsxName = `${innerDir}.xlsx`;
    const md5Name = `md5_${innerDir}.txt`;
    const zip = buildZip([
      { name: `${innerDir}/${xlsxName}`, data: xlsx },
      { name: `${innerDir}/${md5Name}`, data: md5Txt(md5(xlsx), xlsxName) },
    ]);
    return {
      zip,
      pacote: {
        id, etapa, etapaLabel: id,
        url: `https://download.inep.gov.br/${id}.zip`,
        zipName: `${id}.zip`, zipBytes: zip.length, zipSha256: sha256(zip),
        edicoes: EDICOES, edicoesComMeta: METAS_FIXTURE,
        innerDir, xlsxName, xlsxBytes: xlsx.length, xlsxSha256: sha256(xlsx),
        xlsxMd5: md5(xlsx), md5Name,
      },
    };
  };
  return [monta(xlsxA, "fixture-ai", "anosIniciais"), monta(xlsxB, "fixture-af", "anosFinais")];
}

async function rodarDois(pares) {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true });
  for (const { zip, pacote } of pares) await writeFile(path.join(cache, pacote.zipName), zip);
  try {
    return await executar({
      argv: ["--cache", cache, "--out", path.join(base, "out")],
      cwd: base,
      pacotes: pares.map((par) => par.pacote),
    });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

const linha = (identificacao, edicoes = { 2025: { lp: "200.0" } }) =>
  linhaDeEscola(identificacao, edicoes, EDICOES, INDICADORES, temMeta);

test("código Inep duplicado dentro do mesmo pacote aborta", async () => {
  const { zip, pacote } = montarPacote({
    xlsx: planilhaPadrao({ linhas: [linha(ESCOLA_A), linha({ ...ESCOLA_A })] }),
  });
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await assert.rejects(
      () => rodar([], { base, cache, out, pacote }),
      (error) => /codigo_inep_duplicado_no_pacote/.test(error.message) && /11024682/.test(error.message),
    );
  });
});

test("a mesma escola repetida para a mesma etapa aborta", async () => {
  // Dois pacotes declarando a MESMA etapa para a mesma escola.
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha(ESCOLA_A)]);
  b.pacote.etapa = "anosIniciais";
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /etapa_repetida_para_a_mesma_escola/.test(error.message),
  );
});

test("o mesmo código Inep em municípios diferentes aborta", async () => {
  const [a, b] = doisPacotes(
    [linha(ESCOLA_A)],
    [linha({ ...ESCOLA_A, codigoIbge: "3550308", municipio: "São Paulo", uf: "SP" })],
  );
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /identidade_de_escola_divergente/.test(error.message) && /codigoIbge/.test(error.message),
  );
});

test("nome de escola divergente entre pacotes aborta", async () => {
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha({ ...ESCOLA_A, nome: "OUTRO NOME" })]);
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /identidade_de_escola_divergente/.test(error.message) && /"campo": "nome"/.test(error.message),
  );
});

test("rede divergente entre pacotes aborta", async () => {
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha({ ...ESCOLA_A, rede: "Municipal" })]);
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /identidade_de_escola_divergente/.test(error.message) && /"campo": "rede"/.test(error.message),
  );
});

test("UF divergente para a mesma escola aborta", async () => {
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha({ ...ESCOLA_A, uf: "AC" })]);
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /identidade_de_escola_divergente/.test(error.message) && /"campo": "uf"/.test(error.message),
  );
});

test("mesmo código de município com nome conflitante aborta", async () => {
  const outraEscola = { ...ESCOLA_A, codigoInep: "11024683", municipio: "Nome Diferente" };
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha(outraEscola)]);
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /nome_de_municipio_divergente/.test(error.message) && /1100015/.test(error.message),
  );
});

test("mesmo código de município com UF conflitante aborta", async () => {
  const outraEscola = { ...ESCOLA_A, codigoInep: "11024684", uf: "SP" };
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha(outraEscola)]);
  await assert.rejects(
    () => rodarDois([a, b]),
    (error) => /uf_de_municipio_divergente/.test(error.message),
  );
});

test("pacotes coerentes de etapas diferentes se fundem na mesma escola", async () => {
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha(ESCOLA_A)]);
  const resultado = await rodarDois([a, b]);
  assert.equal(resultado.modo, "normal");
  assert.equal(resultado.manifesto.dataset.escolas, 1);
  assert.equal(resultado.manifesto.dataset.municipios, 1);
});

// ---- Limites defensivos do leitor de ZIP -----------------------------------

/** Reescreve um campo do diretório central da primeira entrada do ZIP. */
function ajustarCentral(zip, deslocamento, escrever) {
  const copia = Buffer.from(zip);
  const eocd = copia.length - 22;
  const central = copia.readUInt32LE(eocd + 16);
  escrever(copia, central + deslocamento);
  return copia;
}

test("número excessivo de entradas é recusado antes de qualquer leitura", () => {
  const entradas = Array.from({ length: LIMITES.maxEntradas + 1 }, (_, i) => ({
    name: `a${i}.txt`,
    data: "x",
  }));
  assert.throws(
    () => openZip(buildZip(entradas)),
    (error) => new RegExp(`acima do limite de ${LIMITES.maxEntradas}`).test(error.message),
  );
});

test("tamanho descomprimido declarado acima do limite é recusado", () => {
  const zip = buildZip([{ name: "a.txt", data: "x" }]);
  // Declara um tamanho descomprimido absurdo no diretório central.
  const adulterado = ajustarCentral(zip, 24, (buf, at) => buf.writeUInt32LE(0xfffffff0, at));
  assert.throws(
    () => openZip(adulterado),
    (error) => /bytes descomprimidos, acima do limite/.test(error.message),
  );
});

test("tamanho comprimido declarado acima do limite é recusado", () => {
  const zip = buildZip([{ name: "a.txt", data: "x" }]);
  const adulterado = ajustarCentral(zip, 20, (buf, at) => buf.writeUInt32LE(0x30000000, at));
  assert.throws(
    () => openZip(adulterado),
    (error) => /entrada comprimida com \d+ bytes, acima do limite/.test(error.message),
  );
});

test("razão de compressão abusiva é recusada", () => {
  const zip = buildZip([{ name: "a.txt", data: "x" }]);
  // 64 MB descomprimidos declarados sobre um payload minúsculo: razão muito
  // acima do teto, e acima do piso a partir do qual a razão é cobrada.
  const adulterado = ajustarCentral(zip, 24, (buf, at) => buf.writeUInt32LE(64 * 1024 * 1024, at));
  assert.throws(
    () => openZip(adulterado),
    (error) => /razão de compressão .*acima do limite/.test(error.message),
  );
});

test("soma dos tamanhos descomprimidos acima do total permitido é recusada", () => {
  // Cada entrada abaixo do teto individual, mas a soma passa do total.
  const porEntrada = 600 * 1024 * 1024;
  const zip = buildZip([
    { name: "a.txt", data: "x" },
    { name: "b.txt", data: "y" },
  ]);
  const copia = Buffer.from(zip);
  const eocd = copia.length - 22;
  let central = copia.readUInt32LE(eocd + 16);
  for (let i = 0; i < 2; i += 1) {
    copia.writeUInt32LE(porEntrada, central + 24);
    copia.writeUInt32LE(porEntrada / 4, central + 20);
    const nameLength = copia.readUInt16LE(central + 28);
    central += 46 + nameLength;
  }
  assert.throws(
    () => openZip(copia),
    (error) => /soma dos tamanhos descomprimidos passa de/.test(error.message),
  );
});

test("valor ZIP64 fora do intervalo seguro de Number é recusado", () => {
  const zip = buildZip([{ name: "a.txt", data: "x" }]);
  const copia = Buffer.from(zip);
  const eocd = copia.length - 22;
  const central = copia.readUInt32LE(eocd + 16);
  const nameLength = copia.readUInt16LE(central + 28);

  // Marca o tamanho descomprimido como "veja o extra ZIP64" e injeta lá um valor
  // acima de Number.MAX_SAFE_INTEGER.
  copia.writeUInt32LE(0xffffffff, central + 24);
  copia.writeUInt16LE(12, central + 30); // extraLength
  const extra = Buffer.alloc(12);
  extra.writeUInt16LE(0x0001, 0);
  extra.writeUInt16LE(8, 2);
  extra.writeBigUInt64LE(2n ** 60n, 4);

  const antes = copia.subarray(0, central + 46 + nameLength);
  const depois = copia.subarray(central + 46 + nameLength);
  const comExtra = Buffer.concat([antes, extra, depois]);
  // Reposiciona o EOCD para refletir o diretório central maior.
  comExtra.writeUInt32LE(comExtra.readUInt32LE(comExtra.length - 22 + 12) + 12, comExtra.length - 22 + 12);

  assert.throws(
    () => openZip(comExtra),
    (error) => /fora do intervalo seguro de inteiro/.test(error.message),
  );
});

test("as fixtures sintéticas continuam dentro de todos os limites", () => {
  const { zip, xlsx } = montarPacote();
  assert.ok(openZip(zip).entries.length <= LIMITES.maxEntradas);
  assert.ok(openZip(xlsx).entries.length <= LIMITES.maxEntradas);
  // Abrir e ler de fato: se algum limite estivesse apertado demais, quebraria aqui.
  assert.ok(openWorkbook(xlsx).sheetName.length > 0);
});

test("os limites comportam os pacotes oficiais com a margem documentada", () => {
  // Máximos medidos nos três pacotes de 2025, em 01/09/2026. O teste falha se
  // alguém apertar um limite abaixo do que a fonte real exige.
  const observado = {
    entradas: 16,
    comprimidoPorEntrada: 56_500_000,
    descomprimidoPorEntrada: 367_400_000,
    descomprimidoTotal: 370_900_000,
    razao: 21.1,
  };
  assert.ok(LIMITES.maxEntradas > observado.entradas, "limite de entradas abaixo do observado");
  assert.ok(LIMITES.maxComprimidoPorEntrada > observado.comprimidoPorEntrada);
  assert.ok(LIMITES.maxDescomprimidoPorEntrada > observado.descomprimidoPorEntrada);
  assert.ok(LIMITES.maxDescomprimidoTotal > observado.descomprimidoTotal);
  assert.ok(LIMITES.maxRazaoCompressao > observado.razao);
});

// ---- Redação do manifesto e da documentação --------------------------------

test("o manifesto não promete data de publicação que não existe", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const bruto = await readFile(manifestoDe(base), "utf8");

    // `publicado_em: null` era uma promessa vazia: o Last-Modified é volátil e o
    // Inep não publica data de referência. Melhor omitir o campo.
    assert.ok(!bruto.includes("publicado_em"), "o campo publicado_em não deve existir");
    assert.ok(!bruto.includes("last_modified"), "nenhum header volátil no manifesto");
    for (const item of resultado.manifesto.pacotes) {
      assert.equal(item.publicado_em, undefined);
    }
  });
});

test("o critério de inclusão fala da cobertura por etapa, não de um número fixo de edições", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const inclusao = resultado.manifesto.criterios.inclusao.join(" | ");
    assert.match(inclusao, /cobertura específica registrada por etapa/);
    assert.doesNotMatch(inclusao, /todas as 11 edições/);
    assert.doesNotMatch(inclusao, /\b11 edições\b/);
  });
});

test("a proveniência descreve o separador decimal sem ambiguidade", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const separador = resultado.manifesto.proveniencia.separador_decimal;
    assert.match(separador, /ponto ou vírgula aceitos como separador decimal na origem/);
    assert.doesNotMatch(separador, /ponto e vírgula aceitos/);
  });
});

test("o manifesto distingue checksum oficial de fingerprint local", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await rodar([], { base, cache, out, pacote });
    const integridade = resultado.manifesto.pacotes[0].integridade;
    // O nome do campo precisa dizer de onde o valor veio.
    assert.ok("xlsx_md5_oficial" in integridade, "o MD5 é o checksum oficial");
    assert.ok("zip_sha256_local" in integridade, "o SHA-256 do ZIP é fingerprint local");
    assert.ok("xlsx_sha256_local" in integridade, "o SHA-256 da planilha é fingerprint local");
    assert.ok(!("zip_sha256" in integridade), "nome ambíguo não deve voltar");
    assert.ok(!("md5_conferido" in integridade), "nome ambíguo não deve voltar");
  });
});

test("o código-fonte não chama verificação de tamanho de checksum, nem alega origens independentes", async () => {
  const arquivos = [
    "../scripts/saeb/import.mjs",
    "../scripts/saeb/lib/sources.mjs",
    "../scripts/saeb/lib/zip.mjs",
    "../scripts/saeb/lib/normalize.mjs",
    "../scripts/saeb/lib/xlsx.mjs",
  ];
  for (const relativo of arquivos) {
    const fonte = await readFile(new URL(relativo, import.meta.url), "utf8");
    assert.doesNotMatch(fonte, /duas origens independentes/, `${relativo}: MD5 e sua cópia fixada têm a mesma origem editorial`);
    assert.doesNotMatch(fonte, /checksum correto/, `${relativo}: não chame conferência de tamanho de checksum`);
    assert.doesNotMatch(fonte, /todas as 11 edições/, `${relativo}`);
  }
});

// ---- --verify-source --------------------------------------------------------
//
// Mesmas fixtures sintéticas do resto do arquivo — nenhum teste aqui toca rede
// nem os pacotes oficiais. A validação real contra os três ZIPs em cache é um
// procedimento manual (`npm run saeb:verify`), documentado em data/saeb/README.md,
// deliberadamente fora desta suíte e da CI.

const rodarVerify = (argv, { base, cache, pacote }) =>
  executar({ argv: ["--verify-source", "--cache", cache, ...argv], cwd: base, pacotes: [pacote] });

async function rodarDoisVerify(pares) {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true });
  for (const { zip, pacote } of pares) await writeFile(path.join(cache, pacote.zipName), zip);
  try {
    return await executar({
      argv: ["--verify-source", "--cache", cache],
      cwd: base,
      pacotes: pares.map((par) => par.pacote),
    });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

const ESCOLA_C = {
  uf: "MG",
  codigoIbge: "3106200",
  municipio: "Belo Horizonte",
  codigoInep: "31000030",
  nome: "EE TERCEIRA ESCOLA",
  rede: "Estadual",
};

test("--verify-source aprova quando cache e manifesto batem com o que o parser produz", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote }); // materializa e grava o manifesto real, uma vez
    const resultado = await rodarVerify([], { base, cache, pacote });
    assert.equal(resultado.modo, "verify-source");
    assert.equal(resultado.manifestoComparacao, "identico");
    assert.equal(resultado.escolas, 2);
    assert.equal(resultado.municipios, 2);
    assert.equal(resultado.artefatosPrevistos, 4); // manifesto + índice + 2 partições
    assert.equal(resultado.escritos, 0);
    assert.equal(resultado.removidos, 0);
    assert.deepEqual(resultado.pacotes, [{ id: "fixture-2025", etapa: "anosIniciais", escolas: 2 }]);
  });
});

test("--verify-source funciona mesmo sem public/data/saeb existente", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    await rm(out, { recursive: true, force: true });
    const resultado = await rodarVerify([], { base, cache, pacote });
    assert.equal(resultado.modo, "verify-source");
    assert.equal(await stat(out).catch(() => null), null, "verify-source não deve recriar o diretório público");
  });
});

test("--verify-source não cria log, arquivo nem diretório algum", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const antes = (await readdir(base, { recursive: true })).sort();
    await rodarVerify([], { base, cache, pacote });
    const depois = (await readdir(base, { recursive: true })).sort();
    assert.deepEqual(depois, antes);
  });
});

test("--verify-source preserva conteúdo e mtime do manifesto e do cache", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const manifestoPath = manifestoDe(base);
    const zipPath = path.join(cache, pacote.zipName);

    const manifestoAntes = { conteudo: await readFile(manifestoPath, "utf8"), stat: await stat(manifestoPath) };
    const zipAntes = { conteudo: await readFile(zipPath), stat: await stat(zipPath) };

    await rodarVerify([], { base, cache, pacote });

    const manifestoDepois = { conteudo: await readFile(manifestoPath, "utf8"), stat: await stat(manifestoPath) };
    const zipDepois = { conteudo: await readFile(zipPath), stat: await stat(zipPath) };

    assert.equal(manifestoDepois.conteudo, manifestoAntes.conteudo);
    assert.equal(manifestoDepois.stat.mtimeMs, manifestoAntes.stat.mtimeMs);
    assert.ok(zipDepois.conteudo.equals(zipAntes.conteudo));
    assert.equal(zipDepois.stat.mtimeMs, zipAntes.stat.mtimeMs);
  });
});

test("--verify-source lê a planilha inteira: um valor inválido numa linha posterior ainda é detectado", async () => {
  const linhas = [linha(ESCOLA_A), linha(ESCOLA_B), linha(ESCOLA_C, { 2025: { lp: "abc" } })];
  const { zip, pacote } = montarPacote({ xlsx: planilhaPadrao({ linhas }) });
  await comCache(zip, pacote, async ({ base, cache }) => {
    // A mesma planilha, adulterada na 3ª linha de dados (row 13): prova que a
    // leitura não para na 1ª linha válida antes de chegar lá.
    await assert.rejects(
      () => rodarVerify([], { base, cache, pacote }),
      (error) => /valor numérico não reconhecido/.test(error.message) && /linha 13/.test(error.message),
    );
  });
});

test("--verify-source falha com manifesto ausente, sem gerar um novo", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache }) => {
    await assert.rejects(
      () => rodarVerify([], { base, cache, pacote }),
      (error) => /manifesto ausente/.test(error.message) && /geração controlada/.test(error.message),
    );
    assert.equal(await stat(manifestoDe(base)).catch(() => null), null, "--verify-source não deve criar o manifesto");
  });
});

test("--verify-source falha com manifesto divergente, sem regravá-lo nem despejá-lo no erro", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const manifestoPath = manifestoDe(base);
    const corrompido = (await readFile(manifestoPath, "utf8")).replace('"schema_manifesto": 1', '"schema_manifesto": 999');
    await writeFile(manifestoPath, corrompido);

    await assert.rejects(
      () => rodarVerify([], { base, cache, pacote }),
      (error) =>
        /manifesto reconstruído diverge/.test(error.message) &&
        /geração controlada/.test(error.message) &&
        error.message.length < 400 &&
        !/"criterios"/.test(error.message),
    );
    assert.equal(await readFile(manifestoPath, "utf8"), corrompido, "manifesto corrompido não deve ser sobrescrito");
  });
});

test("--verify-source falha quando um pacote está ausente do cache", async () => {
  const { pacote } = montarPacote();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true }); // vazio: nenhum zip
  try {
    await assert.rejects(
      () => rodarVerify([], { base, cache, pacote }),
      (error) => /pacote ausente no cache/.test(error.message) && /--download/.test(error.message),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("--verify-source detecta pacote adulterado no cache", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    await writeFile(path.join(cache, pacote.zipName), Buffer.concat([zip, Buffer.from("lixo-adicionado")]));
    await assert.rejects(
      () => rodarVerify([], { base, cache, pacote }),
      (error) => /tamanho \d+ bytes, esperado \d+/.test(error.message),
    );
  });
});

test("--verify-source detecta conflito de identidade entre pacotes, sem precisar de manifesto", async () => {
  const [a, b] = doisPacotes([linha(ESCOLA_A)], [linha({ ...ESCOLA_A, nome: "OUTRO NOME" })]);
  await assert.rejects(
    () => rodarDoisVerify([a, b]),
    (error) => /identidade_de_escola_divergente/.test(error.message) && /"campo": "nome"/.test(error.message),
  );
});

test("--verify-source é incompatível com --download, --check e --out", async () => {
  await assert.rejects(
    () => executar({ argv: ["--verify-source", "--download"] }),
    (error) => /--verify-source e --download são mutuamente exclusivos/.test(error.message),
  );
  await assert.rejects(
    () => executar({ argv: ["--verify-source", "--check"] }),
    (error) => /--verify-source e --check são mutuamente exclusivos/.test(error.message),
  );
  await assert.rejects(
    () => executar({ argv: ["--verify-source", "--out", "qualquer"] }),
    (error) => /--verify-source e --out são mutuamente exclusivos/.test(error.message),
  );
});

test("--out e --cache exigem valor não vazio, com mensagem clara", async () => {
  await assert.rejects(() => executar({ argv: ["--out"] }), (error) => /--out requer um valor não vazio/.test(error.message));
  await assert.rejects(() => executar({ argv: ["--cache", ""] }), (error) => /--cache requer um valor não vazio/.test(error.message));
  await assert.rejects(() => executar({ argv: ["--out="] }), (error) => /--out requer um valor não vazio/.test(error.message));
  await assert.rejects(() => executar({ argv: ["--cache="] }), (error) => /--cache requer um valor não vazio/.test(error.message));
});

test("--verify-source aceita --cache, e usa data/saeb/source como padrão quando ele não é passado", async () => {
  const { zip, pacote } = montarPacote();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-test-"));
  const cacheDefault = path.join(base, "data", "saeb", "source");
  await mkdir(cacheDefault, { recursive: true });
  await writeFile(path.join(cacheDefault, pacote.zipName), zip);
  try {
    // gera o manifesto real usando o mesmo cache padrão (saída redirecionada, sem sujar o padrão)
    await executar({ argv: ["--out", path.join(base, "out")], cwd: base, pacotes: [pacote] });
    const resultado = await executar({ argv: ["--verify-source"], cwd: base, pacotes: [pacote] });
    assert.equal(resultado.modo, "verify-source");
    assert.equal(resultado.cacheDir, cacheDefault);
    assert.equal(resultado.manifestoComparacao, "identico");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("--check continua relatando artefatos ausentes como divergência (semântica preservada)", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    const resultado = await executar({ argv: ["--cache", cache, "--out", out, "--check"], cwd: base, pacotes: [pacote] });
    assert.equal(resultado.modo, "check");
    assert.ok(resultado.divergentes.some((d) => d.motivo === "ausente"), "--check deve continuar reportando ausência, nunca ignorá-la");
  });
});

test("--verify-source nunca chama fetch", async () => {
  const { zip, pacote } = montarPacote();
  await comCache(zip, pacote, async ({ base, cache, out }) => {
    await rodar([], { base, cache, out, pacote });
    const originalFetch = global.fetch;
    global.fetch = () => {
      throw new Error("--verify-source não deveria chamar fetch");
    };
    try {
      const resultado = await rodarVerify([], { base, cache, pacote });
      assert.equal(resultado.modo, "verify-source");
    } finally {
      global.fetch = originalFetch;
    }
  });
});

// ---- Exit codes reais, via subprocesso do CLI verdadeiro -------------------
//
// Os testes acima chamam executar() diretamente e conferem que a Promise
// rejeita ou resolve. Isto aqui prova algo diferente: que o processo real —
// `node scripts/saeb/import.mjs <argv>`, o mesmo binário que roda em produção —
// de fato sai com o código esperado. Nenhum runner intermediário: o subprocesso
// spawna o próprio scripts/saeb/import.mjs, então o bloco
// `if (executadoDiretamente) { try {...} catch {...} }` no fim daquele arquivo é
// o que roda de verdade. Uma regressão nesse bloco (por exemplo, alguém remover
// `process.exitCode = 1`) quebraria estes testes, não um substituto deles — veja
// a prova de regressão ao final desta seção.
//
// Limite de arquitetura, verificado antes de escrever isto: a CLI real chama
// `executar({ argv: process.argv.slice(2) })` sem override de `pacotes` (só os
// testes que importam `executar` diretamente conseguem injetar fixtures). Isso
// significa que o caminho de SUCESSO da CLI real só é exercitável com os três
// pacotes oficiais de verdade — 211 MB, exatamente o que esta suíte não pode
// tocar. Adicionar uma flag/env var só para injetar pacotes de teste no processo
// real contornaria a própria checagem de integridade que o importador existe
// para impor, então não fizemos isso. O caminho de sucesso continua coberto
// diretamente por executar() — veja "--verify-source aprova quando cache e
// manifesto batem com o que o parser produz", acima — e a prova real desse
// caminho contra os pacotes oficiais é `npm run saeb:verify`, documentado em
// data/saeb/README.md como procedimento manual, fora desta suíte e da CI.

const IMPORT_SCRIPT_PATH = path.resolve(import.meta.dirname, "..", "scripts", "saeb", "import.mjs");

/**
 * Spawna a CLI real. Trata explicitamente as três formas de o subprocesso não
 * terminar como um `status` normal: falha ao iniciar (`error`), morte por sinal
 * (inclusive o `SIGTERM` que o próprio `timeout` do spawnSync dispara) — nos
 * dois casos, lança em vez de deixar um `status` nulo escapar para um `assert`
 * que passaria por engano.
 */
function rodarCliReal({ cwd, argv, scriptPath = IMPORT_SCRIPT_PATH, timeoutMs = 15_000 }) {
  const resultado = spawnSync(process.execPath, [scriptPath, ...argv], { cwd, timeout: timeoutMs, encoding: "utf8" });
  if (resultado.error) {
    throw new Error(`subprocesso da CLI não iniciou (${scriptPath}): ${resultado.error.message}`);
  }
  if (resultado.signal) {
    throw new Error(
      `subprocesso da CLI morreu por sinal ${resultado.signal} (possível timeout de ${timeoutMs}ms): ${scriptPath} ${argv.join(" ")}`,
    );
  }
  return { status: resultado.status, stdout: resultado.stdout, stderr: resultado.stderr };
}

test("CLI real: --verify-source com --download sai com 1 e a mensagem de mutuamente exclusivos", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-cli-test-"));
  try {
    const antes = await readdir(base, { recursive: true });
    const { status, stderr } = rodarCliReal({ cwd: base, argv: ["--verify-source", "--download"] });
    assert.equal(status, 1, `esperado exit 1, obtido ${status}: ${stderr}`);
    assert.match(stderr, /mutuamente exclusivos/);
    const depois = await readdir(base, { recursive: true });
    assert.deepEqual(depois, antes, "argumento inválido não deve criar nada, nem tentar rede");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("CLI real: --verify-source com --cache vazio sai com 1 por pacote ausente, sem gerar arquivo", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-cli-test-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true });
  try {
    // Sem rede por construção, não por bloqueio deste teste: o subprocesso é um
    // processo Node separado, então monkey-patchar `fetch` aqui não o alcançaria.
    // A garantia real é de código — verificarPacote() só faz `readFile` no cache
    // local; `fetch` vive exclusivamente dentro de baixarPacote(), chamada apenas
    // quando `flags.download` é true, e `--download` não está neste argv.
    const { status, stderr } = rodarCliReal({ cwd: base, argv: ["--verify-source", "--cache", cache] });
    assert.equal(status, 1, `esperado exit 1, obtido ${status}: ${stderr}`);
    assert.match(stderr, /pacote ausente no cache/);
    assert.match(stderr, /--download/);
    // "sem gerar arquivo": o único conteúdo sob base continua sendo o próprio
    // diretório `cache` vazio que este teste criou — nada mais foi escrito.
    const entradas = await readdir(base, { recursive: true });
    assert.deepEqual(entradas, ["cache"]);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ---- Prova de regressão: os testes acima têm dentes -------------------------
//
// Copia scripts/saeb inteiro (import.mjs + lib/) para um diretório temporário,
// remove cirurgicamente a linha `process.exitCode = 1` do bloco catch da CÓPIA,
// e roda o mesmo cenário de erro acima contra essa cópia mutada. Nunca toca no
// arquivo real. Se o exit code da cópia mutada continuasse 1, isso provaria que
// os testes acima não dependem de fato daquela linha — e não estariam testando
// o que dizem testar.
async function comCopiaMutadaDoCli(mutar, fn) {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-cli-mutante-"));
  try {
    const origem = path.resolve(import.meta.dirname, "..", "scripts", "saeb");
    const destino = path.join(base, "scripts", "saeb");
    await cp(origem, destino, { recursive: true });

    const scriptPath = path.join(destino, "import.mjs");
    const original = await readFile(scriptPath, "utf8");
    const mutado = mutar(original);
    assert.notEqual(mutado, original, "a mutação não alterou nada — o texto-alvo pode ter mudado em import.mjs");
    await writeFile(scriptPath, mutado);

    return await fn({ base, scriptPath });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

/** Remove só o `process.exitCode = 1` do catch genérico do fim do arquivo — não o de `--check` com divergências. */
function removerExitCodeDoCatch(codigoFonte) {
  const alvo = "console.error(`[saeb] ${error.name}: ${error.message}`);\n    process.exitCode = 1;";
  if (!codigoFonte.includes(alvo)) {
    throw new Error("texto-alvo da mutação não encontrado — import.mjs mudou; atualize removerExitCodeDoCatch");
  }
  return codigoFonte.replace(
    alvo,
    "console.error(`[saeb] ${error.name}: ${error.message}`);\n    // MUTADO PELO TESTE DE REGRESSÃO: process.exitCode = 1 removido de propósito",
  );
}

test("prova de regressão: sem `process.exitCode = 1` no catch, o mesmo cenário sairia com 0 — os testes acima pegariam isso", async () => {
  await comCopiaMutadaDoCli(removerExitCodeDoCatch, async ({ base, scriptPath }) => {
    const { status, stderr } = rodarCliReal({ cwd: base, scriptPath, argv: ["--verify-source", "--download"] });
    // A mensagem de erro continua saindo — só o exit code que some. Confirma que
    // a mutação atingiu exatamente o alvo (o exitCode), não a lógica de erro.
    assert.match(stderr, /mutuamente exclusivos/, "a mutação não deveria mudar a mensagem de erro, só o exit code");
    assert.equal(status, 0, "com a linha removida, o processo deveria sair com 0 mesmo tendo logado o erro");
  });
});
