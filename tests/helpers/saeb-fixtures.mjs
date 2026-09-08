// Construtores de fixtures para os testes do importador do SAEB.
//
// Tudo é gerado em memória: nenhum binário entra no repositório, e cada caso
// hostil (path traversal, MD5 errado, ZIP corrompido, coluna faltando) é montado
// explicitamente aqui em vez de depender de um arquivo opaco versionado.
//
// O escritor de ZIP abaixo é deliberadamente permissivo — ele aceita nomes que o
// leitor de produção recusa. É assim que os testes de segurança conseguem
// produzir a entrada maliciosa que o leitor precisa rejeitar.
import { deflateRawSync } from "node:zlib";
import { crc32 } from "../../scripts/saeb/lib/zip.mjs";

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

/**
 * Monta um ZIP a partir de `[{ name, data, method, unixMode }]`.
 * Nenhuma validação de nome: os testes precisam poder gerar entradas inválidas.
 */
export function buildZip(entries) {
  const locals = [];
  const centrals = [];
  let offset = 0;

  for (const entry of entries) {
    const nameBytes = Buffer.from(entry.name, "utf8");
    const data = Buffer.isBuffer(entry.data) ? entry.data : Buffer.from(entry.data ?? "", "utf8");
    const method = entry.method ?? METHOD_DEFLATE;
    const compressed = method === METHOD_STORE ? data : deflateRawSync(data);
    const crc = crc32(data);

    const localHeader = Buffer.alloc(30);
    localHeader.writeUInt32LE(0x04034b50, 0);
    localHeader.writeUInt16LE(20, 4); // versão necessária
    localHeader.writeUInt16LE(0, 6); // flags
    localHeader.writeUInt16LE(method, 8);
    localHeader.writeUInt16LE(0, 10); // hora
    localHeader.writeUInt16LE(0, 12); // data
    localHeader.writeUInt32LE(crc, 14);
    localHeader.writeUInt32LE(compressed.length, 18);
    localHeader.writeUInt32LE(data.length, 22);
    localHeader.writeUInt16LE(nameBytes.length, 26);
    localHeader.writeUInt16LE(0, 28); // extra

    locals.push(localHeader, nameBytes, compressed);

    const centralHeader = Buffer.alloc(46);
    centralHeader.writeUInt32LE(0x02014b50, 0);
    centralHeader.writeUInt16LE(20, 4); // versão de criação
    centralHeader.writeUInt16LE(20, 6); // versão necessária
    centralHeader.writeUInt16LE(0, 8); // flags
    centralHeader.writeUInt16LE(method, 10);
    centralHeader.writeUInt16LE(0, 12);
    centralHeader.writeUInt16LE(0, 14);
    centralHeader.writeUInt32LE(crc, 16);
    centralHeader.writeUInt32LE(compressed.length, 20);
    centralHeader.writeUInt32LE(data.length, 24);
    centralHeader.writeUInt16LE(nameBytes.length, 28);
    centralHeader.writeUInt16LE(0, 30); // extra
    centralHeader.writeUInt16LE(0, 32); // comentário
    centralHeader.writeUInt16LE(0, 34); // disco
    centralHeader.writeUInt16LE(0, 36); // atributos internos
    centralHeader.writeUInt32LE(((entry.unixMode ?? 0o100644) << 16) >>> 0, 38);
    centralHeader.writeUInt32LE(offset, 42);

    centrals.push(centralHeader, nameBytes);
    offset += localHeader.length + nameBytes.length + compressed.length;
  }

  const centralBuffer = Buffer.concat(centrals);
  const eocd = Buffer.alloc(22);
  eocd.writeUInt32LE(0x06054b50, 0);
  eocd.writeUInt16LE(0, 4);
  eocd.writeUInt16LE(0, 6);
  eocd.writeUInt16LE(entries.length, 8);
  eocd.writeUInt16LE(entries.length, 10);
  eocd.writeUInt32LE(centralBuffer.length, 12);
  eocd.writeUInt32LE(offset, 16);
  eocd.writeUInt16LE(0, 20);

  return Buffer.concat([...locals, centralBuffer, eocd]);
}

const escapeXml = (value) =>
  String(value).replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;");

function columnLetter(index) {
  let rest = index + 1;
  let letter = "";
  while (rest > 0) {
    const remainder = (rest - 1) % 26;
    letter = String.fromCharCode(65 + remainder) + letter;
    rest = Math.floor((rest - remainder) / 26);
  }
  return letter;
}

/**
 * Monta um .xlsx de uma aba só.
 *
 * `rows` é `{ [numeroDaLinha]: valores[] }`. Cada valor pode ser:
 *   - string  -> cadeia compartilhada (t="s"), como o Excel real grava texto
 *   - number  -> numérico
 *   - null/undefined -> célula omitida, exatamente como a planilha oficial faz
 */
export function buildXlsx(rows, { sheetName = "Planilha", sheetCount = 1 } = {}) {
  const shared = [];
  const sharedIndex = new Map();
  const indexOfString = (value) => {
    if (!sharedIndex.has(value)) {
      sharedIndex.set(value, shared.length);
      shared.push(value);
    }
    return sharedIndex.get(value);
  };

  const rowXml = Object.entries(rows)
    .map(([numero, valores]) => {
      const cells = valores
        .map((valor, coluna) => {
          if (valor === null || valor === undefined || valor === "") return "";
          const referencia = `${columnLetter(coluna)}${numero}`;
          if (typeof valor === "number") {
            return `<c r="${referencia}"><v>${valor}</v></c>`;
          }
          return `<c r="${referencia}" t="s"><v>${indexOfString(String(valor))}</v></c>`;
        })
        .join("");
      return `<row r="${numero}">${cells}</row>`;
    })
    .join("");

  const sheetXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${rowXml}</sheetData></worksheet>`;

  const sharedXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<sst xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" count="${shared.length}" uniqueCount="${shared.length}">` +
    shared.map((value) => `<si><t>${escapeXml(value)}</t></si>`).join("") +
    `</sst>`;

  const sheetTags = Array.from({ length: sheetCount }, (_, i) =>
    `<sheet name="${escapeXml(i === 0 ? sheetName : `${sheetName} ${i + 1}`)}" sheetId="${i + 1}" r:id="rId${i + 1}"/>`,
  ).join("");

  const workbookXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" ` +
    `xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">` +
    `<sheets>${sheetTags}</sheets></workbook>`;

  const relsXml =
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>` +
    `<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">` +
    `<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet1.xml"/>` +
    `</Relationships>`;

  return buildZip([
    { name: "xl/workbook.xml", data: workbookXml },
    { name: "xl/_rels/workbook.xml.rels", data: relsXml },
    { name: "xl/sharedStrings.xml", data: sharedXml },
    { name: "xl/worksheets/sheet1.xml", data: sheetXml },
  ]);
}

/**
 * Colunas técnicas de um pacote por escola, na ordem em que a planilha oficial
 * as apresenta: identificação primeiro, depois os indicadores por edição.
 */
export function colunasTecnicas(edicoes, indicadores, temMeta) {
  const nomes = ["SG_UF", "CO_MUNICIPIO", "NO_MUNICIPIO", "ID_ESCOLA", "NO_ESCOLA", "REDE"];
  for (const edicao of edicoes) {
    for (const indicador of indicadores) {
      if (indicador.campo === "meta" && !temMeta(edicao)) continue;
      nomes.push(`${indicador.coluna}_${edicao}`);
    }
  }
  return nomes;
}

/**
 * Monta uma linha de dados a partir de um objeto de identificação e de um mapa
 * `{ [edicao]: { [campo]: valorBruto } }`. O que não for informado vira célula
 * omitida — o mesmo que a planilha oficial faz.
 */
export function linhaDeEscola(identificacao, porEdicao, edicoes, indicadores, temMeta) {
  const valores = [
    identificacao.uf,
    identificacao.codigoIbge,
    identificacao.municipio,
    identificacao.codigoInep,
    identificacao.nome,
    identificacao.rede,
  ];
  for (const edicao of edicoes) {
    for (const indicador of indicadores) {
      if (indicador.campo === "meta" && !temMeta(edicao)) continue;
      valores.push(porEdicao?.[edicao]?.[indicador.campo] ?? null);
    }
  }
  return valores;
}

/** Conteúdo de um `md5_*.txt` no formato que o Inep publica. */
export function md5Txt(hash, nomeXlsx, hashOds = "0".repeat(32)) {
  const nomeOds = nomeXlsx.replace(/\.xlsx$/, ".ods");
  return `${hash.toUpperCase()} *${nomeXlsx}\n${hashOds.toUpperCase()} *${nomeOds}\n`;
}
