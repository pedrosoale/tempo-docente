// Normalização determinística dos valores das planilhas oficiais.
//
// A regra central: ausência nunca vira zero, e ausência nunca vira `null` genérico.
// O rodapé das próprias planilhas do Inep define cinco marcadores distintos, e o
// professor precisa da diferença entre "a escola não participou o suficiente" e
// "a escola pediu para não divulgar". Cada marcador vira um estado nomeado com o
// texto oficial correspondente.

export class NormalizeError extends Error {
  constructor(message) {
    super(message);
    this.name = "NormalizeError";
  }
}

/**
 * Marcadores de ausência, exatamente como o rodapé oficial os define.
 * A ordem importa na detecção: "ND***" precisa ser testado antes de "ND".
 */
export const MARCADORES_AUSENCIA = [
  {
    marcador: "ND***",
    estado: "nao_divulgado_material_extraviado",
    motivo: "Escola com pelo menos 20% do material extraviado, com participação insuficiente para divulgação dos resultados",
  },
  {
    marcador: "ND**",
    estado: "nao_divulgado_a_pedido",
    motivo: "Não divulgado por solicitação da Secretaria ou da escola, por situações adversas no momento da aplicação",
  },
  {
    marcador: "ND*",
    estado: "nao_divulgado_por_norma",
    motivo: "Solicitação de não divulgação conforme Portaria Inep nº 410, de 3 de novembro de 2011, ou Portaria Inep nº 304, de 24 de junho de 2013",
  },
  {
    marcador: "ND",
    estado: "participacao_insuficiente",
    motivo: "Número de participantes no SAEB insuficiente para que os resultados sejam divulgados",
  },
  {
    marcador: "-",
    estado: "ausente",
    motivo: "Sem resultado nesta edição: etapa não avaliada, ou escola inexistente ou sem a etapa na ocasião",
  },
];

const POR_MARCADOR = new Map(MARCADORES_AUSENCIA.map((item) => [item.marcador, item]));

// Sufixo oficial: média calculada a partir de avaliação estadual, por extravio
// de provas. A legenda do rodapé escreve "(*)", mas nas células o marcador vem
// como um asterisco solto no fim do número — "187,89*". Confirmado varrendo o
// vocabulário completo das três planilhas de 2025.
const SUFIXO_AVALIACAO_ESTADUAL = "*";
export const OBSERVACAO_AVALIACAO_ESTADUAL =
  "Média calculada a partir dos resultados dos alunos nas avaliações estaduais, em decorrência do extravio de provas e impossibilidade do cálculo da proficiência para o SAEB";

/**
 * Converte o texto de uma célula de indicador em um dos três resultados:
 *
 *   { tipo: "valor",   valor: number, observacao?: string }
 *   { tipo: "ausente", estado: string, motivo: string }
 *   { tipo: "vazio" }                       // célula inexistente na planilha
 *
 * Qualquer outro conteúdo derruba o importador. Um token desconhecido é sinal de
 * que a estrutura da fonte mudou, e adivinhar seria pior do que parar.
 */
export function normalizarIndicador(bruto, contexto = "") {
  if (bruto === undefined || bruto === null) return { tipo: "vazio" };

  // Uma célula pode chegar como string crua (usada nos testes e em fixtures) ou
  // como `{ valor, numerico }` vindo do leitor de XLSX. O tipo importa: célula
  // numérica traz a serialização canônica de um double, que legitimamente usa
  // notação científica — "3.7999999999999999E-2" é 0,038, não um valor suspeito.
  // Célula de texto traz o que uma pessoa digitou, e aí notação científica ou
  // separador de milhar são sinal de que a fonte mudou de forma.
  const celula = typeof bruto === "object" ? bruto : { valor: bruto, numerico: false };

  let texto = String(celula.valor).trim();
  if (texto === "") return { tipo: "vazio" };

  if (celula.numerico) {
    const numero = Number(texto);
    if (!Number.isFinite(numero)) {
      throw new NormalizeError(
        `célula numérica com valor não finito: ${JSON.stringify(texto)}${contexto ? ` em ${contexto}` : ""}`,
      );
    }
    return { tipo: "valor", valor: numero };
  }

  // Os marcadores de ausência são testados ANTES do sufixo, e por correspondência
  // exata. A ordem não é cosmética: "ND*" termina em asterisco, e despi-lo
  // primeiro transformaria "não divulgado por norma" em "participação
  // insuficiente" — dois motivos oficiais distintos, com significados distintos
  // para quem lê.
  const ausencia = POR_MARCADOR.get(texto);
  if (ausencia) {
    return { tipo: "ausente", estado: ausencia.estado, motivo: ausencia.motivo };
  }

  let observacao;
  if (texto.endsWith(SUFIXO_AVALIACAO_ESTADUAL)) {
    const semSufixo = texto.slice(0, -SUFIXO_AVALIACAO_ESTADUAL.length).trim();
    // Só é sufixo de nota se o que sobra for de fato um número. Caso contrário,
    // deixa passar para normalizarNumero, que recusa o token desconhecido.
    if (/^-?\d+(?:[.,]\d+)?$/.test(semSufixo)) {
      observacao = OBSERVACAO_AVALIACAO_ESTADUAL;
      texto = semSufixo;
    }
  }

  const numero = normalizarNumero(texto, contexto);
  return observacao ? { tipo: "valor", valor: numero, observacao } : { tipo: "valor", valor: numero };
}

/**
 * Aceita ponto ou vírgula como separador decimal — a planilha usa os dois,
 * porque parte dos valores está gravada como texto. Recusa separador de milhar,
 * notação científica e qualquer coisa que não seja um decimal simples: converter
 * "1.234" adivinhando se é mil duzentos e trinta e quatro ou um vírgula dois
 * seria uma decisão silenciosa sobre o dado.
 */
export function normalizarNumero(texto, contexto = "") {
  const valor = String(texto).trim();
  if (!/^-?\d+(?:[.,]\d+)?$/.test(valor)) {
    throw new NormalizeError(
      `valor numérico não reconhecido: ${JSON.stringify(texto)}${contexto ? ` em ${contexto}` : ""}`,
    );
  }
  const numero = Number.parseFloat(valor.replace(",", "."));
  if (!Number.isFinite(numero)) {
    throw new NormalizeError(`valor numérico não finito: ${JSON.stringify(texto)}`);
  }
  return numero;
}

/**
 * Identificadores permanecem strings. O código IBGE do município tem 7 dígitos e
 * o código INEP da escola tem 8; zeros à esquerda são significativos e qualquer
 * conversão para Number os perderia silenciosamente.
 */
export function normalizarIdentificador(bruto, { digitos, campo }) {
  const cru = typeof bruto === "object" && bruto !== null ? bruto.valor : bruto;
  if (cru === undefined || cru === null || String(cru).trim() === "") {
    throw new NormalizeError(`${campo} ausente`);
  }
  const texto = String(cru).trim();
  if (!/^\d+$/.test(texto)) {
    throw new NormalizeError(`${campo} não numérico: ${JSON.stringify(texto)}`);
  }
  if (texto.length > digitos) {
    throw new NormalizeError(`${campo} com ${texto.length} dígitos, esperado no máximo ${digitos}: ${texto}`);
  }
  return texto.padStart(digitos, "0");
}

/** Colapsa espaços internos sem alterar acentuação nem caixa. */
export function normalizarTexto(bruto, { campo }) {
  const cru = typeof bruto === "object" && bruto !== null ? bruto.valor : bruto;
  if (cru === undefined || cru === null) {
    throw new NormalizeError(`${campo} ausente`);
  }
  const texto = String(cru).replace(/\s+/g, " ").trim();
  if (texto === "") throw new NormalizeError(`${campo} vazio`);
  return texto;
}

/**
 * Serialização estável: chaves em ordem determinística e nenhuma dependência da
 * ordem de inserção. `JSON.stringify` preserva a ordem de inserção das chaves, o
 * que torna a saída sensível ao caminho do código; ordenar aqui elimina isso.
 */
export function ordenarProfundo(valor) {
  if (Array.isArray(valor)) return valor.map(ordenarProfundo);
  if (valor && typeof valor === "object") {
    const saida = {};
    for (const chave of Object.keys(valor).sort()) {
      saida[chave] = ordenarProfundo(valor[chave]);
    }
    return saida;
  }
  return valor;
}

/**
 * JSON canônico do projeto: chaves ordenadas, indentação de 2 espaços, quebra de
 * linha final LF. Nunca CRLF — o artefato precisa ser idêntico byte a byte em
 * qualquer sistema operacional.
 */
export function serializar(valor) {
  return `${JSON.stringify(ordenarProfundo(valor), null, 2).replace(/\r\n/g, "\n")}\n`;
}

/**
 * Mesma canonicalização, sem indentação. Usada nos artefatos que o navegador
 * busca: a indentação de dois espaços custava mais da metade do payload bruto
 * das partições e não é lida por ninguém. O manifesto continua indentado, porque
 * é revisado por pessoas e aparece em diff.
 */
export function serializarCompacto(valor) {
  return `${JSON.stringify(ordenarProfundo(valor)).replace(/\r\n/g, "\n")}\n`;
}
