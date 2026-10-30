// Normalização da busca da página principal /bncc (parâmetro `q`).
//
// Função pura e determinística, sem dependências: `searchParams.q` pode chegar como string, array
// (parâmetro repetido: ?q=a&q=b), undefined ou até um formato inesperado — e nenhum deles pode derrubar a página.
// O limite acompanha o da consulta própria (TAMANHO_MAXIMO_BUSCA em lib/bncc/computacao-consulta.ts).
export const TAMANHO_MAXIMO_BUSCA_HUB = 120;

export interface BuscaHub {
  /** Busca efetivamente usada (limpa, aparada e com no máximo 120 caracteres). "" quando não há busca. */
  q: string;
  /** Avisos visíveis, em português, sobre repetição ou truncamento. */
  avisos: string[];
}

// eslint-disable-next-line no-control-regex
const CONTROLE = /[\u0000-\u001f\u007f-\u009f]/g;

/** Normaliza o valor bruto de `q`. Nunca lança e nunca devolve um tipo diferente de string em `q`. */
export function normalizarBuscaHub(bruto: unknown): BuscaHub {
  const avisos: string[] = [];
  let texto: string | undefined;

  if (Array.isArray(bruto)) {
    texto = bruto.find((valor): valor is string => typeof valor === "string");
    if (bruto.length > 1) avisos.push("O filtro “q” foi informado mais de uma vez; foi usado apenas o primeiro valor.");
  } else if (typeof bruto === "string") {
    texto = bruto;
  }

  let q = (texto ?? "").replace(CONTROLE, " ").trim();
  if (q.length > TAMANHO_MAXIMO_BUSCA_HUB) {
    q = q.slice(0, TAMANHO_MAXIMO_BUSCA_HUB).trim();
    avisos.push(`A busca foi limitada a ${TAMANHO_MAXIMO_BUSCA_HUB} caracteres.`);
  }
  return { q, avisos };
}

/**
 * Lê `q` dos searchParams da página. Só a propriedade PRÓPRIA `q` conta: `q[]`, `__proto__`, `constructor`
 * e qualquer outra chave inesperada nunca viram busca (nem herdam valor do protótipo).
 */
export function lerBuscaHub(parametros: unknown): BuscaHub {
  if (parametros === null || typeof parametros !== "object") return normalizarBuscaHub(undefined);
  const bruto = Object.prototype.hasOwnProperty.call(parametros, "q") ? (parametros as Record<string, unknown>).q : undefined;
  return normalizarBuscaHub(bruto);
}
