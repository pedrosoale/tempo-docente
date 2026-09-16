// Gerador determinístico do catálogo de descritores da matriz de referência tradicional (2001) do
// SAEB — Língua Portuguesa e Matemática, nas mesmas três etapas do piloto de escalas de proficiência
// (5º ano do Ensino Fundamental / Anos Iniciais, 9º ano do Ensino Fundamental / Anos Finais, e 3ª
// série do Ensino Médio). Mesmo padrão de scripts/saeb-escalas/gerar.mjs: uma única lógica de
// geração (`gerar`, abaixo) e dois modos de uso sobre ela:
//
//   node gerar.mjs           gera e grava data/saeb-descritores/matriz-lp-mt-2001.json
//   node gerar.mjs --check   gera em memória (nunca escreve) e compara byte a byte com o arquivo já
//                            versionado — ver `verificar()`.
//
// O arquivo-fonte (data/saeb-descritores/source/official-inep-matriz-lp-mt-2001.json) é uma
// transcrição hand-verified dos PDFs oficiais — cada descritor foi conferido visualmente contra a
// imagem renderizada da página do PDF (não contra o texto extraído: os dois PDFs oficiais usam um
// mapa de caracteres não padrão que corrompe letras acentuadas e algumas palavras na extração de
// texto automática, o mesmo problema já documentado em scripts/saeb-escalas/gerar.mjs para a
// publicação de escalas). O hash SHA-256 de cada PDF (fontes.lp.hashSha256 / fontes.mt.hashSha256)
// foi calculado diretamente sobre os bytes baixados de download.inep.gov.br nesta rodada — ver
// relatório do piloto para o registro completo da conferência.
//
// Diretório PRÓPRIO deste piloto (data/saeb-descritores/), deliberadamente separado de data/saeb/
// (partições de resultados escolares) e de data/saeb-escalas/ (catálogo de escalas de
// proficiência) — matriz de referência, descritor e escala de proficiência são conceitos distintos
// (ver lib/saeb/descritores.ts) e não devem compartilhar árvore de dados.
//
// ACHADO DOCUMENTAL: a ficha catalográfica interna de AMBOS os PDFs oficiais (Língua Portuguesa e
// Matemática) cita, por erro de diagramação do próprio Inep, "Matrizes de referência de linguagens
// Língua Portuguesa do Saeb – BNCC. Brasília, 2022" — mesmo no arquivo de Matemática. O corpo de
// cada documento contradiz essa ficha (cabeçalho de página, fonte interna de cada quadro e a
// referência final citam inequivocamente o Saeb 2001) — ver `fontes.lp.notaDocumental` e
// `fontes.mt.notaDocumental` no arquivo-fonte, e o relatório do piloto para o registro visual.
//
// ESCOPO: esta rodada cobre apenas a matriz TRADICIONAL (2001) — nunca a matriz alinhada à BNCC,
// que tem estrutura e terminologia próprias (ver documentação em lib/saeb/descritores.ts) e não é
// importada aqui.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serializar } from "../saeb/lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
const FONTE_PATH = join(REPO_ROOT, "data", "saeb-descritores", "source", "official-inep-matriz-lp-mt-2001.json");
const SAIDA_PATH = join(REPO_ROOT, "data", "saeb-descritores", "matriz-lp-mt-2001.json");

export class DescritoresGeracaoError extends Error {
  constructor(message) {
    super(message);
    this.name = "DescritoresGeracaoError";
  }
}

const HASH_HEX_64 = /^[0-9a-f]{64}$/;
const ETAPAS_VALIDAS = new Set(["anosIniciais", "anosFinais", "ensinoMedio"]);
const COMPONENTES_VALIDOS = new Set(["lp", "mt"]);
/** Domínio oficial do Inep — a URL da fonte precisa pertencer a ele (ou a um subdomínio dele). */
const DOMINIO_OFICIAL_INEP = "inep.gov.br";
/** Código de descritor no vocabulário oficial: sempre "D" seguido de um ou mais dígitos, sem zero à esquerda. */
const CODIGO_DESCRITOR = /^D([1-9][0-9]*)$/;

/** Quantidade de descritores documentada para cada etapa/componente, conferida a mão contra os
 * Quadros de distribuição (Quadro 2, 4 e 6 do PDF de Língua Portuguesa; contagem direta dos Quadros
 * 1, 2 e 3 do PDF de Matemática, que não têm quadro de distribuição separado). Uma mudança nesse
 * número sem atualização deliberada deste mapa é tratada como possível erro de transcrição, nunca
 * silenciada. */
const CONTAGEM_ESPERADA = {
  "anosIniciais/lp": 15,
  "anosFinais/lp": 21,
  "ensinoMedio/lp": 21,
  "anosIniciais/mt": 28,
  "anosFinais/mt": 37,
  "ensinoMedio/mt": 35,
};

/** Rótulo de agrupamento oficial por componente — a fonte de Língua Portuguesa rotula os grupos como
 * "TÓPICOS" e a de Matemática como "TEMAS" (conferido no cabeçalho de cada Quadro), e essa distinção
 * nunca muda por etapa. Um valor tecnicamente presente no vocabulário {"topico","tema"} mas errado
 * para o componente (ex.: "tema" numa matriz de LP) precisa ser rejeitado, não só aceito por estar na
 * lista de valores possíveis. */
const ROTULO_ESPERADO_POR_COMPONENTE = { lp: "topico", mt: "tema" };

/** Tópicos/temas oficiais por componente — número (algarismo romano) e nome exatamente como o
 * cabeçalho de cada Quadro apresenta. Constante por componente (não varia por etapa: os mesmos seis
 * tópicos de LP, e os mesmos quatro temas de MT, se repetem nas três etapas — conferido visualmente
 * nos Quadros 1/3/5 de LP e 1/2/3 de MT). Usado para rejeitar tópico/tema inventado, número de grupo
 * duplicado, e grupo oficial ausente ou repetido. */
const GRUPOS_OFICIAIS_POR_COMPONENTE = {
  lp: [
    ["I", "Procedimentos de leitura"],
    ["II", "Implicações do suporte, do gênero e/ou do enunciador na compreensão do texto"],
    ["III", "Relação entre textos"],
    ["IV", "Coerência e coesão no processamento do texto"],
    ["V", "Relações entre recursos expressivos e efeitos de sentido"],
    ["VI", "Variação linguística"],
  ],
  mt: [
    ["I", "Espaço e Forma"],
    ["II", "Grandezas e Medidas"],
    ["III", "Números e Operações/Álgebra e Funções"],
    ["IV", "Tratamento da Informação"],
  ],
};

/** Códigos "D<n>" de inicio a fim, inclusive — só para compactar as faixas contíguas de
 * CODIGOS_POR_GRUPO_ESPERADO abaixo (usada nos grupos de Matemática, onde a numeração oficial segue
 * a ordem dos temas). Nunca usada para os grupos de Língua Portuguesa, cuja numeração NÃO é
 * contígua por tópico (ver comentário abaixo). */
function faixaDescritores(inicio, fim) {
  const codigos = [];
  for (let i = inicio; i <= fim; i += 1) codigos.push(`D${i}`);
  return codigos;
}

/** Conjunto EXATO de códigos de descritor esperado em CADA grupo oficial, por etapa/componente —
 * conferido diretamente contra os Quadros de distribuição oficiais (Quadro 2, 4 e 6 de LP; Quadros
 * 1/2/3 de MT). Existe porque validar só a QUANTIDADE por grupo não detecta a troca de dois
 * descritores entre dois grupos do mesmo tamanho (ex.: D1 do tópico I trocado por D10 do tópico VI em
 * LP/5º ano preserva o total de cada grupo, a unicidade dos códigos e o total da matriz — só o
 * CONJUNTO de códigos por grupo expõe a troca). Estes valores são literais e independentes de
 * qualquer cálculo sobre o arquivo-fonte: uma comparação de conjunto entre isto e os códigos
 * realmente presentes em cada grupo, nunca uma contagem.
 *
 * A numeração de Língua Portuguesa NÃO segue a ordem dos tópicos no documento oficial (ex.: o tópico
 * I "Procedimentos de leitura" contém D1, D3, D4, D6, D11 — não D1..D5), por isso os grupos de LP são
 * listados por extenso; a numeração de Matemática segue a ordem dos temas, por isso usa
 * faixaDescritores para compactar. */
const CODIGOS_POR_GRUPO_ESPERADO = {
  "anosIniciais/lp": {
    I: ["D1", "D3", "D4", "D6", "D11"],
    II: ["D5", "D9"],
    III: ["D15"],
    IV: ["D2", "D7", "D8", "D12"],
    V: ["D13", "D14"],
    VI: ["D10"],
  },
  "anosFinais/lp": {
    I: ["D1", "D3", "D4", "D6", "D14"],
    II: ["D5", "D12"],
    III: ["D20", "D21"],
    IV: ["D2", "D7", "D8", "D9", "D10", "D11", "D15"],
    V: ["D16", "D17", "D18", "D19"],
    VI: ["D13"],
  },
  "ensinoMedio/lp": {
    // Idêntico a anosFinais/lp — a matriz tradicional de LP reutiliza o mesmo conjunto de
    // descritores para o 9º ano e para a 3ª série do Ensino Médio (ver Quadros 3 e 5 do PDF oficial).
    I: ["D1", "D3", "D4", "D6", "D14"],
    II: ["D5", "D12"],
    III: ["D20", "D21"],
    IV: ["D2", "D7", "D8", "D9", "D10", "D11", "D15"],
    V: ["D16", "D17", "D18", "D19"],
    VI: ["D13"],
  },
  "anosIniciais/mt": {
    I: faixaDescritores(1, 5),
    II: faixaDescritores(6, 12),
    III: faixaDescritores(13, 26),
    IV: faixaDescritores(27, 28),
  },
  "anosFinais/mt": {
    I: faixaDescritores(1, 11),
    II: faixaDescritores(12, 15),
    III: faixaDescritores(16, 35),
    IV: faixaDescritores(36, 37),
  },
  "ensinoMedio/mt": {
    I: faixaDescritores(1, 10),
    II: faixaDescritores(11, 13),
    III: faixaDescritores(14, 33),
    IV: faixaDescritores(34, 35),
  },
};

function ehTextoNaoVazio(valor) {
  return typeof valor === "string" && valor.trim() !== "";
}

function ehInteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

/** Metadados de uma publicação (um por componente: lp, mt) — título, órgão, versão, hash e URL. */
function validarFonte(fonte, contexto) {
  if (!fonte || typeof fonte !== "object") {
    throw new DescritoresGeracaoError(`${contexto}: metadado de fonte ausente`);
  }
  for (const campo of ["titulo", "orgao", "versaoPublicacao"]) {
    if (!ehTextoNaoVazio(fonte[campo])) {
      throw new DescritoresGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio, recebeu ${JSON.stringify(fonte[campo])}`);
    }
  }
  if (typeof fonte.hashSha256 !== "string" || !HASH_HEX_64.test(fonte.hashSha256)) {
    throw new DescritoresGeracaoError(`${contexto}: hashSha256 ausente ou malformado`);
  }
  if (!ehInteiroPositivo(fonte.totalPaginasPdf)) {
    throw new DescritoresGeracaoError(`${contexto}: totalPaginasPdf precisa ser um inteiro positivo, recebeu ${JSON.stringify(fonte.totalPaginasPdf)}`);
  }
  if (!ehTextoNaoVazio(fonte.url)) {
    throw new DescritoresGeracaoError(`${contexto}: campo "url" precisa ser texto não vazio`);
  }
  let url;
  try {
    url = new URL(fonte.url);
  } catch {
    throw new DescritoresGeracaoError(`${contexto}: url inválida: ${JSON.stringify(fonte.url)}`);
  }
  if (url.protocol !== "https:") {
    throw new DescritoresGeracaoError(`${contexto}: url precisa ser HTTPS, recebeu "${fonte.url}"`);
  }
  const dominioOficial = url.hostname === DOMINIO_OFICIAL_INEP || url.hostname.endsWith(`.${DOMINIO_OFICIAL_INEP}`);
  if (!dominioOficial) {
    throw new DescritoresGeracaoError(`${contexto}: url precisa pertencer ao domínio oficial do Inep (*.${DOMINIO_OFICIAL_INEP}), recebeu host "${url.hostname}"`);
  }
  if (fonte.notaDocumental !== undefined && !ehTextoNaoVazio(fonte.notaDocumental)) {
    throw new DescritoresGeracaoError(`${contexto}: notaDocumental, quando presente, precisa ser texto não vazio`);
  }
}

function validarDescritor(descritor, fontePaginas, contexto) {
  if (!CODIGO_DESCRITOR.test(descritor.codigo ?? "")) {
    throw new DescritoresGeracaoError(`${contexto}: código de descritor inválido: ${JSON.stringify(descritor.codigo)} (esperado "D" seguido de dígitos, ex.: "D1")`);
  }
  if (!ehTextoNaoVazio(descritor.texto)) {
    throw new DescritoresGeracaoError(`${contexto}: descritor ${descritor.codigo} sem texto oficial`);
  }
  for (const [campoPaginas, valor] of [["paginasPdf", descritor.paginasPdf], ["paginasImpressas", descritor.paginasImpressas]]) {
    if (!Array.isArray(valor) || valor.length === 0) {
      throw new DescritoresGeracaoError(`${contexto}: descritor ${descritor.codigo} tem "${campoPaginas}" que precisa ser um array não vazio`);
    }
    for (const pagina of valor) {
      if (!ehInteiroPositivo(pagina)) {
        throw new DescritoresGeracaoError(`${contexto}: descritor ${descritor.codigo} tem página inválida em "${campoPaginas}": ${JSON.stringify(pagina)} (precisa ser inteiro positivo)`);
      }
    }
  }
  for (const pagina of descritor.paginasPdf) {
    if (pagina > fontePaginas) {
      throw new DescritoresGeracaoError(`${contexto}: descritor ${descritor.codigo} tem página de PDF ${pagina} além do total de páginas da fonte (${fontePaginas})`);
    }
  }
}

function validarGrupo(grupo, fontePaginas, contexto) {
  if (!ehTextoNaoVazio(grupo.numero)) {
    throw new DescritoresGeracaoError(`${contexto}: grupo sem "numero" (ex.: "I", "II")`);
  }
  if (!ehTextoNaoVazio(grupo.nome)) {
    throw new DescritoresGeracaoError(`${contexto}: grupo "${grupo.numero}" sem "nome"`);
  }
  if (!Array.isArray(grupo.descritores) || grupo.descritores.length === 0) {
    throw new DescritoresGeracaoError(`${contexto}: grupo "${grupo.numero}" (${grupo.nome}) sem descritores`);
  }
  for (const descritor of grupo.descritores) {
    validarDescritor(descritor, fontePaginas, `${contexto}, grupo ${grupo.numero} (${grupo.nome})`);
  }
}

/**
 * Valida que os grupos (tópicos/temas) de uma matriz são exatamente os grupos oficiais do
 * componente — nem um tópico/tema inventado, nem um número de grupo duplicado, nem um grupo oficial
 * faltando ou repetido — e que cada grupo tem exatamente o CONJUNTO de códigos documentado para ele
 * nesse recorte (ver CODIGOS_POR_GRUPO_ESPERADO). Comparar o conjunto, não só o tamanho, é
 * deliberado: dois descritores trocados entre dois grupos do mesmo tamanho preservam a contagem por
 * grupo, a unicidade de cada código na matriz e o total geral — só o conjunto exato por grupo expõe
 * essa troca. Roda depois de validarGrupo (que já garantiu numero/nome/descritores não vazios) e
 * antes da checagem de densidade global de códigos.
 */
function validarGruposOficiais(matriz, contexto) {
  const oficiais = GRUPOS_OFICIAIS_POR_COMPONENTE[matriz.componente];
  const codigosPorGrupoEsperado = CODIGOS_POR_GRUPO_ESPERADO[`${matriz.etapa}/${matriz.componente}`];
  if (!codigosPorGrupoEsperado) {
    throw new DescritoresGeracaoError(`${contexto}: nenhum conjunto de códigos por grupo registrado para este recorte — atualize CODIGOS_POR_GRUPO_ESPERADO deliberadamente antes de aceitar`);
  }

  const numerosVistos = new Set();
  for (const grupo of matriz.grupos) {
    if (numerosVistos.has(grupo.numero)) {
      throw new DescritoresGeracaoError(`${contexto}: número de grupo duplicado: "${grupo.numero}"`);
    }
    numerosVistos.add(grupo.numero);

    const parOficial = oficiais.find(([numero, nome]) => numero === grupo.numero && nome === grupo.nome);
    if (!parOficial) {
      throw new DescritoresGeracaoError(
        `${contexto}: grupo "${grupo.numero}. ${grupo.nome}" não corresponde a nenhum tópico/tema oficial de ${matriz.componente === "lp" ? "Língua Portuguesa" : "Matemática"} — tópicos/temas inventados não são aceitos`,
      );
    }

    const codigosEsperados = codigosPorGrupoEsperado[grupo.numero];
    const codigosReais = grupo.descritores.map((descritor) => descritor.codigo);
    const setEsperado = new Set(codigosEsperados);
    const setReal = new Set(codigosReais);
    const faltando = codigosEsperados.filter((codigo) => !setReal.has(codigo));
    const inesperados = codigosReais.filter((codigo) => !setEsperado.has(codigo));
    if (faltando.length > 0 || inesperados.length > 0 || setReal.size !== codigosReais.length) {
      throw new DescritoresGeracaoError(
        `${contexto}: grupo "${grupo.numero}. ${grupo.nome}" não tem exatamente o conjunto de códigos documentado (conferido contra o quadro de distribuição oficial) — esperado ${JSON.stringify(codigosEsperados)}, encontrado ${JSON.stringify(codigosReais)}` +
          (faltando.length > 0 ? `; faltando: ${JSON.stringify(faltando)}` : "") +
          (inesperados.length > 0 ? `; não deveria estar aqui: ${JSON.stringify(inesperados)}` : "") +
          " — um descritor pode ter sido arquivado sob o tópico/tema errado",
      );
    }
  }

  if (matriz.grupos.length !== oficiais.length) {
    throw new DescritoresGeracaoError(`${contexto}: esperado exatamente ${oficiais.length} grupos oficiais, encontrado ${matriz.grupos.length} — grupo oficial faltando ou repetido`);
  }
}

function validarMatriz(matriz, fontesPorComponente) {
  const contexto = `matriz ${matriz.etapa ?? "?"}/${matriz.componente ?? "?"}`;
  if (!ETAPAS_VALIDAS.has(matriz.etapa)) throw new DescritoresGeracaoError(`${contexto}: etapa desconhecida`);
  if (!COMPONENTES_VALIDOS.has(matriz.componente)) throw new DescritoresGeracaoError(`${contexto}: componente desconhecido — este piloto só cobre lp/mt`);
  for (const campo of ["etapaLabelOficial", "quadro", "tituloOficial", "fonteInternaCitada"]) {
    if (!ehTextoNaoVazio(matriz[campo])) {
      throw new DescritoresGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio, recebeu ${JSON.stringify(matriz[campo])}`);
    }
  }
  const rotuloEsperado = ROTULO_ESPERADO_POR_COMPONENTE[matriz.componente];
  if (matriz.rotuloAgrupamento !== rotuloEsperado) {
    throw new DescritoresGeracaoError(
      `${contexto}: rotuloAgrupamento deveria ser "${rotuloEsperado}" para o componente "${matriz.componente}", recebeu ${JSON.stringify(matriz.rotuloAgrupamento)}`,
    );
  }
  if (!Array.isArray(matriz.grupos) || matriz.grupos.length === 0) {
    throw new DescritoresGeracaoError(`${contexto}: sem grupos (tópicos/temas)`);
  }

  const fonte = fontesPorComponente[matriz.componente];
  for (const grupo of matriz.grupos) validarGrupo(grupo, fonte.totalPaginasPdf, contexto);
  validarGruposOficiais(matriz, contexto);

  // Nenhum código repetido dentro da matriz, e a numeração precisa ser densa a partir de D1 — uma
  // lacuna ou duplicata é tratada como erro de transcrição, nunca um recorte parcial silencioso.
  const codigos = matriz.grupos.flatMap((grupo) => grupo.descritores.map((descritor) => descritor.codigo));
  if (new Set(codigos).size !== codigos.length) {
    throw new DescritoresGeracaoError(`${contexto}: há código de descritor duplicado — códigos: ${JSON.stringify(codigos)}`);
  }
  const numeros = codigos.map((codigo) => Number(codigo.slice(1))).sort((a, b) => a - b);
  for (let i = 0; i < numeros.length; i += 1) {
    if (numeros[i] !== i + 1) {
      throw new DescritoresGeracaoError(`${contexto}: numeração de descritor não é densa a partir de D1 — esperado D${i + 1}, encontrado D${numeros[i]} (códigos: ${JSON.stringify(codigos)})`);
    }
  }

  const chave = `${matriz.etapa}/${matriz.componente}`;
  const esperado = CONTAGEM_ESPERADA[chave];
  if (esperado === undefined) {
    throw new DescritoresGeracaoError(`${contexto}: nenhuma contagem esperada registrada para "${chave}" — atualize CONTAGEM_ESPERADA deliberadamente antes de aceitar este recorte`);
  }
  if (codigos.length !== esperado) {
    throw new DescritoresGeracaoError(`${contexto}: esperado exatamente ${esperado} descritores (conferido contra o quadro de distribuição oficial), encontrado ${codigos.length}`);
  }
}

/** SHA-256 (hex) dos bytes reais de um arquivo local — mesmo algoritmo usado para calcular
 * fonte.hashSha256 na primeira conferência (ver comentário de topo). Não depende de rede: lê só o
 * arquivo local indicado. */
export function calcularHashSha256(caminhoArquivo) {
  const bytes = readFileSync(caminhoArquivo);
  return createHash("sha256").update(bytes).digest("hex");
}

/**
 * Confere o hashSha256 de um metadado de fonte contra os bytes reais de uma cópia local do PDF —
 * nunca busca o PDF pela rede, e nunca embute os PDFs oficiais no repositório ou nos testes: quem
 * chama esta função precisa fornecer `caminhoArquivo` apontando para uma cópia já presente no
 * sistema de arquivos (ex.: durante uma reconferência documental manual). `gerar()` NÃO chama esta
 * função automaticamente — os PDFs oficiais vivem fora do repositório (ver comentário de topo) e o
 * build não pode depender de um arquivo que não existe em CI. Lança DescritoresGeracaoError quando o
 * hash calculado diverge do hash registrado, nomeando os dois valores para facilitar o diagnóstico.
 */
export function verificarHashPdfLocal({ caminhoArquivo, hashEsperado }) {
  const hashCalculado = calcularHashSha256(caminhoArquivo);
  if (hashCalculado !== hashEsperado) {
    throw new DescritoresGeracaoError(
      `Hash SHA-256 do arquivo local (${caminhoArquivo}) não confere com o hash registrado na fonte — esperado ${hashEsperado}, calculado ${hashCalculado}. ` +
        "O arquivo pode ter sido substituído, corrompido, ou o Inep pode ter republicado o PDF — reconfira manualmente antes de atualizar hashSha256.",
    );
  }
}

export function gerar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH, escrever = true } = {}) {
  const bruto = readFileSync(fontePath, "utf-8");
  const fonteJson = JSON.parse(bruto);

  const { fontes, matrizes } = fonteJson;
  if (!fontes || typeof fontes !== "object") {
    throw new DescritoresGeracaoError("Nenhum metadado de fonte encontrado no arquivo-fonte (campo \"fontes\")");
  }
  for (const componente of COMPONENTES_VALIDOS) {
    if (!fontes[componente]) {
      throw new DescritoresGeracaoError(`Metadado de fonte ausente para o componente "${componente}"`);
    }
    validarFonte(fontes[componente], `fontes.${componente}`);
  }
  if (!Array.isArray(matrizes) || matrizes.length === 0) {
    throw new DescritoresGeracaoError("Nenhuma matriz encontrada no arquivo-fonte");
  }
  for (const matriz of matrizes) validarMatriz(matriz, fontes);

  // Precisa cobrir exatamente lp e mt nas três etapas do piloto — nem mais, nem menos.
  const chaves = matrizes.map((m) => `${m.etapa}/${m.componente}`).sort();
  const esperado = ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"].sort();
  if (chaves.length !== esperado.length || !chaves.every((c, i) => c === esperado[i])) {
    throw new DescritoresGeracaoError(`Escopo do catálogo inesperado — esperado exatamente ${JSON.stringify(esperado)}, encontrado ${JSON.stringify(chaves)}`);
  }

  const catalogo = {
    schema: "saeb-descritores-piloto/1",
    piloto: {
      etapas: ["anosIniciais", "anosFinais", "ensinoMedio"],
      componentes: ["lp", "mt"],
      matrizAbrangida: "tradicional-2001",
    },
    fontes,
    matrizes,
  };

  const texto = serializar(catalogo);
  let escrito = false;
  if (escrever) {
    let atual;
    try {
      atual = readFileSync(saidaPath, "utf-8");
    } catch (error) {
      if (error.code !== "ENOENT") throw error;
    }
    if (atual !== texto) {
      writeFileSync(saidaPath, texto, "utf-8");
      escrito = true;
    }
  }
  return { catalogo, texto, escrito };
}

/**
 * Verifica que o catálogo já versionado em `saidaPath` é exatamente o que `gerar` produziria agora,
 * a partir de `fontePath` — nunca escreve em `saidaPath`. Mesmo raciocínio de
 * scripts/saeb-escalas/gerar.mjs: uma única comparação de bytes cobre desatualização, edição manual
 * e divergência de serialização ao mesmo tempo.
 */
export function verificar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH } = {}) {
  const { texto: esperado } = gerar({ fontePath, saidaPath, escrever: false });
  let atual;
  try {
    atual = readFileSync(saidaPath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new DescritoresGeracaoError(`Catálogo versionado não encontrado em ${saidaPath} — rode "npm run saeb:descritores:gerar" primeiro.`);
    }
    throw error;
  }
  if (atual !== esperado) {
    throw new DescritoresGeracaoError(
      `Catálogo versionado em ${saidaPath} diverge da fonte em ${fontePath} — rode "npm run saeb:descritores:gerar" para regenerá-lo. Nunca edite o catálogo gerado manualmente.`,
    );
  }
  return { texto: esperado };
}

// Execução direta: node scripts/saeb-descritores/gerar.mjs [--check]
const executadoDiretamente = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executadoDiretamente) {
  const modoCheck = process.argv.includes("--check");
  try {
    if (modoCheck) {
      verificar();
      console.log(`Catálogo em dia com a fonte: ${SAIDA_PATH}`);
    } else {
      const { texto, escrito } = gerar();
      const acao = escrito ? "Catálogo gerado" : "Catálogo já em dia (nada escrito)";
      console.log(`${acao}: ${SAIDA_PATH} (${Buffer.byteLength(texto, "utf-8")} bytes)`);
    }
  } catch (error) {
    if (error instanceof DescritoresGeracaoError) {
      console.error(`${modoCheck ? "Verificação" : "Geração"} interrompida: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
