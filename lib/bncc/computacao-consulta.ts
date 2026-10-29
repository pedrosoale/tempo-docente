// Consulta PÚBLICA ao catálogo "Computação na Educação Básica — Complemento à BNCC" (/bncc/computacao).
//
// Camada fina sobre lib/bncc/computacao.ts (que continua sendo a única dona dos dados): aqui ficam só
// (1) a leitura segura dos parâmetros de URL, (2) a filtragem/busca e (3) a projeção dos registros nos
// campos que a interface pode mostrar. Nada daqui faz rede ou lê o sistema de arquivos, e o componente
// visual não repete nenhuma dessa lógica.
//
// Nunca é exposto à interface: id_interno, hashes, páginas do PDF, URL/SHA do documento e demais
// campos técnicos do gerador. `codigo` é sempre o código oficial; o literal impresso na fonte só
// aparece quando difere do código registrado (hoje, só EF05CO11).
import {
  ESCOPOS_COMPUTACAO,
  codigoImpressoNaFonte,
  listarCompetenciasEspecificas,
  listarHabilidades,
  listarPremissas,
  obterMetadados,
  type CompetenciaEspecificaComputacao,
  type EixoComputacao,
  type EscopoComputacao,
  type HabilidadeComputacao,
  type PremissaComputacao,
} from "./computacao.ts";
import { normalizeSearchText } from "./search.mjs";

export type { EscopoComputacao };

// --------------------------------------------------------------------------------------------------
// Vocabulário de URL (slugs ASCII estáveis; o rótulo exibido vem sempre dos dados)
// --------------------------------------------------------------------------------------------------
export const ETAPA_TODAS = "todas";

export const ETAPAS_URL: { valor: EscopoComputacao; rotulo: string }[] = [
  { valor: "educacao-infantil", rotulo: "Educação Infantil" },
  { valor: "anos-iniciais", rotulo: "Anos Iniciais do Ensino Fundamental" },
  { valor: "anos-finais", rotulo: "Anos Finais do Ensino Fundamental" },
  { valor: "ensino-medio", rotulo: "Ensino Médio" },
];

export const EIXOS_URL: { valor: string; rotulo: EixoComputacao }[] = [
  { valor: "pensamento-computacional", rotulo: "Pensamento Computacional" },
  { valor: "mundo-digital", rotulo: "Mundo Digital" },
  { valor: "cultura-digital", rotulo: "Cultura Digital" },
];

export const TAMANHO_MAXIMO_BUSCA = 120;
/** Resultados por página (fixo): 141 itens = 6 páginas de até 24. */
export const TAMANHO_PAGINA = 24;

// --------------------------------------------------------------------------------------------------
// Projeção pública
// --------------------------------------------------------------------------------------------------
export interface ItemPublicoComputacao {
  /** Código OFICIAL (ex.: "EF05CO11"). */
  codigo: string;
  escopo: EscopoComputacao;
  /** "Educação Infantil", "Ensino Fundamental · Anos Iniciais", "Ensino Fundamental · Anos Finais" ou "Ensino Médio". */
  etapaRotulo: string;
  /** "Objetivo de aprendizagem e desenvolvimento" (Educação Infantil) ou "Habilidade". */
  natureza: "Objetivo de aprendizagem e desenvolvimento" | "Habilidade";
  texto: string;
  /** Rótulo de agrupamento: etapa (EI), ano ou bloco de anos (EF) ou competência específica (EM). */
  grupo: string;
  eixo: string | null;
  /** Objeto de conhecimento (e, no 6º ao 9º ano, o segundo nível impresso sob o mesmo cabeçalho). */
  objeto: string | null;
  competenciaEspecifica: number | null;
  explicacao: string | null;
  exemplos: string[];
  /** Códigos de outros componentes que o documento diz estarem em relação direta (nunca equivalência). */
  relacoes: string[];
  /** Notas sobre peculiaridades do documento oficial (ex.: explicação e exemplo possivelmente trocados). */
  notasDoDocumento: string[];
  /** Literal impresso na fonte quando difere do código oficial registrado. */
  codigoImpresso: string | null;
  /** Normalizações tipográficas feitas na transcrição deste registro (palavra quebrada sem hífen, marcador de continuação). */
  normalizacoes: string[];
  /** true quando algum termo da busca só aparece na explicação ou nos exemplos. */
  encontradoSoEmApoio: boolean;
}

function escopoDe(h: HabilidadeComputacao): EscopoComputacao {
  if (h.etapa === "Educação Infantil") return "educacao-infantil";
  if (h.etapa === "Ensino Médio") return "ensino-medio";
  return h.segmento === "Anos Finais" ? "anos-finais" : "anos-iniciais";
}

const ROTULO_ETAPA: Record<EscopoComputacao, string> = {
  "educacao-infantil": "Educação Infantil",
  "anos-iniciais": "Ensino Fundamental · Anos Iniciais",
  "anos-finais": "Ensino Fundamental · Anos Finais",
  "ensino-medio": "Ensino Médio",
};

function grupoDe(h: HabilidadeComputacao): string {
  if (h.etapa === "Educação Infantil") return "Educação Infantil";
  if (h.etapa === "Ensino Médio") return `Competência específica ${h.competencia_especifica}`;
  return h.ano ?? h.bloco_anos ?? "";
}

function objetoDe(h: HabilidadeComputacao): string | null {
  if (!h.objeto_conhecimento) return null;
  return h.objeto_conhecimento_nivel_2 ? `${h.objeto_conhecimento} › ${h.objeto_conhecimento_nivel_2}` : h.objeto_conhecimento;
}

const TEXTO_NORMALIZACAO: Record<string, string> = {
  // C1 (código EF05CO011) é tratado por codigoImpresso; aqui só as correções que não alteram nem o código nem o texto da habilidade.
  C2: "Normalização: no documento, o objeto de conhecimento aparece com a palavra “responsabilidade” quebrada entre duas linhas (“responsabilidad” e “e”); aqui ela está escrita por inteiro.",
  C3: "Normalização: no documento, as células de objeto de conhecimento desta linha trazem o marcador de continuação de tabela “(cont.)”; ele foi omitido aqui.",
};

function normalizacoesDe(h: HabilidadeComputacao): string[] {
  const meta = obterMetadados(escopoDe(h)) as unknown as {
    correcoes_tipograficas: { id: string; registros: string[] }[];
    marcadores_de_continuacao_removidos?: { id: string; registros: string[] }[];
  };
  const todas = [...meta.correcoes_tipograficas, ...(meta.marcadores_de_continuacao_removidos ?? [])];
  return todas.filter((c) => c.registros.includes(h.codigo) && TEXTO_NORMALIZACAO[c.id]).map((c) => TEXTO_NORMALIZACAO[c.id]);
}

function projetar(h: HabilidadeComputacao, encontradoSoEmApoio = false): ItemPublicoComputacao {
  const impresso = codigoImpressoNaFonte(h.codigo);
  return {
    codigo: h.codigo,
    escopo: escopoDe(h),
    etapaRotulo: ROTULO_ETAPA[escopoDe(h)],
    natureza: h.tipo === "objetivo_aprendizagem" ? "Objetivo de aprendizagem e desenvolvimento" : "Habilidade",
    texto: h.texto,
    grupo: grupoDe(h),
    eixo: h.eixo,
    objeto: objetoDe(h),
    competenciaEspecifica: h.competencia_especifica,
    explicacao: h.explicacao,
    exemplos: h.exemplos,
    relacoes: h.relacoes_transversais.map((r) => r.codigo),
    notasDoDocumento: h.notas_documentais,
    codigoImpresso: impresso && impresso !== h.codigo ? impresso : null,
    normalizacoes: normalizacoesDe(h),
    encontradoSoEmApoio,
  };
}

// --------------------------------------------------------------------------------------------------
// Opções de ano/bloco (derivadas dos dados — nenhum ano é escrito à mão)
// --------------------------------------------------------------------------------------------------
export interface OpcaoAno {
  /** Valor na URL: "3" (um ano) ou "1-5" (bloco "1º ao 5º ano"). */
  valor: string;
  rotulo: string;
  escopo: EscopoComputacao;
  bloco: boolean;
}

function digitos(rotulo: string): number[] {
  return [...rotulo.matchAll(/\d+/g)].map((m) => Number(m[0]));
}

export function listarOpcoesAno(): OpcaoAno[] {
  const vistos = new Map<string, OpcaoAno>();
  for (const h of listarHabilidades()) {
    if (h.etapa !== "Ensino Fundamental") continue;
    const escopo = escopoDe(h);
    if (h.ano && !vistos.has(h.ano)) {
      vistos.set(h.ano, { valor: String(digitos(h.ano)[0]), rotulo: h.ano, escopo, bloco: false });
    }
    if (h.bloco_anos && !vistos.has(h.bloco_anos)) {
      const [de, ate] = digitos(h.bloco_anos);
      vistos.set(h.bloco_anos, { valor: `${de}-${ate}`, rotulo: h.bloco_anos, escopo, bloco: true });
    }
  }
  // Anos Iniciais antes dos Anos Finais; dentro de cada etapa, os anos em ordem e o bloco por último.
  const ordemEscopo = (o: OpcaoAno) => ESCOPOS_COMPUTACAO.indexOf(o.escopo);
  return [...vistos.values()].sort((a, b) => ordemEscopo(a) - ordemEscopo(b) || Number(a.bloco) - Number(b.bloco) || digitos(a.rotulo)[0] - digitos(b.rotulo)[0]);
}

export function listarNumerosCompetenciaMedio(): number[] {
  return [...new Set(listarHabilidades().map((h) => h.competencia_especifica).filter((n): n is number => n !== null))].sort((a, b) => a - b);
}

// --------------------------------------------------------------------------------------------------
// Leitura segura dos parâmetros
// --------------------------------------------------------------------------------------------------
export type ValoresBrutos = Record<string, string | string[] | undefined> | undefined | null;

export interface FiltrosComputacao {
  etapa: EscopoComputacao | typeof ETAPA_TODAS | null;
  ano: OpcaoAno | null;
  eixo: (typeof EIXOS_URL)[number] | null;
  competencia: number | null;
  q: string;
}

export interface ConsultaComputacao {
  filtros: FiltrosComputacao;
  /** Página pedida (1 quando ausente ou inválida); ainda não limitada ao total — ver paginar(). */
  pagina: number;
  /** Avisos sobre parâmetros repetidos, inválidos ou incompatíveis (cada um já ignorado/saneado). */
  avisos: string[];
  /** true quando algum filtro válido foi informado (senão a página mostra o resumo por etapa). */
  ativa: boolean;
}

/** Parâmetro repetido chega como array: usa SEMPRE o primeiro valor e informa que houve repetição. Nunca lança. */
function primeiro(valor: unknown): { valor: string | undefined; repetido: boolean } {
  if (Array.isArray(valor)) {
    const primeiroValor = valor.find((v) => typeof v === "string");
    return { valor: typeof primeiroValor === "string" ? primeiroValor : undefined, repetido: valor.length > 1 };
  }
  return { valor: typeof valor === "string" ? valor : undefined, repetido: false };
}

// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f]/g;

function curto(valor: string): string {
  const limpo = valor.replace(CONTROLE, " ").trim();
  return limpo.length > 40 ? `${limpo.slice(0, 40)}…` : limpo;
}

export function lerConsulta(brutos: ValoresBrutos): ConsultaComputacao {
  const avisos: string[] = [];
  const entrada: Record<string, unknown> = brutos && typeof brutos === "object" ? brutos : {};
  const ler = (nome: string) => {
    const r = primeiro(entrada[nome]);
    const valor = r.valor?.replace(CONTROLE, " ").trim();
    if (r.repetido) avisos.push(`O filtro “${nome}” foi informado mais de uma vez; foi usado apenas o primeiro valor.`);
    return valor ? valor : undefined;
  };

  // etapa
  let etapa: FiltrosComputacao["etapa"] = null;
  const etapaBruta = ler("etapa");
  if (etapaBruta) {
    const minuscula = etapaBruta.toLowerCase();
    if (minuscula === ETAPA_TODAS) etapa = ETAPA_TODAS;
    else if (ETAPAS_URL.some((e) => e.valor === minuscula)) etapa = minuscula as EscopoComputacao;
    else avisos.push(`A etapa “${curto(etapaBruta)}” não existe neste documento e foi ignorada.`);
  }

  // ano / bloco de anos
  let ano: OpcaoAno | null = null;
  const anoBruto = ler("ano");
  if (anoBruto) {
    const opcao = listarOpcoesAno().find((o) => o.valor === anoBruto);
    if (!opcao) avisos.push(`O ano “${curto(anoBruto)}” não existe neste documento e foi ignorado.`);
    else if (etapa && etapa !== ETAPA_TODAS && etapa !== opcao.escopo) {
      avisos.push(`O filtro de ano (${opcao.rotulo}) não se aplica à etapa escolhida e foi ignorado.`);
    } else ano = opcao;
  }

  // eixo
  let eixo: FiltrosComputacao["eixo"] = null;
  const eixoBruto = ler("eixo");
  if (eixoBruto) {
    const opcao = EIXOS_URL.find((e) => e.valor === eixoBruto.toLowerCase());
    if (!opcao) avisos.push(`O eixo “${curto(eixoBruto)}” não existe neste documento e foi ignorado.`);
    else if (etapa === "ensino-medio") avisos.push("O Ensino Médio não é organizado por eixos neste documento; o filtro de eixo foi ignorado.");
    else eixo = opcao;
  }

  // competência específica (só existe ligada às habilidades do Ensino Médio)
  let competencia: number | null = null;
  const competenciaBruta = ler("competencia");
  if (competenciaBruta) {
    const numero = /^\d{1,2}$/.test(competenciaBruta) ? Number(competenciaBruta) : NaN;
    if (!listarNumerosCompetenciaMedio().includes(numero)) avisos.push(`A competência “${curto(competenciaBruta)}” não existe neste documento e foi ignorada.`);
    else if (etapa && etapa !== ETAPA_TODAS && etapa !== "ensino-medio") {
      avisos.push("O filtro de competência específica só se aplica às habilidades do Ensino Médio e foi ignorado para a etapa escolhida.");
    } else competencia = numero;
  }

  // busca
  let q = ler("q") ?? "";
  if (q.length > TAMANHO_MAXIMO_BUSCA) {
    q = q.slice(0, TAMANHO_MAXIMO_BUSCA).trim();
    avisos.push(`A busca foi limitada a ${TAMANHO_MAXIMO_BUSCA} caracteres.`);
  }

  // página (inteiro positivo; qualquer outra coisa — negativo, zero, decimal, texto — volta à primeira)
  let pagina = 1;
  const paginaBruta = ler("pagina");
  if (paginaBruta) {
    const numero = /^\d{1,6}$/.test(paginaBruta) ? Number(paginaBruta) : NaN;
    if (Number.isInteger(numero) && numero >= 1) pagina = numero;
    else avisos.push(`A página “${curto(paginaBruta)}” não é válida; foi mostrada a primeira.`);
  }

  const filtros: FiltrosComputacao = { etapa, ano, eixo, competencia, q };
  return { filtros, pagina, avisos, ativa: etapa !== null || ano !== null || eixo !== null || competencia !== null || q !== "" };
}

/** Query string canônica e estável (ordem fixa) de um conjunto de filtros — para links compartilháveis. */
export function montarQueryString(filtros: Partial<FiltrosComputacao>, pagina = 1): string {
  const p = new URLSearchParams();
  if (filtros.etapa) p.set("etapa", filtros.etapa);
  if (filtros.ano) p.set("ano", filtros.ano.valor);
  if (filtros.eixo) p.set("eixo", filtros.eixo.valor);
  if (filtros.competencia) p.set("competencia", String(filtros.competencia));
  if (filtros.q) p.set("q", filtros.q);
  if (pagina > 1) p.set("pagina", String(pagina));
  const s = p.toString();
  return s ? `?${s}` : "";
}

// --------------------------------------------------------------------------------------------------
// Execução
// --------------------------------------------------------------------------------------------------
function termos(texto: string): string[] {
  return normalizeSearchText(texto).split(" ").filter(Boolean);
}

export function buscar(filtros: FiltrosComputacao): ItemPublicoComputacao[] {
  const t = termos(filtros.q);
  // Uma busca igual ao literal impresso de um código corrigido (ex.: "EF05CO011") leva ao registro
  // correspondente, sem tratar o literal como código válido nem como prefixo de outros.
  const literal = t.length === 1 ? listarHabilidades().find((h) => normalizeSearchText(codigoImpressoNaFonte(h.codigo) ?? "") === t[0] && h.codigo !== codigoImpressoNaFonte(h.codigo)) : undefined;

  const saida: ItemPublicoComputacao[] = [];
  for (const h of listarHabilidades()) {
    const escopo = escopoDe(h);
    if (filtros.etapa && filtros.etapa !== ETAPA_TODAS && escopo !== filtros.etapa) continue;
    if (filtros.ano) {
      const confere = filtros.ano.bloco ? h.bloco_anos === filtros.ano.rotulo : h.ano === filtros.ano.rotulo || (h.anos_aplicaveis ?? []).includes(filtros.ano.rotulo);
      if (!confere) continue;
    }
    if (filtros.eixo && h.eixo !== filtros.eixo.rotulo) continue;
    if (filtros.competencia !== null && h.competencia_especifica !== filtros.competencia) continue;

    let soEmApoio = false;
    if (t.length > 0) {
      if (literal) {
        if (h.codigo !== literal.codigo) continue;
      } else {
        const principal = normalizeSearchText([h.codigo, h.texto, h.objeto_conhecimento, h.objeto_conhecimento_nivel_2].filter(Boolean).join(" "));
        const apoio = normalizeSearchText([h.explicacao, ...h.exemplos].filter(Boolean).join(" "));
        const todos = `${principal} ${apoio}`;
        if (!t.every((x) => todos.includes(x))) continue;
        soEmApoio = !t.every((x) => principal.includes(x));
      }
    }
    saida.push(projetar(h, soEmApoio));
  }
  return saida;
}

export interface GrupoResultado {
  rotulo: string;
  /** Etapa e natureza dos itens do grupo, ex.: "Ensino Fundamental · Anos Iniciais · habilidades". */
  contexto: string;
  itens: ItemPublicoComputacao[];
}

/** Agrupa na ordem em que os grupos aparecem (a do catálogo: por código). */
export function agruparResultados(itens: ItemPublicoComputacao[]): GrupoResultado[] {
  const grupos: GrupoResultado[] = [];
  for (const item of itens) {
    const ultimo = grupos[grupos.length - 1];
    if (ultimo && ultimo.rotulo === item.grupo && ultimo.contexto.startsWith(item.etapaRotulo)) ultimo.itens.push(item);
    else {
      const natureza = item.natureza === "Habilidade" ? "habilidades" : "objetivos de aprendizagem e desenvolvimento";
      grupos.push({ rotulo: item.grupo, contexto: `${item.etapaRotulo} · ${natureza}`, itens: [item] });
    }
  }
  return grupos;
}

export interface PaginaDeResultados<T> {
  itens: T[];
  /** Página efetivamente mostrada (a pedida, limitada a 1..totalPaginas). */
  pagina: number;
  totalPaginas: number;
  total: number;
  /** Intervalo mostrado, 1-based e inclusivo; 0–0 quando não há resultados. */
  de: number;
  ate: number;
  /** Aviso quando a página pedida excedia o total e foi trazida de volta à última. */
  aviso: string | null;
}

/** Recorte de uma página de resultados. Nunca lança: página fora do intervalo é limitada. */
export function paginar<T>(itens: T[], paginaPedida: number, tamanho = TAMANHO_PAGINA): PaginaDeResultados<T> {
  const total = itens.length;
  const totalPaginas = Math.max(1, Math.ceil(total / tamanho));
  const pedida = Number.isFinite(paginaPedida) && paginaPedida >= 1 ? Math.floor(paginaPedida) : 1;
  const pagina = Math.min(pedida, totalPaginas);
  const inicio = (pagina - 1) * tamanho;
  const fatia = itens.slice(inicio, inicio + tamanho);
  return {
    itens: fatia,
    pagina,
    totalPaginas,
    total,
    de: total === 0 ? 0 : inicio + 1,
    ate: total === 0 ? 0 : inicio + fatia.length,
    aviso: pedida > totalPaginas ? `A página ${pedida} não existe (há ${totalPaginas}); foi mostrada a última.` : null,
  };
}

export function contarPorEtapa(): { escopo: EscopoComputacao; rotulo: string; total: number }[] {
  const habilidades = listarHabilidades();
  return ETAPAS_URL.map((e) => ({ escopo: e.valor, rotulo: e.rotulo, total: habilidades.filter((h) => escopoDe(h) === e.valor).length }));
}

export function descreverSelecao(filtros: FiltrosComputacao): string[] {
  const partes: string[] = [];
  if (filtros.etapa === ETAPA_TODAS) partes.push("Todas as etapas");
  else if (filtros.etapa) partes.push(ETAPAS_URL.find((e) => e.valor === filtros.etapa)?.rotulo ?? "");
  if (filtros.ano) partes.push(filtros.ano.rotulo);
  if (filtros.eixo) partes.push(`Eixo ${filtros.eixo.rotulo}`);
  if (filtros.competencia !== null) partes.push(`Competência específica ${filtros.competencia}`);
  if (filtros.q) partes.push(`Busca: “${filtros.q}”`);
  return partes.filter(Boolean);
}

// --------------------------------------------------------------------------------------------------
// Premissas, competências e fontes (consolidadas: cada item oficial aparece uma única vez)
// --------------------------------------------------------------------------------------------------
export interface CompetenciaPublica {
  numero: number;
  texto: string;
  /** Texto repetido no quadro de habilidades quando o documento o imprime diferente do da lista. */
  textoNoQuadro: string | null;
}

function publicarCompetencia(c: CompetenciaEspecificaComputacao): CompetenciaPublica {
  return {
    numero: c.numero,
    texto: c.texto,
    textoNoQuadro: c.textos_divergem && c.texto_no_quadro_de_habilidades ? c.texto_no_quadro_de_habilidades : null,
  };
}

export function obterCompetenciasEnsinoFundamental(): CompetenciaPublica[] {
  return listarCompetenciasEspecificas("Ensino Fundamental").map(publicarCompetencia).sort((a, b) => a.numero - b.numero);
}

export function obterCompetenciasEnsinoMedio(): CompetenciaPublica[] {
  return listarCompetenciasEspecificas("Ensino Médio").map(publicarCompetencia).sort((a, b) => a.numero - b.numero);
}

export function obterPremissas(): { introducao: string | null; itens: { numero: number; texto: string }[] } {
  const intro = obterMetadados("educacao-infantil").premissas_introducao as { texto?: string } | null | undefined;
  const itens = listarPremissas()
    .map((p: PremissaComputacao) => ({ numero: p.numero, texto: p.texto }))
    .sort((a, b) => a.numero - b.numero);
  return { introducao: intro?.texto ?? null, itens };
}

export interface FontePublica {
  titulo: string;
  url: string;
  papel: "tabelas" | "normativo";
}

/** Fontes oficiais (gov.br/MEC) citadas pelo catálogo — sem hashes nem datas de coleta. */
export function obterFontesPublicas(): FontePublica[] {
  const fontes = obterMetadados(ESCOPOS_COMPUTACAO[0]).fontes;
  const mapa: Record<string, FontePublica["papel"] | undefined> = {
    "anexo-parecer-ceb-2-2022": "tabelas",
    "parecer-ceb-2-2022": "normativo",
    "resolucao-ceb-1-2022": "normativo",
  };
  return fontes.filter((f) => mapa[f.id]).map((f) => ({ titulo: f.titulo, url: f.url, papel: mapa[f.id] as FontePublica["papel"] }));
}
