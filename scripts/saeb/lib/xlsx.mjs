// Leitor mínimo de XLSX, suficiente para as planilhas de divulgação do Inep.
//
// Um .xlsx é um ZIP de XML. Este módulo reaproveita o leitor defensivo em
// ./zip.mjs e extrai apenas o que o importador precisa: a única aba da planilha,
// linha a linha, resolvida contra a tabela de cadeias compartilhadas.
//
// Escolhas deliberadas, e o motivo de cada uma:
//
// - Percorre a planilha em fatias de bytes (`<row …>` até `</row>`) em vez de
//   converter o XML inteiro em uma string. A aba de Anos Iniciais tem 66 mil
//   linhas por 137 colunas e passa de 200 MB descomprimida; materializar isso
//   como uma única string JavaScript é desnecessário e frágil.
// - Devolve o valor de cada célula como string crua, sem coerção numérica. A
//   conversão é responsabilidade de ./normalize.mjs, que sabe distinguir
//   ausência de zero e vírgula decimal de separador de milhar.
// - Endereça células pela letra da coluna, nunca pela ordem em que aparecem:
//   o formato omite células vazias, então posição não é índice.
import { openZip } from "./zip.mjs";

export class XlsxError extends Error {
  constructor(message) {
    super(message);
    this.name = "XlsxError";
  }
}

const WORKBOOK = "xl/workbook.xml";
const WORKBOOK_RELS = "xl/_rels/workbook.xml.rels";
const SHARED_STRINGS = "xl/sharedStrings.xml";

function decodeXmlText(value) {
  if (!value.includes("&")) return value;
  return value.replace(/&(#x?[0-9a-fA-F]+|amp|lt|gt|quot|apos);/g, (match, entity) => {
    switch (entity) {
      case "amp": return "&";
      case "lt": return "<";
      case "gt": return ">";
      case "quot": return '"';
      case "apos": return "'";
      default:
        if (entity.startsWith("#x") || entity.startsWith("#X")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(2), 16));
        }
        if (entity.startsWith("#")) {
          return String.fromCodePoint(Number.parseInt(entity.slice(1), 10));
        }
        return match;
    }
  });
}

/**
 * Converte a referência de célula ("BC11") no índice da coluna, começando em 0.
 */
export function columnIndex(reference) {
  let index = 0;
  for (const char of reference) {
    const code = char.charCodeAt(0);
    if (code < 65 || code > 90) break;
    index = index * 26 + (code - 64);
  }
  return index - 1;
}

/**
 * Converte o índice de coluna na letra correspondente ("A", "Z", "AA"…).
 */
export function columnLetter(index) {
  let rest = index + 1;
  let letter = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    rest = Math.floor((rest - remainder) / 26);
  }
  return letter;
}

function parseSharedStrings(buffer) {
  if (!buffer) return [];
  const xml = buffer.toString("utf8");
  const strings = [];
  // Cada <si> pode conter um <t> simples ou vários <r><t> (texto com formatação
  // parcial); os pedaços de um mesmo <si> concatenam.
  const siPattern = /<si\b[^>]*>([\s\S]*?)<\/si>/g;
  let match;
  while ((match = siPattern.exec(xml)) !== null) {
    const body = match[1];
    let text = "";
    const tPattern = /<t\b[^>]*>([\s\S]*?)<\/t>/g;
    let piece;
    while ((piece = tPattern.exec(body)) !== null) {
      text += decodeXmlText(piece[1]);
    }
    strings.push(text);
  }
  return strings;
}

function resolveSingleSheetPath(zip) {
  const workbook = zip.read(WORKBOOK).toString("utf8");
  const sheets = [...workbook.matchAll(/<sheet\b[^>]*\/?>/g)].map((match) => match[0]);
  if (sheets.length !== 1) {
    throw new XlsxError(`esperada exatamente uma aba na planilha, encontradas ${sheets.length}`);
  }
  const relationId = sheets[0].match(/r:id="([^"]+)"/)?.[1];
  const name = decodeXmlText(sheets[0].match(/name="([^"]*)"/)?.[1] ?? "");
  if (!relationId) throw new XlsxError("aba sem r:id — não é possível resolver o alvo");

  const rels = zip.read(WORKBOOK_RELS).toString("utf8");
  const relation = [...rels.matchAll(/<Relationship\b[^>]*>/g)]
    .map((match) => match[0])
    .find((tag) => tag.includes(`Id="${relationId}"`));
  if (!relation) throw new XlsxError(`relação ${relationId} não encontrada em ${WORKBOOK_RELS}`);

  let target = relation.match(/Target="([^"]+)"/)?.[1];
  if (!target) throw new XlsxError(`relação ${relationId} sem Target`);
  target = target.replace(/^\/+/, "").replace(/^xl\//, "");
  return { name, path: `xl/${target}` };
}

/**
 * Percorre a aba devolvendo, para cada linha não vazia, `{ rowNumber, cells }`,
 * onde `cells` mapeia a referência da coluna para `{ valor, numerico }`.
 */
function* iterateRows(sheetBuffer, sharedStrings) {
  const OPEN = Buffer.from("<row");
  const CLOSE = Buffer.from("</row>");
  const SELF_CLOSE = Buffer.from("/>");

  let cursor = 0;
  while (cursor < sheetBuffer.length) {
    const start = sheetBuffer.indexOf(OPEN, cursor);
    if (start === -1) return;

    // Distingue <row .../> (linha vazia) de <row ...>…</row>.
    const tagEnd = sheetBuffer.indexOf(0x3e, start); // ">"
    if (tagEnd === -1) return;
    const selfClosing =
      sheetBuffer.subarray(tagEnd - 1, tagEnd + 1).equals(SELF_CLOSE);

    let end;
    if (selfClosing) {
      end = tagEnd + 1;
    } else {
      end = sheetBuffer.indexOf(CLOSE, tagEnd);
      if (end === -1) return;
      end += CLOSE.length;
    }

    const chunk = sheetBuffer.subarray(start, end).toString("utf8");
    cursor = end;

    const rowNumber = Number.parseInt(chunk.match(/^<row\b[^>]*\br="(\d+)"/)?.[1] ?? "", 10);
    if (!Number.isInteger(rowNumber)) continue;

    const cells = new Map();
    const cellPattern = /<c\b([^>]*)(?:\/>|>([\s\S]*?)<\/c>)/g;
    let cell;
    while ((cell = cellPattern.exec(chunk)) !== null) {
      const attributes = cell[1];
      const body = cell[2];
      const reference = attributes.match(/\br="([A-Z]+)\d+"/)?.[1];
      if (!reference) continue;
      if (body === undefined) continue;

      const type = attributes.match(/\bt="([^"]+)"/)?.[1] ?? "n";
      let value;
      if (type === "inlineStr") {
        value = [...body.matchAll(/<t\b[^>]*>([\s\S]*?)<\/t>/g)]
          .map((piece) => decodeXmlText(piece[1]))
          .join("");
      } else {
        const raw = body.match(/<v\b[^>]*>([\s\S]*?)<\/v>/)?.[1];
        if (raw === undefined) continue;
        if (type === "s") {
          const index = Number.parseInt(raw, 10);
          value = sharedStrings[index];
          if (value === undefined) {
            throw new XlsxError(`índice de cadeia compartilhada fora de faixa: ${raw}`);
          }
        } else {
          value = decodeXmlText(raw);
        }
      }
      if (value === "") continue;
      // O tipo viaja junto com o valor: célula numérica carrega a serialização
      // canônica de um double (que pode vir em notação científica), enquanto
      // célula de texto carrega o que uma pessoa digitou — inclusive vírgula
      // decimal e marcador de ausência. As duas exigem regras diferentes.
      cells.set(reference, { valor: value, numerico: type === "n" });
    }

    if (cells.size > 0) yield { rowNumber, cells };
  }
}

/**
 * Abre um .xlsx e devolve a aba única com um iterador de linhas.
 */
export function openWorkbook(buffer) {
  const zip = openZip(buffer);
  const sheet = resolveSingleSheetPath(zip);
  if (!zip.has(sheet.path)) {
    throw new XlsxError(`aba declarada em ${WORKBOOK} não existe no pacote: ${sheet.path}`);
  }
  const sharedStrings = zip.has(SHARED_STRINGS) ? parseSharedStrings(zip.read(SHARED_STRINGS)) : [];
  const sheetBuffer = zip.read(sheet.path);

  return {
    sheetName: sheet.name,
    sheetPath: sheet.path,
    sharedStringCount: sharedStrings.length,
    rows: () => iterateRows(sheetBuffer, sharedStrings),
  };
}
