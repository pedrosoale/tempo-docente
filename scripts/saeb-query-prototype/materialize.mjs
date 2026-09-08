// Protótipo de materialização — Etapa 3 (proposta da consulta do SAEB).
//
// NÃO é o importador de produção, e não substitui scripts/saeb/import.mjs.
// É um experimento para responder uma pergunta concreta: dá para consultar
// uma escola do SAEB baixando só a partição que a contém — sem baixar todos
// os resultados do município nem carregar um índice nacional com as 86.098
// escolas?
//
// Reaproveita integralmente a validação de integridade e a normalização do
// importador já commitado: verificarPacote(), extrairEscolas() e
// montarArtefatos() de ../saeb/import.mjs fazem exatamente o mesmo trabalho
// que fazem em produção — leitura do cache, checagem de fingerprint/MD5,
// normalização de valores e marcadores de ausência, detecção de conflitos de
// identidade. Nada disso é reimplementado aqui.
//
// A única lógica nova é a subdivisão por tamanho, aplicada depois de
// montarArtefatos() já ter produzido as partições por município no formato
// oficial. O laço de leitura dos pacotes abaixo (verificarPacote → openWorkbook
// → extrairEscolas) é uma repetição deliberada do laço interno de
// construirDataset() em import.mjs — repetido, não importado, para não exigir
// nenhuma mudança no importador já commitado por causa de um protótipo.
//
// Escreve só onde o chamador manda explicitamente. Nunca em public/data/saeb,
// nunca no cache oficial (data/saeb/source), nunca no manifesto (data/saeb/manifest.json).
import { gzipSync } from "node:zlib";
import { lstat, mkdir, readdir, readFile, stat } from "node:fs/promises";
import os from "node:os";
import path from "node:path";
import process from "node:process";

import { extrairEscolas, escreverSeMudou, montarArtefatos, verificarPacote } from "../saeb/import.mjs";
import { openWorkbook } from "../saeb/lib/xlsx.mjs";
import { ordenarProfundo, serializarCompacto } from "../saeb/lib/normalize.mjs";
import { PACOTES } from "../saeb/lib/sources.mjs";

export class PrototypeError extends Error {
  constructor(message) {
    super(message);
    this.name = "PrototypeError";
  }
}

/** Raiz do repositório — este arquivo vive em <raiz>/scripts/saeb-query-prototype/. */
const REPO_ROOT = path.resolve(import.meta.dirname, "..", "..");

const SCHEMA_PARTICAO_PROTOTIPO = "saeb-escolas-particao/1-prototipo";
const SCHEMA_INDICE_MUNICIPIO_PROTOTIPO = "saeb-escolas-indice-municipio/1-prototipo";
const SCHEMA_INDICE_NACIONAL_PROTOTIPO = "saeb-municipios-indice/1-prototipo";

export const gzipBytes = (texto) => gzipSync(Buffer.from(texto, "utf8")).length;

function montarConteudoParticao(municipio, escolas) {
  return { schema: SCHEMA_PARTICAO_PROTOTIPO, municipio, escolas };
}

/**
 * Agrupa escolas (assume-se já ordenadas por codigoInep, a mesma ordenação
 * estável que montarArtefatos() já aplica) em blocos cujo JSON canônico
 * comprimido fica dentro do limite — greedy, em uma passada, determinístico.
 *
 * Nunca separa os dados de uma escola entre dois blocos. Se uma única escola,
 * sozinha, já ultrapassar o limite, ela vira um bloco de tamanho 1 — registrada
 * em `excecoes`, nunca descartada nem cortada.
 */
export function agruparPorTamanho(escolasOrdenadas, limiteBytesGzip, montarConteudo) {
  if (!Number.isFinite(limiteBytesGzip) || limiteBytesGzip <= 0) {
    throw new PrototypeError(`limiteBytesGzip precisa ser um número positivo, recebido: ${limiteBytesGzip}`);
  }

  // Cada escola é canonicamente serializada (ordenarProfundo + JSON.stringify)
  // UMA vez — O(n) no total, não a cada tentativa de agrupamento. Isso elimina
  // o custo dominante do desenho anterior: reordenar e reserializar a lista
  // inteira a cada escola adicionada, que é O(n²) sobre estruturas profundas
  // (até 3 etapas × 11 edições × 6 indicadores por escola) e tornava o
  // protótipo impraticável para o maior município.
  //
  // Isto NÃO torna o agrupamento inteiro O(n): a cada escola candidata, ainda
  // se comprime de novo o bloco corrente inteiro (linha do gzipBytes logo
  // abaixo) para medir o tamanho real — trabalho proporcional ao tamanho do
  // bloco, repetido a cada tentativa dentro do mesmo bloco. Para um município
  // muito grande, isso ainda soma um custo quadrático no número de escolas
  // daquele município, só que sobre concatenação de string e compressão —
  // operações baratas — em vez de reordenação recursiva de objetos profundos.
  // Na prática medida (ver relatório), isso ficou aceitável: a materialização
  // nacional completa leva minutos, não horas. Não foi redesenhado nesta
  // rodada porque o desempenho medido é aceitável; se o SAEB crescer muito
  // (mais edições, mais municípios grandes), vale revisitar com um algoritmo
  // de busca binária pelo ponto de corte, em vez de avançar escola a escola.
  const fragmentos = escolasOrdenadas.map((escola) => JSON.stringify(ordenarProfundo(escola)));

  // O limite é sobre o ARQUIVO inteiro, não só sobre o array de escolas — o
  // envelope (schema + município) também entra no gzip real. Descobre o
  // prefixo/sufixo do envelope UMA vez, chamando montarConteudo com uma lista
  // vazia e localizando onde o array de escolas entraria, para medir durante a
  // varredura exatamente o mesmo texto que será gravado no fim.
  const envelopeVazio = serializarCompacto(montarConteudo([]));
  const marcador = '"escolas":[]';
  const posicaoMarcador = envelopeVazio.indexOf(marcador);
  if (posicaoMarcador === -1) {
    throw new PrototypeError('montarConteudo([]) não produziu o formato esperado ("escolas":[]) — não é possível medir o tamanho com segurança');
  }
  const prefixoEnvelope = `${envelopeVazio.slice(0, posicaoMarcador)}"escolas":[`;
  const sufixoEnvelope = `]${envelopeVazio.slice(posicaoMarcador + marcador.length)}`;

  const grupos = [];
  let atual = [];
  let textoAtual = ""; // fragmentos já unidos por vírgula, sem colchetes — cresce por concatenação, O(1) amortizado
  let tamanhoAtual = 0;

  for (let i = 0; i < escolasOrdenadas.length; i += 1) {
    const escola = escolasOrdenadas[i];
    const fragmento = fragmentos[i];
    const textoCandidato = tamanhoAtual === 0 ? fragmento : `${textoAtual},${fragmento}`;
    const bytes = gzipBytes(`${prefixoEnvelope}${textoCandidato}${sufixoEnvelope}`);
    if (tamanhoAtual > 0 && bytes > limiteBytesGzip) {
      grupos.push(atual);
      atual = [escola];
      textoAtual = fragmento;
      tamanhoAtual = 1;
    } else {
      atual.push(escola);
      textoAtual = textoCandidato;
      tamanhoAtual += 1;
    }
  }
  if (atual.length > 0) grupos.push(atual);

  // Exceção: grupo de uma escola só, que sozinha já passa do limite. O tamanho
  // final registrado usa a função canônica de verdade (montarConteudo +
  // serializarCompacto), não o atalho de concatenação — chamada só uma vez por
  // grupo de tamanho 1, custo desprezível.
  const excecoes = [];
  for (const grupo of grupos) {
    if (grupo.length === 1) {
      const bytes = gzipBytes(serializarCompacto(montarConteudo(grupo)));
      if (bytes > limiteBytesGzip) {
        excecoes.push({ codigoInep: grupo[0].codigoInep, bytesGzip: bytes, limiteBytesGzip });
      }
    }
  }

  return { grupos, excecoes };
}

/**
 * Processa um município (uma partição já montada por montarArtefatos()) em:
 *   - um índice leve das escolas do município (só o necessário para localizar
 *     cada escola: código INEP, nome, rede, e em qual arquivo de partição ela
 *     está) — nunca o histórico de indicadores;
 *   - uma ou mais partições de resultados, cada uma com os dados completos
 *     (todas as etapas e edições) das escolas que ela contém.
 */
export function materializarMunicipio(particaoMunicipio, limiteBytesGzip) {
  const { codigoIbge, conteudo } = particaoMunicipio;
  const { municipio, escolas } = conteudo;

  const montar = (lista) => montarConteudoParticao(municipio, lista);
  const { grupos, excecoes } = agruparPorTamanho(escolas, limiteBytesGzip, montar);

  const particoes = grupos.map((lista, indice) => {
    const arquivo = `${String(indice + 1).padStart(3, "0")}.json`;
    const conteudoParticao = montar(lista);
    const texto = serializarCompacto(conteudoParticao);
    return {
      arquivo,
      texto,
      bytesBrutos: Buffer.byteLength(texto, "utf8"),
      bytesGzip: gzipBytes(texto),
      totalEscolas: lista.length,
      escolas: lista,
    };
  });

  const escolasIndice = {
    schema: SCHEMA_INDICE_MUNICIPIO_PROTOTIPO,
    codigoIbge,
    municipio: { codigoIbge: municipio.codigoIbge, nome: municipio.nome, uf: municipio.uf },
    escolas: particoes.flatMap((particao) =>
      particao.escolas.map((escola) => ({
        codigoInep: escola.codigoInep,
        nome: escola.nome,
        rede: escola.rede,
        particao: particao.arquivo,
      })),
    ),
  };
  const escolasIndiceTexto = serializarCompacto(escolasIndice);

  return {
    codigoIbge,
    municipio,
    particoes,
    escolasIndiceTexto,
    escolasIndiceBytesBrutos: Buffer.byteLength(escolasIndiceTexto, "utf8"),
    escolasIndiceBytesGzip: gzipBytes(escolasIndiceTexto),
    excecoes,
    totalEscolas: escolas.length,
  };
}

/**
 * Lê os pacotes do cache (reaproveitando verificarPacote/extrairEscolas do
 * importador já commitado), monta as partições por município (reaproveitando
 * montarArtefatos — mesma checagem de conflito de identidade da produção), e
 * aplica a subdivisão por tamanho em cada uma. Tudo em memória; nada é escrito
 * aqui.
 *
 * O retorno inclui `referencia`: exatamente o array `particoes` que
 * montarArtefatos() produziu, ANTES de qualquer subdivisão — os registros
 * normalizados do importador, intocados. É o "lado esperado" para a
 * comparação semântica em compararComReferencia(); nunca deve ser obtido a
 * partir do resultado já subdividido/materializado.
 */
export async function construirPrototipo({ registro = PACOTES, cacheDir, limiteBytesGzip }) {
  const porEtapa = [];
  for (const pacote of registro) {
    const { xlsxBytes } = await verificarPacote(pacote, cacheDir);
    const workbook = openWorkbook(xlsxBytes);
    const { escolas } = extrairEscolas(workbook, pacote);
    porEtapa.push({ pacote, escolas });
  }

  const { particoes } = montarArtefatos(porEtapa);
  const referencia = particoes;
  const municipios = particoes.map((particao) => materializarMunicipio(particao, limiteBytesGzip));

  const indiceNacional = {
    schema: SCHEMA_INDICE_NACIONAL_PROTOTIPO,
    limiteBytesGzip,
    municipios: municipios.map((m) => ({
      codigoIbge: m.codigoIbge,
      nome: m.municipio.nome,
      uf: m.municipio.uf,
      escolas: m.totalEscolas,
      particoes: m.particoes.length,
    })),
  };
  const indiceNacionalTexto = serializarCompacto(indiceNacional);

  return { municipios, indiceNacionalTexto, limiteBytesGzip, referencia };
}

async function listarArquivosRecursivo(dir) {
  const raiz = await stat(dir).catch(() => null);
  if (!raiz) return [];
  const resultado = [];
  async function andar(atual) {
    const entradas = await readdir(atual, { withFileTypes: true });
    for (const entrada of entradas) {
      const caminho = path.join(atual, entrada.name);
      if (entrada.isDirectory()) await andar(caminho);
      else resultado.push(caminho);
    }
  }
  await andar(dir);
  return resultado;
}

// ---- Política de destino temporário ----------------------------------------
//
// O protótipo afirma escrever só fora do repositório. Isto aqui é o que torna
// essa afirmação verificável em código, não só em comentário: só um
// subdiretório DEDICADO dentro da raiz temporária do sistema é aceito como
// destino — nunca a própria raiz temporária, nunca uma raiz de disco, nunca o
// diretório home, nunca o repositório (ou qualquer coisa dentro dele:
// public/, data/, o cache oficial, o manifesto). Roda antes de qualquer
// processamento caro, e vale para a função — não só para a CLI.

/** `caminho` está estritamente dentro de `possivelAncestral` (não é o próprio). */
function ehAncestro(possivelAncestral, caminho) {
  const relativo = path.relative(possivelAncestral, caminho);
  return relativo !== "" && relativo !== ".." && !relativo.startsWith(`..${path.sep}`) && !path.isAbsolute(relativo);
}

/** `caminho` é igual a `possivelAncestral`, ou está estritamente dentro dele. */
function ehAncestroOuIgual(possivelAncestral, caminho) {
  return possivelAncestral === caminho || ehAncestro(possivelAncestral, caminho);
}

/**
 * Recusa qualquer segmento do caminho, do mais específico até (sem incluir) a
 * raiz temporária, que já exista em disco e seja um link simbólico ou uma
 * junction — só olha segmentos que já existem, porque o destino final
 * tipicamente ainda não existe na primeira execução.
 *
 * Limitação conhecida: criar um link simbólico de verdade no Windows exige
 * Modo de Desenvolvedor ou privilégio elevado; numa máquina sem isso, o teste
 * correspondente não consegue montar o cenário e é pulado explicitamente, não
 * silenciosamente — ver tests/saeb-query-prototype.test.mjs.
 */
async function recusarLinksNoCaminho(destino, raizTemp) {
  const segmentos = [];
  let atual = destino;
  while (atual !== raizTemp) {
    segmentos.push(atual);
    const pai = path.dirname(atual);
    if (pai === atual) break; // chegou na raiz do disco sem encontrar raizTemp — não deveria acontecer, já validado antes
    atual = pai;
  }
  for (const segmento of segmentos) {
    const info = await lstat(segmento).catch(() => null);
    if (info === null) continue; // ainda não existe — nada a checar neste segmento
    if (info.isSymbolicLink()) {
      throw new PrototypeError(`destino recusado: "${segmento}" é um link simbólico (ou junction) — não é permitido no caminho de destino`);
    }
    if (!info.isDirectory()) {
      throw new PrototypeError(`destino recusado: "${segmento}" já existe e não é um diretório`);
    }
  }
}

/**
 * Valida `outDirBruto` contra a política de destino temporário. Lança
 * PrototypeError com um motivo específico na primeira violação encontrada.
 * Devolve o caminho absoluto e normalizado, para uso no resto da função.
 */
export async function validarDestinoTemporario(outDirBruto, { raizRepositorio = REPO_ROOT } = {}) {
  if (typeof outDirBruto !== "string" || outDirBruto.trim() === "") {
    throw new PrototypeError("destino (--out) precisa ser um caminho não vazio");
  }

  const destino = path.resolve(outDirBruto);
  const raizTemp = path.resolve(os.tmpdir());
  const home = path.resolve(os.homedir());
  const raizDisco = path.parse(destino).root;
  const cacheOficial = path.resolve(raizRepositorio, "data", "saeb", "source");
  const manifesto = path.resolve(raizRepositorio, "data", "saeb", "manifest.json");
  const publicDir = path.resolve(raizRepositorio, "public");
  const dataDir = path.resolve(raizRepositorio, "data");

  if (destino === raizDisco) {
    throw new PrototypeError(`destino recusado: "${destino}" é uma raiz de disco`);
  }
  if (destino === raizTemp) {
    throw new PrototypeError(`destino recusado: não pode ser a própria raiz temporária (${raizTemp}) — use um subdiretório dedicado dentro dela`);
  }
  if (ehAncestroOuIgual(home, destino) && !ehAncestro(raizTemp, destino)) {
    throw new PrototypeError(`destino recusado: "${destino}" está dentro do diretório home (${home}) e fora da raiz temporária`);
  }
  for (const [rotulo, protegido] of [
    ["o repositório do projeto", raizRepositorio],
    ["public/", publicDir],
    ["data/", dataDir],
    ["o cache oficial", cacheOficial],
    ["o manifesto oficial", manifesto],
  ]) {
    if (ehAncestroOuIgual(protegido, destino) || ehAncestroOuIgual(destino, protegido)) {
      throw new PrototypeError(`destino recusado: "${destino}" colide com ${rotulo} ("${protegido}")`);
    }
  }
  if (!ehAncestro(raizTemp, destino)) {
    throw new PrototypeError(
      `destino recusado: "${destino}" precisa ser um subdiretório dedicado dentro da raiz temporária do sistema (${raizTemp})`,
    );
  }

  await recusarLinksNoCaminho(destino, raizTemp);

  return destino;
}

/**
 * Grava o plano de arquivos do protótipo em `outDir`. Segurança, nesta ordem:
 * (1) `outDir` passa pela política de destino temporário — ANTES de qualquer
 * leitura ou escrita, e mesmo que quem chamou já tenha validado, porque a
 * proteção precisa valer para a função, não só para a CLI; (2) cada caminho
 * planejado é reconferido como estritamente dentro do destino validado; (3) se
 * o destino já contiver qualquer arquivo que o plano não preveja, aborta sem
 * escrever nem apagar nada — nunca sobrescreve, nunca remove o que não
 * reconhece, nunca faz limpeza recursiva genérica. Escreve só o que mudou de
 * fato (via escreverSeMudou do importador), para que duas execuções sobre a
 * mesma entrada produzam os mesmos bytes e não toquem mtime de nada que já
 * esteja correto.
 */
export async function materializar({ outDir: outDirBruto, prototipo }) {
  const outDir = await validarDestinoTemporario(outDirBruto);

  const plano = new Map();
  plano.set(path.join(outDir, "municipios-index.json"), prototipo.indiceNacionalTexto);
  for (const m of prototipo.municipios) {
    const baseMunicipio = path.join(outDir, "municipios", m.codigoIbge);
    // O índice de escolas só é gravado quando o município tem mais de uma
    // partição — é o único caso em que o cliente precisa de algo para
    // descobrir ONDE está uma escola antes de baixar. Um município de
    // partição única não precisa de índice: o nome do arquivo é previsível
    // (particoes/001.json) e a contagem de partições já vem no índice
    // nacional. Sem essa condição, todo município ganharia um arquivo extra
    // só para apontar para si mesmo — quase dobrando o total de arquivos.
    if (m.particoes.length > 1) {
      plano.set(path.join(baseMunicipio, "escolas-index.json"), m.escolasIndiceTexto);
    }
    for (const particao of m.particoes) {
      plano.set(path.join(baseMunicipio, "particoes", particao.arquivo), particao.texto);
    }
  }

  for (const caminho of plano.keys()) {
    if (!ehAncestro(outDir, caminho)) {
      throw new PrototypeError(`plano de arquivos contém caminho fora do destino validado — abortando sem escrever nada: ${caminho}`);
    }
  }

  const existentes = await listarArquivosRecursivo(outDir);
  const estranhos = existentes.filter((caminho) => !plano.has(caminho));
  if (estranhos.length > 0) {
    throw new PrototypeError(
      `destino tem arquivo(s) que o protótipo não gerou — abortando sem tocar em nada: ` +
        `${estranhos.slice(0, 5).join(", ")}${estranhos.length > 5 ? ` (+${estranhos.length - 5})` : ""}`,
    );
  }

  await mkdir(outDir, { recursive: true });
  let escritos = 0;
  for (const [caminho, texto] of plano) {
    if (await escreverSeMudou(caminho, texto)) escritos += 1;
  }

  return { arquivos: plano.size, escritos, caminhos: [...plano.keys()].sort() };
}

// ---- Comparação semântica ---------------------------------------------------
//
// Determinismo (duas execuções produzem os mesmos bytes) e preservação
// semântica (o que foi materializado é fiel aos registros normalizados pelo
// importador) são propriedades DIFERENTES. Duas execuções idênticas podem
// convergir uma para a outra e ainda assim as duas terem perdido a mesma
// escola, se a perda for determinística. Isto aqui testa a segunda
// propriedade diretamente: lê os arquivos de verdade em disco e compara,
// campo a campo, contra `referencia` — o array que construirPrototipo()
// devolve, vindo de montarArtefatos() ANTES de qualquer subdivisão. Nunca
// aceita `referencia` reconstruída a partir da própria saída do protótipo.

const igualProfundo = (a, b) => serializarCompacto(a) === serializarCompacto(b);

/** Nome de arquivo de partição aceito pelo contrato: exatamente três dígitos + ".json". */
const NOME_PARTICAO_VALIDO = /^\d{3}\.json$/;

/**
 * Detecta chaves duplicadas numa lista ANTES de qualquer Map ser construído a
 * partir dela — um Map(lista.map(x => [chave(x), x])) mantém silenciosamente
 * só a última ocorrência de cada chave repetida, escondendo exatamente o tipo
 * de adulteração que este verificador existe para achar. Devolve uma entrada
 * por chave que aparece mais de uma vez.
 */
function detectarChavesDuplicadas(itens, chaveDe) {
  const contagem = new Map();
  for (const item of itens) {
    const chave = chaveDe(item);
    contagem.set(chave, (contagem.get(chave) ?? 0) + 1);
  }
  return [...contagem.entries()].filter(([, ocorrencias]) => ocorrencias > 1).map(([chave, ocorrencias]) => ({ chave, ocorrencias }));
}

/**
 * Compara integralmente `referencia` (registros normalizados do importador,
 * pré-subdivisão) com o que está de fato em `outDir` — nunca confiando em
 * nenhuma contagem ou apontamento que os próprios arquivos declarem sobre si
 * mesmos: cada afirmação (quantas escolas, quantas partições, qual o nome do
 * município) é confrontada contra a referência e/ou contra os arquivos
 * efetivamente presentes no disco. Usa codigoIbge e codigoInep como
 * identidade — nunca nome.
 *
 * Cobertura, em três camadas:
 *  - índice nacional: schema, duplicidade de município (antes de criar Map),
 *    identidade (nome/UF), contagem declarada de escolas e de partições
 *    (contra a referência e contra os arquivos reais, respectivamente);
 *  - partições: schema e identificação do município no PRÓPRIO ENVELOPE de
 *    cada arquivo (não só no índice nacional), nomenclatura (padrão NNN.json,
 *    partição única precisa ser exatamente 001.json), escolas perdidas,
 *    indevidas, duplicadas ou alteradas (deep-equal contra a referência);
 *  - índice municipal: presença condicionada à subdivisão real (não à
 *    contagem declarada), schema, identificação do município, duplicidade de
 *    código INEP (antes de criar Map), nome/rede de cada entrada contra a
 *    referência, e resolução de cada apontamento para um arquivo existente
 *    que de fato contém aquela escola.
 *
 * Somente leitura: nunca corrige o que encontra. Devolve
 * `{ ok, discrepancias, municipiosVerificados }` — `ok` só é `true` quando
 * `discrepancias` está vazio.
 */
export async function compararComReferencia({ referencia, outDir }) {
  const discrepancias = [];
  const registrar = (tipo, detalhe) => discrepancias.push({ tipo, ...detalhe });

  // ---- Índice nacional: schema e duplicidade, ANTES de qualquer Map --------
  const indiceNacional = JSON.parse(await readFile(path.join(outDir, "municipios-index.json"), "utf8"));
  if (indiceNacional.schema !== SCHEMA_INDICE_NACIONAL_PROTOTIPO) {
    registrar("indice_nacional_schema_invalido", { esperado: SCHEMA_INDICE_NACIONAL_PROTOTIPO, encontrado: indiceNacional.schema });
  }
  for (const { chave: codigoIbge, ocorrencias } of detectarChavesDuplicadas(indiceNacional.municipios ?? [], (m) => m.codigoIbge)) {
    registrar("indice_nacional_municipio_duplicado", { codigoIbge, ocorrencias });
  }
  const entradaIndicePorCodigo = new Map((indiceNacional.municipios ?? []).map((m) => [m.codigoIbge, m]));
  const referenciaPorCodigo = new Map(referencia.map((p) => [p.codigoIbge, p]));

  for (const codigoIbge of referenciaPorCodigo.keys()) {
    if (!entradaIndicePorCodigo.has(codigoIbge)) registrar("municipio_ausente", { codigoIbge });
  }
  for (const codigoIbge of entradaIndicePorCodigo.keys()) {
    if (!referenciaPorCodigo.has(codigoIbge)) registrar("municipio_indevido", { codigoIbge });
  }

  for (const [codigoIbge, particaoRef] of referenciaPorCodigo) {
    const entradaIndice = entradaIndicePorCodigo.get(codigoIbge);
    if (!entradaIndice) continue; // já registrado como municipio_ausente

    const municipioRef = particaoRef.conteudo.municipio;
    const escolasRef = particaoRef.conteudo.escolas;

    // ---- Índice nacional: identidade e contagem de escolas, contra a referência ----
    if (municipioRef.nome !== entradaIndice.nome || municipioRef.uf !== entradaIndice.uf) {
      registrar("indice_nacional_identidade_incorreta", {
        codigoIbge,
        esperado: { nome: municipioRef.nome, uf: municipioRef.uf },
        encontrado: { nome: entradaIndice.nome, uf: entradaIndice.uf },
      });
    }
    if (entradaIndice.escolas !== escolasRef.length) {
      registrar("indice_nacional_contagem_escolas_incorreta", { codigoIbge, esperado: escolasRef.length, declarado: entradaIndice.escolas });
    }

    // ---- Partições: arquivos REAIS no disco — nunca a contagem declarada ----
    const dirMunicipio = path.join(outDir, "municipios", codigoIbge);
    const dirParticoes = path.join(dirMunicipio, "particoes");
    const entradasDir = await readdir(dirParticoes, { withFileTypes: true }).catch(() => null);
    if (entradasDir === null) {
      registrar("particoes_ausentes", { codigoIbge });
      if (entradaIndice.particoes !== 0) {
        registrar("indice_nacional_contagem_particoes_incorreta", { codigoIbge, esperado: 0, declarado: entradaIndice.particoes });
      }
      continue;
    }

    const arquivosValidos = [];
    for (const entrada of entradasDir) {
      if (!entrada.isFile() || !NOME_PARTICAO_VALIDO.test(entrada.name)) {
        registrar("particao_nome_invalido", { codigoIbge, arquivo: entrada.name });
        continue;
      }
      arquivosValidos.push(entrada.name);
    }
    arquivosValidos.sort();

    // Este é o cerne do achado 1: a contagem que o índice nacional DECLARA
    // nunca decide nada sozinha — é confrontada aqui contra o que existe de
    // verdade em disco, e a divergência vira discrepância, não é ignorada.
    if (entradaIndice.particoes !== arquivosValidos.length) {
      registrar("indice_nacional_contagem_particoes_incorreta", { codigoIbge, esperado: arquivosValidos.length, declarado: entradaIndice.particoes });
    }

    if (arquivosValidos.length === 0) {
      registrar("particoes_ausentes", { codigoIbge });
      continue;
    }
    if (arquivosValidos.length === 1 && arquivosValidos[0] !== "001.json") {
      registrar("particao_unica_nome_incorreto", { codigoIbge, arquivo: arquivosValidos[0] });
    }

    // ---- Índice municipal: presença condicionada aos arquivos REAIS --------
    // (arquivosValidos.length, nunca entradaIndice.particoes) — schema,
    // identidade e duplicidade de código INEP, ANTES de qualquer Map.
    const caminhoIndiceMunicipal = path.join(dirMunicipio, "escolas-index.json");
    const existeIndiceMunicipal = (await stat(caminhoIndiceMunicipal).catch(() => null)) !== null;
    const deveriaExistirIndice = arquivosValidos.length > 1;

    let apontamentosIndice = null;
    if (deveriaExistirIndice && !existeIndiceMunicipal) {
      registrar("indice_municipal_ausente", { codigoIbge });
    } else if (!deveriaExistirIndice && existeIndiceMunicipal) {
      registrar("indice_municipal_indevido", { codigoIbge });
    } else if (deveriaExistirIndice && existeIndiceMunicipal) {
      const indiceMunicipal = JSON.parse(await readFile(caminhoIndiceMunicipal, "utf8"));

      if (indiceMunicipal.schema !== SCHEMA_INDICE_MUNICIPIO_PROTOTIPO) {
        registrar("indice_municipal_schema_invalido", { codigoIbge, esperado: SCHEMA_INDICE_MUNICIPIO_PROTOTIPO, encontrado: indiceMunicipal.schema });
      }
      const identificacao = indiceMunicipal.municipio ?? {};
      if (
        indiceMunicipal.codigoIbge !== codigoIbge ||
        identificacao.codigoIbge !== codigoIbge ||
        identificacao.nome !== municipioRef.nome ||
        identificacao.uf !== municipioRef.uf
      ) {
        registrar("indice_municipal_identidade_incorreta", {
          codigoIbge,
          esperado: { codigoIbge, nome: municipioRef.nome, uf: municipioRef.uf },
          encontrado: { codigoIbge: indiceMunicipal.codigoIbge, ...identificacao },
        });
      }

      for (const { chave: codigoInep, ocorrencias } of detectarChavesDuplicadas(indiceMunicipal.escolas ?? [], (e) => e.codigoInep)) {
        registrar("indice_municipal_escola_duplicada", { codigoIbge, codigoInep, ocorrencias });
      }
      apontamentosIndice = new Map((indiceMunicipal.escolas ?? []).map((e) => [e.codigoInep, e]));

      const escolasRefPorCodigoParaIndice = new Map(escolasRef.map((e) => [e.codigoInep, e]));
      for (const [codigoInep, entradaEscolaIndice] of apontamentosIndice) {
        const esperada = escolasRefPorCodigoParaIndice.get(codigoInep);
        if (!esperada) {
          registrar("indice_municipal_escola_indevida", { codigoIbge, codigoInep });
          continue;
        }
        if (entradaEscolaIndice.nome !== esperada.nome || entradaEscolaIndice.rede !== esperada.rede) {
          registrar("indice_municipal_entrada_incorreta", {
            codigoIbge,
            codigoInep,
            esperado: { nome: esperada.nome, rede: esperada.rede },
            encontrado: { nome: entradaEscolaIndice.nome, rede: entradaEscolaIndice.rede },
          });
        }
        if (!arquivosValidos.includes(entradaEscolaIndice.particao)) {
          registrar("indice_aponta_para_arquivo_inexistente", { codigoIbge, codigoInep, arquivo: entradaEscolaIndice.particao });
        }
      }
      for (const codigoInep of escolasRefPorCodigoParaIndice.keys()) {
        if (!apontamentosIndice.has(codigoInep)) registrar("indice_municipal_escola_ausente", { codigoIbge, codigoInep });
      }
    }

    // ---- Conteúdo de cada partição: schema, envelope do município, escolas ----
    const encontradasPorCodigo = new Map();
    const duplicadas = new Set();
    for (const arquivo of arquivosValidos) {
      let conteudo;
      try {
        conteudo = JSON.parse(await readFile(path.join(dirParticoes, arquivo), "utf8"));
      } catch (error) {
        registrar("particao_ilegivel", { codigoIbge, arquivo, erro: error.message });
        continue;
      }

      if (conteudo.schema !== SCHEMA_PARTICAO_PROTOTIPO) {
        registrar("particao_schema_invalido", { codigoIbge, arquivo, esperado: SCHEMA_PARTICAO_PROTOTIPO, encontrado: conteudo.schema });
      }
      // Achado 2: o nome do município no ENVELOPE de cada partição — não só
      // no índice nacional — precisa bater com a referência. Antes, nada lia
      // este campo de volta para conferir.
      const municipioParticao = conteudo.municipio ?? {};
      if (
        municipioParticao.codigoIbge !== codigoIbge ||
        municipioParticao.nome !== municipioRef.nome ||
        municipioParticao.uf !== municipioRef.uf
      ) {
        registrar("particao_municipio_alterado", {
          codigoIbge,
          arquivo,
          esperado: { codigoIbge, nome: municipioRef.nome, uf: municipioRef.uf },
          encontrado: municipioParticao,
        });
      }

      for (const escola of conteudo.escolas ?? []) {
        if (encontradasPorCodigo.has(escola.codigoInep)) {
          registrar("escola_duplicada", {
            codigoIbge,
            codigoInep: escola.codigoInep,
            arquivos: [encontradasPorCodigo.get(escola.codigoInep).arquivo, arquivo],
          });
          duplicadas.add(escola.codigoInep);
          continue;
        }
        encontradasPorCodigo.set(escola.codigoInep, { escola, arquivo });

        if (apontamentosIndice) {
          const apontamento = apontamentosIndice.get(escola.codigoInep);
          if (!apontamento) {
            registrar("escola_sem_apontamento_no_indice", { codigoIbge, codigoInep: escola.codigoInep });
          } else if (apontamento.particao !== arquivo) {
            registrar("apontamento_incorreto", {
              codigoIbge,
              codigoInep: escola.codigoInep,
              indiceAponta: apontamento.particao,
              encontradoEm: arquivo,
            });
          }
        }
      }
    }

    const codigosRef = new Set(escolasRef.map((e) => e.codigoInep));
    for (const codigoInep of codigosRef) {
      if (!encontradasPorCodigo.has(codigoInep)) registrar("escola_perdida", { codigoIbge, codigoInep });
    }
    for (const codigoInep of encontradasPorCodigo.keys()) {
      if (!codigosRef.has(codigoInep)) registrar("escola_indevida", { codigoIbge, codigoInep });
    }

    const escolasRefPorCodigo = new Map(escolasRef.map((e) => [e.codigoInep, e]));
    for (const [codigoInep, { escola: encontrada }] of encontradasPorCodigo) {
      if (duplicadas.has(codigoInep)) continue; // conteúdo não é confiável quando duplicada; já registrado acima
      const esperada = escolasRefPorCodigo.get(codigoInep);
      if (!esperada) continue; // já registrado como escola_indevida
      if (!igualProfundo(esperada, encontrada)) {
        registrar("escola_alterada", { codigoIbge, codigoInep });
      }
    }

    if (apontamentosIndice) {
      for (const codigoInep of apontamentosIndice.keys()) {
        if (!encontradasPorCodigo.has(codigoInep)) {
          registrar("indice_aponta_para_escola_inexistente", { codigoIbge, codigoInep });
        }
      }
    }
  }

  return { ok: discrepancias.length === 0, discrepancias, municipiosVerificados: referenciaPorCodigo.size };
}

// ---- Medição ----------------------------------------------------------------

function percentil(valoresOrdenados, p) {
  if (valoresOrdenados.length === 0) return 0;
  const indice = Math.min(valoresOrdenados.length - 1, Math.floor(p * valoresOrdenados.length));
  return valoresOrdenados[indice];
}

/**
 * Estatísticas do experimento — usadas tanto pela CLI quanto pelos testes.
 *
 * `indicesMunicipais` só considera municípios subdivididos (mais de uma
 * partição): são os únicos cujo índice de escolas é de fato materializado por
 * materializar() — ver o comentário lá. Incluir os de partição única inflaria
 * a mediana artificialmente com um arquivo que nunca chega a existir em disco.
 */
export function medir(prototipo) {
  const subdivididos = prototipo.municipios.filter((m) => m.particoes.length > 1);
  const indicesBrutos = subdivididos.map((m) => m.escolasIndiceBytesBrutos).sort((a, b) => a - b);
  const indicesGzip = subdivididos.map((m) => m.escolasIndiceBytesGzip).sort((a, b) => a - b);
  const particoesBrutas = prototipo.municipios.flatMap((m) => m.particoes.map((p) => p.bytesBrutos)).sort((a, b) => a - b);
  const particoesGzip = prototipo.municipios.flatMap((m) => m.particoes.map((p) => p.bytesGzip)).sort((a, b) => a - b);
  const totalParticoes = prototipo.municipios.reduce((soma, m) => soma + m.particoes.length, 0);
  const municipiosSubdivididos = subdivididos.length;
  const excecoes = prototipo.municipios.flatMap((m) => m.excecoes.map((e) => ({ codigoIbge: m.codigoIbge, ...e })));

  return {
    limiteBytesGzip: prototipo.limiteBytesGzip,
    municipios: prototipo.municipios.length,
    municipiosSubdivididos,
    totalParticoes,
    // 1 índice nacional + 1 índice de escolas só nos municípios subdivididos + todas as partições.
    totalArquivos: 1 + municipiosSubdivididos + totalParticoes,
    indiceNacional: {
      bytesBrutos: Buffer.byteLength(prototipo.indiceNacionalTexto, "utf8"),
      bytesGzip: gzipBytes(prototipo.indiceNacionalTexto),
    },
    indicesMunicipais: {
      arquivosMaterializados: municipiosSubdivididos,
      mediana: percentil(indicesBrutos, 0.5),
      p95: percentil(indicesBrutos, 0.95),
      max: indicesBrutos.at(-1) ?? 0,
      medianaGzip: percentil(indicesGzip, 0.5),
      p95Gzip: percentil(indicesGzip, 0.95),
      maxGzip: indicesGzip.at(-1) ?? 0,
    },
    particoes: {
      mediana: percentil(particoesBrutas, 0.5),
      p95: percentil(particoesBrutas, 0.95),
      max: particoesBrutas.at(-1) ?? 0,
      medianaGzip: percentil(particoesGzip, 0.5),
      p95Gzip: percentil(particoesGzip, 0.95),
      maxGzip: particoesGzip.at(-1) ?? 0,
    },
    excecoes,
  };
}

/** Encontra o município pelo código IBGE, para relatar casos específicos (ex.: São Paulo). */
export function encontrarMunicipio(prototipo, codigoIbge) {
  return prototipo.municipios.find((m) => m.codigoIbge === codigoIbge);
}

// ---- CLI de validação manual --------------------------------------------------
//
// node scripts/saeb-query-prototype/materialize.mjs --out <dir> --limite-kib 100 [--cache <dir>] [--sem-comparacao]
//
// Só roda contra o cache já existente (sem --download, sem rede). Escreve
// exclusivamente no --out informado, validado pela política de destino
// temporário ANTES de qualquer leitura de cache ou processamento — nunca em
// public/data/saeb. Por padrão, roda também a comparação semântica contra a
// referência (--sem-comparacao pula essa etapa, para inspecionar só a
// materialização).

function parseArgsCli(argv) {
  const flags = { out: null, cache: null, limiteKiB: 100, semComparacao: false };
  for (let i = 0; i < argv.length; i += 1) {
    const arg = argv[i];
    if (arg === "--out") flags.out = argv[++i];
    else if (arg === "--cache") flags.cache = argv[++i];
    else if (arg === "--limite-kib") flags.limiteKiB = Number(argv[++i]);
    else if (arg === "--sem-comparacao") flags.semComparacao = true;
    else throw new PrototypeError(`argumento desconhecido: ${arg}`);
  }
  if (!flags.out) throw new PrototypeError("--out é obrigatório: o protótipo nunca escreve num diretório implícito");
  if (!Number.isFinite(flags.limiteKiB) || flags.limiteKiB <= 0) {
    throw new PrototypeError(`--limite-kib precisa ser um número positivo, recebido: ${flags.limiteKiB}`);
  }
  return flags;
}

const executadoDiretamente =
  process.argv[1] && import.meta.url === new URL(`file://${process.argv[1].replace(/\\/g, "/")}`).href;

if (executadoDiretamente) {
  try {
    const flags = parseArgsCli(process.argv.slice(2));
    const cacheDir = path.resolve(flags.cache ?? path.join("data", "saeb", "source"));
    const limiteBytesGzip = Math.round(flags.limiteKiB * 1024);

    // Valida o destino ANTES do processamento caro (leitura do cache real,
    // normalização das ~86 mil escolas) — não depois.
    const outDir = await validarDestinoTemporario(flags.out);

    const inicioConstrucao = Date.now();
    const prototipo = await construirPrototipo({ cacheDir, limiteBytesGzip });
    const msConstrucao = Date.now() - inicioConstrucao;

    const inicioEscrita = Date.now();
    const resultadoEscrita = await materializar({ outDir, prototipo });
    const msEscrita = Date.now() - inicioEscrita;

    const estatisticas = medir(prototipo);

    let comparacao = null;
    let msComparacao = null;
    if (!flags.semComparacao) {
      const inicioComparacao = Date.now();
      comparacao = await compararComReferencia({ referencia: prototipo.referencia, outDir });
      msComparacao = Date.now() - inicioComparacao;
    }

    console.log(
      JSON.stringify(
        {
          limiteKiB: flags.limiteKiB,
          outDir,
          cacheDir,
          escritos: resultadoEscrita.escritos,
          arquivos: resultadoEscrita.arquivos,
          ...estatisticas,
          tempoMs: { construcao: msConstrucao, escrita: msEscrita, comparacaoSemantica: msComparacao },
          comparacaoSemantica: comparacao
            ? {
                ok: comparacao.ok,
                municipiosVerificados: comparacao.municipiosVerificados,
                discrepancias: comparacao.discrepancias.length,
                amostraDiscrepancias: comparacao.discrepancias.slice(0, 10),
              }
            : "pulada (--sem-comparacao)",
        },
        null,
        2,
      ),
    );
    if (comparacao && !comparacao.ok) process.exitCode = 1;
  } catch (error) {
    console.error(`[prototipo-saeb] ${error.name ?? "Error"}: ${error.message}`);
    process.exitCode = 1;
  }
}
