// Biblioteca INTERNA do catálogo "Computação na Educação Básica — Complemento à BNCC" (nome curto
// interno: "BNCC Computação"). Importa os quatro catálogos gerados como módulos estáticos — nenhuma
// consulta aqui faz rede ou lê o sistema de arquivos.
//
// data/bncc/computacao-<escopo>.json é gerado por scripts/bncc-computacao/gerar.mjs a partir das fontes
// auditadas em data/bncc/source/official-mec-bncc-computacao-<escopo>.json — nunca editar os arquivos
// gerados. Ver data/bncc/README.md ("Computação na Educação Básica — Complemento à BNCC").
//
// NÃO INTEGRADA À INTERFACE: este módulo não é importado por lib/bncc/data.ts, pela busca da homepage,
// por /bncc, pelo sitemap nem por nenhuma página. A busca pública existente continua sem retornar
// resultados de Computação até que haja uma decisão de interface posterior.
//
// DISTINÇÕES QUE ESTE MÓDULO PRESERVA (nunca unificar):
//   - É o complemento NACIONAL à BNCC (Resolução CNE/CEB nº 1/2022) — não é currículo estadual ou
//     municipal, não é a matriz do SAEB e não é habilidade de Língua Portuguesa.
//   - `codigo` é o código OFICIAL (ex.: "EF01CO01"); `id_interno` é um identificador técnico deste catálogo
//     ("computacao.ef01co01") e NUNCA um código oficial — buscarPorCodigo jamais aceita um id_interno.
//   - Habilidade/objetivo (campo `texto`), explicação, exemplos e relações transversais ficam em campos
//     separados; buscar pelo texto da habilidade não alcança explicações nem exemplos.
//   - Relações transversais (ex.: "Possui relação direta com (EM13MAT315)") são relações indicadas pela
//     fonte, NUNCA equivalência entre a habilidade de Computação e a de outro componente.
import anosFinais from "../../data/bncc/computacao-anos-finais.json" with { type: "json" };
import anosIniciais from "../../data/bncc/computacao-anos-iniciais.json" with { type: "json" };
import educacaoInfantil from "../../data/bncc/computacao-educacao-infantil.json" with { type: "json" };
import ensinoMedio from "../../data/bncc/computacao-ensino-medio.json" with { type: "json" };
import { normalizeSearchText } from "./search.mjs";

export type EscopoComputacao = "educacao-infantil" | "anos-iniciais" | "anos-finais" | "ensino-medio";
export type EtapaComputacao = "Educação Infantil" | "Ensino Fundamental" | "Ensino Médio";
export type SegmentoComputacao = "Anos Iniciais" | "Anos Finais";
export type EixoComputacao = "Pensamento Computacional" | "Mundo Digital" | "Cultura Digital";

export interface RelacaoTransversal {
  /** Código de OUTRO componente da BNCC citado pela fonte (ex.: "EM13MAT315"). Nunca equivale à habilidade. */
  codigo: string;
  natureza: "relacao_direta_indicada_pela_fonte";
  trecho_na_fonte: string;
  campo_na_fonte: "EXEMPLOS";
}

interface CamposComuns {
  id_interno: string;
  etapa: EtapaComputacao;
  documento_fonte: string;
  documento_url: string;
  documento_sha256: string;
  pagina_fonte: number;
  pagina_impressa: number;
  quadro_fonte: string;
}

/** Habilidade (Ensino Fundamental e Médio) ou objetivo de aprendizagem (Educação Infantil). */
export interface HabilidadeComputacao extends CamposComuns {
  tipo: "habilidade" | "objetivo_aprendizagem";
  /** Código OFICIAL (ex.: "EF05CO11"). */
  codigo: string;
  segmento: SegmentoComputacao | null;
  ano: string | null;
  anos_aplicaveis: string[] | null;
  bloco_anos: string | null;
  eixo: EixoComputacao | null;
  competencia_especifica: number | null;
  objeto_conhecimento: string | null;
  objeto_conhecimento_nivel_2: string | null;
  enunciado_agrupador: string | null;
  texto: string;
  explicacao: string | null;
  exemplos: string[];
  relacoes_transversais: RelacaoTransversal[];
  notas_documentais: string[];
  pagina_fonte_complemento: number;
  pagina_impressa_complemento: number;
}

export interface CompetenciaEspecificaComputacao extends CamposComuns {
  tipo: "competencia_especifica";
  codigo: null;
  numero: number;
  texto: string;
  texto_no_quadro_de_habilidades?: string;
  textos_divergem?: boolean;
}

export interface PremissaComputacao extends CamposComuns {
  tipo: "premissa";
  codigo: null;
  numero: number;
  texto: string;
}

export type RegistroComputacao = HabilidadeComputacao | CompetenciaEspecificaComputacao | PremissaComputacao;

export interface MetadadosComputacao {
  escopo: EscopoComputacao;
  nome_oficial: string;
  nome_curto: string;
  publicado_na_interface: false;
  total_registros: number;
  total_habilidades_e_objetivos: number;
  fontes: { id: string; titulo: string; url: string; sha256: string; tamanho_bytes: number; papel: string; acessado_em: string }[];
  fontes_indisponiveis: { url: string; motivo: string; equivalente_oficial: string | null }[];
  correcoes_tipograficas: { id: string; registros: string[]; impresso_na_fonte: string; corrigido: string }[];
  divergencias_documentais: { id: string; natureza: string; descricao: string }[];
  [chave: string]: unknown;
}

interface CatalogoComputacao {
  metadata: MetadadosComputacao;
  registros: RegistroComputacao[];
}

const CATALOGOS: Record<EscopoComputacao, CatalogoComputacao> = {
  "educacao-infantil": educacaoInfantil as unknown as CatalogoComputacao,
  "anos-iniciais": anosIniciais as unknown as CatalogoComputacao,
  "anos-finais": anosFinais as unknown as CatalogoComputacao,
  "ensino-medio": ensinoMedio as unknown as CatalogoComputacao,
};

export const ESCOPOS_COMPUTACAO: EscopoComputacao[] = ["educacao-infantil", "anos-iniciais", "anos-finais", "ensino-medio"];
export const NOME_OFICIAL_COMPUTACAO = "Computação na Educação Básica — Complemento à BNCC";
export const NOME_CURTO_COMPUTACAO = "BNCC Computação";

const ehHabilidade = (r: RegistroComputacao): r is HabilidadeComputacao => r.tipo === "habilidade" || r.tipo === "objetivo_aprendizagem";
const norm = (valor: string) => normalizeSearchText(valor);

// --------------------------------------------------------------------------------------------------
// Listagens
// --------------------------------------------------------------------------------------------------

/** Todos os registros dos quatro catálogos (habilidades, objetivos, competências e premissas), na ordem dos arquivos. */
export function listarTodosRegistros(): RegistroComputacao[] {
  return ESCOPOS_COMPUTACAO.flatMap((e) => CATALOGOS[e].registros);
}

/** Habilidades do Fundamental e do Médio + objetivos de aprendizagem da Educação Infantil (141 registros). */
export function listarHabilidades(): HabilidadeComputacao[] {
  return listarTodosRegistros().filter(ehHabilidade);
}

/** Competências específicas. As 7 do Ensino Fundamental aparecem nos dois arquivos do EF; esta função as devolve uma única vez. */
export function listarCompetenciasEspecificas(etapa?: EtapaComputacao): CompetenciaEspecificaComputacao[] {
  const vistos = new Set<string>();
  const saida: CompetenciaEspecificaComputacao[] = [];
  for (const r of listarTodosRegistros()) {
    if (r.tipo !== "competencia_especifica" || vistos.has(r.id_interno)) continue;
    if (etapa && r.etapa !== etapa) continue;
    vistos.add(r.id_interno);
    saida.push(r);
  }
  return saida;
}

export function listarPremissas(): PremissaComputacao[] {
  return listarTodosRegistros().filter((r): r is PremissaComputacao => r.tipo === "premissa");
}

// --------------------------------------------------------------------------------------------------
// Filtros (sempre sobre habilidades/objetivos)
// --------------------------------------------------------------------------------------------------
export function filtrarPorEtapa(etapa: EtapaComputacao): HabilidadeComputacao[] {
  return listarHabilidades().filter((h) => h.etapa === etapa);
}

export function filtrarPorSegmento(segmento: SegmentoComputacao): HabilidadeComputacao[] {
  return listarHabilidades().filter((h) => h.segmento === segmento);
}

/** Habilidades de UM ano específico (ex.: "3º ano"). Os blocos "1º ao 5º ano"/"6º ao 9º ano" só entram com `incluirBlocos`. */
export function filtrarPorAno(ano: string, { incluirBlocos = false }: { incluirBlocos?: boolean } = {}): HabilidadeComputacao[] {
  const alvo = norm(ano);
  return listarHabilidades().filter((h) => (h.ano !== null && norm(h.ano) === alvo) || (incluirBlocos && h.bloco_anos !== null && (h.anos_aplicaveis ?? []).some((a) => norm(a) === alvo)));
}

/** Habilidades de um bloco de anos (ex.: "1º ao 5º ano", "6º ao 9º ano"). */
export function filtrarPorBlocoDeAnos(bloco: string): HabilidadeComputacao[] {
  const alvo = norm(bloco);
  return listarHabilidades().filter((h) => h.bloco_anos !== null && norm(h.bloco_anos) === alvo);
}

export function filtrarPorEixo(eixo: string): HabilidadeComputacao[] {
  const alvo = norm(eixo);
  return listarHabilidades().filter((h) => h.eixo !== null && norm(h.eixo) === alvo);
}

/** Pelo objeto de conhecimento do primeiro nível (ou, com `incluirNivel2`, também pelo segundo nível dos quadros do 6º ao 9º ano). */
export function filtrarPorObjetoDeConhecimento(objeto: string, { incluirNivel2 = false }: { incluirNivel2?: boolean } = {}): HabilidadeComputacao[] {
  const alvo = norm(objeto);
  return listarHabilidades().filter(
    (h) => (h.objeto_conhecimento !== null && norm(h.objeto_conhecimento) === alvo) || (incluirNivel2 && h.objeto_conhecimento_nivel_2 !== null && norm(h.objeto_conhecimento_nivel_2) === alvo),
  );
}

/** Habilidades do Ensino Médio de uma competência específica (1 a 7). */
export function filtrarPorCompetenciaEspecifica(numero: number): HabilidadeComputacao[] {
  return listarHabilidades().filter((h) => h.competencia_especifica === numero);
}

// --------------------------------------------------------------------------------------------------
// Buscas
// --------------------------------------------------------------------------------------------------
/** Busca por CÓDIGO OFICIAL exato ("EF01CO01"; maiúsculas/minúsculas e espaços nas bordas são ignorados). Nunca aceita id_interno. */
export function buscarPorCodigo(codigo: string): HabilidadeComputacao | undefined {
  const alvo = codigo.trim().toUpperCase();
  return listarHabilidades().find((h) => h.codigo === alvo);
}

/** Busca por identificador INTERNO ("computacao.ef01co01"). Não é um código oficial. */
export function buscarPorIdInterno(idInterno: string): RegistroComputacao | undefined {
  return listarTodosRegistros().find((r) => r.id_interno === idInterno);
}

export function ehCodigoOficial(valor: string): boolean {
  return buscarPorCodigo(valor) !== undefined;
}

function termos(consulta: string): string[] {
  return norm(consulta).split(" ").filter(Boolean);
}

/** Busca (sem acentos, sem diferenciar maiúsculas, todos os termos) SOMENTE no texto da habilidade/objetivo. Não alcança explicações nem exemplos. */
export function buscarPorTexto(consulta: string): HabilidadeComputacao[] {
  const t = termos(consulta);
  if (t.length === 0) return [];
  return listarHabilidades().filter((h) => {
    const alvo = norm(h.texto);
    return t.every((x) => alvo.includes(x));
  });
}

/** Busca SOMENTE na explicação da habilidade — só quando pedida explicitamente. */
export function buscarPorExplicacao(consulta: string): HabilidadeComputacao[] {
  const t = termos(consulta);
  if (t.length === 0) return [];
  return listarHabilidades().filter((h) => h.explicacao !== null && t.every((x) => norm(h.explicacao as string).includes(x)));
}

/** Busca SOMENTE nos exemplos — só quando pedida explicitamente. */
export function buscarPorExemplos(consulta: string): HabilidadeComputacao[] {
  const t = termos(consulta);
  if (t.length === 0) return [];
  return listarHabilidades().filter((h) => {
    const alvo = norm(h.exemplos.join(" "));
    return t.every((x) => alvo.includes(x));
  });
}

// --------------------------------------------------------------------------------------------------
// Proveniência
// --------------------------------------------------------------------------------------------------
export function obterMetadados(escopo: EscopoComputacao): MetadadosComputacao {
  return CATALOGOS[escopo].metadata;
}

/** Relações transversais indicadas pela fonte para um código (nunca equivalência). */
export function obterRelacoesTransversais(codigo: string): RelacaoTransversal[] {
  return buscarPorCodigo(codigo)?.relacoes_transversais ?? [];
}

/** Código tal como está IMPRESSO na fonte quando houve correção documentada (ex.: "EF05CO11" → "EF05CO011"); senão o próprio código. */
export function codigoImpressoNaFonte(codigo: string): string | null {
  const h = buscarPorCodigo(codigo);
  if (!h) return null;
  for (const e of ESCOPOS_COMPUTACAO) {
    const c = CATALOGOS[e].metadata.correcoes_tipograficas.find((x) => x.registros.includes(h.codigo) && x.id === "C1");
    if (c) return c.impresso_na_fonte;
  }
  return h.codigo;
}
