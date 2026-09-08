// Importador do SAEB — camada de aquisição, verificação e normalização.
//
// Não é executado por build, teste ou install: roda apenas quando alguém chama
// `npm run saeb:import` (ou `--check` / `--download`). Nada de rede acontece sem
// `--download` explícito.
//
// Fonte: pacotes oficiais de divulgação do Ideb por escola, edição 2025 — ver
// ./lib/sources.mjs para as URLs, tamanhos e MD5 conferidos na auditoria r2.
//
// Determinismo: o artefato versionado não carrega horário de execução. O que
// muda quando a fonte muda são o MD5 oficial e os fingerprints SHA-256 locais
// registrados no manifesto — nenhum deles depende de quando o importador rodou.
// O horário do run vai para um log ignorado pelo Git.
//
// O manifesto não registra data de publicação: o header HTTP Last-Modified é
// volátil e só existe no momento do download, e o Inep não publica uma data de
// referência confiável junto dos pacotes. Gravar um campo só para preenchê-lo
// seria pior do que omiti-lo.
//
// Uso:
//   node scripts/saeb/import.mjs --download        baixa os pacotes para o cache
//   node scripts/saeb/import.mjs                   gera os artefatos a partir do cache
//   node scripts/saeb/import.mjs --check           valida uma materialização existente
//   node scripts/saeb/import.mjs --verify-source   valida fonte, parser e manifesto — sem materializar nada
//   node scripts/saeb/import.mjs --out <dir>       redireciona a saída (revisão)
//
// --check e --verify-source respondem perguntas diferentes: --check pergunta
// "o que está em public/data/saeb bate com o que o cache produziria?" (e por
// isso relata ausência como divergência); --verify-source pergunta "os três
// pacotes em cache, passados pelo parser, ainda produzem o manifesto já
// commitado?" — nunca toca em public/data/saeb, exista ele ou não.
import { createHash } from "node:crypto";
import { mkdir, readdir, readFile, rename, stat, unlink, writeFile } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

import { openZip } from "./lib/zip.mjs";
import { openWorkbook } from "./lib/xlsx.mjs";
import {
  MARCADORES_AUSENCIA,
  normalizarIdentificador,
  normalizarIndicador,
  normalizarTexto,
  OBSERVACAO_AVALIACAO_ESTADUAL,
  serializar,
  serializarCompacto,
} from "./lib/normalize.mjs";

// Identificador curto da observação de avaliação estadual. O texto oficial
// completo fica no manifesto, em observacoes.
const OBSERVACAO_AVALIACAO_ESTADUAL_ID = "avaliacao_estadual";
import {
  ATRIBUICAO,
  COLUNAS_IDENTIFICACAO,
  EDICAO_PILOTO,
  EDICOES,
  INDICADORES,
  LINHA_CABECALHO,
  PACOTES,
  PAGINA_OFICIAL,
  PRIMEIRA_LINHA_DADOS,
  RESSALVAS,
  SCHEMA_DATASET,
  SCHEMA_INDICE,
  SCHEMA_MANIFESTO,
  ULTIMA_EDICAO_COM_META,
  md5EntryName,
  xlsxEntryName,
} from "./lib/sources.mjs";

const root = process.cwd();

export class ImportError extends Error {
  constructor(message) {
    super(message);
    this.name = "ImportError";
  }
}

/** Exige que uma flag posicional (`--out valor`) tenha um próximo argumento não vazio. */
function exigirValor(argv, indice, nome) {
  const valor = argv[indice];
  if (valor === undefined || valor === "") {
    throw new ImportError(`${nome} requer um valor não vazio`);
  }
  return valor;
}

/** Exige que uma flag no formato `--out=valor` não tenha a parte depois do "=" vazia. */
function exigirValorInline(arg, offset, nome) {
  const valor = arg.slice(offset);
  if (valor === "") {
    throw new ImportError(`${nome} requer um valor não vazio`);
  }
  return valor;
}

function parseArgs(argv) {
  const flags = { download: false, check: false, verifySource: false, out: null, cache: null };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--download") flags.download = true;
    else if (arg === "--check") flags.check = true;
    else if (arg === "--verify-source") flags.verifySource = true;
    else if (arg === "--out") flags.out = exigirValor(argv, ++i, "--out");
    else if (arg === "--cache") flags.cache = exigirValor(argv, ++i, "--cache");
    else if (arg.startsWith("--out=")) flags.out = exigirValorInline(arg, 6, "--out");
    else if (arg.startsWith("--cache=")) flags.cache = exigirValorInline(arg, 8, "--cache");
    else throw new ImportError(`argumento desconhecido: ${arg}`);
  }
  if (flags.download && flags.check) {
    throw new ImportError("--download e --check são mutuamente exclusivos: --check nunca acessa a rede");
  }
  if (flags.verifySource && flags.download) {
    throw new ImportError("--verify-source e --download são mutuamente exclusivos: --verify-source nunca acessa a rede");
  }
  if (flags.verifySource && flags.check) {
    throw new ImportError(
      "--verify-source e --check são mutuamente exclusivos: um valida a fonte e o parser contra o manifesto, o outro valida uma materialização existente",
    );
  }
  if (flags.verifySource && flags.out !== null) {
    throw new ImportError("--verify-source e --out são mutuamente exclusivos: --verify-source não materializa artefatos, então não há saída para redirecionar");
  }
  return flags;
}

const sha256 = (buffer) => createHash("sha256").update(buffer).digest("hex");
const md5 = (buffer) => createHash("md5").update(buffer).digest("hex");

// ---- Aquisição -------------------------------------------------------------

/**
 * Baixa um pacote para o cache. Recusa-se a sobrescrever um arquivo existente
 * cujo conteúdo divirja: apagar silenciosamente bytes já verificados é
 * exatamente o que um importador não pode fazer.
 */
async function baixarPacote(pacote, cacheDir, log) {
  const destino = path.join(cacheDir, pacote.zipName);
  const jaExiste = await stat(destino).catch(() => null);

  if (jaExiste) {
    // Validação completa do que já está em cache — tamanho, fingerprint SHA-256,
    // estrutura do pacote, MD5 oficial e bytes da planilha. Só assim dá para
    // dizer que o download é dispensável.
    const atual = await readFile(destino);
    try {
      validarPacoteCompleto(pacote, atual);
    } catch (error) {
      throw new ImportError(
        `${destino} já existe e não passou na validação: ${error.message}. ` +
          "Remova o arquivo manualmente depois de confirmar a origem; o importador não sobrescreve.",
      );
    }
    log(`cache já tem ${pacote.zipName} validado por completo — download dispensado`);
    return { destino, baixado: false, lastModified: null };
  }

  log(`baixando ${pacote.url}`);
  let resposta;
  try {
    resposta = await fetch(pacote.url, { redirect: "follow" });
  } catch (error) {
    // download.inep.gov.br serve uma cadeia de certificados incompleta: falta o
    // intermediário, então o bundle embutido do Node não consegue validar a
    // folha. A saída correta é usar a trust store do sistema operacional, que
    // tem o intermediário — e nunca desabilitar a verificação TLS, o que
    // deixaria o pipeline aceitar qualquer resposta forjada.
    if (error?.cause?.code === "UNABLE_TO_VERIFY_LEAF_SIGNATURE") {
      throw new ImportError(
        `TLS não validou ${pacote.url}: o servidor do Inep envia cadeia de certificados incompleta. ` +
          "Rode com a trust store do sistema — `npm run saeb:download`, que já usa node --use-system-ca. " +
          "Nunca desabilite a verificação de certificado para contornar isto.",
      );
    }
    throw new ImportError(`download falhou para ${pacote.url}: ${error.message}`);
  }
  if (!resposta.ok) {
    throw new ImportError(`download falhou para ${pacote.url}: HTTP ${resposta.status}`);
  }
  const bytes = Buffer.from(await resposta.arrayBuffer());
  const lastModified = resposta.headers.get("last-modified");

  // A validação inteira acontece em memória, ANTES de qualquer escrita. Um
  // download que não passe nunca chega a existir como arquivo: nada de deixar
  // no cache um pacote reprovado para alguém encontrar depois.
  validarPacoteCompleto(pacote, bytes);

  await escreverAtomico(destino, bytes);
  log(`gravado ${destino} (${bytes.length} bytes) após validação completa`);
  return { destino, baixado: true, lastModified };
}

/**
 * Prova de integridade de um pacote, em memória. Falha na primeira divergência.
 *
 * São duas camadas com proveniências diferentes:
 *
 * - o **checksum oficial** (MD5) publicado pelo Inep dentro do pacote, conferido
 *   contra a cópia previamente fixada no registro de fontes. As duas cópias estão
 *   separadas no tempo e no armazenamento, mas têm a mesma origem editorial;
 * - os **fingerprints SHA-256 locais**, calculados na revisão de um download
 *   oficial e fixados no registro. O Inep não publica SHA-256. É o que detecta
 *   adulteração que preserve o tamanho — e o MD5, sozinho, não bastaria.
 */
export function validarPacoteCompleto(pacote, zipBytes) {
  if (zipBytes.length !== pacote.zipBytes) {
    throw new ImportError(`${pacote.zipName}: tamanho ${zipBytes.length} bytes, esperado ${pacote.zipBytes}`);
  }

  const zipSha = sha256(zipBytes);
  if (zipSha !== pacote.zipSha256) {
    throw new ImportError(
      `${pacote.zipName}: fingerprint SHA-256 do ZIP diverge — obtido ${zipSha}, fixado ${pacote.zipSha256}`,
    );
  }

  const zip = openZip(zipBytes);

  const nomeXlsx = xlsxEntryName(pacote);
  const nomeMd5 = md5EntryName(pacote);
  for (const obrigatorio of [nomeXlsx, nomeMd5]) {
    if (!zip.has(obrigatorio)) {
      throw new ImportError(`${pacote.zipName}: arquivo obrigatório ausente no pacote: ${obrigatorio}`);
    }
  }

  const md5Declarado = extrairMd5Oficial(zip.read(nomeMd5).toString("utf8"), pacote.xlsxName);
  if (md5Declarado !== pacote.xlsxMd5) {
    throw new ImportError(
      `${pacote.zipName}: MD5 oficial declarado no pacote (${md5Declarado}) diverge da cópia fixada no registro de fontes (${pacote.xlsxMd5})`,
    );
  }

  const xlsxBytes = zip.read(nomeXlsx);
  if (xlsxBytes.length !== pacote.xlsxBytes) {
    throw new ImportError(
      `${pacote.zipName}: planilha com ${xlsxBytes.length} bytes, esperado ${pacote.xlsxBytes}`,
    );
  }

  const md5Calculado = md5(xlsxBytes);
  if (md5Calculado !== md5Declarado) {
    throw new ImportError(
      `${pacote.zipName}: MD5 da planilha extraída (${md5Calculado}) diverge do MD5 oficial (${md5Declarado})`,
    );
  }

  const xlsxSha = sha256(xlsxBytes);
  if (xlsxSha !== pacote.xlsxSha256) {
    throw new ImportError(
      `${pacote.zipName}: fingerprint SHA-256 da planilha diverge — obtido ${xlsxSha}, fixado ${pacote.xlsxSha256}`,
    );
  }

  return {
    xlsxBytes,
    integridade: {
      zip_bytes: zipBytes.length,
      zip_sha256_local: zipSha,
      xlsx_bytes: xlsxBytes.length,
      xlsx_sha256_local: xlsxSha,
      xlsx_md5_oficial: md5Declarado,
      xlsx_md5_recalculado: md5Calculado,
      md5_oficial_conferido: true,
      fingerprints_locais_conferidos: true,
      entradas_do_pacote: zip.names.slice().sort(),
    },
  };
}

// ---- Verificação de integridade -------------------------------------------

/**
 * Lê o pacote do cache e prova a integridade antes de qualquer processamento:
 * tamanho do ZIP, presença das entradas obrigatórias, MD5 da planilha conferido
 * pelo checksum oficial confrontado com a cópia previamente fixada no registro
 * de fontes, e pelos fingerprints SHA-256 locais.
 */
async function verificarPacote(pacote, cacheDir) {
  const caminho = path.join(cacheDir, pacote.zipName);
  const zipBytes = await readFile(caminho).catch((error) => {
    if (error.code === "ENOENT") {
      throw new ImportError(
        `pacote ausente no cache: ${caminho}. Rode primeiro: node scripts/saeb/import.mjs --download`,
      );
    }
    throw error;
  });
  return validarPacoteCompleto(pacote, zipBytes);
}

/** Extrai o MD5 da planilha do arquivo `md5_*.txt` publicado dentro do pacote. */
export function extrairMd5Oficial(conteudo, nomeArquivo) {
  const linhas = conteudo.split(/\r?\n/).map((linha) => linha.trim()).filter(Boolean);
  for (const linha of linhas) {
    const match = linha.match(/^([0-9a-fA-F]{32})\s+\*?(.+)$/);
    if (match && match[2].trim() === nomeArquivo) {
      return match[1].toLowerCase();
    }
  }
  throw new ImportError(`md5 oficial de ${nomeArquivo} não encontrado no arquivo de checksum do pacote`);
}

// ---- Leitura e normalização ------------------------------------------------

function mapearCabecalho(linha) {
  const porNome = new Map();
  for (const [referencia, celula] of linha.cells) {
    const nome = String(celula.valor).trim();
    if (nome === "") continue;
    if (porNome.has(nome)) {
      throw new ImportError(`coluna duplicada no cabeçalho técnico: ${nome}`);
    }
    porNome.set(nome, referencia);
  }
  return porNome;
}

/**
 * Colunas obrigatórias de um pacote. A cobertura de edições é do pacote, não
 * global: o Ensino Médio começa em 2017 e tem metas só em 2019 e 2021.
 */
function colunasEsperadas(pacote) {
  const comMeta = new Set(pacote.edicoesComMeta);
  const nomes = [...COLUNAS_IDENTIFICACAO];
  for (const edicao of pacote.edicoes) {
    for (const indicador of INDICADORES) {
      if (indicador.campo === "meta" && !comMeta.has(edicao)) continue;
      nomes.push(`${indicador.coluna}_${edicao}`);
    }
  }
  return nomes;
}

/**
 * Percorre a planilha e devolve um registro por escola. Falha antes de produzir
 * qualquer linha se o cabeçalho técnico não estiver onde a auditoria constatou
 * ou se faltar uma coluna obrigatória.
 */
export function extrairEscolas(workbook, pacote) {
  const iterador = workbook.rows();
  const comMeta = new Set(pacote.edicoesComMeta);
  let cabecalho = null;

  const escolas = [];
  const ausenciasPorEstado = {};

  for (const linha of iterador) {
    if (linha.rowNumber < LINHA_CABECALHO) continue;

    if (linha.rowNumber === LINHA_CABECALHO) {
      cabecalho = mapearCabecalho(linha);
      const faltando = colunasEsperadas(pacote).filter((nome) => !cabecalho.has(nome));
      if (faltando.length > 0) {
        throw new ImportError(
          `${pacote.zipName}: coluna obrigatória ausente na linha ${LINHA_CABECALHO}: ${faltando.slice(0, 8).join(", ")}` +
            (faltando.length > 8 ? ` (+${faltando.length - 8})` : ""),
        );
      }
      continue;
    }

    if (linha.rowNumber < PRIMEIRA_LINHA_DADOS) continue;
    if (!cabecalho) {
      throw new ImportError(`${pacote.zipName}: cabeçalho técnico não encontrado na linha ${LINHA_CABECALHO}`);
    }

    const ler = (nome) => linha.cells.get(cabecalho.get(nome));

    // O rodapé editorial ("Fonte: MEC/Inep", notas) fica depois dos dados e não
    // traz código de escola: é o sinal de fim da tabela.
    const idEscolaBruto = ler("ID_ESCOLA");
    if (idEscolaBruto === undefined) continue;

    const contexto = `${pacote.id} linha ${linha.rowNumber}`;
    const escola = {
      codigoInep: normalizarIdentificador(idEscolaBruto, { digitos: 8, campo: "ID_ESCOLA" }),
      nome: normalizarTexto(ler("NO_ESCOLA"), { campo: "NO_ESCOLA" }),
      rede: normalizarTexto(ler("REDE"), { campo: "REDE" }),
      codigoIbge: normalizarIdentificador(ler("CO_MUNICIPIO"), { digitos: 7, campo: "CO_MUNICIPIO" }),
      municipio: normalizarTexto(ler("NO_MUNICIPIO"), { campo: "NO_MUNICIPIO" }),
      uf: normalizarTexto(ler("SG_UF"), { campo: "SG_UF" }),
      edicoes: {},
    };

    for (const edicao of pacote.edicoes) {
      const registro = {};
      for (const indicador of INDICADORES) {
        if (indicador.campo === "meta" && !comMeta.has(edicao)) continue;
        const resultado = normalizarIndicador(
          ler(`${indicador.coluna}_${edicao}`),
          `${contexto} coluna ${indicador.coluna}_${edicao}`,
        );
        if (resultado.tipo === "valor") {
          // O texto da observação vive no manifesto, não na partição: repeti-lo
          // por célula custaria centenas de MB sem acrescentar informação.
          registro[indicador.campo] = resultado.observacao
            ? { valor: resultado.valor, obs: OBSERVACAO_AVALIACAO_ESTADUAL_ID }
            : resultado.valor;
        } else if (resultado.tipo === "ausente") {
          // Mesma razão: guarda-se o estado, que é a informação; o motivo em
          // linguagem corrente está no manifesto, indexado por estado.
          registro[indicador.campo] = { estado: resultado.estado };
          ausenciasPorEstado[resultado.estado] = (ausenciasPorEstado[resultado.estado] ?? 0) + 1;
        }
        // "vazio" não gera chave: a coluna não trouxe conteúdo algum.
      }
      if (Object.keys(registro).length > 0) escola.edicoes[edicao] = registro;
    }

    escolas.push(escola);
  }

  if (!cabecalho) {
    throw new ImportError(`${pacote.zipName}: cabeçalho técnico não encontrado na linha ${LINHA_CABECALHO}`);
  }

  return { escolas, ausenciasPorEstado };
}

// ---- Montagem dos artefatos ------------------------------------------------

/** Ordenação estável e explícita, independente da ordem de leitura. */
const porCodigoInep = (a, b) => (a.codigoInep < b.codigoInep ? -1 : a.codigoInep > b.codigoInep ? 1 : 0);

/**
 * Junta as escolas dos três pacotes numa partição por município.
 *
 * Nenhum conflito é resolvido em silêncio. Se a mesma escola aparecer com nome,
 * rede, município ou UF diferentes entre pacotes da mesma edição, o importador
 * para: escolher um dos valores exigiria uma regra de precedência que ninguém
 * documentou, e a escolha errada fica invisível no artefato.
 */
export function montarArtefatos(porEtapa) {
  const municipios = new Map();
  // Identidade canônica por escola, e o pacote onde ela apareceu primeiro.
  const identidadeEscola = new Map();
  const conflitos = [];

  const registrar = (tipo, detalhe) => {
    if (conflitos.length < 25) conflitos.push({ tipo, ...detalhe });
  };

  for (const { pacote, escolas } of porEtapa) {
    const vistosNoPacote = new Set();

    for (const escola of escolas) {
      if (vistosNoPacote.has(escola.codigoInep)) {
        registrar("codigo_inep_duplicado_no_pacote", { pacote: pacote.id, codigoInep: escola.codigoInep });
        continue;
      }
      vistosNoPacote.add(escola.codigoInep);

      const identidade = {
        codigoIbge: escola.codigoIbge,
        municipio: escola.municipio,
        uf: escola.uf,
        nome: escola.nome,
        rede: escola.rede,
      };
      const anterior = identidadeEscola.get(escola.codigoInep);
      if (!anterior) {
        identidadeEscola.set(escola.codigoInep, { ...identidade, pacote: pacote.id });
      } else {
        for (const campo of ["codigoIbge", "municipio", "uf", "nome", "rede"]) {
          if (anterior[campo] !== identidade[campo]) {
            registrar("identidade_de_escola_divergente", {
              codigoInep: escola.codigoInep,
              campo,
              [`em_${anterior.pacote}`]: anterior[campo],
              [`em_${pacote.id}`]: identidade[campo],
            });
          }
        }
      }

      let municipio = municipios.get(escola.codigoIbge);
      if (!municipio) {
        municipio = {
          codigoIbge: escola.codigoIbge,
          nome: escola.municipio,
          uf: escola.uf,
          origem: pacote.id,
          escolas: new Map(),
        };
        municipios.set(escola.codigoIbge, municipio);
      } else {
        if (municipio.nome !== escola.municipio) {
          registrar("nome_de_municipio_divergente", {
            codigoIbge: escola.codigoIbge,
            [`em_${municipio.origem}`]: municipio.nome,
            [`em_${pacote.id}`]: escola.municipio,
          });
        }
        if (municipio.uf !== escola.uf) {
          registrar("uf_de_municipio_divergente", {
            codigoIbge: escola.codigoIbge,
            [`em_${municipio.origem}`]: municipio.uf,
            [`em_${pacote.id}`]: escola.uf,
          });
        }
      }

      let alvo = municipio.escolas.get(escola.codigoInep);
      if (!alvo) {
        alvo = { codigoInep: escola.codigoInep, nome: escola.nome, rede: escola.rede, etapas: {} };
        municipio.escolas.set(escola.codigoInep, alvo);
      }
      if (Object.prototype.hasOwnProperty.call(alvo.etapas, pacote.etapa)) {
        registrar("etapa_repetida_para_a_mesma_escola", {
          codigoInep: escola.codigoInep,
          etapa: pacote.etapa,
          pacote: pacote.id,
        });
        continue;
      }
      alvo.etapas[pacote.etapa] = escola.edicoes;
    }
  }

  if (conflitos.length > 0) {
    throw new ImportError(
      `${conflitos.length} conflito(s) de identidade entre os pacotes — nenhuma precedência foi aplicada. ` +
        `Ocorrências: ${JSON.stringify(conflitos, null, 2)}`,
    );
  }

  const codigos = [...municipios.keys()].sort();
  const particoes = codigos.map((codigo) => {
    const municipio = municipios.get(codigo);
    const escolas = [...municipio.escolas.values()].sort(porCodigoInep);
    return {
      codigoIbge: codigo,
      conteudo: {
        schema: SCHEMA_DATASET,
        municipio: { codigoIbge: municipio.codigoIbge, nome: municipio.nome, uf: municipio.uf },
        escolas,
      },
      totalEscolas: escolas.length,
    };
  });

  const indice = {
    schema: SCHEMA_INDICE,
    municipios: codigos.map((codigo) => {
      const municipio = municipios.get(codigo);
      return {
        codigoIbge: municipio.codigoIbge,
        nome: municipio.nome,
        uf: municipio.uf,
        escolas: municipio.escolas.size,
      };
    }),
  };

  return { particoes, indice };
}

// ---- Escrita ---------------------------------------------------------------

async function escreverAtomico(destino, conteudo) {
  await mkdir(path.dirname(destino), { recursive: true });
  const temporario = `${destino}.tmp-${process.pid}`;
  await writeFile(temporario, conteudo);
  await rename(temporario, destino);
}

// Nome de partição gerada: exatamente sete dígitos e extensão .json. Qualquer
// outra coisa dentro de municipios/ é tratada como estranha, nunca removida.
const NOME_DE_PARTICAO = /^\d{7}\.json$/;

/**
 * Compara o conjunto de arquivos presentes na saída com o esperado.
 *
 * Devolve `orfaos` — partições geradas que deixaram de fazer parte da saída, e
 * que portanto podem ser removidas com segurança — e `estranhos`, qualquer outro
 * arquivo, que nunca é removido.
 *
 * A varredura é rasa e limitada a `outDir` e `outDir/municipios`. Não desce por
 * links nem por subdiretórios inesperados: um subdiretório desconhecido é
 * reportado como estranho, em vez de percorrido.
 */
async function inspecionarSaida(outDir, esperados) {
  const orfaos = [];
  const estranhos = [];

  const raiz = await readdir(outDir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (raiz === null) return { orfaos, estranhos };

  for (const entrada of raiz) {
    const caminho = path.join(outDir, entrada.name);
    if (entrada.isDirectory()) {
      if (entrada.name !== "municipios") estranhos.push(caminho);
      continue;
    }
    if (!entrada.isFile() || !esperados.has(caminho)) estranhos.push(caminho);
  }

  const municipiosDir = path.join(outDir, "municipios");
  const dentro = await readdir(municipiosDir, { withFileTypes: true }).catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (dentro === null) return { orfaos, estranhos };

  for (const entrada of dentro) {
    const caminho = path.join(municipiosDir, entrada.name);
    if (!entrada.isFile() || !NOME_DE_PARTICAO.test(entrada.name)) {
      estranhos.push(caminho);
      continue;
    }
    if (!esperados.has(caminho)) orfaos.push(caminho);
  }

  orfaos.sort();
  estranhos.sort();
  return { orfaos, estranhos };
}

/**
 * Remove uma partição órfã. Toda a segurança está aqui, e é deliberadamente
 * redundante com `inspecionarSaida`: o caminho precisa estar dentro de
 * `outDir/municipios`, o nome precisa casar com o padrão exato, e a remoção é de
 * um arquivo único — nunca recursiva, nunca sobre caminho calculado.
 */
async function removerParticaoGerada(outDir, caminho) {
  const municipiosDir = path.resolve(outDir, "municipios");
  const alvo = path.resolve(caminho);
  const prefixo = municipiosDir + path.sep;

  if (!alvo.startsWith(prefixo)) {
    throw new ImportError(`recusa de remoção fora do diretório de saída: ${alvo}`);
  }
  if (path.dirname(alvo) !== municipiosDir) {
    throw new ImportError(`recusa de remoção em subdiretório inesperado: ${alvo}`);
  }
  if (!NOME_DE_PARTICAO.test(path.basename(alvo))) {
    throw new ImportError(`recusa de remoção de arquivo fora do padrão de partição: ${alvo}`);
  }
  await unlink(alvo);
}

/**
 * Escreve apenas quando o conteúdo mudou de fato. Reexecutar o importador sobre
 * a mesma fonte não deve alterar mtime de nada.
 */
async function escreverSeMudou(destino, texto) {
  const atual = await readFile(destino, "utf8").catch((error) => {
    if (error.code === "ENOENT") return null;
    throw error;
  });
  if (atual === texto) return false;
  await escreverAtomico(destino, texto);
  return true;
}

// ---- Manifesto -------------------------------------------------------------

export function montarManifesto({ pacotes, particoes, indice, ausenciasPorEstado, totalEscolas }) {
  return {
    schema_manifesto: SCHEMA_MANIFESTO,
    edicao: EDICAO_PILOTO,
    fonte: {
      atribuicao: ATRIBUICAO,
      pagina_oficial: PAGINA_OFICIAL,
      observacoes_metodologicas: RESSALVAS,
      metas_projetadas_ate: ULTIMA_EDICAO_COM_META,
    },
    pacotes: pacotes.map((item) => ({
      id: item.pacote.id,
      etapa: item.pacote.etapa,
      etapa_label: item.pacote.etapaLabel,
      url: item.pacote.url,
      arquivo: item.pacote.zipName,
      integridade: item.integridade,
      arquivos_internos_utilizados: [xlsxEntryName(item.pacote), md5EntryName(item.pacote)],
      edicoes_cobertas: item.pacote.edicoes,
      edicoes_com_meta: item.pacote.edicoesComMeta,
      escolas: item.totalEscolas,
    })),
    dataset: {
      schema_particao: SCHEMA_DATASET,
      schema_indice: SCHEMA_INDICE,
      edicoes: EDICOES,
      indicadores: INDICADORES.map(({ campo, coluna, descricao }) => ({ campo, coluna_origem: coluna, descricao })),
      estados_de_ausencia: MARCADORES_AUSENCIA.map(({ marcador, estado, motivo }) => ({ marcador, estado, motivo })),
      observacoes: { [OBSERVACAO_AVALIACAO_ESTADUAL_ID]: OBSERVACAO_AVALIACAO_ESTADUAL },
      municipios: particoes.length,
      escolas: totalEscolas,
      escolas_por_particao_maior: particoes.reduce((maior, item) => Math.max(maior, item.totalEscolas), 0),
      ausencias_por_estado: ausenciasPorEstado,
      indice_municipios: indice.municipios.length,
    },
    criterios: {
      inclusao: [
        "toda escola presente na planilha oficial de divulgação por escola da edição 2025",
        "todas as edições disponíveis em cada pacote, conforme a cobertura específica registrada por etapa",
      ],
      exclusao: [
        "taxas de aprovação por ano escolar (VL_APROVACAO_*): insumo do indicador de rendimento, já preservado em 'p'",
        "linhas de rodapé editorial, identificadas pela ausência de ID_ESCOLA",
        "planilha agregada do SAEB 2025: o Inep não publica MD5 oficial para ela",
      ],
      ausencia: "marcadores oficiais preservados como estado nomeado; ausência nunca vira zero nem null genérico",
    },
    ordenacao: {
      particoes: "código IBGE do município, ordem lexicográfica crescente",
      escolas: "código INEP da escola, ordem lexicográfica crescente",
      chaves_json: "todas as chaves de objeto ordenadas lexicograficamente antes da serialização",
    },
    proveniencia: {
      identificadores_preservados_como_texto: ["codigoIbge (7 dígitos)", "codigoInep (8 dígitos)"],
      separador_decimal: "ponto ou vírgula aceitos como separador decimal na origem; o artefato usa ponto",
      quebra_de_linha: "LF",
      campos_volateis: "nenhum: o manifesto não registra horário de execução, caminho local nem usuário",
    },
  };
}

// ---- Orquestração ----------------------------------------------------------

/**
 * Lê o cache, prova a integridade de cada pacote, extrai as escolas e monta
 * partições, índice e manifesto — tudo em memória, sem tocar disco além da
 * leitura do próprio cache.
 *
 * Compartilhada entre o modo normal/--check (que depois materializam o
 * resultado) e --verify-source (que só compara o resultado contra o que já
 * está no disco). Existe para que os dois caminhos nunca divirjam na lógica
 * de validação ou de normalização — só no que fazem com o resultado.
 */
async function construirDataset(registro, cacheDir, log) {
  const pacotes = [];
  const porEtapa = [];
  let ausenciasPorEstado = {};

  for (const pacote of registro) {
    const { xlsxBytes, integridade } = await verificarPacote(pacote, cacheDir);
    log(`${pacote.id}: integridade confirmada (md5 ${integridade.xlsx_md5_oficial})`);

    const workbook = openWorkbook(xlsxBytes);
    const { escolas, ausenciasPorEstado: ausencias } = extrairEscolas(workbook, pacote);
    log(`${pacote.id}: ${escolas.length} escolas lidas da aba ${JSON.stringify(workbook.sheetName)}`);

    for (const [estado, quantidade] of Object.entries(ausencias)) {
      ausenciasPorEstado[estado] = (ausenciasPorEstado[estado] ?? 0) + quantidade;
    }
    pacotes.push({ pacote, integridade, totalEscolas: escolas.length });
    porEtapa.push({ pacote, escolas });
  }

  const { particoes, indice } = montarArtefatos(porEtapa);
  const totalEscolas = new Set(porEtapa.flatMap(({ escolas }) => escolas.map((e) => e.codigoInep))).size;
  ausenciasPorEstado = Object.fromEntries(Object.entries(ausenciasPorEstado).sort());

  const manifesto = montarManifesto({ pacotes, particoes, indice, ausenciasPorEstado, totalEscolas });

  return { pacotes, particoes, indice, manifesto, totalEscolas, ausenciasPorEstado };
}

/**
 * `pacotes` é injetável para que os testes exercitem o fluxo inteiro sobre
 * fixtures sintéticas, sem rede e sem os 211 MB dos pacotes oficiais. Em
 * produção o padrão é sempre o registro oficial de ./lib/sources.mjs.
 */
export async function executar({ argv = [], cwd = root, logger = console, pacotes: registro = PACOTES } = {}) {
  const flags = parseArgs(argv);
  const cacheDir = path.resolve(cwd, flags.cache ?? path.join("data", "saeb", "source"));
  const outDir = path.resolve(cwd, flags.out ?? path.join("public", "data", "saeb"));
  const manifestoPath = path.resolve(cwd, path.join("data", "saeb", "manifest.json"));
  const linhasLog = [];
  const log = (mensagem) => {
    linhasLog.push(mensagem);
    logger.error?.(`[saeb] ${mensagem}`);
  };

  if (flags.download) {
    await mkdir(cacheDir, { recursive: true });
    const baixados = [];
    for (const pacote of registro) {
      baixados.push(await baixarPacote(pacote, cacheDir, log));
    }
    return { modo: "download", cacheDir, baixados, log: linhasLog };
  }

  // ---- --verify-source: valida fonte, parser e manifesto, não materializa nada.
  if (flags.verifySource) {
    const { pacotes, particoes, manifesto, totalEscolas } = await construirDataset(registro, cacheDir, log);
    const manifestoTexto = serializar(manifesto);

    // Comparação por leitura simples — nunca por escrita e diff: --verify-source
    // não pode deixar rastro nenhum no disco, nem um arquivo temporário.
    const manifestoAtual = await readFile(manifestoPath, "utf8").catch((error) => {
      if (error.code === "ENOENT") return null;
      throw error;
    });

    if (manifestoAtual === null) {
      throw new ImportError(
        `manifesto ausente em ${manifestoPath} — --verify-source não gera manifesto: rode a geração controlada ` +
          "(node scripts/saeb/import.mjs) e revise o diff antes de commitar.",
      );
    }
    if (manifestoAtual !== manifestoTexto) {
      throw new ImportError(
        `manifesto reconstruído diverge de ${manifestoPath} — --verify-source não regenera automaticamente: rode a ` +
          "geração controlada (node scripts/saeb/import.mjs) e revise o diff antes de commitar.",
      );
    }

    log(`manifesto: idêntico a ${manifestoPath}`);

    return {
      modo: "verify-source",
      cacheDir,
      pacotes: pacotes.map((item) => ({ id: item.pacote.id, etapa: item.pacote.etapa, escolas: item.totalEscolas })),
      escolas: totalEscolas,
      municipios: particoes.length,
      artefatosPrevistos: 2 + particoes.length,
      manifestoComparacao: "identico",
      escritos: 0,
      removidos: 0,
      log: linhasLog,
    };
  }

  const { particoes, indice, manifesto } = await construirDataset(registro, cacheDir, log);

  const artefatos = [
    { caminho: manifestoPath, texto: serializar(manifesto) },
    { caminho: path.join(outDir, "municipios-index.json"), texto: serializarCompacto(indice) },
    ...particoes.map((item) => ({
      caminho: path.join(outDir, "municipios", `${item.codigoIbge}.json`),
      texto: serializarCompacto(item.conteudo),
    })),
  ];

  const esperadosNaSaida = new Set(
    artefatos.filter((item) => item.caminho.startsWith(outDir)).map((item) => item.caminho),
  );
  const { orfaos, estranhos } = await inspecionarSaida(outDir, esperadosNaSaida);

  if (flags.check) {
    const divergentes = [];
    for (const artefato of artefatos) {
      const atual = await readFile(artefato.caminho, "utf8").catch((error) => {
        if (error.code === "ENOENT") return null;
        throw error;
      });
      if (atual === null) divergentes.push({ caminho: artefato.caminho, motivo: "ausente" });
      else if (atual !== artefato.texto) divergentes.push({ caminho: artefato.caminho, motivo: "conteudo_diverge" });
    }
    // Órfão é divergência: o conjunto na saída precisa ser exatamente o esperado.
    // Em --check nada é apagado nem criado — só relatado.
    for (const caminho of orfaos) divergentes.push({ caminho, motivo: "orfao" });
    for (const caminho of estranhos) divergentes.push({ caminho, motivo: "arquivo_estranho" });
    return {
      modo: "check",
      artefatos: artefatos.length,
      divergentes,
      escritos: 0,
      removidos: 0,
      manifesto,
      log: linhasLog,
    };
  }

  // Um arquivo que não é partição gerada nunca é apagado: pode ser trabalho de
  // alguém, e o importador não tem como saber. Aborta antes de escrever.
  if (estranhos.length > 0) {
    throw new ImportError(
      `arquivo(s) não reconhecido(s) no diretório de saída — o importador não remove o que não gerou. ` +
        `Resolva manualmente: ${estranhos.slice(0, 10).join(", ")}${estranhos.length > 10 ? ` (+${estranhos.length - 10})` : ""}`,
    );
  }

  let escritos = 0;
  for (const artefato of artefatos) {
    if (await escreverSeMudou(artefato.caminho, artefato.texto)) escritos += 1;
  }

  let removidos = 0;
  for (const caminho of orfaos) {
    await removerParticaoGerada(outDir, caminho);
    removidos += 1;
    log(`partição órfã removida: ${path.basename(caminho)}`);
  }

  // O horário da execução vive só aqui, num log ignorado pelo Git. É o que
  // permite ao manifesto ser determinístico sem perder rastreabilidade de quando
  // o importador rodou. Nunca escrito em modo --check.
  const logPath = path.resolve(cwd, path.join("data", "saeb", "last-run.log"));
  await escreverAtomico(
    logPath,
    `${new Date().toISOString()} artefatos=${artefatos.length} escritos=${escritos}\n${linhasLog.map((linha) => `  ${linha}`).join("\n")}\n`,
  );

  return {
    modo: "normal",
    removidos,
    logPath,
    outDir,
    manifestoPath,
    artefatos: artefatos.length,
    escritos,
    manifesto,
    log: linhasLog,
  };
}

const executadoDiretamente = process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (executadoDiretamente) {
  try {
    const resultado = await executar({ argv: process.argv.slice(2) });
    const resumo = { ...resultado };
    delete resumo.manifesto;
    delete resumo.log;
    console.log(JSON.stringify(resumo, null, 2));
    if (resultado.modo === "check" && resultado.divergentes.length > 0) {
      console.error(JSON.stringify({ divergentes: resultado.divergentes.slice(0, 20) }, null, 2));
      process.exitCode = 1;
    }
  } catch (error) {
    console.error(`[saeb] ${error.name}: ${error.message}`);
    process.exitCode = 1;
  }
}

export { escreverAtomico, escreverSeMudou, parseArgs, verificarPacote };
