// Testes do catálogo "Computação na Educação Básica — Complemento à BNCC" (BNCC Computação) e do seu
// gerador (scripts/bncc-computacao/gerar.mjs). Nenhuma rede, nenhum PDF: só a fonte auditada versionada
// e os catálogos gerados.
//
// As contagens abaixo são uma cópia INDEPENDENTE dos totais aprovados na conferência visual do Anexo
// (Rodada 26 do relatório), reescritas aqui — nunca importadas do gerador nem de
// referencia-aprovada.mjs: este arquivo não valida o gerador contra os próprios números que deveria testar.
//
// Nenhum teste escreve em data/bncc/: toda geração usa diretórios temporários (mkdtempSync), e um teste
// final prova que as fontes, os catálogos e a árvore data/bncc continuam byte a byte idênticos.
import assert from "node:assert/strict";
import { execFileSync, spawnSync } from "node:child_process";
import { createHash } from "node:crypto";
import { cpSync, existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync, utimesSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import test from "node:test";

import { ESCOPOS, arquivoFonte, arquivoSaida, gerar, urlEhOficial, validarTextoDeHabilidade, verificar } from "../scripts/bncc-computacao/gerar.mjs";

const RAIZ = process.cwd();
const DIR_DATA = join(RAIZ, "data", "bncc");
const DIR_FONTE = join(DIR_DATA, "source");
const GERAR_CLI = join(RAIZ, "scripts", "bncc-computacao", "gerar.mjs");

// ---- cópia independente dos totais aprovados -------------------------------------------------------
const ANEXO_SHA256 = "b0f021db3c7c2c042b821cec5fab7d77ed1888dbb61590461ce2afef404865b7";
const TOTAL_ESPERADO = 141;
const TOTAL_POR_ESCOPO = { "educacao-infantil": 11, "anos-iniciais": 50, "anos-finais": 54, "ensino-medio": 26 };
const TOTAL_POR_PREFIXO = {
  EI03CO: 11,
  EF01CO: 7, EF02CO: 6, EF03CO: 9, EF04CO: 8, EF05CO: 11, EF15CO: 9,
  EF06CO: 10, EF07CO: 11, EF08CO: 11, EF09CO: 10, EF69CO: 12,
  EM13CO: 26,
};
const POR_ANO_E_EIXO = {
  "1º ano": [7, { "Pensamento Computacional": 3, "Mundo Digital": 2, "Cultura Digital": 2 }],
  "2º ano": [6, { "Pensamento Computacional": 2, "Mundo Digital": 2, "Cultura Digital": 2 }],
  "3º ano": [9, { "Pensamento Computacional": 3, "Mundo Digital": 3, "Cultura Digital": 3 }],
  "4º ano": [8, { "Pensamento Computacional": 3, "Mundo Digital": 2, "Cultura Digital": 3 }],
  "5º ano": [11, { "Pensamento Computacional": 4, "Mundo Digital": 3, "Cultura Digital": 4 }],
  "6º ano": [10, { "Pensamento Computacional": 6, "Mundo Digital": 2, "Cultura Digital": 2 }],
  "7º ano": [11, { "Pensamento Computacional": 5, "Mundo Digital": 2, "Cultura Digital": 4 }],
  "8º ano": [11, { "Pensamento Computacional": 4, "Mundo Digital": 2, "Cultura Digital": 5 }],
  "9º ano": [10, { "Pensamento Computacional": 3, "Mundo Digital": 2, "Cultura Digital": 5 }],
};
const POR_BLOCO_E_EIXO = {
  "1º ao 5º ano": [9, { "Pensamento Computacional": 4, "Mundo Digital": 3, "Cultura Digital": 2 }],
  "6º ao 9º ano": [12, { "Pensamento Computacional": 6, "Mundo Digital": 4, "Cultura Digital": 2 }],
};
const EI_POR_EIXO = { "Pensamento Computacional": 6, "Mundo Digital": 3, "Cultura Digital": 2 };
const EM_POR_COMPETENCIA = { 1: 6, 2: 2, 3: 3, 4: 5, 5: 2, 6: 4, 7: 4 };
const EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE = [4, 5, 7];

function carregar(escopo) {
  return JSON.parse(readFileSync(join(DIR_DATA, arquivoSaida(escopo)), "utf-8"));
}
const habilidadesDe = (cat) => cat.registros.filter((r) => r.tipo === "habilidade" || r.tipo === "objetivo_aprendizagem");
const todasHabilidades = () => ESCOPOS.flatMap((e) => habilidadesDe(carregar(e)));
function contar(lista, chave) {
  const c = {};
  for (const x of lista) c[x[chave]] = (c[x[chave]] ?? 0) + 1;
  return c;
}
function hashArquivo(caminho) {
  return createHash("sha256").update(readFileSync(caminho)).digest("hex");
}
function hashArvore(dir) {
  const saida = {};
  const visitar = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (e.isDirectory()) visitar(p);
      else saida[p.slice(dir.length)] = `${hashArquivo(p)}:${statSync(p).mtimeMs}`;
    }
  };
  visitar(dir);
  return saida;
}

const ANTES = hashArvore(DIR_DATA);

// ---- contagens exatas -------------------------------------------------------------------------------
test("total exato de habilidades e objetivos por escopo e geral (141)", () => {
  let soma = 0;
  for (const e of ESCOPOS) {
    const n = habilidadesDe(carregar(e)).length;
    assert.equal(n, TOTAL_POR_ESCOPO[e], `escopo ${e}`);
    soma += n;
  }
  assert.equal(soma, TOTAL_ESPERADO);
  assert.equal(new Set(todasHabilidades().map((h) => h.codigo)).size, TOTAL_ESPERADO, "nenhum código repetido entre os escopos");
});

test("totais exatos por prefixo de código — os 13 padrões que realmente aparecem no Anexo", () => {
  const por = {};
  for (const h of todasHabilidades()) por[h.codigo.slice(0, 6)] = (por[h.codigo.slice(0, 6)] ?? 0) + 1;
  assert.deepEqual(por, TOTAL_POR_PREFIXO);
});

test("a numeração de cada prefixo é densa de 01 ao total — sem lacuna inventada e sem sequência preenchida", () => {
  for (const [prefixo, total] of Object.entries(TOTAL_POR_PREFIXO)) {
    const numeros = todasHabilidades().filter((h) => h.codigo.startsWith(prefixo)).map((h) => Number(h.codigo.slice(6))).sort((a, b) => a - b);
    assert.deepEqual(numeros, Array.from({ length: total }, (_, i) => i + 1), prefixo);
  }
});

test("Educação Infantil: 11 objetivos de aprendizagem (EI03CO01–EI03CO11) em 3 eixos, mais 4 premissas", () => {
  const cat = carregar("educacao-infantil");
  const objetivos = habilidadesDe(cat);
  assert.ok(objetivos.every((o) => o.tipo === "objetivo_aprendizagem" && o.etapa === "Educação Infantil"));
  assert.deepEqual(contar(objetivos, "eixo"), EI_POR_EIXO);
  assert.ok(objetivos.every((o) => o.explicacao === null && o.objeto_conhecimento === null && o.competencia_especifica === null && o.ano === null && o.bloco_anos === null));
  assert.equal(cat.registros.filter((r) => r.tipo === "premissa").length, 4);
  assert.ok(cat.registros.filter((r) => r.tipo === "premissa").every((p) => p.codigo === null));
  assert.match(cat.metadata.premissas_introducao.texto, /^A Computação permite explorar e vivenciar experiências/);
});

test("Ensino Fundamental: totais exatos por ano e por eixo (1º ao 9º ano)", () => {
  const todas = [...habilidadesDe(carregar("anos-iniciais")), ...habilidadesDe(carregar("anos-finais"))];
  for (const [ano, [total, eixos]] of Object.entries(POR_ANO_E_EIXO)) {
    const doAno = todas.filter((h) => h.ano === ano);
    assert.equal(doAno.length, total, ano);
    assert.deepEqual(contar(doAno, "eixo"), eixos, `${ano} por eixo`);
    assert.ok(doAno.every((h) => h.codigo.startsWith(`EF0${ano[0]}CO`) && h.bloco_anos === null && h.anos_aplicaveis.length === 1));
  }
});

test("Ensino Fundamental: blocos 'Por etapa' (1º ao 5º ano = EF15CO; 6º ao 9º ano = EF69CO) têm ano null e anos aplicáveis do bloco", () => {
  const todas = [...habilidadesDe(carregar("anos-iniciais")), ...habilidadesDe(carregar("anos-finais"))];
  for (const [bloco, [total, eixos]] of Object.entries(POR_BLOCO_E_EIXO)) {
    const doBloco = todas.filter((h) => h.bloco_anos === bloco);
    assert.equal(doBloco.length, total, bloco);
    assert.deepEqual(contar(doBloco, "eixo"), eixos, `${bloco} por eixo`);
    assert.ok(doBloco.every((h) => h.ano === null));
  }
  assert.deepEqual(todas.find((h) => h.codigo === "EF15CO01").anos_aplicaveis, ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"]);
  assert.deepEqual(todas.find((h) => h.codigo === "EF69CO01").anos_aplicaveis, ["6º ano", "7º ano", "8º ano", "9º ano"]);
});

test("Ensino Fundamental: todo registro tem eixo e objeto de conhecimento; só os quadros do 6º ao 9º têm nível 2 e enunciado agrupador", () => {
  const todas = [...habilidadesDe(carregar("anos-iniciais")), ...habilidadesDe(carregar("anos-finais"))];
  for (const h of todas) {
    assert.ok(h.eixo && h.objeto_conhecimento, h.codigo);
    const hierarquico = /^EF(0[6-9]|69)CO/.test(h.codigo);
    assert.equal(h.objeto_conhecimento_nivel_2 !== null, hierarquico, h.codigo);
    assert.equal(h.enunciado_agrupador !== null, hierarquico, h.codigo);
    assert.ok(h.explicacao && h.exemplos.length >= 1, h.codigo);
  }
});

test("Ensino Médio: 26 habilidades em 7 competências específicas, sem eixo e sem objeto de conhecimento", () => {
  const cat = carregar("ensino-medio");
  const hab = habilidadesDe(cat);
  assert.equal(hab.length, 26);
  assert.deepEqual(contar(hab, "competencia_especifica"), Object.fromEntries(Object.entries(EM_POR_COMPETENCIA).map(([k, v]) => [k, v])));
  assert.ok(hab.every((h) => h.eixo === null && h.objeto_conhecimento === null && h.ano === null));
  assert.equal(cat.registros.filter((r) => r.tipo === "competencia_especifica").length, 7);
});

test("as 7 competências do Ensino Fundamental são idênticas nos dois arquivos do EF e preservam o texto da lista", () => {
  const a = carregar("anos-iniciais").registros.filter((r) => r.tipo === "competencia_especifica");
  const b = carregar("anos-finais").registros.filter((r) => r.tipo === "competencia_especifica");
  assert.equal(a.length, 7);
  assert.deepEqual(a, b);
  assert.match(a[0].texto, /^Compreender a Computação como uma área de conhecimento/);
});

test("Ensino Médio: o texto das competências 4, 5 e 7 diverge entre a lista (p. 65) e o quadro de habilidades — ambos preservados e documentados", () => {
  const cat = carregar("ensino-medio");
  const comps = cat.registros.filter((r) => r.tipo === "competencia_especifica");
  for (const c of comps) {
    assert.equal(c.textos_divergem, EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE.includes(c.numero), `competência ${c.numero}`);
    assert.equal(c.texto === c.texto_no_quadro_de_habilidades, !c.textos_divergem);
  }
  assert.equal(cat.metadata.divergencias_documentais.length, 3);
  assert.match(comps[3].texto, /produzindo conteúdos e artefatos .* questões éticas e legais/);
  assert.match(comps[3].texto_no_quadro_de_habilidades, /produzindo informação e\/ou artefatos .* questões legais/);
});

// ---- identidade e distinções ------------------------------------------------------------------------
test("registros de habilidade/objetivo têm código oficial; id_interno nunca é um código oficial", () => {
  for (const h of todasHabilidades()) {
    assert.match(h.codigo, /^E[IFM]\d{2}CO\d{2}$/);
    assert.equal(h.id_interno, `computacao.${h.codigo.toLowerCase()}`);
    assert.notEqual(h.id_interno, h.codigo);
  }
  for (const e of ESCOPOS) {
    for (const r of carregar(e).registros.filter((x) => x.tipo === "premissa" || x.tipo === "competencia_especifica")) {
      assert.equal(r.codigo, null, "a fonte não codifica premissas nem competências");
    }
  }
});

test("EF05CO011 (impresso com 3 dígitos na fonte) é registrado como EF05CO11, com a correção documentada; nenhum código tem 3 dígitos", () => {
  const todas = todasHabilidades();
  assert.ok(todas.some((h) => h.codigo === "EF05CO11"));
  assert.ok(!todas.some((h) => h.codigo === "EF05CO011"));
  const c1 = carregar("anos-iniciais").metadata.correcoes_tipograficas.find((c) => c.id === "C1");
  assert.equal(c1.impresso_na_fonte, "EF05CO011");
  assert.equal(c1.corrigido, "EF05CO11");
  assert.equal(c1.conferido_visualmente, true);
});

test("correções tipográficas controladas: só C1 (código), C2 ('responsabilidad e') e C3 (marcador '(cont.)'), cada uma ligada a registros específicos", () => {
  const ai = carregar("anos-iniciais").metadata;
  const af = carregar("anos-finais").metadata;
  assert.deepEqual(ai.correcoes_tipograficas.map((c) => c.id), ["C1"]);
  assert.deepEqual(af.correcoes_tipograficas.map((c) => c.id), ["C2"]);
  assert.deepEqual(af.correcoes_tipograficas[0].registros, ["EF09CO06", "EF09CO07", "EF09CO08", "EF09CO09"]);
  assert.deepEqual(af.marcadores_de_continuacao_removidos.map((c) => c.id), ["C3"]);
  assert.deepEqual(af.marcadores_de_continuacao_removidos[0].registros, ["EF09CO05"]);
  for (const e of ESCOPOS) {
    for (const r of habilidadesDe(carregar(e))) {
      assert.doesNotMatch(JSON.stringify(r), /\(cont\.\)|responsabilidad e/, r.codigo);
    }
  }
});

test("notas documentais: só EF05CO06, EF05CO07 e EF69CO01 — a explicação/exemplo impressos ficam como estão no PDF", () => {
  const comNota = todasHabilidades().filter((h) => h.notas_documentais.length > 0).map((h) => h.codigo);
  assert.deepEqual(comNota, ["EF05CO06", "EF05CO07", "EF69CO01"]);
  const h06 = todasHabilidades().find((h) => h.codigo === "EF05CO06");
  assert.match(h06.texto, /armazenados em um dispositivo local ou remoto/);
  assert.match(h06.explicacao, /gerenciados por um software que denominamos Sistema Operacional/, "preservado como impresso: a explicação da linha de EF05CO06 trata de sistema operacional");
  const h69 = todasHabilidades().find((h) => h.codigo === "EF69CO01");
  assert.equal(h69.explicacao, h69.exemplos[0]);
});

test("a relação transversal oficial de EM13CO05 (EM13MAT315) é uma relação, não uma habilidade, e aponta para um código real da BNCC existente", () => {
  const h = todasHabilidades().find((x) => x.codigo === "EM13CO05");
  assert.deepEqual(h.relacoes_transversais.map((r) => [r.codigo, r.natureza]), [["EM13MAT315", "relacao_direta_indicada_pela_fonte"]]);
  assert.ok(!h.exemplos.some((x) => /Possui relação direta/.test(x)), "a frase da relação não fica duplicada nos exemplos");
  assert.ok(!todasHabilidades().some((x) => x.codigo === "EM13MAT315"));
  const mat = JSON.parse(readFileSync(join(DIR_DATA, "ensino-medio-matematica.json"), "utf-8"));
  assert.ok(mat.registros.some((r) => r.codigo === "EM13MAT315"), "o destino da relação existe na BNCC publicada");
  assert.equal(todasHabilidades().filter((x) => x.relacoes_transversais.length > 0).length, 1, "é a única relação transversal impressa no Anexo");
});

test("explicação, exemplo e texto da habilidade são campos separados: nunca idênticos entre si, sem cabeçalho/rodapé no texto", () => {
  for (const h of todasHabilidades()) {
    assert.ok(!h.exemplos.includes(h.texto), h.codigo);
    if (h.explicacao !== null && h.codigo !== "EF69CO01") assert.ok(!h.exemplos.includes(h.explicacao), h.codigo);
    assert.notEqual(h.explicacao, h.texto, h.codigo);
    assert.doesNotThrow(() => validarTextoDeHabilidade(h.texto, h.codigo), h.codigo);
    assert.doesNotMatch(h.texto, /EXPLICAÇÃO DA HABILIDADE|COMPUTAÇÃO - |Diagramação/);
  }
});

test("conteúdo nacional: nenhum campo remete a currículo estadual, SEDUC, Currículo Paulista ou a outra etapa de documento", () => {
  for (const e of ESCOPOS) {
    const bruto = readFileSync(join(DIR_DATA, arquivoSaida(e)), "utf-8") + readFileSync(join(DIR_FONTE, arquivoFonte(e)), "utf-8");
    assert.doesNotMatch(bruto, /Paulista|SEDUC|Educação Digital e Midiática|Curr[ií]culo Paulista/i, e);
    assert.equal(carregar(e).metadata.nome_oficial, "Computação na Educação Básica — Complemento à BNCC");
    assert.equal(carregar(e).metadata.nome_curto, "BNCC Computação");
  }
});

// ---- proveniência -----------------------------------------------------------------------------------
test("proveniência: Anexo oficial no gov.br/mec com SHA-256 literal, equivalente idêntico, Parecer e Resolução; sem fonte fora do domínio oficial", () => {
  for (const e of ESCOPOS) {
    const cat = carregar(e);
    const anexo = cat.metadata.fontes.find((f) => f.papel === "fonte_das_tabelas");
    assert.equal(anexo.sha256, ANEXO_SHA256);
    assert.equal(anexo.tamanho_bytes, 1426596);
    assert.equal(anexo.total_paginas_pdf, 75);
    assert.equal(anexo.mime, "application/pdf");
    assert.match(anexo.url, /^https:\/\/www\.gov\.br\/mec\/pt-br\/cne\/pdf\/pareceres-do-cne\/ceb\/2022\/anexo-ao-parecer-cneceb-no-2-2022-bncc-computacao\.pdf$/);
    const equiv = cat.metadata.fontes.find((f) => f.papel === "equivalente_oficial_identico_ao_anexo");
    assert.equal(equiv.sha256, anexo.sha256, "o PDF diagramado é byte a byte idêntico ao Anexo");
    assert.deepEqual(cat.metadata.fontes.map((f) => f.id).sort(), ["anexo-parecer-ceb-2-2022", "bncc-computacao-gov-br-media", "parecer-ceb-2-2022", "resolucao-ceb-1-2022"]);
    for (const f of cat.metadata.fontes) {
      assert.ok(urlEhOficial(f.url), f.url);
      assert.match(f.sha256, /^[0-9a-f]{64}$/);
      assert.match(f.acessado_em, /^2026-10-28T\d{2}:\d{2}:\d{2}Z$/);
    }
    for (const r of cat.registros) {
      assert.equal(r.documento_sha256, ANEXO_SHA256);
      assert.equal(r.documento_url, anexo.url);
    }
    assert.ok(cat.metadata.fontes_indisponiveis.length === 5, "as 5 URLs pedidas que não responderam estão registradas");
    assert.ok(cat.metadata.fontes_indisponiveis.some((u) => u.url.includes("233371") && u.equivalente_oficial === null), "a planilha consolidada segue sem equivalente oficial");
  }
});

test("páginas: a página impressa é a real − 4 e o complemento (explicação/exemplos) é a página seguinte", () => {
  for (const h of todasHabilidades()) {
    assert.equal(h.pagina_impressa, h.pagina_fonte - 4, h.codigo);
    assert.equal(h.pagina_fonte_complemento, h.pagina_fonte + 1, h.codigo);
    assert.equal(h.pagina_impressa_complemento, h.pagina_impressa + 1, h.codigo);
    assert.ok(h.pagina_fonte >= 6 && h.pagina_fonte <= 74, h.codigo);
  }
});

test("conteúdo literal de registros-chave (um por etapa e padrão de código)", () => {
  const h = (c) => todasHabilidades().find((x) => x.codigo === c);
  assert.equal(h("EI03CO01").texto, "Reconhecer padrão de repetição em sequência de sons, movimentos, desenhos.");
  assert.equal(h("EF01CO01").eixo, "Pensamento Computacional");
  assert.equal(h("EF01CO01").objeto_conhecimento, "Organização de objetos");
  assert.match(h("EF05CO11").texto, /^Identificar a adequação de diferentes tecnologias computacionais na resolução de problemas\.$/);
  assert.equal(h("EF09CO06").objeto_conhecimento, "Segurança e responsabilidade no uso da tecnologia");
  assert.equal(h("EF09CO05").objeto_conhecimento, "Sistemas distribuídos e internet");
  assert.equal(h("EF69CO12").objeto_conhecimento_nivel_2, "Tecnologia digital e sustentabilidade");
  assert.match(h("EM13CO26").texto, /direito digital/);
  assert.equal(h("EM13CO26").competencia_especifica, 7);
  assert.equal(h("EF06CO01").texto.endsWith("‘tipo de dados’"), true, "texto impresso sem ponto final, preservado");
});

// ---- geração ----------------------------------------------------------------------------------------
function copiarFontes() {
  const dir = mkdtempSync(join(tmpdir(), "bncc-computacao-"));
  for (const e of ESCOPOS) cpSync(join(DIR_FONTE, arquivoFonte(e)), join(dir, arquivoFonte(e)));
  return dir;
}

test("gerador: a primeira geração cria os 4 catálogos e eles são idênticos, byte a byte, aos versionados", () => {
  const dir = copiarFontes();
  try {
    const r = gerar({ fonteDir: dir, saidaDir: dir });
    for (const e of ESCOPOS) {
      assert.equal(r[e].escrito, true, `${e} deveria ser criado`);
      assert.equal(readFileSync(join(dir, arquivoSaida(e)), "utf-8"), readFileSync(join(DIR_DATA, arquivoSaida(e)), "utf-8"), e);
    }
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gerador: a segunda geração não escreve nada — hash e mtime idênticos", async () => {
  const dir = copiarFontes();
  try {
    gerar({ fonteDir: dir, saidaDir: dir });
    const passado = new Date("2020-01-01T00:00:00Z");
    for (const e of ESCOPOS) utimesSync(join(dir, arquivoSaida(e)), passado, passado);
    const antes = Object.fromEntries(ESCOPOS.map((e) => [e, [hashArquivo(join(dir, arquivoSaida(e))), statSync(join(dir, arquivoSaida(e))).mtimeMs]]));
    const r = gerar({ fonteDir: dir, saidaDir: dir });
    for (const e of ESCOPOS) {
      assert.equal(r[e].escrito, false, e);
      assert.deepEqual([hashArquivo(join(dir, arquivoSaida(e))), statSync(join(dir, arquivoSaida(e))).mtimeMs], antes[e], e);
    }
    const saida = execFileSync(process.execPath, [GERAR_CLI, "--fonte-dir", dir, "--saida-dir", dir], { encoding: "utf-8" });
    assert.match(saida, /já em dia \(nada escrito\)/);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gerador: --check passa no catálogo real e falha (exit 1, sem escrever) quando o catálogo gerado é editado à mão", () => {
  verificar();
  const dir = copiarFontes();
  try {
    gerar({ fonteDir: dir, saidaDir: dir });
    const ok = spawnSync(process.execPath, [GERAR_CLI, "--check", "--fonte-dir", dir, "--saida-dir", dir], { encoding: "utf-8" });
    assert.equal(ok.status, 0, ok.stderr);
    const alvo = join(dir, arquivoSaida("ensino-medio"));
    writeFileSync(alvo, readFileSync(alvo, "utf-8").replace("Explorar e construir", "Explorar e construí"));
    const editado = readFileSync(alvo, "utf-8");
    const ruim = spawnSync(process.execPath, [GERAR_CLI, "--check", "--fonte-dir", dir, "--saida-dir", dir], { encoding: "utf-8" });
    assert.equal(ruim.status, 1);
    assert.match(ruim.stderr, /diverge da fonte/);
    assert.equal(readFileSync(alvo, "utf-8"), editado, "--check nunca escreve");
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("gerador: nenhuma escrita parcial — se uma fonte é inválida, nenhum catálogo é gravado", () => {
  const dir = copiarFontes();
  try {
    const f = JSON.parse(readFileSync(join(dir, arquivoFonte("ensino-medio")), "utf-8"));
    f.registros[0].texto = f.registros[0].texto.replace("Explorar", "Explorei");
    writeFileSync(join(dir, arquivoFonte("ensino-medio")), JSON.stringify(f));
    assert.throws(() => gerar({ fonteDir: dir, saidaDir: dir }), /fonte ensino-medio/);
    for (const e of ESCOPOS) assert.equal(existsSync(join(dir, arquivoSaida(e))), false, `${e} não deveria ter sido escrito`);
  } finally {
    rmSync(dir, { recursive: true, force: true });
  }
});

test("catálogo gerado: metadados declaram que está publicado só em /bncc/computacao (submenu e sitemap), e fora de data.ts, import-report, busca geral e homepage", () => {
  for (const e of ESCOPOS) {
    const m = carregar(e).metadata;
    assert.equal(m.publicado_na_interface, true);
    assert.match(m.nota_de_interface, /exclusivamente na página \/bncc\/computacao/);
    assert.match(m.nota_de_interface, /submenu BNCC/);
    assert.match(m.nota_de_interface, /sitemap/);
    assert.match(m.nota_de_interface, /Não está incorporado a lib\/bncc\/data\.ts, a data\/bncc\/import-report\.json, à busca geral de \/bncc nem à homepage/);
    // Nada de afirmações antigas de que o catálogo é interno/sem rota/sem menu/sem sitemap.
    assert.doesNotMatch(m.nota_de_interface, /interno|nenhuma página|nenhum.*(menu|sitemap)|não expõe/i);
    assert.equal(m.schema, "bncc-computacao/1");
    assert.equal(m.total_habilidades_e_objetivos, TOTAL_POR_ESCOPO[e]);
  }
});

// ---- separação da BNCC existente e da interface ------------------------------------------------------
test("compatibilidade: nenhum código de Computação colide com os 1616 registros da BNCC existente, e o agregado antigo segue em 1616", () => {
  const codigosExistentes = new Set();
  for (const nome of readdirSync(DIR_DATA)) {
    if (!/\.json$/.test(nome) || /report|^computacao-/.test(nome)) continue;
    const d = JSON.parse(readFileSync(join(DIR_DATA, nome), "utf-8"));
    for (const r of d.registros ?? []) if (r.codigo) codigosExistentes.add(r.codigo);
  }
  assert.ok(codigosExistentes.size > 1000);
  for (const h of todasHabilidades()) assert.ok(!codigosExistentes.has(h.codigo), `${h.codigo} colide com a BNCC existente`);
  const agregado = JSON.parse(readFileSync(join(DIR_DATA, "import-report.json"), "utf-8"));
  assert.equal(agregado.total_geral, 1616);
});

// Rodada 35: a interface pública /bncc/computacao foi criada. O que continua valendo é o ISOLAMENTO: a rota,
// o submenu e o sitemap são os únicos pontos de contato, e nada que não seja a consulta de Computação
// (dados agregados da BNCC, importador, homepage, rodapé, layout raiz, busca) referencia o catálogo.
// Rodada 38 (descoberta): o rodapé e a página principal /bncc (grupo app/(bncc-hub), só por um cartão de acesso e uma
// prévia separada via lib/bncc/computacao-consulta.ts) passaram a ser pontos de contato; dados, importador, busca
// curricular, homepage e layout raiz continuam sem referenciar o catálogo.
test("interface isolada: só a rota /bncc/computacao, o submenu, o sitemap, o rodapé e a descoberta em /bncc referenciam Computação; dados, importador, homepage e layout raiz não", () => {
  const alvos = [join(RAIZ, "lib", "bncc", "data.ts"), join(RAIZ, "lib", "bncc", "search.mjs"), join(RAIZ, "scripts", "bncc", "import.mjs"), join(RAIZ, "app", "layout.tsx"), join(RAIZ, "app", "page.tsx")];
  for (const alvo of alvos) {
    if (!existsSync(alvo)) continue;
    assert.doesNotMatch(readFileSync(alvo, "utf-8"), /bncc\/computacao|computacao-(educacao|anos|ensino)|bncc-computacao/, alvo);
  }
  const grupoDaRota = join(RAIZ, "app", "(bncc-computacao)");
  const grupoDoHub = join(RAIZ, "app", "(bncc-hub)");
  const pontosDeContato = [
    join(RAIZ, "app", "sitemap.ts"),
    join(RAIZ, "app", "components", "Header.tsx"),
    join(RAIZ, "app", "components", "Footer.tsx"),
    join(RAIZ, "app", "bncc", "components", "ComputacaoDescoberta.tsx"),
  ];
  const visitar = (d) => {
    for (const e of readdirSync(d, { withFileTypes: true })) {
      const p = join(d, e.name);
      if (p === grupoDaRota || p === grupoDoHub || pontosDeContato.includes(p)) continue;
      if (e.isDirectory()) visitar(p);
      else if (/\.(ts|tsx)$/.test(e.name)) assert.doesNotMatch(readFileSync(p, "utf-8"), /bncc\/computacao|computacao-(educacao|anos|ensino)/, p);
    }
  };
  visitar(join(RAIZ, "app"));
  // Os pontos de contato só citam a rota pública — nunca os arquivos do catálogo.
  for (const ponto of pontosDeContato) {
    const fonte = readFileSync(ponto, "utf-8");
    assert.match(fonte, /\/bncc\/computacao/, ponto);
    assert.doesNotMatch(fonte, /computacao-(educacao|anos|ensino)|data\/bncc/, ponto);
  }
  for (const arquivo of [join(grupoDoHub, "bncc", "page.tsx"), join(grupoDoHub, "layout.tsx")]) {
    assert.doesNotMatch(readFileSync(arquivo, "utf-8"), /computacao-(educacao|anos|ensino)|data\/bncc/, arquivo);
  }
  // A rota vive no grupo (fora de app/bncc/loading.tsx, para o conteúdo vir no HTML inicial).
  assert.ok(existsSync(join(grupoDaRota, "bncc", "computacao", "page.tsx")), "rota /bncc/computacao");
  assert.ok(!existsSync(join(RAIZ, "app", "bncc", "computacao")), "a rota não fica sob app/bncc (ver o comentário em app/(bncc-computacao)/layout.tsx)");
  assert.ok(!existsSync(join(RAIZ, "app", "educacao-digital")) && !existsSync(join(RAIZ, "app", "educacao-midiatica")));
});

test("estes testes não alteraram nenhum arquivo de data/bncc (hash e mtime de toda a árvore idênticos)", () => {
  assert.deepEqual(hashArvore(DIR_DATA), ANTES);
});
