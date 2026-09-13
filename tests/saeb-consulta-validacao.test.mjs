// Testes de lib/saeb/validacao.ts — validação em runtime dos quatro artefatos públicos. Cobre os
// dois achados reproduzidos pela revisão (índice sem `versao` aceito; `municipios: null` aceito com
// schema correto) e uma bateria mais ampla de estrutura inválida, além dos casos válidos.
import assert from "node:assert/strict";
import test from "node:test";

import {
  SaebSchemaError,
  SaebVersionMismatchError,
  validarIndiceMunicipal,
  validarIndiceNacional,
  validarParticao,
  validarVersaoAtual,
} from "../lib/saeb/validacao.ts";
import { SCHEMA_INDICE_MUNICIPIO, SCHEMA_INDICE_NACIONAL, SCHEMA_PARTICAO, SCHEMA_VERSAO_ATUAL } from "../lib/saeb/types.ts";

const V = "versao-abc123";

/** Devolve uma cópia de `obj` sem a chave `chave` — usado para simular um campo ausente sem disparar aviso de variável não usada com desestruturação. */
function sem(obj, chave) {
  const copia = { ...obj };
  delete copia[chave];
  return copia;
}

function current(sobrepor = {}) {
  return { schema: SCHEMA_VERSAO_ATUAL, versao: V, limiteBytesGzip: 51200, municipios: 5571, ...sobrepor };
}

function entradaNacional(sobrepor = {}) {
  return { codigoIbge: "3550308", nome: "São Paulo", uf: "SP", escolas: 2, particoes: 2, ...sobrepor };
}

function indiceNacional(sobrepor = {}) {
  return { schema: SCHEMA_INDICE_NACIONAL, versao: V, limiteBytesGzip: 51200, municipios: [entradaNacional()], ...sobrepor };
}

function entradaMunicipal(sobrepor = {}) {
  return { codigoInep: "35000001", nome: "EE UM", rede: "Estadual", particao: "001.json", ...sobrepor };
}

function indiceMunicipal(sobrepor = {}) {
  return {
    schema: SCHEMA_INDICE_MUNICIPIO,
    versao: V,
    codigoIbge: "3550308",
    municipio: { codigoIbge: "3550308", nome: "São Paulo", uf: "SP" },
    escolas: [entradaMunicipal()],
    ...sobrepor,
  };
}

function escola(sobrepor = {}) {
  return { codigoInep: "35000001", nome: "EE UM", rede: "Estadual", etapas: { anosIniciais: { 2025: { lp: 200.5 } } }, ...sobrepor };
}

function particao(sobrepor = {}) {
  return { schema: SCHEMA_PARTICAO, versao: V, municipio: { codigoIbge: "3550308", nome: "São Paulo", uf: "SP" }, escolas: [escola()], ...sobrepor };
}

// ---- 1. Casos válidos --------------------------------------------------------------------------

test("validarVersaoAtual: aceita current.json válido", () => {
  const v = validarVersaoAtual(current());
  assert.equal(v.versao, V);
  assert.equal(v.municipios, 5571);
});

test("validarIndiceNacional: aceita índice nacional válido", () => {
  const indice = validarIndiceNacional(indiceNacional(), V);
  assert.equal(indice.municipios.length, 1);
  assert.equal(indice.municipios[0].codigoIbge, "3550308");
});

test("validarIndiceMunicipal: aceita índice municipal válido, confere identidade do município solicitado", () => {
  const indice = validarIndiceMunicipal(indiceMunicipal(), V, "3550308");
  assert.equal(indice.municipio.nome, "São Paulo");
});

test("validarParticao: aceita partição válida, com valor numérico, zero, ausência oficial e observação", () => {
  const conteudo = particao({
    escolas: [
      escola({ codigoInep: "35000001", etapas: { anosIniciais: { 2025: { lp: 0, mt: 187.34 } } } }),
      escola({ codigoInep: "35000002", etapas: { anosIniciais: { 2025: { lp: { estado: "ausente" } } } } }),
      escola({ codigoInep: "35000003", etapas: { anosIniciais: { 2025: { lp: { valor: 187.89, obs: "avaliacao_estadual" } } } } }),
    ],
  });
  const validada = validarParticao(conteudo, V, "3550308", "001.json");
  assert.equal(validada.escolas[0].etapas.anosIniciais["2025"].lp, 0, "zero precisa ser preservado como valor, não descartado");
  assert.deepEqual(validada.escolas[1].etapas.anosIniciais["2025"].lp, { estado: "ausente" });
  assert.deepEqual(validada.escolas[2].etapas.anosIniciais["2025"].lp, { valor: 187.89, obs: "avaliacao_estadual" });
});

// ---- 2. Os dois achados reproduzidos pela revisão -----------------------------------------------

test("[achado] validarIndiceNacional: rejeita índice SEM o campo versao — antes era aceito", () => {
  assert.throws(() => validarIndiceNacional(sem(indiceNacional(), "versao"), V), SaebSchemaError);
});

test("[achado] validarIndiceMunicipal: rejeita índice SEM o campo versao", () => {
  assert.throws(() => validarIndiceMunicipal(sem(indiceMunicipal(), "versao"), V, "3550308"), SaebSchemaError);
});

test("[achado] validarParticao: rejeita partição SEM o campo versao", () => {
  assert.throws(() => validarParticao(sem(particao(), "versao"), V, "3550308", "001.json"), SaebSchemaError);
});

test("[achado] validarVersaoAtual: rejeita current.json sem versao (versão vazia não conta como presente)", () => {
  assert.throws(() => validarVersaoAtual(current({ versao: "" })), SaebSchemaError);
  assert.throws(() => validarVersaoAtual(sem(current(), "versao")), SaebSchemaError);
});

test("[achado] validarIndiceNacional: rejeita municipios: null, mesmo com schema correto — antes era aceito", () => {
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: null }), V), SaebSchemaError);
});

test("[achado] validarIndiceMunicipal: rejeita escolas: null, mesmo com schema correto", () => {
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: null }), V, "3550308"), SaebSchemaError);
});

test("[achado] validarParticao: rejeita escolas: null, mesmo com schema correto", () => {
  assert.throws(() => validarParticao(particao({ escolas: null }), V, "3550308", "001.json"), SaebSchemaError);
});

// ---- 3. Versão presente, mas divergente da esperada ---------------------------------------------

test("validarIndiceNacional: versão presente mas diferente da esperada é SaebVersionMismatchError, não SaebSchemaError", () => {
  assert.throws(() => validarIndiceNacional(indiceNacional({ versao: "outra-versao" }), V), SaebVersionMismatchError);
});

test("validarIndiceMunicipal: versão divergente é SaebVersionMismatchError", () => {
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ versao: "outra-versao" }), V, "3550308"), SaebVersionMismatchError);
});

test("validarParticao: versão divergente é SaebVersionMismatchError", () => {
  assert.throws(() => validarParticao(particao({ versao: "outra-versao" }), V, "3550308", "001.json"), SaebVersionMismatchError);
});

// ---- 4. Município incorreto (identificação não corresponde ao código solicitado) ----------------

test("validarIndiceMunicipal: rejeita quando codigoIbge do índice não corresponde ao solicitado", () => {
  assert.throws(
    () => validarIndiceMunicipal(indiceMunicipal({ codigoIbge: "1100015" }), V, "3550308"),
    SaebSchemaError,
  );
});

test("validarIndiceMunicipal: rejeita quando municipio.codigoIbge diverge do codigoIbge de nível superior", () => {
  const dados = indiceMunicipal({ municipio: { codigoIbge: "1100015", nome: "Outro", uf: "RO" } });
  assert.throws(() => validarIndiceMunicipal(dados, V, "3550308"), SaebSchemaError);
});

test("validarParticao: rejeita quando o envelope declara um município diferente do solicitado", () => {
  const dados = particao({ municipio: { codigoIbge: "1100015", nome: "Alta Floresta D'Oeste", uf: "RO" } });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarIndiceMunicipal: rejeita codigoIbge com formato inválido (não são 7 dígitos)", () => {
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ codigoIbge: "355030" }), V, "355030"), SaebSchemaError);
});

// ---- 5. Estrutura inválida nos índices ------------------------------------------------------------

test("validarIndiceNacional: rejeita quando municipios não é um array (objeto, string, número)", () => {
  for (const valor of [{}, "abc", 42, undefined]) {
    assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: valor }), V), SaebSchemaError, `deveria rejeitar municipios=${JSON.stringify(valor)}`);
  }
});

test("validarIndiceNacional: rejeita entrada sem codigoIbge, nome ou uf", () => {
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ codigoIbge: undefined })] }), V), SaebSchemaError);
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ nome: "" })] }), V), SaebSchemaError);
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ uf: "sp" })] }), V), SaebSchemaError, "UF minúscula deveria ser rejeitada");
});

test("validarIndiceNacional: rejeita contagens inválidas (particoes < 1, escolas negativo, não-inteiro)", () => {
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ particoes: 0 })] }), V), SaebSchemaError);
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ escolas: -1 })] }), V), SaebSchemaError);
  assert.throws(() => validarIndiceNacional(indiceNacional({ municipios: [entradaNacional({ particoes: 1.5 })] }), V), SaebSchemaError);
});

test("validarIndiceMunicipal: rejeita entrada de escola com codigoInep, nome, rede ou particao inválidos", () => {
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: [entradaMunicipal({ codigoInep: "123" })] }), V, "3550308"), SaebSchemaError);
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: [entradaMunicipal({ nome: "" })] }), V, "3550308"), SaebSchemaError);
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: [entradaMunicipal({ rede: null })] }), V, "3550308"), SaebSchemaError);
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: [entradaMunicipal({ particao: "1.json" })] }), V, "3550308"), SaebSchemaError);
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ escolas: [entradaMunicipal({ particao: "001.txt" })] }), V, "3550308"), SaebSchemaError);
});

test("validarIndiceNacional / validarIndiceMunicipal / validarParticao: rejeitam schema errado, mesmo com o resto válido", () => {
  assert.throws(() => validarIndiceNacional(indiceNacional({ schema: "outro" }), V), SaebSchemaError);
  assert.throws(() => validarIndiceMunicipal(indiceMunicipal({ schema: "outro" }), V, "3550308"), SaebSchemaError);
  assert.throws(() => validarParticao(particao({ schema: "outro" }), V, "3550308", "001.json"), SaebSchemaError);
});

test("validarIndiceNacional / validarParticao: rejeitam corpo que não é um objeto (array, string, null)", () => {
  for (const corpo of [null, "texto", 42, []]) {
    assert.throws(() => validarIndiceNacional(corpo, V), SaebSchemaError);
    assert.throws(() => validarParticao(corpo, V, "3550308", "001.json"), SaebSchemaError);
  }
});

// ---- 6. Indicadores malformados ------------------------------------------------------------------

test("validarParticao: rejeita indicador que não é número, ausência oficial nem valor com observação", () => {
  const casos = ["200.5", null, true, {}, { foo: "bar" }, [1, 2]];
  for (const valor of casos) {
    const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { 2025: { lp: valor } } } })] });
    assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError, `deveria rejeitar lp=${JSON.stringify(valor)}`);
  }
});

test("validarParticao: rejeita estado de ausência não reconhecido pelo contrato — nunca inventa um estado", () => {
  const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { 2025: { lp: { estado: "motivo_inventado" } } } } })] });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: rejeita observação não reconhecida (só 'avaliacao_estadual' é válida)", () => {
  const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { 2025: { lp: { valor: 100, obs: "outra_coisa" } } } } })] });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: rejeita valor com obs mas sem valor numérico finito (NaN/Infinity/string)", () => {
  for (const valorRuim of [Number.NaN, Number.POSITIVE_INFINITY, "200"]) {
    const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { 2025: { lp: { valor: valorRuim, obs: "avaliacao_estadual" } } } } })] });
    assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
  }
});

test("validarParticao: rejeita campo de indicador desconhecido pelo contrato", () => {
  const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { 2025: { indicadorFalso: 100 } } } })] });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: rejeita etapa desconhecida pelo contrato", () => {
  const dados = particao({ escolas: [escola({ etapas: { etapaInventada: { 2025: { lp: 100 } } } })] });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: rejeita chave de edição que não é um ano de 4 dígitos", () => {
  const dados = particao({ escolas: [escola({ etapas: { anosIniciais: { "20255": { lp: 100 } } } })] });
  assert.throws(() => validarParticao(dados, V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: aceita etapas vazias ({}) — escola sem nenhum resultado divulgado é válida, não malformada", () => {
  const dados = particao({ escolas: [escola({ etapas: {} })] });
  const validada = validarParticao(dados, V, "3550308", "001.json");
  assert.deepEqual(validada.escolas[0].etapas, {});
});

test("validarParticao: rejeita escola com codigoInep, nome ou rede inválidos", () => {
  assert.throws(() => validarParticao(particao({ escolas: [escola({ codigoInep: "abc" })] }), V, "3550308", "001.json"), SaebSchemaError);
  assert.throws(() => validarParticao(particao({ escolas: [escola({ codigoInep: "1234567" })] }), V, "3550308", "001.json"), SaebSchemaError);
  assert.throws(() => validarParticao(particao({ escolas: [escola({ nome: "" })] }), V, "3550308", "001.json"), SaebSchemaError);
  assert.throws(() => validarParticao(particao({ escolas: [escola({ rede: 123 })] }), V, "3550308", "001.json"), SaebSchemaError);
});

test("validarParticao: distingue ausência oficial, campo opcional ausente e dado malformado", () => {
  const dados = particao({
    escolas: [
      escola({ etapas: { anosIniciais: { 2025: { lp: { estado: "participacao_insuficiente" } } } } }), // ausência oficial — válida
    ],
  });
  const validada = validarParticao(dados, V, "3550308", "001.json");
  assert.deepEqual(validada.escolas[0].etapas.anosIniciais["2025"].lp, { estado: "participacao_insuficiente" });
  assert.equal(validada.escolas[0].etapas.anosIniciais["2025"].mt, undefined, "campo opcional ausente não é erro — só não aparece no objeto");
});
