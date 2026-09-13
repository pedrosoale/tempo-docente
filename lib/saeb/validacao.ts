// Validação em runtime dos quatro artefatos públicos do SAEB (current.json, índice nacional,
// índice municipal, partição). Os tipos de lib/saeb/types.ts descrevem a FORMA esperada, mas
// nunca são checados em runtime pelo TypeScript — um arquivo estático em public/data/saeb pode
// divergir do tipo (campo ausente, schema certo com conteúdo errado, JSON adulterado por engano)
// sem que nada detecte isso antes de chegar à interface. Esta rodada corrige exatamente o que a
// revisão encontrou: um índice sem `versao` era aceito, e um índice com `municipios: null` também.
//
// Contrato desta rodada: TODO arquivo servido pela consulta (não o protótipo em si, que continua
// podendo gerar saídas sem versão para testes — ver materialize.mjs) precisa declarar `versao`.
// Nunca enfraquecer isso para "aceitar arquivos antigos sem versão": um arquivo sem versão é,
// para o cliente da consulta, tão inválido quanto um schema errado.
//
// Cada validarX() recebe `unknown` (nunca confia no tipo declarado da resposta de fetch) e:
//   - lança SaebSchemaError com uma mensagem específica de qual campo falhou, OU
//   - lança SaebVersionMismatchError quando a versão declarada diverge da esperada, OU
//   - devolve o objeto já validado, com a forma exata do tipo (nunca um valor "quase certo").
//
// Distinção deliberada entre os três jeitos de "não ter número" (ver lib/saeb/registro.ts):
// ausência OFICIAL (`{estado}`, só um dos 5 estados reconhecidos), campo de indicador realmente
// ausente de um registro de edição (opcional — não é erro), e QUALQUER OUTRA COISA nesse lugar
// (erro de validação — dado malformado, não ausência).
import {
  SCHEMA_INDICE_MUNICIPIO,
  SCHEMA_INDICE_NACIONAL,
  SCHEMA_PARTICAO,
  SCHEMA_VERSAO_ATUAL,
  type CampoIndicador,
  type EntradaIndiceMunicipal,
  type EntradaIndiceNacional,
  type Escola,
  type Etapa,
  type EstadoAusencia,
  type IndiceMunicipal,
  type IndiceNacional,
  type Municipio,
  type Particao,
  type RegistroEdicao,
  type RegistrosPorEdicao,
  type ValorIndicador,
  type VersaoAtual,
} from "./types.ts";

export class SaebFetchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaebFetchError";
  }
}

export class SaebSchemaError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaebSchemaError";
  }
}

export class SaebVersionMismatchError extends Error {
  constructor(message: string) {
    super(message);
    this.name = "SaebVersionMismatchError";
  }
}

const REGEX_CODIGO_IBGE = /^\d{7}$/;
const REGEX_CODIGO_INEP = /^\d{8}$/;
const REGEX_UF = /^[A-Z]{2}$/;
const REGEX_ARQUIVO_PARTICAO = /^\d{3}\.json$/;
const REGEX_EDICAO = /^\d{4}$/;

const ETAPAS_VALIDAS = new Set<Etapa>(["anosIniciais", "anosFinais", "ensinoMedio"]);
const CAMPOS_INDICADOR_VALIDOS = new Set<CampoIndicador>(["lp", "mt", "n", "p", "ideb", "meta"]);
const ESTADOS_AUSENCIA_VALIDOS = new Set<EstadoAusencia>([
  "nao_divulgado_material_extraviado",
  "nao_divulgado_a_pedido",
  "nao_divulgado_por_norma",
  "participacao_insuficiente",
  "ausente",
]);
// Único valor que o dataset atual produz (ver OBSERVACAO_AVALIACAO_ESTADUAL_ID em
// scripts/saeb/import.mjs) — uma observação desconhecida é tratada como dado malformado, não
// como uma variante nova a aceitar silenciosamente.
const OBSERVACOES_VALIDAS = new Set(["avaliacao_estadual"]);

function ehObjeto(v: unknown): v is Record<string, unknown> {
  return typeof v === "object" && v !== null && !Array.isArray(v);
}

function exigirObjeto(v: unknown, contexto: string): Record<string, unknown> {
  if (!ehObjeto(v)) throw new SaebSchemaError(`${contexto}: esperado um objeto, recebido ${JSON.stringify(v)}`);
  return v;
}

function exigirArray(v: unknown, contexto: string): unknown[] {
  if (!Array.isArray(v)) throw new SaebSchemaError(`${contexto}: esperado um array, recebido ${JSON.stringify(v)}`);
  return v;
}

function exigirString(v: unknown, contexto: string): string {
  if (typeof v !== "string" || v === "") throw new SaebSchemaError(`${contexto}: esperada uma string não vazia, recebido ${JSON.stringify(v)}`);
  return v;
}

function exigirNumeroFinito(v: unknown, contexto: string): number {
  if (typeof v !== "number" || !Number.isFinite(v)) {
    throw new SaebSchemaError(`${contexto}: esperado um número finito, recebido ${JSON.stringify(v)}`);
  }
  return v;
}

function exigirInteiroNaoNegativo(v: unknown, contexto: string): number {
  const n = exigirNumeroFinito(v, contexto);
  if (!Number.isInteger(n) || n < 0) throw new SaebSchemaError(`${contexto}: esperado um inteiro não negativo, recebido ${n}`);
  return n;
}

function exigirPadrao(v: string, regex: RegExp, contexto: string): string {
  if (!regex.test(v)) throw new SaebSchemaError(`${contexto}: formato inválido: ${JSON.stringify(v)}`);
  return v;
}

/** Versão obrigatória, não vazia, e igual à esperada quando uma versão esperada é conhecida. */
function exigirVersao(v: unknown, versaoEsperada: string | undefined, contexto: string): string {
  const versao = exigirString(v, `${contexto}.versao`);
  if (versaoEsperada !== undefined && versao !== versaoEsperada) {
    throw new SaebVersionMismatchError(
      `${contexto} tem versão "${versao}", mas a versão atual da consulta é "${versaoEsperada}" — provável dado de outra geração; tente novamente.`,
    );
  }
  return versao;
}

function validarMunicipio(v: unknown, codigoIbgeEsperado: string, contexto: string): Municipio {
  const obj = exigirObjeto(v, contexto);
  const codigoIbge = exigirPadrao(exigirString(obj.codigoIbge, `${contexto}.codigoIbge`), REGEX_CODIGO_IBGE, `${contexto}.codigoIbge`);
  if (codigoIbge !== codigoIbgeEsperado) {
    throw new SaebSchemaError(`${contexto}: código IBGE declarado (${codigoIbge}) não corresponde ao município solicitado (${codigoIbgeEsperado})`);
  }
  const nome = exigirString(obj.nome, `${contexto}.nome`);
  const uf = exigirPadrao(exigirString(obj.uf, `${contexto}.uf`), REGEX_UF, `${contexto}.uf`);
  return { codigoIbge, nome, uf };
}

function validarValorIndicador(v: unknown, contexto: string): ValorIndicador {
  if (typeof v === "number") {
    if (!Number.isFinite(v)) throw new SaebSchemaError(`${contexto}: valor numérico não finito: ${JSON.stringify(v)}`);
    return v;
  }
  if (ehObjeto(v)) {
    if ("estado" in v) {
      const estado = v.estado;
      if (typeof estado !== "string" || !ESTADOS_AUSENCIA_VALIDOS.has(estado as EstadoAusencia)) {
        throw new SaebSchemaError(`${contexto}: estado de ausência não reconhecido pelo contrato: ${JSON.stringify(estado)}`);
      }
      return { estado: estado as EstadoAusencia };
    }
    if ("valor" in v || "obs" in v) {
      const valor = exigirNumeroFinito(v.valor, `${contexto}.valor`);
      const obs = v.obs;
      if (typeof obs !== "string" || !OBSERVACOES_VALIDAS.has(obs)) {
        throw new SaebSchemaError(`${contexto}: observação não reconhecida pelo contrato: ${JSON.stringify(obs)}`);
      }
      return { valor, obs };
    }
  }
  throw new SaebSchemaError(`${contexto}: valor de indicador malformado (nem número, nem ausência oficial, nem valor com observação): ${JSON.stringify(v)}`);
}

function validarRegistroEdicao(v: unknown, contexto: string): RegistroEdicao {
  const obj = exigirObjeto(v, contexto);
  const registro: RegistroEdicao = {};
  for (const [campo, valor] of Object.entries(obj)) {
    if (!CAMPOS_INDICADOR_VALIDOS.has(campo as CampoIndicador)) {
      throw new SaebSchemaError(`${contexto}: campo de indicador desconhecido pelo contrato: ${campo}`);
    }
    registro[campo as CampoIndicador] = validarValorIndicador(valor, `${contexto}.${campo}`);
  }
  return registro;
}

function validarEtapas(v: unknown, contexto: string): Escola["etapas"] {
  const obj = exigirObjeto(v, contexto);
  const etapas: Escola["etapas"] = {};
  for (const [etapa, registros] of Object.entries(obj)) {
    if (!ETAPAS_VALIDAS.has(etapa as Etapa)) throw new SaebSchemaError(`${contexto}: etapa desconhecida pelo contrato: ${etapa}`);
    const registrosObj = exigirObjeto(registros, `${contexto}.${etapa}`);
    const porEdicao: RegistrosPorEdicao = {};
    for (const [edicao, registro] of Object.entries(registrosObj)) {
      exigirPadrao(edicao, REGEX_EDICAO, `${contexto}.${etapa} (chave de edição)`);
      porEdicao[edicao] = validarRegistroEdicao(registro, `${contexto}.${etapa}.${edicao}`);
    }
    etapas[etapa as Etapa] = porEdicao;
  }
  return etapas;
}

function validarEscola(v: unknown, contexto: string): Escola {
  const obj = exigirObjeto(v, contexto);
  const codigoInep = exigirPadrao(exigirString(obj.codigoInep, `${contexto}.codigoInep`), REGEX_CODIGO_INEP, `${contexto}.codigoInep`);
  const nome = exigirString(obj.nome, `${contexto}.nome`);
  const rede = exigirString(obj.rede, `${contexto}.rede`);
  const etapas = validarEtapas(obj.etapas, `${contexto}(INEP ${codigoInep}).etapas`);
  return { codigoInep, nome, rede, etapas };
}

function validarEntradaIndiceNacional(v: unknown, contexto: string): EntradaIndiceNacional {
  const obj = exigirObjeto(v, contexto);
  const codigoIbge = exigirPadrao(exigirString(obj.codigoIbge, `${contexto}.codigoIbge`), REGEX_CODIGO_IBGE, `${contexto}.codigoIbge`);
  const nome = exigirString(obj.nome, `${contexto}.nome`);
  const uf = exigirPadrao(exigirString(obj.uf, `${contexto}.uf`), REGEX_UF, `${contexto}.uf`);
  const escolas = exigirInteiroNaoNegativo(obj.escolas, `${contexto}.escolas`);
  const particoes = exigirInteiroNaoNegativo(obj.particoes, `${contexto}.particoes`);
  if (particoes < 1) throw new SaebSchemaError(`${contexto}.particoes precisa ser >= 1, recebido ${particoes}`);
  return { codigoIbge, nome, uf, escolas, particoes };
}

function validarEntradaIndiceMunicipal(v: unknown, contexto: string): EntradaIndiceMunicipal {
  const obj = exigirObjeto(v, contexto);
  const codigoInep = exigirPadrao(exigirString(obj.codigoInep, `${contexto}.codigoInep`), REGEX_CODIGO_INEP, `${contexto}.codigoInep`);
  const nome = exigirString(obj.nome, `${contexto}.nome`);
  const rede = exigirString(obj.rede, `${contexto}.rede`);
  const particao = exigirPadrao(exigirString(obj.particao, `${contexto}.particao`), REGEX_ARQUIVO_PARTICAO, `${contexto}.particao`);
  return { codigoInep, nome, rede, particao };
}

export function validarVersaoAtual(dados: unknown): VersaoAtual {
  const obj = exigirObjeto(dados, "current.json");
  if (obj.schema !== SCHEMA_VERSAO_ATUAL) {
    throw new SaebSchemaError(`current.json: schema inesperado: ${JSON.stringify(obj.schema)}`);
  }
  const versao = exigirString(obj.versao, "current.json.versao");
  const limiteBytesGzip = exigirNumeroFinito(obj.limiteBytesGzip, "current.json.limiteBytesGzip");
  const municipios = exigirInteiroNaoNegativo(obj.municipios, "current.json.municipios");
  return { schema: SCHEMA_VERSAO_ATUAL, versao, limiteBytesGzip, municipios };
}

export function validarIndiceNacional(dados: unknown, versaoEsperada: string): IndiceNacional {
  const contexto = "índice nacional";
  const obj = exigirObjeto(dados, contexto);
  if (obj.schema !== SCHEMA_INDICE_NACIONAL) throw new SaebSchemaError(`${contexto}: schema inesperado: ${JSON.stringify(obj.schema)}`);
  const versao = exigirVersao(obj.versao, versaoEsperada, contexto);
  const limiteBytesGzip = exigirNumeroFinito(obj.limiteBytesGzip, `${contexto}.limiteBytesGzip`);
  const municipiosBrutos = exigirArray(obj.municipios, `${contexto}.municipios`);
  const municipios = municipiosBrutos.map((m, i) => validarEntradaIndiceNacional(m, `${contexto}.municipios[${i}]`));
  return { schema: SCHEMA_INDICE_NACIONAL, versao, limiteBytesGzip, municipios };
}

export function validarIndiceMunicipal(dados: unknown, versaoEsperada: string, codigoIbgeEsperado: string): IndiceMunicipal {
  const contexto = `índice municipal de ${codigoIbgeEsperado}`;
  const obj = exigirObjeto(dados, contexto);
  if (obj.schema !== SCHEMA_INDICE_MUNICIPIO) throw new SaebSchemaError(`${contexto}: schema inesperado: ${JSON.stringify(obj.schema)}`);
  const versao = exigirVersao(obj.versao, versaoEsperada, contexto);
  const codigoIbge = exigirPadrao(exigirString(obj.codigoIbge, `${contexto}.codigoIbge`), REGEX_CODIGO_IBGE, `${contexto}.codigoIbge`);
  if (codigoIbge !== codigoIbgeEsperado) {
    throw new SaebSchemaError(`${contexto}: campo codigoIbge (${codigoIbge}) não corresponde ao município solicitado (${codigoIbgeEsperado})`);
  }
  const municipio = validarMunicipio(obj.municipio, codigoIbgeEsperado, `${contexto}.municipio`);
  const escolasBrutas = exigirArray(obj.escolas, `${contexto}.escolas`);
  const escolas = escolasBrutas.map((e, i) => validarEntradaIndiceMunicipal(e, `${contexto}.escolas[${i}]`));
  return { schema: SCHEMA_INDICE_MUNICIPIO, versao, codigoIbge, municipio, escolas };
}

export function validarParticao(dados: unknown, versaoEsperada: string, codigoIbgeEsperado: string, arquivo: string): Particao {
  const contexto = `partição ${codigoIbgeEsperado}/${arquivo}`;
  const obj = exigirObjeto(dados, contexto);
  if (obj.schema !== SCHEMA_PARTICAO) throw new SaebSchemaError(`${contexto}: schema inesperado: ${JSON.stringify(obj.schema)}`);
  const versao = exigirVersao(obj.versao, versaoEsperada, contexto);
  const municipio = validarMunicipio(obj.municipio, codigoIbgeEsperado, `${contexto}.municipio`);
  const escolasBrutas = exigirArray(obj.escolas, `${contexto}.escolas`);
  const escolas = escolasBrutas.map((e, i) => validarEscola(e, `${contexto}.escolas[${i}]`));
  return { schema: SCHEMA_PARTICAO, versao, municipio, escolas };
}
