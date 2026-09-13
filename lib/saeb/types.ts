// Formato de fio dos artefatos gerados por scripts/saeb-query-prototype/materialize.mjs e
// publicados (localmente, nesta rodada) em public/data/saeb/. Tipos aqui são uma cópia
// deliberada, não um import de scripts/* — mesmo padrão de lib/saresp/types.ts, que também
// não importa scripts/saresp/build-data.mjs. Qualquer mudança de formato do lado da geração
// precisa ser espelhada aqui manualmente.

/** As três etapas cobertas pelos pacotes oficiais do Ideb por escola. */
export type Etapa = "anosIniciais" | "anosFinais" | "ensinoMedio";

/** Os seis campos de indicador que o importador preserva (ver INDICADORES em scripts/saeb/lib/sources.mjs). */
export type CampoIndicador = "lp" | "mt" | "n" | "p" | "ideb" | "meta";

/**
 * Estados oficiais de ausência — espelha MARCADORES_AUSENCIA de
 * scripts/saeb/lib/normalize.mjs. Nunca inventar um estado além destes cinco.
 */
export type EstadoAusencia =
  | "nao_divulgado_material_extraviado"
  | "nao_divulgado_a_pedido"
  | "nao_divulgado_por_norma"
  | "participacao_insuficiente"
  | "ausente";

export interface IndicadorAusente {
  estado: EstadoAusencia;
}

export interface IndicadorComObservacao {
  valor: number;
  /** Sempre "avaliacao_estadual" no dataset atual — ver OBSERVACAO_AVALIACAO_ESTADUAL. */
  obs: string;
}

/** O que uma célula de indicador normalizada pode ser — nunca `null`, nunca 0 fabricado. */
export type ValorIndicador = number | IndicadorAusente | IndicadorComObservacao;

/** Um registro de edição só tem chave para o indicador que a planilha de fato trouxe. */
export type RegistroEdicao = Partial<Record<CampoIndicador, ValorIndicador>>;

/** Chave: ano da edição como string (ex.: "2025") — nunca todas as edições estão presentes. */
export type RegistrosPorEdicao = Record<string, RegistroEdicao>;

export interface Escola {
  codigoInep: string;
  nome: string;
  rede: string;
  /** Só tem chave para a etapa em que a escola de fato aparece em algum pacote. */
  etapas: Partial<Record<Etapa, RegistrosPorEdicao>>;
}

export interface Municipio {
  codigoIbge: string;
  nome: string;
  uf: string;
}

export const SCHEMA_PARTICAO = "saeb-escolas-particao/1-prototipo";
export const SCHEMA_INDICE_MUNICIPIO = "saeb-escolas-indice-municipio/1-prototipo";
export const SCHEMA_INDICE_NACIONAL = "saeb-municipios-indice/1-prototipo";
export const SCHEMA_VERSAO_ATUAL = "saeb-versao-atual/1-prototipo";

/** Wire shape de public/data/saeb/current.json — o ponteiro de versão, sempre buscado primeiro. */
export interface VersaoAtual {
  schema: string;
  versao: string;
  limiteBytesGzip: number;
  municipios: number;
}

/** Uma entrada de public/data/saeb/municipios-index.json. `particoes` é uma CONTAGEM, nunca um array. */
export interface EntradaIndiceNacional {
  codigoIbge: string;
  nome: string;
  uf: string;
  escolas: number;
  particoes: number;
}

export interface IndiceNacional {
  schema: string;
  versao?: string;
  limiteBytesGzip: number;
  municipios: EntradaIndiceNacional[];
}

/** Uma entrada de public/data/saeb/municipios/<ibge>/escolas-index.json. */
export interface EntradaIndiceMunicipal {
  codigoInep: string;
  nome: string;
  rede: string;
  /** Nome do arquivo de partição que contém esta escola — ex.: "002.json". */
  particao: string;
}

/** Wire shape de public/data/saeb/municipios/<ibge>/escolas-index.json — só existe quando particoes > 1. */
export interface IndiceMunicipal {
  schema: string;
  versao?: string;
  codigoIbge: string;
  municipio: Municipio;
  escolas: EntradaIndiceMunicipal[];
}

/** Wire shape de public/data/saeb/municipios/<ibge>/particoes/NNN.json. */
export interface Particao {
  schema: string;
  versao?: string;
  municipio: Municipio;
  escolas: Escola[];
}
