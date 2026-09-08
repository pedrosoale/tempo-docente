// Testes do protótipo de materialização da consulta do SAEB (Etapa 3, proposta).
//
// Tudo roda sobre fixtures sintéticas em memória, sem rede e sem ler os 211 MB
// de pacotes oficiais — a validação contra os pacotes reais é um procedimento
// manual, separado desta suíte e da CI (mesma política já adotada para o
// importador em tests/saeb-import.test.mjs).
import assert from "node:assert/strict";
import test from "node:test";
import { createHash } from "node:crypto";
import { mkdtemp, mkdir, readFile, readdir, rm, stat, symlink, writeFile } from "node:fs/promises";
import os, { tmpdir } from "node:os";
import path from "node:path";

import {
  agruparPorTamanho,
  compararComReferencia,
  construirPrototipo,
  encontrarMunicipio,
  materializar,
  materializarMunicipio,
  medir,
  PrototypeError,
  validarDestinoTemporario,
} from "../scripts/saeb-query-prototype/materialize.mjs";
import { EDICOES, INDICADORES } from "../scripts/saeb/lib/sources.mjs";
import { buildXlsx, buildZip, colunasTecnicas, linhaDeEscola, md5Txt } from "./helpers/saeb-fixtures.mjs";

const REPO_ROOT_REAL = path.resolve(import.meta.dirname, "..");

const md5 = (buffer) => createHash("md5").update(buffer).digest("hex");
const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");

// ---- Fabricação de escolas sintéticas ---------------------------------------

/**
 * Texto determinístico e (por variar com `seed`) não trivialmente compressível
 * entre escolas diferentes — se todas as escolas recebessem o mesmo texto de
 * enchimento, o gzip comprimiria a repetição quase inteira e os testes de
 * limite de tamanho não conseguiriam forçar divisão nenhuma.
 */
function payloadDeterministico(bytesAprox, seed = "") {
  let texto = "";
  let contador = 0;
  while (texto.length < bytesAprox) {
    texto += createHash("sha256").update(`${seed}-payload-${contador}`).digest("hex");
    contador += 1;
  }
  return texto.slice(0, Math.max(0, bytesAprox));
}

/** Escola no formato que montarArtefatos() produz: codigoInep/nome/rede + etapas aninhadas. */
function escola({ codigoInep, nome, rede = "Estadual", bytesPayload = 20 }) {
  return {
    codigoInep,
    nome,
    rede,
    etapas: {
      anosIniciais: {
        2025: { lp: 200.5, mt: 210.3, n: 5.5, p: 0.9, ideb: 5.0, obs: payloadDeterministico(bytesPayload, codigoInep) },
      },
    },
  };
}

/** Escola cujo indicador `lp` é um estado de ausência nomeado, não um número — para testar alteração de ausência. */
function escolaComAusencia({ codigoInep, nome, rede = "Estadual", estado = "participacao_insuficiente" }) {
  return {
    codigoInep,
    nome,
    rede,
    etapas: { anosIniciais: { 2025: { lp: { estado }, mt: 210.3, n: 5.5, p: 0.9, ideb: 5.0 } } },
  };
}

/** Município no formato que montarArtefatos() devolve em `particoes`. */
function particaoMunicipio({ codigoIbge = "3550308", nome = "Cidade Teste", uf = "SP", escolas }) {
  return {
    codigoIbge,
    conteudo: { schema: "saeb-escolas-municipio/1", municipio: { codigoIbge, nome, uf }, escolas },
    totalEscolas: escolas.length,
  };
}

const montarConteudoTeste = (municipio) => (lista) => ({ escolas: lista, municipio });

// ---- 1. agruparPorTamanho (unidade) -----------------------------------------

test("agruparPorTamanho: tudo cabe num grupo só quando o total fica abaixo do limite", () => {
  const escolas = [
    escola({ codigoInep: "10000001", nome: "A" }),
    escola({ codigoInep: "10000002", nome: "B" }),
    escola({ codigoInep: "10000003", nome: "C" }),
  ];
  const { grupos, excecoes } = agruparPorTamanho(escolas, 1024 * 1024, montarConteudoTeste({ codigoIbge: "1" }));
  assert.equal(grupos.length, 1);
  assert.equal(grupos[0].length, 3);
  assert.deepEqual(excecoes, []);
});

test("agruparPorTamanho: divide em múltiplos grupos quando o total ultrapassa o limite, sem perder nem duplicar escola", () => {
  const escolas = Array.from({ length: 12 }, (_, i) =>
    escola({ codigoInep: String(20000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 400 }),
  );
  // Cada escola serializada sozinha tem uns poucos centenas de bytes; um limite
  // pequeno o bastante força vários grupos, mas nenhum tão pequeno que uma
  // escola sozinha estoure (isso é testado à parte).
  const { grupos, excecoes } = agruparPorTamanho(escolas, 900, montarConteudoTeste({ codigoIbge: "1" }));
  assert.ok(grupos.length > 1, "deveria ter dividido em mais de um grupo");
  assert.deepEqual(excecoes, []);

  const codigosNosGrupos = grupos.flat().map((e) => e.codigoInep);
  assert.deepEqual(codigosNosGrupos, escolas.map((e) => e.codigoInep), "ordem e conjunto devem ser preservados exatamente");
  assert.equal(new Set(codigosNosGrupos).size, escolas.length, "nenhuma escola duplicada entre grupos");
});

test("agruparPorTamanho: uma escola isolada que sozinha excede o limite vira exceção, nunca é cortada nem descartada", () => {
  const gigante = escola({ codigoInep: "30000001", nome: "Escola Grande", bytesPayload: 5000 });
  const pequena = escola({ codigoInep: "30000002", nome: "Escola Pequena", bytesPayload: 10 });
  const limite = 500; // bem menor que o payload da gigante sozinha

  const { grupos, excecoes } = agruparPorTamanho([gigante, pequena], limite, montarConteudoTeste({ codigoIbge: "1" }));

  const grupoDaGigante = grupos.find((g) => g.some((e) => e.codigoInep === "30000001"));
  assert.equal(grupoDaGigante.length, 1, "a escola gigante deve ficar sozinha no próprio grupo");
  assert.deepEqual(grupoDaGigante[0], gigante, "os dados da escola não podem ser alterados nem cortados");

  assert.equal(excecoes.length, 1);
  assert.equal(excecoes[0].codigoInep, "30000001");
  assert.ok(excecoes[0].bytesGzip > limite);

  // A escola pequena não deveria ter virado exceção.
  assert.ok(!excecoes.some((e) => e.codigoInep === "30000002"));
});

test("agruparPorTamanho: determinístico — mesma entrada e mesmo limite produzem os mesmos grupos", () => {
  const escolas = Array.from({ length: 20 }, (_, i) =>
    escola({ codigoInep: String(40000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 300 }),
  );
  const montar = montarConteudoTeste({ codigoIbge: "1" });
  const a = agruparPorTamanho(escolas, 700, montar);
  const b = agruparPorTamanho(escolas, 700, montar);
  assert.deepEqual(
    a.grupos.map((g) => g.map((e) => e.codigoInep)),
    b.grupos.map((g) => g.map((e) => e.codigoInep)),
  );
  assert.deepEqual(a.excecoes, b.excecoes);
});

test("agruparPorTamanho: limites diferentes produzem quantidades de grupos diferentes (parâmetros de experimento, não oficiais)", () => {
  const escolas = Array.from({ length: 20 }, (_, i) =>
    escola({ codigoInep: String(50000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 300 }),
  );
  const montar = montarConteudoTeste({ codigoIbge: "1" });
  const apertado = agruparPorTamanho(escolas, 600, montar);
  const folgado = agruparPorTamanho(escolas, 6000, montar);
  assert.ok(apertado.grupos.length > folgado.grupos.length, "limite menor deve produzir mais grupos");
  assert.equal(folgado.grupos.length, 1, "limite generoso o bastante deve caber tudo num grupo só");
});

test("agruparPorTamanho: rejeita limite não positivo com mensagem clara", () => {
  assert.throws(
    () => agruparPorTamanho([escola({ codigoInep: "1", nome: "x" })], 0, montarConteudoTeste({ codigoIbge: "1" })),
    (error) => error instanceof PrototypeError && /positivo/.test(error.message),
  );
});

// ---- 2. materializarMunicipio: integridade do agrupamento --------------------

test("materializarMunicipio: o tamanho gzip REAL do arquivo (com envelope schema+município) nunca passa do limite, exceto exceções registradas", () => {
  // Regressão: a varredura antes media só o array de escolas, sem o envelope
  // (schema + município) que também vai para o arquivo final — um município
  // real (SP, limite 100 KiB) chegou a gerar uma partição de 102.525 B contra
  // um limite de 102.400 B por causa desse overhead não contabilizado.
  const escolas = Array.from({ length: 30 }, (_, i) =>
    escola({ codigoInep: String(65000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 400 }),
  );
  const limite = 2000;
  const resultado = materializarMunicipio(
    particaoMunicipio({ codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas }),
    limite,
  );
  for (const particao of resultado.particoes) {
    if (particao.totalEscolas === 1 && resultado.excecoes.some((e) => e.codigoInep === particao.escolas[0].codigoInep)) {
      continue; // exceção documentada — não é falha
    }
    assert.ok(
      particao.bytesGzip <= limite,
      `partição ${particao.arquivo} tem ${particao.bytesGzip} B gzip reais, acima do limite de ${limite} B`,
    );
  }
});

test("materializarMunicipio: cada escola pertence a exatamente uma partição, sem perda, duplicação ou alteração", () => {
  const escolas = Array.from({ length: 15 }, (_, i) =>
    escola({ codigoInep: String(60000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 500 }),
  );
  const particao = particaoMunicipio({ escolas });
  const resultado = materializarMunicipio(particao, 900);

  const todasAsEscolasNasParticoes = resultado.particoes.flatMap((p) => p.escolas);
  assert.equal(todasAsEscolasNasParticoes.length, escolas.length);

  const porCodigo = new Map(escolas.map((e) => [e.codigoInep, e]));
  for (const encontrada of todasAsEscolasNasParticoes) {
    const original = porCodigo.get(encontrada.codigoInep);
    assert.ok(original, `escola ${encontrada.codigoInep} não deveria existir`);
    assert.deepEqual(encontrada, original, "etapas, edições, indicadores e estados de ausência não podem mudar");
    porCodigo.delete(encontrada.codigoInep);
  }
  assert.equal(porCodigo.size, 0, "nenhuma escola do original pode ficar de fora");
});

test("materializarMunicipio: índice de escolas não inclui histórico de indicadores", () => {
  const escolas = [escola({ codigoInep: "70000001", nome: "Escola X" }), escola({ codigoInep: "70000002", nome: "Escola Y" })];
  const resultado = materializarMunicipio(particaoMunicipio({ escolas }), 1024 * 1024);
  const indice = JSON.parse(resultado.escolasIndiceTexto);
  for (const entrada of indice.escolas) {
    assert.deepEqual(Object.keys(entrada).sort(), ["codigoInep", "nome", "particao", "rede"]);
  }
});

test("materializarMunicipio: cada apontamento do índice resolve para a partição e a escola corretas", () => {
  const escolas = Array.from({ length: 10 }, (_, i) =>
    escola({ codigoInep: String(80000000 + i).padStart(8, "0"), nome: `Escola ${i}`, bytesPayload: 500 }),
  );
  const resultado = materializarMunicipio(particaoMunicipio({ escolas }), 900);
  const indice = JSON.parse(resultado.escolasIndiceTexto);
  const particoesPorArquivo = new Map(resultado.particoes.map((p) => [p.arquivo, JSON.parse(p.texto)]));

  for (const entrada of indice.escolas) {
    const conteudoParticao = particoesPorArquivo.get(entrada.particao);
    assert.ok(conteudoParticao, `índice aponta para arquivo inexistente: ${entrada.particao}`);
    const encontrada = conteudoParticao.escolas.find((e) => e.codigoInep === entrada.codigoInep);
    assert.ok(encontrada, `escola ${entrada.codigoInep} não está na partição ${entrada.particao} que o índice indica`);
    assert.equal(encontrada.nome, entrada.nome);
    assert.equal(encontrada.rede, entrada.rede);
  }
});

test("materializarMunicipio: escolas homônimas continuam distinguíveis pelo código INEP", () => {
  const gemea1 = escola({ codigoInep: "90000001", nome: "EMEF SANTOS DUMONT" });
  const gemea2 = escola({ codigoInep: "90000002", nome: "EMEF SANTOS DUMONT" });
  const resultado = materializarMunicipio(particaoMunicipio({ escolas: [gemea1, gemea2] }), 1024 * 1024);
  const indice = JSON.parse(resultado.escolasIndiceTexto);

  assert.equal(indice.escolas.length, 2, "as duas escolas homônimas devem aparecer separadamente");
  const codigos = indice.escolas.map((e) => e.codigoInep).sort();
  assert.deepEqual(codigos, ["90000001", "90000002"]);
  // Mesmo nome, códigos diferentes — a distinção tem que sobreviver no índice.
  assert.ok(indice.escolas.every((e) => e.nome === "EMEF SANTOS DUMONT"));
});

test("materializarMunicipio: propaga a exceção de tamanho com o código IBGE do município", () => {
  const gigante = escola({ codigoInep: "11000001", nome: "Escola Enorme", bytesPayload: 5000 });
  const resultado = materializarMunicipio(particaoMunicipio({ codigoIbge: "3550308", escolas: [gigante] }), 500);
  assert.equal(resultado.excecoes.length, 1);
  assert.equal(resultado.excecoes[0].codigoInep, "11000001");
  assert.equal(resultado.codigoIbge, "3550308");
});

// ---- 3. Ponta a ponta, reaproveitando o pipeline real do importador --------
//
// Reaproveita verificarPacote/openWorkbook/extrairEscolas/montarArtefatos —
// exatamente as funções do importador já commitado — via construirPrototipo().
// Não reimplementa nem lê planilha por conta própria.

const METAS_FIXTURE = ["2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021"];
const temMeta = (edicao) => METAS_FIXTURE.includes(edicao);
const COLUNAS = colunasTecnicas(EDICOES, INDICADORES, temMeta);

function planilhaComEscolas(linhas) {
  const rows = { 1: ["Ministério da Educação"], 9: ["1º ao 5º ano"], [10]: COLUNAS };
  linhas.forEach((valores, indice) => {
    rows[11 + indice] = valores;
  });
  rows[11 + linhas.length + 1] = ["Fonte: MEC/Inep"];
  return buildXlsx(rows, { sheetName: "IDEB_Escolas (Anos_Iniciais)" });
}

function montarPacoteFixture(linhasEscolas) {
  const xlsx = planilhaComEscolas(linhasEscolas);
  const innerDir = "divulgacao_prototipo_escolas_2025";
  const xlsxName = "divulgacao_prototipo_escolas_2025.xlsx";
  const md5Name = "md5_divulgacao_prototipo_escolas_2025.txt";
  const hash = md5(xlsx);
  const zip = buildZip([
    { name: `${innerDir}/${xlsxName}`, data: xlsx },
    { name: `${innerDir}/${md5Name}`, data: md5Txt(hash, xlsxName) },
  ]);
  const pacote = {
    id: "prototipo-fixture-2025",
    etapa: "anosIniciais",
    etapaLabel: "Fixture",
    url: "https://download.inep.gov.br/ideb/resultados/prototipo-fixture.zip",
    zipName: "prototipo-fixture.zip",
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
  return { zip, pacote };
}

const linha = (identificacao, edicoes = { 2025: { lp: "200.0" } }) =>
  linhaDeEscola(identificacao, edicoes, EDICOES, INDICADORES, temMeta);

test("construirPrototipo: pipeline real (verificarPacote → extrairEscolas → montarArtefatos) produz escolas íntegras", async () => {
  const escolasFixture = [
    { uf: "SP", codigoIbge: "3550308", municipio: "São Paulo", codigoInep: "35000001", nome: "EE UM", rede: "Estadual" },
    { uf: "SP", codigoIbge: "3550308", municipio: "São Paulo", codigoInep: "35000002", nome: "EE DOIS", rede: "Estadual" },
    { uf: "RO", codigoIbge: "1100015", municipio: "Alta Floresta D'Oeste", codigoInep: "11000001", nome: "EE TRES", rede: "Municipal" },
  ];
  const linhas = escolasFixture.map((id) => linha(id, { 2025: { lp: "220.5", mt: "230.1", n: "6.0", p: "0.95", ideb: "5.7" } }));
  const { zip, pacote } = montarPacoteFixture(linhas);

  const base = await mkdtemp(path.join(tmpdir(), "saeb-prototipo-cache-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, pacote.zipName), zip);

  try {
    const prototipo = await construirPrototipo({ registro: [pacote], cacheDir: cache, limiteBytesGzip: 1024 * 1024 });
    assert.equal(prototipo.municipios.length, 2, "duas escolas em São Paulo + uma em Alta Floresta D'Oeste = 2 municípios");

    const sp = encontrarMunicipio(prototipo, "3550308");
    assert.ok(sp);
    const codigosSp = sp.particoes.flatMap((p) => p.escolas.map((e) => e.codigoInep)).sort();
    assert.deepEqual(codigosSp, ["35000001", "35000002"]);

    const ro = encontrarMunicipio(prototipo, "1100015");
    assert.equal(ro.totalEscolas, 1);
    const escolaRo = ro.particoes[0].escolas[0];
    assert.equal(escolaRo.etapas.anosIniciais["2025"].lp, 220.5, "valor normalizado pelo importador real deve chegar intacto");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("construirPrototipo: sem --download e sem tocar o cache oficial do projeto — só lê o --cache informado", async () => {
  const escolasFixture = [{ uf: "SP", codigoIbge: "3550308", municipio: "São Paulo", codigoInep: "35000001", nome: "EE UM", rede: "Estadual" }];
  const { zip, pacote } = montarPacoteFixture([linha(escolasFixture[0])]);
  const base = await mkdtemp(path.join(tmpdir(), "saeb-prototipo-cache-"));
  const cache = path.join(base, "cache");
  await mkdir(cache, { recursive: true });
  await writeFile(path.join(cache, pacote.zipName), zip);
  try {
    const antes = await readdir(cache);
    await construirPrototipo({ registro: [pacote], cacheDir: cache, limiteBytesGzip: 1024 * 1024 });
    const depois = await readdir(cache);
    assert.deepEqual(depois, antes, "o cache não deve ganhar nem perder arquivos");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ---- 4. materializar (disco): determinismo e segurança de destino -----------

async function construirPrototipoSintetico(limiteBytesGzip = 900) {
  const escolasA = Array.from({ length: 8 }, (_, i) =>
    escola({ codigoInep: String(21000000 + i).padStart(8, "0"), nome: `Escola A${i}`, bytesPayload: 400 }),
  );
  const escolasB = [escola({ codigoInep: "22000001", nome: "Escola B0" })];
  const particoes = [
    particaoMunicipio({ codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: escolasA }),
    particaoMunicipio({ codigoIbge: "1100015", nome: "Alta Floresta D'Oeste", uf: "RO", escolas: escolasB }),
  ];
  const municipios = particoes.map((p) => materializarMunicipio(p, limiteBytesGzip));
  const indiceNacional = {
    schema: "saeb-municipios-indice/1-prototipo",
    limiteBytesGzip,
    municipios: municipios.map((m) => ({ codigoIbge: m.codigoIbge, nome: m.municipio.nome, uf: m.municipio.uf, escolas: m.totalEscolas, particoes: m.particoes.length })),
  };
  return { municipios, indiceNacionalTexto: `${JSON.stringify(indiceNacional)}\n`, limiteBytesGzip };
}

test("materializar: duas execuções com a mesma entrada produzem os mesmos caminhos e os mesmos bytes", async () => {
  const prototipo = await construirPrototipoSintetico();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-prototipo-out-"));
  const outDir = path.join(base, "saida");
  try {
    const r1 = await materializar({ outDir, prototipo });
    assert.ok(r1.escritos > 0);

    const conteudoPrimeiraRodada = new Map();
    for (const caminho of r1.caminhos) conteudoPrimeiraRodada.set(caminho, await readFile(caminho, "utf8"));
    const mtimesPrimeiraRodada = new Map();
    for (const caminho of r1.caminhos) mtimesPrimeiraRodada.set(caminho, (await stat(caminho)).mtimeMs);

    const r2 = await materializar({ outDir, prototipo });
    assert.equal(r2.escritos, 0, "segunda execução sobre a mesma entrada não deve escrever nada");
    assert.deepEqual(r2.caminhos, r1.caminhos, "mesmos caminhos");

    for (const caminho of r2.caminhos) {
      assert.equal(await readFile(caminho, "utf8"), conteudoPrimeiraRodada.get(caminho), `conteúdo mudou em ${caminho}`);
      assert.equal((await stat(caminho)).mtimeMs, mtimesPrimeiraRodada.get(caminho), `mtime mudou em ${caminho}`);
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("materializar: destino com arquivo estranho falha com segurança, sem apagar nem sobrescrever nada", async () => {
  const prototipo = await construirPrototipoSintetico();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-prototipo-out-"));
  const outDir = path.join(base, "saida");
  await mkdir(outDir, { recursive: true });
  const estranho = path.join(outDir, "nao-deveria-estar-aqui.txt");
  await writeFile(estranho, "trabalho de outra pessoa\n");
  try {
    await assert.rejects(
      () => materializar({ outDir, prototipo }),
      (error) => error instanceof PrototypeError && /não gerou/.test(error.message),
    );
    assert.equal(await readFile(estranho, "utf8"), "trabalho de outra pessoa\n", "arquivo alheio não pode ser tocado");
    const entradasDepois = await readdir(outDir);
    assert.deepEqual(entradasDepois, ["nao-deveria-estar-aqui.txt"], "nada deveria ter sido escrito além do que já existia");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("materializar: índice nacional e índices municipais escritos em disco resolvem para os arquivos certos", async () => {
  const prototipo = await construirPrototipoSintetico();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-prototipo-out-"));
  const outDir = path.join(base, "saida");
  try {
    await materializar({ outDir, prototipo });

    const indiceNacional = JSON.parse(await readFile(path.join(outDir, "municipios-index.json"), "utf8"));
    for (const municipioEntrada of indiceNacional.municipios) {
      const dirMunicipio = path.join(outDir, "municipios", municipioEntrada.codigoIbge);

      if (municipioEntrada.particoes === 1) {
        // Município de partição única: sem escolas-index.json — o cliente vai
        // direto para particoes/001.json, cujo nome é previsível.
        assert.equal(await stat(path.join(dirMunicipio, "escolas-index.json")).catch(() => null), null);
        const conteudoUnico = JSON.parse(await readFile(path.join(dirMunicipio, "particoes", "001.json"), "utf8"));
        assert.equal(conteudoUnico.escolas.length, municipioEntrada.escolas);
        continue;
      }

      const escolasIndex = JSON.parse(await readFile(path.join(dirMunicipio, "escolas-index.json"), "utf8"));
      assert.equal(escolasIndex.escolas.length, municipioEntrada.escolas, `contagem do índice nacional diverge de ${municipioEntrada.codigoIbge}`);

      for (const entradaEscola of escolasIndex.escolas) {
        const particaoPath = path.join(dirMunicipio, "particoes", entradaEscola.particao);
        const conteudoParticao = JSON.parse(await readFile(particaoPath, "utf8"));
        assert.ok(
          conteudoParticao.escolas.some((e) => e.codigoInep === entradaEscola.codigoInep),
          `escola ${entradaEscola.codigoInep} não encontrada em ${particaoPath}`,
        );
      }
    }
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

// ---- 5. medir() --------------------------------------------------------------

test("medir: contabiliza arquivos, subdivisão e exceções coerentemente com o protótipo construído", async () => {
  const prototipo = await construirPrototipoSintetico(900);
  const estatisticas = medir(prototipo);
  const totalParticoesReal = prototipo.municipios.reduce((soma, m) => soma + m.particoes.length, 0);
  const subdivididosReal = prototipo.municipios.filter((m) => m.particoes.length > 1).length;
  assert.equal(estatisticas.totalParticoes, totalParticoesReal);
  // 1 índice nacional + 1 índice de escolas só nos municípios subdivididos (municípios de
  // partição única não geram escolas-index.json — ver materializar()) + todas as partições.
  assert.equal(estatisticas.totalArquivos, 1 + subdivididosReal + totalParticoesReal);
  assert.equal(estatisticas.municipiosSubdivididos, subdivididosReal);
  assert.ok(estatisticas.municipiosSubdivididos >= 1, "a fixture foi desenhada para forçar subdivisão em São Paulo");
});

// ---- 6. validarDestinoTemporario: política de destino ------------------------
//
// Um "repositório" falso e isolado, para testar a colisão com repo/public/
// data/cache/manifesto sem depender do caminho real deste projeto na máquina
// que roda o teste. Um teste à parte confirma que o padrão (sem override)
// protege o repositório de verdade.
async function comRepositorioFalso(fn) {
  const raizRepositorio = await mkdtemp(path.join(tmpdir(), "saeb-repo-falso-"));
  try {
    return await fn(raizRepositorio);
  } finally {
    await rm(raizRepositorio, { recursive: true, force: true });
  }
}

test("validarDestinoTemporario: aceita um subdiretório dedicado dentro da raiz temporária", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-dest-"));
  try {
    const validado = await validarDestinoTemporario(path.join(base, "saida"));
    assert.equal(validado, path.resolve(path.join(base, "saida")));
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("validarDestinoTemporario: aceita ancestrais que ainda não existem, dentro da raiz temporária", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-dest-"));
  try {
    const destinoProfundo = path.join(base, "a", "b", "c", "saida");
    const validado = await validarDestinoTemporario(destinoProfundo);
    assert.equal(validado, path.resolve(destinoProfundo));
    assert.equal(await stat(destinoProfundo).catch(() => null), null, "validar não deve criar nada");
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("validarDestinoTemporario: recusa a própria raiz temporária", async () => {
  await assert.rejects(
    () => validarDestinoTemporario(os.tmpdir()),
    (error) => error instanceof PrototypeError && /raiz temporária/.test(error.message),
  );
});

test("validarDestinoTemporario: recusa raiz de disco", async () => {
  const raizDisco = path.parse(path.resolve(os.tmpdir())).root;
  await assert.rejects(
    () => validarDestinoTemporario(raizDisco),
    (error) => error instanceof PrototypeError && /raiz de disco/.test(error.message),
  );
});

test("validarDestinoTemporario: recusa o diretório home, mesmo em subpasta", async () => {
  await assert.rejects(() => validarDestinoTemporario(os.homedir()), (error) => error instanceof PrototypeError);
  await assert.rejects(
    () => validarDestinoTemporario(path.join(os.homedir(), "Documents", "saeb-teste")),
    (error) => error instanceof PrototypeError && /home/.test(error.message),
  );
});

test("validarDestinoTemporario: recusa escape por .. que sai da raiz temporária", async () => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-dest-"));
  try {
    const comEscape = path.join(base, "..", "..", "..", "fora-da-raiz-temp");
    // Só é um teste válido se o escape de fato sair da raiz temporária —
    // confirma a premissa antes de testar a rejeição.
    assert.ok(!path.resolve(comEscape).startsWith(path.resolve(os.tmpdir())), "a fixture não escapou de verdade da raiz temp");
    await assert.rejects(() => validarDestinoTemporario(comEscape), (error) => error instanceof PrototypeError);
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("validarDestinoTemporario: recusa o repositório, public/, data/, cache oficial e manifesto (via raizRepositorio de teste)", async () => {
  await comRepositorioFalso(async (raizRepositorio) => {
    const alvos = [
      raizRepositorio,
      path.join(raizRepositorio, "public"),
      path.join(raizRepositorio, "public", "data", "saeb"),
      path.join(raizRepositorio, "data"),
      path.join(raizRepositorio, "data", "saeb", "source"),
      path.join(raizRepositorio, "data", "saeb", "source", "algum-pacote.zip"),
      path.join(raizRepositorio, "data", "saeb", "manifest.json"),
    ];
    for (const alvo of alvos) {
      await assert.rejects(
        () => validarDestinoTemporario(alvo, { raizRepositorio }),
        (error) => error instanceof PrototypeError,
        `deveria ter recusado: ${alvo}`,
      );
    }
  });
});

test("validarDestinoTemporario: por padrão (sem override), protege o repositório real deste projeto", async () => {
  await assert.rejects(() => validarDestinoTemporario(path.join(REPO_ROOT_REAL, "public")), (error) => error instanceof PrototypeError);
  await assert.rejects(() => validarDestinoTemporario(path.join(REPO_ROOT_REAL, "data", "saeb", "source")), (error) => error instanceof PrototypeError);
  await assert.rejects(() => validarDestinoTemporario(path.join(REPO_ROOT_REAL, "data", "saeb", "manifest.json")), (error) => error instanceof PrototypeError);
  await assert.rejects(() => validarDestinoTemporario(REPO_ROOT_REAL), (error) => error instanceof PrototypeError);
});

test("validarDestinoTemporario: recusa link simbólico existente no caminho de destino", async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-dest-"));
  const alvoReal = path.join(base, "alvo-real");
  const linkPath = path.join(base, "link-simbolico");
  await mkdir(alvoReal, { recursive: true });
  try {
    await symlink(alvoReal, linkPath, "dir");
  } catch (error) {
    await rm(base, { recursive: true, force: true });
    t.skip(`ambiente não permite criar link simbólico (${error.code}) — limitação do sistema, não do protótipo; criar symlink de diretório no Windows normalmente exige Modo de Desenvolvedor ou privilégio elevado`);
    return;
  }
  try {
    await assert.rejects(
      () => validarDestinoTemporario(path.join(linkPath, "saida")),
      (error) => error instanceof PrototypeError && /link simbólico/.test(error.message),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("validarDestinoTemporario: recusa junction existente no caminho de destino", async (t) => {
  const base = await mkdtemp(path.join(tmpdir(), "saeb-dest-"));
  const alvoReal = path.join(base, "alvo-real");
  const junctionPath = path.join(base, "junction");
  await mkdir(alvoReal, { recursive: true });
  try {
    await symlink(alvoReal, junctionPath, "junction");
  } catch (error) {
    await rm(base, { recursive: true, force: true });
    t.skip(`ambiente não permite criar junction (${error.code}) — limitação do sistema, não do protótipo`);
    return;
  }
  try {
    await assert.rejects(
      () => validarDestinoTemporario(path.join(junctionPath, "saida")),
      (error) => error instanceof PrototypeError && /link simbólico/.test(error.message),
    );
  } finally {
    await rm(base, { recursive: true, force: true });
  }
});

test("materializar: nunca escreve quando o destino é inválido, e a checagem roda antes de qualquer processamento", async () => {
  const prototipo = await construirPrototipoSintetico();
  await assert.rejects(
    () => materializar({ outDir: os.homedir(), prototipo }),
    (error) => error instanceof PrototypeError,
  );
  // Também recusa via o repositório real, sem precisar de override — a
  // proteção vale para a função, não só para quem passa raizRepositorio.
  await assert.rejects(
    () => materializar({ outDir: path.join(REPO_ROOT_REAL, "public", "data", "saeb-teste-nao-deveria-existir"), prototipo }),
    (error) => error instanceof PrototypeError,
  );
  assert.equal(
    await stat(path.join(REPO_ROOT_REAL, "public", "data", "saeb-teste-nao-deveria-existir")).catch(() => null),
    null,
    "nada deveria ter sido criado dentro do repositório real",
  );
});

// ---- 7. compararComReferencia: comparação semântica real --------------------
//
// Determinismo (duas execuções batem entre si) e preservação semântica (o que
// foi materializado é fiel à referência normalizada pelo importador) são
// propriedades diferentes — estes testes cobrem só a segunda, mutilando
// deliberadamente a saída já materializada e confirmando que cada mutilação é
// detectada.

async function montarCenarioParaComparacao(limiteBytesGzip = 900) {
  const escolasSp = Array.from({ length: 8 }, (_, i) =>
    escola({ codigoInep: String(31000000 + i).padStart(8, "0"), nome: `Escola SP ${i}`, bytesPayload: 400 }),
  );
  const escolaAusencia = escolaComAusencia({ codigoInep: "31000099", nome: "Escola SP Ausência" });
  const escolasRo = [escola({ codigoInep: "32000001", nome: "Escola RO única" })];
  const referencia = [
    particaoMunicipio({ codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: [...escolasSp, escolaAusencia] }),
    particaoMunicipio({ codigoIbge: "1100015", nome: "Alta Floresta D'Oeste", uf: "RO", escolas: escolasRo }),
  ];
  const municipios = referencia.map((p) => materializarMunicipio(p, limiteBytesGzip));
  const indiceNacional = {
    schema: "saeb-municipios-indice/1-prototipo",
    limiteBytesGzip,
    municipios: municipios.map((m) => ({
      codigoIbge: m.codigoIbge,
      nome: m.municipio.nome,
      uf: m.municipio.uf,
      escolas: m.totalEscolas,
      particoes: m.particoes.length,
    })),
  };
  assert.ok(municipios[0].particoes.length > 1, "a fixture precisa forçar subdivisão em São Paulo, para testar o índice municipal também");
  return { municipios, indiceNacionalTexto: `${JSON.stringify(indiceNacional)}\n`, limiteBytesGzip, referencia };
}

async function comCenarioMaterializado(fn) {
  const prototipo = await montarCenarioParaComparacao();
  const base = await mkdtemp(path.join(tmpdir(), "saeb-comparacao-"));
  const outDir = path.join(base, "saida");
  try {
    await materializar({ outDir, prototipo });
    return await fn({ prototipo, outDir });
  } finally {
    await rm(base, { recursive: true, force: true });
  }
}

test("compararComReferencia: cenário íntegro não acusa nenhuma discrepância", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, true, JSON.stringify(resultado.discrepancias));
    assert.equal(resultado.municipiosVerificados, 2);
  });
});

test("compararComReferencia: detecta escola removida de uma partição", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "3550308", "particoes");
    const arquivos = await readdir(dirParticoes);
    const alvo = path.join(dirParticoes, arquivos[0]);
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    const removida = conteudo.escolas.shift();
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_perdida" && d.codigoInep === removida.codigoInep));
  });
});

test("compararComReferencia: detecta escola duplicada dentro da mesma partição", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "3550308", "particoes");
    const arquivos = await readdir(dirParticoes);
    const alvo = path.join(dirParticoes, arquivos[0]);
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    const duplicada = conteudo.escolas[0];
    conteudo.escolas.push({ ...duplicada });
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_duplicada" && d.codigoInep === duplicada.codigoInep));
  });
});

test("compararComReferencia: detecta indicador alterado", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "3550308", "particoes");
    const arquivos = await readdir(dirParticoes);
    const alvo = path.join(dirParticoes, arquivos[0]);
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    const alterada = conteudo.escolas[0];
    alterada.etapas.anosIniciais["2025"].lp = 999.9;
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_alterada" && d.codigoInep === alterada.codigoInep));
  });
});

test("compararComReferencia: detecta estado de ausência alterado", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "3550308", "particoes");
    let alvo = null;
    let conteudo = null;
    for (const arquivo of await readdir(dirParticoes)) {
      const candidato = JSON.parse(await readFile(path.join(dirParticoes, arquivo), "utf8"));
      if (candidato.escolas.some((e) => e.codigoInep === "31000099")) {
        alvo = path.join(dirParticoes, arquivo);
        conteudo = candidato;
        break;
      }
    }
    assert.ok(alvo, "a escola com ausência deveria estar em alguma partição");
    const alterada = conteudo.escolas.find((e) => e.codigoInep === "31000099");
    alterada.etapas.anosIniciais["2025"].lp.estado = "nao_divulgado_por_norma";
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_alterada" && d.codigoInep === "31000099"));
  });
});

test("compararComReferencia: detecta remoção de etapa/edição inteira", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "3550308", "particoes");
    const arquivos = await readdir(dirParticoes);
    const alvo = path.join(dirParticoes, arquivos[0]);
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    const alterada = conteudo.escolas[0];
    delete alterada.etapas.anosIniciais["2025"];
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_alterada" && d.codigoInep === alterada.codigoInep));
  });
});

test("compararComReferencia: detecta apontamento incorreto no índice municipal", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirMunicipio = path.join(outDir, "municipios", "3550308");
    const caminhoIndice = path.join(dirMunicipio, "escolas-index.json");
    const indice = JSON.parse(await readFile(caminhoIndice, "utf8"));
    assert.ok(indice.escolas.length > 1, "precisa de pelo menos 2 escolas no índice para trocar o apontamento de uma");

    const [primeira, segunda] = indice.escolas;
    assert.notEqual(primeira.particao, undefined);
    // Aponta a primeira escola para a partição da segunda (só é um apontamento
    // incorreto de verdade se as partições forem diferentes).
    const outraParticao = indice.escolas.find((e) => e.particao !== primeira.particao)?.particao ?? segunda.particao;
    primeira.particao = outraParticao;
    await writeFile(caminhoIndice, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(
      resultado.discrepancias.some((d) => d.tipo === "apontamento_incorreto" && d.codigoInep === primeira.codigoInep) ||
        resultado.discrepancias.some((d) => d.tipo === "escola_sem_apontamento_no_indice"),
      JSON.stringify(resultado.discrepancias),
    );
  });
});

test("compararComReferencia: funciona para município de partição única, sem índice próprio", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    // Alta Floresta D'Oeste (RO) tem 1 escola só — sem escolas-index.json.
    const dirMunicipio = path.join(outDir, "municipios", "1100015");
    assert.equal(await stat(path.join(dirMunicipio, "escolas-index.json")).catch(() => null), null);

    const alvo = path.join(dirMunicipio, "particoes", "001.json");
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    conteudo.escolas[0].nome = "NOME TROCADO SEM AUTORIZAÇÃO";
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "escola_alterada" && d.codigoInep === "32000001"));
  });
});

// ---- 8. compararComReferencia: regressão dos dois achados da revisão -------
//
// Os dois cenários abaixo ("declara 99 partições para quem tem 1" e "nome do
// município trocado no envelope da partição") são exatamente os que o Codex
// reproduziu contra a versão anterior do verificador — reprovava com ok:true.
// Cada teste confirma o TIPO específico de discrepância, não uma falha
// genérica: se o verificador regredir para uma checagem mais fraca (ou for
// "corrigido" de um jeito que só pega um sintoma vizinho), o teste certo vai
// falhar por assert.ok não achar aquele tipo — não por qualquer motivo.

test("compararComReferencia: [achado 1] detecta contagem de partições incorreta, incluindo declarar múltiplas quando só existe uma", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const entradaRo = indice.municipios.find((m) => m.codigoIbge === "1100015");
    assert.equal(entradaRo.particoes, 1, "pré-condição da fixture: RO precisa ter exatamente 1 partição real");
    entradaRo.particoes = 99; // exatamente o cenário que o Codex reproduziu
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false, "não pode aprovar um índice que declara 99 partições para quem tem 1");
    assert.ok(
      resultado.discrepancias.some(
        (d) => d.tipo === "indice_nacional_contagem_particoes_incorreta" && d.codigoIbge === "1100015" && d.declarado === 99 && d.esperado === 1,
      ),
    );
  });
});

test("compararComReferencia: [achado 2] detecta o nome do município adulterado no envelope de uma partição", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const alvo = path.join(outDir, "municipios", "1100015", "particoes", "001.json");
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    assert.equal(conteudo.municipio.nome, "Alta Floresta D'Oeste");
    conteudo.municipio.nome = "Nome Forjado"; // exatamente o cenário que o Codex reproduziu
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false, "não pode aprovar uma partição cujo envelope declara um município diferente do real");
    assert.ok(
      resultado.discrepancias.some(
        (d) => d.tipo === "particao_municipio_alterado" && d.codigoIbge === "1100015" && d.encontrado.nome === "Nome Forjado",
      ),
    );
  });
});

// ---- 9. compararComReferencia: cobertura adicional pedida na revisão -------

test("compararComReferencia: detecta contagem de escolas incorreta no índice nacional", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const entradaRo = indice.municipios.find((m) => m.codigoIbge === "1100015");
    entradaRo.escolas = 42;
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(
      resultado.discrepancias.some(
        (d) => d.tipo === "indice_nacional_contagem_escolas_incorreta" && d.codigoIbge === "1100015" && d.declarado === 42 && d.esperado === 1,
      ),
    );
  });
});

test("compararComReferencia: detecta município duplicado no índice nacional, antes de qualquer Map colapsar a duplicata", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const entradaRo = indice.municipios.find((m) => m.codigoIbge === "1100015");
    indice.municipios.push({ ...entradaRo });
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(
      resultado.discrepancias.some((d) => d.tipo === "indice_nacional_municipio_duplicado" && d.codigoIbge === "1100015" && d.ocorrencias === 2),
    );
  });
});

test("compararComReferencia: detecta escola duplicada no índice municipal, antes de qualquer Map colapsar a duplicata", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios", "3550308", "escolas-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const alvo = indice.escolas[0];
    indice.escolas.push({ ...alvo });
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(
      resultado.discrepancias.some((d) => d.tipo === "indice_municipal_escola_duplicada" && d.codigoInep === alvo.codigoInep && d.ocorrencias === 2),
    );
  });
});

test("compararComReferencia: detecta nome adulterado numa entrada do índice municipal (contra a referência, não só contra a partição)", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios", "3550308", "escolas-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const alvo = indice.escolas[0];
    alvo.nome = "NOME FORJADO NO ÍNDICE";
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_municipal_entrada_incorreta" && d.codigoInep === alvo.codigoInep));
  });
});

test("compararComReferencia: detecta rede adulterada numa entrada do índice municipal", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios", "3550308", "escolas-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const alvo = indice.escolas[0];
    alvo.rede = "Federal"; // rede que não existe na fixture — garante divergência real
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_municipal_entrada_incorreta" && d.codigoInep === alvo.codigoInep));
  });
});

test("compararComReferencia: detecta schema inválido no índice nacional", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    indice.schema = "schema-forjado/0";
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_nacional_schema_invalido"));
  });
});

test("compararComReferencia: detecta schema inválido numa partição", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const alvo = path.join(outDir, "municipios", "1100015", "particoes", "001.json");
    const conteudo = JSON.parse(await readFile(alvo, "utf8"));
    conteudo.schema = "schema-forjado/0";
    await writeFile(alvo, JSON.stringify(conteudo));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "particao_schema_invalido" && d.codigoIbge === "1100015"));
  });
});

test("compararComReferencia: detecta schema inválido no índice municipal", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios", "3550308", "escolas-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    indice.schema = "schema-forjado/0";
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_municipal_schema_invalido" && d.codigoIbge === "3550308"));
  });
});

test("compararComReferencia: detecta partições completamente ausentes para um município (arquivo obrigatório ausente)", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await rm(path.join(outDir, "municipios", "1100015", "particoes"), { recursive: true, force: true });

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "particoes_ausentes" && d.codigoIbge === "1100015"));
  });
});

test("compararComReferencia: detecta arquivo inesperado (fora do padrão NNN.json) na pasta de partições", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await writeFile(path.join(outDir, "municipios", "1100015", "particoes", "notas.txt"), "isto não deveria estar aqui\n");

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "particao_nome_invalido" && d.codigoIbge === "1100015" && d.arquivo === "notas.txt"));
  });
});

test("compararComReferencia: detecta índice municipal apontando para um arquivo de partição que não existe", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios", "3550308", "escolas-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    const alvo = indice.escolas[0];
    alvo.particao = "999.json";
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_aponta_para_arquivo_inexistente" && d.codigoInep === alvo.codigoInep));
  });
});

test("compararComReferencia: detecta município de partição única cujo arquivo não se chama 001.json", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const dirParticoes = path.join(outDir, "municipios", "1100015", "particoes");
    const conteudo = await readFile(path.join(dirParticoes, "001.json"), "utf8");
    await writeFile(path.join(dirParticoes, "002.json"), conteudo);
    await rm(path.join(dirParticoes, "001.json"));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(
      resultado.discrepancias.some((d) => d.tipo === "particao_unica_nome_incorreto" && d.codigoIbge === "1100015" && d.arquivo === "002.json"),
    );
  });
});

test("compararComReferencia: detecta índice municipal ausente quando o município está de fato subdividido", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await rm(path.join(outDir, "municipios", "3550308", "escolas-index.json"));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_municipal_ausente" && d.codigoIbge === "3550308"));
  });
});

test("compararComReferencia: detecta índice municipal indevido quando o município tem partição única de verdade", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await writeFile(
      path.join(outDir, "municipios", "1100015", "escolas-index.json"),
      JSON.stringify({ schema: "saeb-escolas-indice-municipio/1-prototipo", codigoIbge: "1100015", municipio: {}, escolas: [] }),
    );

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "indice_municipal_indevido" && d.codigoIbge === "1100015"));
  });
});

test("compararComReferencia: JSON ilegível numa partição vira discrepância explícita, nunca aprovação silenciosa", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await writeFile(path.join(outDir, "municipios", "1100015", "particoes", "001.json"), "{ isto não é json válido ");

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false);
    assert.ok(resultado.discrepancias.some((d) => d.tipo === "particao_ilegivel" && d.codigoIbge === "1100015"));
  });
});

test("compararComReferencia: índice nacional ausente produz erro explícito, nunca aprovação silenciosa", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    await rm(path.join(outDir, "municipios-index.json"));
    await assert.rejects(() => compararComReferencia({ referencia: prototipo.referencia, outDir }));
  });
});

// ---- 10. compararComReferencia: refutação da "limitação restante" do relatório ----
//
// O relatório (seção "Limitação restante") especulava que um índice nacional
// com schema válido e municipios: [] passaria com ok: true, por não haver
// nada para comparar. Isso é falso: com uma referência não vazia, todo
// codigoIbge da referência que não aparece no índice já vira "municipio_ausente"
// — o laço de detecção roda sobre a REFERÊNCIA, não sobre o índice. Este teste
// confirma o comportamento real, para que o relatório possa ser corrigido com
// uma afirmação verificada, não uma suposição.

test("compararComReferencia: índice nacional com municipios: [] não aprova quando a referência tem municípios reais", async () => {
  await comCenarioMaterializado(async ({ prototipo, outDir }) => {
    const caminho = path.join(outDir, "municipios-index.json");
    const indice = JSON.parse(await readFile(caminho, "utf8"));
    assert.ok(indice.municipios.length > 0, "pré-condição: a fixture precisa ter municípios de verdade para o teste ter sentido");
    assert.equal(indice.schema, "saeb-municipios-indice/1-prototipo", "pré-condição: schema continua válido — só o conteúdo é esvaziado");
    indice.municipios = [];
    await writeFile(caminho, JSON.stringify(indice));

    const resultado = await compararComReferencia({ referencia: prototipo.referencia, outDir });
    assert.equal(resultado.ok, false, "um índice nacional vazio não pode aprovar quando a referência tem municípios");
    for (const codigoIbge of ["3550308", "1100015"]) {
      assert.ok(
        resultado.discrepancias.some((d) => d.tipo === "municipio_ausente" && d.codigoIbge === codigoIbge),
        `deveria ter registrado municipio_ausente para ${codigoIbge}`,
      );
    }
  });
});
