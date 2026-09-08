// Leitor de ZIP defensivo, construído só com APIs nativas do Node (node:zlib).
//
// Por que não uma dependência: o pipeline lê arquivos oficiais grandes vindos da
// internet, e a superfície necessária aqui é pequena — diretório central, inflate
// e CRC32. Uma biblioteca de terceiros nesse caminho acrescenta risco de cadeia
// de suprimentos sem cobrir nenhum caso que este módulo não cubra. O que ela
// pouparia (≈200 linhas) é menos do que ela custaria em confiança.
//
// O leitor recusa, por construção, tudo que possa escapar do diretório de
// trabalho: caminho absoluto, `..`, separador invertido, nome duplicado, entrada
// que seja link simbólico e método de compressão desconhecido. Nada é extraído
// para o disco por este módulo — ele devolve bytes em memória, e quem chama
// decide o que fazer com eles.
import { inflateRawSync } from "node:zlib";

const SIG_EOCD = 0x06054b50;
const SIG_EOCD64 = 0x06064b50;
const SIG_EOCD64_LOCATOR = 0x07064b50;
const SIG_CENTRAL = 0x02014b50;
const SIG_LOCAL = 0x04034b50;

const METHOD_STORE = 0;
const METHOD_DEFLATE = 8;

// S_IFLNK em modo Unix, deslocado para os 16 bits altos de externalAttributes.
const UNIX_MODE_SHIFT = 16;
const S_IFMT = 0o170000;
const S_IFLNK = 0o120000;

/**
 * Limites de descompressão. Todos são checados contra o que o diretório central
 * DECLARA, antes de qualquer alocação, e o inflate ainda recebe `maxOutputLength`
 * para o caso de o declarado mentir.
 *
 * Dimensionados sobre os máximos medidos nos três pacotes oficiais de 2025
 * (medição em 01/09/2026), com a margem indicada em cada linha. Não são
 * configuráveis pela entrada: um ZIP hostil não pode afrouxar o próprio limite.
 */
export const LIMITES = {
  // Observado: 16 entradas (o .xlsx interno). Margem 16x.
  maxEntradas: 256,
  // Observado: 56,5 MB (o .ods dentro do pacote de Anos Iniciais). Margem 4,5x.
  maxComprimidoPorEntrada: 256 * 1024 * 1024,
  // Observado: 367,4 MB (xl/worksheets/sheet1.xml de Anos Iniciais). Margem 2,1x.
  maxDescomprimidoPorEntrada: 768 * 1024 * 1024,
  // Observado: 370,9 MB somando todas as entradas do mesmo ZIP. Margem 2,8x.
  maxDescomprimidoTotal: 1024 * 1024 * 1024,
  // Observado: 21,1x (xl/printerSettings/printerSettings1.bin, arquivo minúsculo).
  // Margem 9,5x, e ainda uma ordem de grandeza abaixo de uma zip bomb típica.
  maxRazaoCompressao: 200,
  // A razão só é cobrada acima deste piso: arquivos pequenos comprimem muito bem
  // por natureza e uma razão alta neles não é sinal de nada.
  pisoRazaoBytes: 1024 * 1024,
};

/** Recusa qualquer valor fora do intervalo seguro de inteiro do JavaScript. */
function inteiroSeguro(valor, rotulo, entry) {
  const numero = typeof valor === "bigint" ? Number(valor) : valor;
  if (!Number.isSafeInteger(numero) || numero < 0) {
    throw new ZipError(
      `${rotulo} fora do intervalo seguro de inteiro: ${String(valor)}`,
      entry ? { entry } : undefined,
    );
  }
  return numero;
}

export class ZipError extends Error {
  constructor(message, { entry } = {}) {
    super(entry ? `${message} (entrada: ${JSON.stringify(entry)})` : message);
    this.name = "ZipError";
    this.entry = entry;
  }
}

let crcTable;
function crc32(buffer) {
  if (!crcTable) {
    crcTable = new Int32Array(256);
    for (let i = 0; i < 256; i += 1) {
      let value = i;
      for (let bit = 0; bit < 8; bit += 1) {
        value = value & 1 ? 0xedb88320 ^ (value >>> 1) : value >>> 1;
      }
      crcTable[i] = value;
    }
  }
  let crc = -1;
  for (let i = 0; i < buffer.length; i += 1) {
    crc = crcTable[(crc ^ buffer[i]) & 0xff] ^ (crc >>> 8);
  }
  return (crc ^ -1) >>> 0;
}

/**
 * Um nome de entrada só é aceito se for um caminho relativo, POSIX, sem
 * componente vazio, sem `.`/`..` e sem unidade de disco. Qualquer outra forma é
 * recusada antes de qualquer leitura de bytes.
 */
export function assertSafeEntryName(name) {
  if (typeof name !== "string" || name.length === 0) {
    throw new ZipError("nome de entrada vazio", { entry: name });
  }
  if (name.includes("\u0000")) {
    throw new ZipError("nome de entrada com byte nulo", { entry: name });
  }
  if (name.includes("\\")) {
    throw new ZipError("nome de entrada com separador invertido", { entry: name });
  }
  if (name.startsWith("/")) {
    throw new ZipError("caminho absoluto recusado", { entry: name });
  }
  if (/^[a-zA-Z]:/.test(name)) {
    throw new ZipError("caminho com unidade de disco recusado", { entry: name });
  }
  const parts = name.split("/");
  for (const part of parts) {
    if (part === "..") throw new ZipError("path traversal recusado", { entry: name });
    if (part === ".") throw new ZipError("componente '.' recusado", { entry: name });
  }
  // Diretórios terminam em "/" e produzem um último componente vazio; qualquer
  // outro componente vazio significa "//" no meio do caminho.
  const interior = name.endsWith("/") ? parts.slice(0, -1) : parts;
  if (interior.some((part) => part === "")) {
    throw new ZipError("componente de caminho vazio", { entry: name });
  }
  return name;
}

function findEndOfCentralDirectory(buffer) {
  const maxComment = 0xffff;
  const start = Math.max(0, buffer.length - maxComment - 22);
  for (let i = buffer.length - 22; i >= start; i -= 1) {
    if (buffer.readUInt32LE(i) === SIG_EOCD) return i;
  }
  throw new ZipError("assinatura de fim de diretório central não encontrada — arquivo não é um ZIP válido ou está truncado");
}

function readCentralDirectoryBounds(buffer) {
  const eocd = findEndOfCentralDirectory(buffer);
  let entryCount = buffer.readUInt16LE(eocd + 10);
  let directorySize = buffer.readUInt32LE(eocd + 12);
  let directoryOffset = buffer.readUInt32LE(eocd + 16);

  const needsZip64 =
    entryCount === 0xffff || directorySize === 0xffffffff || directoryOffset === 0xffffffff;

  if (needsZip64) {
    const locator = eocd - 20;
    if (locator < 0 || buffer.readUInt32LE(locator) !== SIG_EOCD64_LOCATOR) {
      throw new ZipError("ZIP64 indicado mas o localizador do fim de diretório central não foi encontrado");
    }
    const eocd64Offset = inteiroSeguro(buffer.readBigUInt64LE(locator + 8), "offset ZIP64 do fim de diretório central");
    if (eocd64Offset < 0 || eocd64Offset + 56 > buffer.length || buffer.readUInt32LE(eocd64Offset) !== SIG_EOCD64) {
      throw new ZipError("registro ZIP64 de fim de diretório central inválido");
    }
    entryCount = inteiroSeguro(buffer.readBigUInt64LE(eocd64Offset + 32), "número de entradas ZIP64");
    directorySize = inteiroSeguro(buffer.readBigUInt64LE(eocd64Offset + 40), "tamanho do diretório central ZIP64");
    directoryOffset = inteiroSeguro(buffer.readBigUInt64LE(eocd64Offset + 48), "offset do diretório central ZIP64");
  }

  if (directoryOffset + directorySize > buffer.length) {
    throw new ZipError("diretório central aponta para fora do arquivo — ZIP truncado");
  }
  return { entryCount, directorySize, directoryOffset };
}

function readZip64Extra(extra, entry) {
  let cursor = 0;
  while (cursor + 4 <= extra.length) {
    const headerId = extra.readUInt16LE(cursor);
    const size = extra.readUInt16LE(cursor + 2);
    const body = extra.subarray(cursor + 4, cursor + 4 + size);
    if (headerId === 0x0001) {
      let at = 0;
      if (entry.uncompressedSize === 0xffffffff && at + 8 <= body.length) {
        entry.uncompressedSize = inteiroSeguro(body.readBigUInt64LE(at), "tamanho descomprimido ZIP64", entry.name);
        at += 8;
      }
      if (entry.compressedSize === 0xffffffff && at + 8 <= body.length) {
        entry.compressedSize = inteiroSeguro(body.readBigUInt64LE(at), "tamanho comprimido ZIP64", entry.name);
        at += 8;
      }
      if (entry.localHeaderOffset === 0xffffffff && at + 8 <= body.length) {
        entry.localHeaderOffset = inteiroSeguro(body.readBigUInt64LE(at), "offset do cabeçalho local ZIP64", entry.name);
        at += 8;
      }
    }
    cursor += 4 + size;
  }
}

/**
 * Lê o diretório central e devolve as entradas validadas. Não descomprime nada.
 */
export function readZipDirectory(buffer) {
  if (!Buffer.isBuffer(buffer) || buffer.length < 22) {
    throw new ZipError("buffer pequeno demais para conter um ZIP");
  }
  const { entryCount, directoryOffset } = readCentralDirectoryBounds(buffer);

  if (entryCount > LIMITES.maxEntradas) {
    throw new ZipError(
      `ZIP declara ${entryCount} entradas, acima do limite de ${LIMITES.maxEntradas}`,
    );
  }

  const entries = [];
  const seen = new Set();
  let cursor = directoryOffset;
  let totalDescomprimido = 0;

  for (let index = 0; index < entryCount; index += 1) {
    if (cursor + 46 > buffer.length || buffer.readUInt32LE(cursor) !== SIG_CENTRAL) {
      throw new ZipError(`cabeçalho de diretório central inválido na entrada ${index}`);
    }
    const nameLength = buffer.readUInt16LE(cursor + 28);
    const extraLength = buffer.readUInt16LE(cursor + 30);
    const commentLength = buffer.readUInt16LE(cursor + 32);
    const entry = {
      name: buffer.subarray(cursor + 46, cursor + 46 + nameLength).toString("utf8"),
      method: buffer.readUInt16LE(cursor + 10),
      crc32: buffer.readUInt32LE(cursor + 16),
      compressedSize: buffer.readUInt32LE(cursor + 20),
      uncompressedSize: buffer.readUInt32LE(cursor + 24),
      externalAttributes: buffer.readUInt32LE(cursor + 38),
      localHeaderOffset: buffer.readUInt32LE(cursor + 42),
    };
    readZip64Extra(buffer.subarray(cursor + 46 + nameLength, cursor + 46 + nameLength + extraLength), entry);

    assertSafeEntryName(entry.name);

    if (seen.has(entry.name)) {
      throw new ZipError("nome de entrada duplicado", { entry: entry.name });
    }
    seen.add(entry.name);

    const unixMode = (entry.externalAttributes >>> UNIX_MODE_SHIFT) & 0xffff;
    if ((unixMode & S_IFMT) === S_IFLNK) {
      throw new ZipError("entrada é link simbólico", { entry: entry.name });
    }

    entry.isDirectory = entry.name.endsWith("/");
    if (!entry.isDirectory && entry.method !== METHOD_STORE && entry.method !== METHOD_DEFLATE) {
      throw new ZipError(`método de compressão não suportado: ${entry.method}`, { entry: entry.name });
    }

    // Limites cobrados sobre o DECLARADO, antes de qualquer alocação. Um ZIP
    // hostil que anuncie gigabytes é recusado aqui, sem que um único byte seja
    // descomprimido.
    inteiroSeguro(entry.compressedSize, "tamanho comprimido", entry.name);
    inteiroSeguro(entry.uncompressedSize, "tamanho descomprimido", entry.name);
    inteiroSeguro(entry.localHeaderOffset, "offset do cabeçalho local", entry.name);

    if (entry.compressedSize > LIMITES.maxComprimidoPorEntrada) {
      throw new ZipError(
        `entrada comprimida com ${entry.compressedSize} bytes, acima do limite de ${LIMITES.maxComprimidoPorEntrada}`,
        { entry: entry.name },
      );
    }
    if (entry.uncompressedSize > LIMITES.maxDescomprimidoPorEntrada) {
      throw new ZipError(
        `entrada declara ${entry.uncompressedSize} bytes descomprimidos, acima do limite de ${LIMITES.maxDescomprimidoPorEntrada}`,
        { entry: entry.name },
      );
    }
    if (
      entry.uncompressedSize >= LIMITES.pisoRazaoBytes &&
      entry.compressedSize > 0 &&
      entry.uncompressedSize / entry.compressedSize > LIMITES.maxRazaoCompressao
    ) {
      throw new ZipError(
        `razão de compressão ${(entry.uncompressedSize / entry.compressedSize).toFixed(1)}x acima do limite de ${LIMITES.maxRazaoCompressao}x`,
        { entry: entry.name },
      );
    }

    totalDescomprimido += entry.uncompressedSize;
    inteiroSeguro(totalDescomprimido, "soma dos tamanhos descomprimidos");
    if (totalDescomprimido > LIMITES.maxDescomprimidoTotal) {
      throw new ZipError(
        `soma dos tamanhos descomprimidos passa de ${LIMITES.maxDescomprimidoTotal} bytes`,
        { entry: entry.name },
      );
    }

    entries.push(entry);
    cursor += 46 + nameLength + extraLength + commentLength;
  }

  return entries;
}

/**
 * Descomprime uma entrada e confere CRC32 e tamanho declarado. Devolve Buffer.
 */
export function readZipEntry(buffer, entry) {
  if (entry.isDirectory) {
    throw new ZipError("entrada é diretório, não arquivo", { entry: entry.name });
  }
  const local = entry.localHeaderOffset;
  if (local + 30 > buffer.length || buffer.readUInt32LE(local) !== SIG_LOCAL) {
    throw new ZipError("cabeçalho local inválido", { entry: entry.name });
  }
  const nameLength = buffer.readUInt16LE(local + 26);
  const extraLength = buffer.readUInt16LE(local + 28);
  const dataStart = inteiroSeguro(local + 30 + nameLength + extraLength, "início dos dados", entry.name);
  const dataEnd = inteiroSeguro(dataStart + entry.compressedSize, "fim dos dados", entry.name);
  if (dataEnd > buffer.length) {
    throw new ZipError("dados da entrada ultrapassam o fim do arquivo — ZIP truncado", { entry: entry.name });
  }

  const raw = buffer.subarray(dataStart, dataEnd);
  let content;
  if (entry.method === METHOD_STORE) {
    content = Buffer.from(raw);
  } else {
    try {
      // `maxOutputLength` faz o zlib abortar durante a descompressão, e não
      // depois: um payload que minta sobre o próprio tamanho declarado não chega
      // a alocar além do teto.
      content = inflateRawSync(raw, { maxOutputLength: LIMITES.maxDescomprimidoPorEntrada });
    } catch (error) {
      throw new ZipError(`falha ao descomprimir: ${error.message}`, { entry: entry.name });
    }
  }

  if (content.length !== entry.uncompressedSize) {
    throw new ZipError(
      `tamanho descomprimido diverge: esperado ${entry.uncompressedSize}, obtido ${content.length}`,
      { entry: entry.name },
    );
  }
  const actualCrc = crc32(content);
  if (actualCrc !== entry.crc32) {
    throw new ZipError(
      `CRC32 diverge: esperado ${entry.crc32.toString(16)}, obtido ${actualCrc.toString(16)}`,
      { entry: entry.name },
    );
  }
  return content;
}

/**
 * Abre um ZIP em memória e devolve um acessor por nome exato.
 */
export function openZip(buffer) {
  const entries = readZipDirectory(buffer);
  const byName = new Map(entries.map((entry) => [entry.name, entry]));
  return {
    entries,
    names: entries.map((entry) => entry.name),
    has: (name) => byName.has(name),
    entry(name) {
      const entry = byName.get(name);
      if (!entry) throw new ZipError("arquivo obrigatório ausente no pacote", { entry: name });
      return entry;
    },
    read(name) {
      return readZipEntry(buffer, this.entry(name));
    },
  };
}

export { crc32 };
