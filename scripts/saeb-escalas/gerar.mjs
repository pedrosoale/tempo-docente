// Gerador determinístico do catálogo de escalas de proficiência do SAEB usado pelo piloto de
// interpretação pedagógica (Língua Portuguesa e Matemática — 5º ano do Ensino Fundamental / Anos
// Iniciais, 9º ano do Ensino Fundamental / Anos Finais, e 3ª série do Ensino Médio).
//
// Este script NÃO reprocessa o PDF oficial — o texto de cada nível já foi extraído, conferido
// visualmente contra o PDF (ver C:\ProjetosIA\escalas_de_proficiencia_do_saeb.pdf, fora do
// repositório) e congelado em data/saeb-escalas/source/official-inep-escalas-lp-mt.json. Reprocessar
// o PDF a cada build seria frágil (a fonte usa um mapa de caracteres não padrão que corrompe a
// extração de texto com algumas ferramentas — ver auditoria) e dependeria de um arquivo externo ao
// repositório, que não existe em CI. Este script tem UMA ÚNICA lógica de geração (`gerar`, abaixo) e
// dois modos de uso sobre ela:
//
//   node gerar.mjs           gera e grava data/saeb-escalas/escalas-lp-mt.json
//   node gerar.mjs --check   gera em memória (nunca escreve) e compara byte a byte com o arquivo já
//                            versionado — falha se a fonte mudou sem regeneração, se alguém editou o
//                            catálogo gerado à mão, ou se a serialização divergir por qualquer motivo
//                            (conteúdo, ordenação de chaves, newline). Ver `verificar()`.
//
// A validação em si cobre dois níveis:
//   1. INTEGRIDADE ESTRUTURAL E SEMÂNTICA do arquivo-fonte já verificado — todo campo que influencia
//      classificação ou proveniência é checado (ver `validarNivel`/`validarFonte`); uma divergência
//      aqui interrompe a geração com erro, nunca produz um catálogo parcial.
//   2. Serialização canônica (chaves ordenadas, LF, sem timestamp) usando o MESMO serializador
//      determinístico já usado pelo importador SAEB (scripts/saeb/lib/normalize.mjs) — duas
//      execuções da mesma fonte produzem bytes idênticos.
//
// O hash do PDF (fonte.hashSha256, na fonte) é metadado de proveniência, conferido manualmente — este
// script não tem como reconferi-lo em tempo de build porque o PDF vive fora do repositório
// (C:\ProjetosIA, nunca dentro de tempo-docente). Ver relatório do piloto para o registro da
// conferência manual.
//
// RODADA "2025": esta versão do gerador (schema saeb-escalas-piloto/2) passou a incluir 2025 nas
// edições associadas de LP/MT nas três etapas, e passou a cobrir 5º ano e Ensino Médio (além do 9º
// ano já existente) — usando o MESMO arquivo-fonte de sempre (Quadros 1, 2, 5 e 6, que já estavam no
// PDF mas não tinham sido extraídos ainda). A base documental para incluir 2025 sem alegar
// continuidade só pelos números: a cartilha oficial "Saeb 2025 — Diretrizes da edição"
// (cartilha_saeb_2025_diretrizes_da_edicao.pdf) afirma textualmente que, no 5º e 9º ano do ensino
// fundamental e na 3ª e 4ª série do ensino médio, "os estudantes fazem provas de língua portuguesa e
// matemática, com o mesmo conteúdo das edições anteriores do Saeb, ligadas à matriz 2001" — e a Nota
// Informativa do Ideb 2025 confirma que os resultados "são comparáveis com as edições anteriores".
// Ver o relatório do piloto para a citação completa e o restante da matriz de evidências.
import { readFileSync, writeFileSync } from "node:fs";
import { fileURLToPath } from "node:url";
import { dirname, join } from "node:path";
import { serializar } from "../saeb/lib/normalize.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
// Diretório PRÓPRIO deste piloto (data/saeb-escalas/), deliberadamente separado de data/saeb/ — o
// importador dos resultados SAEB (scripts/saeb/import.mjs) ignora data/saeb/source/ inteiro no
// .gitignore (só guarda ZIPs oficiais de ~211MB, re-baixáveis). O arquivo-fonte aqui é pequeno,
// hand-verified, e NÃO é re-baixável (é uma transcrição conferida do PDF externo ao repositório) —
// teria sido descartado silenciosamente do controle de versão se ficasse dentro daquele diretório.
const FONTE_PATH = join(REPO_ROOT, "data", "saeb-escalas", "source", "official-inep-escalas-lp-mt.json");
const SAIDA_PATH = join(REPO_ROOT, "data", "saeb-escalas", "escalas-lp-mt.json");

export class EscalasGeracaoError extends Error {
  constructor(message) {
    super(message);
    this.name = "EscalasGeracaoError";
  }
}

const HASH_HEX_64 = /^[0-9a-f]{64}$/;
const ETAPAS_VALIDAS = new Set(["anosIniciais", "anosFinais", "ensinoMedio"]);
const COMPONENTES_VALIDOS = new Set(["lp", "mt"]);
/** Domínio oficial do Inep — a URL da fonte precisa pertencer a ele (ou a um subdomínio dele). */
const DOMINIO_OFICIAL_INEP = "inep.gov.br";

/** Todas as edições do SAEB já realizadas sob a matriz 2001, para validar que
 * `edicoesAssociadas` não contém um ano inventado ou digitado errado. */
const EDICOES_SAEB_CONHECIDAS = new Set([
  "1995", "1997", "1999", "2001", "2003", "2005", "2007", "2009", "2011",
  "2013", "2015", "2017", "2019", "2021", "2023", "2025",
]);

/**
 * Edições documentadas por etapa — ligadas à matriz 2001 em Língua Portuguesa e Matemática, com o
 * mesmo conteúdo entre edições (ver comentário de topo para a citação da fonte). As três listas
 * diferem porque o Ideb por escola do Ensino Médio só existe a partir de 2017 (ver
 * scripts/saeb/lib/sources.mjs, EDICOES_ENSINO_MEDIO) — 5º e 9º ano têm Ideb por escola desde 2005.
 * 2025 entra nas três porque a cartilha oficial da edição confirma "mesmo conteúdo das edições
 * anteriores... ligadas à matriz 2001" para as três etapas — nunca por presumir continuidade a
 * partir dos números.
 */
const EDICOES_POR_ETAPA = {
  anosIniciais: Object.freeze(["2005", "2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023", "2025"]),
  anosFinais: Object.freeze(["2005", "2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023", "2025"]),
  ensinoMedio: Object.freeze(["2017", "2019", "2021", "2023", "2025"]),
};

function ehTextoNaoVazio(valor) {
  return typeof valor === "string" && valor.trim() !== "";
}

function ehInteiroPositivo(valor) {
  return Number.isInteger(valor) && valor > 0;
}

/** Metadados da publicação — título, órgão, versão, hash e URL. Validado uma vez, fora do laço de níveis. */
function validarFonte(fonte, contexto = "fonte") {
  if (!fonte || typeof fonte !== "object") {
    throw new EscalasGeracaoError(`${contexto}: metadado de fonte ausente`);
  }
  for (const campo of ["titulo", "orgao", "versaoPublicacao"]) {
    if (!ehTextoNaoVazio(fonte[campo])) {
      throw new EscalasGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio, recebeu ${JSON.stringify(fonte[campo])}`);
    }
  }
  if (typeof fonte.hashSha256 !== "string" || !HASH_HEX_64.test(fonte.hashSha256)) {
    throw new EscalasGeracaoError(`${contexto}: hashSha256 ausente ou malformado`);
  }
  if (!ehInteiroPositivo(fonte.totalPaginasPdf)) {
    throw new EscalasGeracaoError(`${contexto}: totalPaginasPdf precisa ser um inteiro positivo, recebeu ${JSON.stringify(fonte.totalPaginasPdf)}`);
  }
  if (!ehTextoNaoVazio(fonte.url)) {
    throw new EscalasGeracaoError(`${contexto}: campo "url" precisa ser texto não vazio`);
  }
  let url;
  try {
    url = new URL(fonte.url);
  } catch {
    throw new EscalasGeracaoError(`${contexto}: url inválida: ${JSON.stringify(fonte.url)}`);
  }
  if (url.protocol !== "https:") {
    throw new EscalasGeracaoError(`${contexto}: url precisa ser HTTPS, recebeu "${fonte.url}"`);
  }
  const dominioOficial = url.hostname === DOMINIO_OFICIAL_INEP || url.hostname.endsWith(`.${DOMINIO_OFICIAL_INEP}`);
  if (!dominioOficial) {
    throw new EscalasGeracaoError(`${contexto}: url precisa pertencer ao domínio oficial do Inep (*.${DOMINIO_OFICIAL_INEP}), recebeu host "${url.hostname}"`);
  }
}

/** Consistência entre um limite (inferior ou superior) e o operador declarado para ele — nenhum
 * outro operador é aceito além dos dois exigidos pelo vocabulário oficial da escala. */
function validarParLimiteOperador(nivel, contexto, { nomeLimite, limite, nomeOperador, operador, operadorExigido }) {
  if (limite !== null && (typeof limite !== "number" || !Number.isFinite(limite))) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} tem ${nomeLimite} não finito: ${JSON.stringify(limite)}`);
  }
  if (limite === null) {
    if (operador !== null) {
      throw new EscalasGeracaoError(
        `${contexto}: nível ${nivel.nivel} tem ${nomeLimite} nulo mas ${nomeOperador} não é nulo (${JSON.stringify(operador)})`,
      );
    }
  } else if (operador !== operadorExigido) {
    throw new EscalasGeracaoError(
      `${contexto}: nível ${nivel.nivel} tem ${nomeLimite} numérico mas ${nomeOperador} não é "${operadorExigido}" (recebeu ${JSON.stringify(operador)})`,
    );
  }
}

function validarNivel(nivel, fonte, contexto) {
  const campos = ["nivel", "nomeNivel", "origemNome", "tabulado", "limiteInferior", "operadorInferior", "limiteSuperior", "operadorSuperior", "descricaoOficial", "paginasPdf", "paginasImpressas"];
  for (const campo of campos) {
    if (!(campo in nivel)) throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel ?? "?"} sem campo obrigatório "${campo}"`);
  }
  if (typeof nivel.nivel !== "number" || nivel.nivel < 0 || !Number.isInteger(nivel.nivel)) {
    throw new EscalasGeracaoError(`${contexto}: "nivel" precisa ser um inteiro >= 0, recebeu ${JSON.stringify(nivel.nivel)}`);
  }
  if (!ehTextoNaoVazio(nivel.nomeNivel)) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} sem "nomeNivel" (texto não vazio)`);
  }
  if (nivel.origemNome !== "quadro" && nivel.origemNome !== "nota_rodape") {
    throw new EscalasGeracaoError(`${contexto}: origemNome inválido em nível ${nivel.nivel}`);
  }
  if (typeof nivel.tabulado !== "boolean") {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} tem "tabulado" que não é booleano: ${JSON.stringify(nivel.tabulado)}`);
  }
  // Equivalência completa entre origemNome e tabulado — não basta checar um sentido. Um nível
  // vindo de um quadro tabelado tem que estar marcado como tabulado; um nível vindo de nota de
  // rodapé nunca pode estar marcado como tabulado — e o inverso também precisa valer: "quadro" com
  // tabulado:false seria uma contradição semântica silenciosa (um nível realmente tabelado no PDF,
  // tratado como se fosse implícito).
  if (nivel.origemNome === "quadro" && nivel.tabulado !== true) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} vem de um quadro tabelado mas não está marcado como tabulado — origemNome e tabulado precisam ser coerentes`);
  }
  if (nivel.origemNome === "nota_rodape" && nivel.tabulado !== false) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} vem de nota de rodapé mas está marcado como tabulado — nunca inventar um nível tabelado a partir de uma nota`);
  }
  if (!ehTextoNaoVazio(nivel.descricaoOficial)) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} sem descrição oficial`);
  }

  validarParLimiteOperador(nivel, contexto, {
    nomeLimite: "limiteInferior", limite: nivel.limiteInferior,
    nomeOperador: "operadorInferior", operador: nivel.operadorInferior, operadorExigido: ">=",
  });
  validarParLimiteOperador(nivel, contexto, {
    nomeLimite: "limiteSuperior", limite: nivel.limiteSuperior,
    nomeOperador: "operadorSuperior", operador: nivel.operadorSuperior, operadorExigido: "<",
  });
  if (nivel.limiteInferior !== null && nivel.limiteSuperior !== null && nivel.limiteInferior >= nivel.limiteSuperior) {
    throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} tem limiteInferior (${nivel.limiteInferior}) >= limiteSuperior (${nivel.limiteSuperior})`);
  }

  for (const [campoPaginas, valor] of [["paginasPdf", nivel.paginasPdf], ["paginasImpressas", nivel.paginasImpressas]]) {
    if (!Array.isArray(valor) || valor.length === 0) {
      throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} tem "${campoPaginas}" que precisa ser um array não vazio`);
    }
    for (const pagina of valor) {
      if (!ehInteiroPositivo(pagina)) {
        throw new EscalasGeracaoError(`${contexto}: nível ${nivel.nivel} tem página inválida em "${campoPaginas}": ${JSON.stringify(pagina)} (precisa ser inteiro positivo)`);
      }
    }
  }
  for (const pagina of nivel.paginasPdf) {
    if (pagina > fonte.totalPaginasPdf) {
      throw new EscalasGeracaoError(
        `${contexto}: nível ${nivel.nivel} tem página de PDF ${pagina} além do total de páginas da fonte (${fonte.totalPaginasPdf})`,
      );
    }
  }
}

function validarEscala(escala, fonte) {
  // Usa etapa/componente para o contexto de erro (não quadro/tituloOficial, que são justamente os
  // campos validados logo abaixo e podem estar vazios ou ausentes).
  const contexto = `escala ${escala.etapa ?? "?"}/${escala.componente ?? "?"}`;
  if (!ETAPAS_VALIDAS.has(escala.etapa)) throw new EscalasGeracaoError(`${contexto}: etapa desconhecida`);
  if (!COMPONENTES_VALIDOS.has(escala.componente)) throw new EscalasGeracaoError(`${contexto}: componente desconhecido — este piloto só cobre lp/mt, nunca ideb/n/p/meta`);
  for (const campo of ["etapaLabelOficial", "quadro", "tituloOficial", "fonteInternaCitada"]) {
    if (!ehTextoNaoVazio(escala[campo])) {
      throw new EscalasGeracaoError(`${contexto}: campo "${campo}" precisa ser texto não vazio, recebeu ${JSON.stringify(escala[campo])}`);
    }
  }
  if (!Array.isArray(escala.niveis) || escala.niveis.length === 0) throw new EscalasGeracaoError(`${contexto}: sem níveis`);

  for (const nivel of escala.niveis) validarNivel(nivel, fonte, contexto);

  const ordenados = [...escala.niveis].sort((a, b) => a.nivel - b.nivel);
  // Sem lacuna e sem duplicata na numeração dos níveis (0..N contínuo).
  for (let i = 0; i < ordenados.length; i += 1) {
    if (ordenados[i].nivel !== i) {
      throw new EscalasGeracaoError(`${contexto}: numeração de nível não é contínua a partir de 0 — esperado ${i}, encontrado ${ordenados[i].nivel}`);
    }
  }
  // Sem sobreposição e sem lacuna ENTRE fronteiras consecutivas: o teto de um nível tem que ser
  // exatamente o piso do próximo — senão um valor real poderia cair "entre" dois níveis, ou em dois
  // ao mesmo tempo.
  for (let i = 0; i < ordenados.length - 1; i += 1) {
    const atual = ordenados[i];
    const proximo = ordenados[i + 1];
    if (atual.limiteSuperior === null) {
      throw new EscalasGeracaoError(`${contexto}: nível ${atual.nivel} está aberto no topo mas não é o último nível`);
    }
    if (proximo.limiteInferior === null || atual.limiteSuperior !== proximo.limiteInferior) {
      throw new EscalasGeracaoError(
        `${contexto}: lacuna ou sobreposição entre o nível ${atual.nivel} (termina em ${atual.limiteSuperior}) e o nível ${proximo.nivel} (começa em ${proximo.limiteInferior})`,
      );
    }
  }
  // O nível mais alto tem que ficar aberto (sem teto) — nenhuma escala oficial lida tem teto máximo.
  const maisAlto = ordenados[ordenados.length - 1];
  if (maisAlto.limiteSuperior !== null) {
    throw new EscalasGeracaoError(`${contexto}: nível mais alto (${maisAlto.nivel}) não está aberto no topo`);
  }
  // O nível mais baixo tem que ficar aberto embaixo — nenhuma escala tem piso mínimo definido.
  const maisBaixo = ordenados[0];
  if (maisBaixo.limiteInferior !== null) {
    throw new EscalasGeracaoError(`${contexto}: nível mais baixo (${maisBaixo.nivel}) não está aberto embaixo`);
  }

  if (!Array.isArray(escala.edicoesAssociadas) || escala.edicoesAssociadas.length === 0) {
    throw new EscalasGeracaoError(`${contexto}: sem edições associadas documentadas`);
  }
  for (const edicao of escala.edicoesAssociadas) {
    if (!EDICOES_SAEB_CONHECIDAS.has(edicao)) {
      throw new EscalasGeracaoError(`${contexto}: edição associada "${edicao}" não é uma edição conhecida do Saeb — verifique se não é um erro de digitação`);
    }
  }
}

export function gerar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH, escrever = true } = {}) {
  const bruto = readFileSync(fontePath, "utf-8");
  const fonteJson = JSON.parse(bruto);

  const { fonte, escalas } = fonteJson;
  validarFonte(fonte);
  if (!Array.isArray(escalas) || escalas.length === 0) {
    throw new EscalasGeracaoError("Nenhuma escala encontrada no arquivo-fonte");
  }

  const escalasComEdicoes = escalas.map((escala) => {
    const edicoes = EDICOES_POR_ETAPA[escala.etapa];
    if (!edicoes) {
      throw new EscalasGeracaoError(`Nenhuma lista de edições documentadas está registrada para a etapa "${escala.etapa}"`);
    }
    return { ...escala, edicoesAssociadas: edicoes };
  });
  for (const escala of escalasComEdicoes) validarEscala(escala, fonte);

  // Precisa cobrir exatamente lp e mt nas três etapas do piloto — nem mais, nem menos.
  const chaves = escalasComEdicoes.map((e) => `${e.etapa}/${e.componente}`).sort();
  const esperado = ["anosFinais/lp", "anosFinais/mt", "anosIniciais/lp", "anosIniciais/mt", "ensinoMedio/lp", "ensinoMedio/mt"].sort();
  if (chaves.length !== esperado.length || !chaves.every((c, i) => c === esperado[i])) {
    throw new EscalasGeracaoError(`Escopo do catálogo inesperado — esperado exatamente ${JSON.stringify(esperado)}, encontrado ${JSON.stringify(chaves)}`);
  }

  const catalogo = {
    schema: "saeb-escalas-piloto/2",
    piloto: {
      etapas: ["anosIniciais", "anosFinais", "ensinoMedio"],
      componentes: ["lp", "mt"],
    },
    fonte,
    escalas: escalasComEdicoes,
  };

  const texto = serializar(catalogo);
  let escrito = false;
  if (escrever) {
    // Só grava quando o conteúdo realmente muda — regenerar a mesma fonte não deve tocar o
    // catálogo já versionado (mtime, cache de bundler/watcher, diff espúrio no git). Um catálogo
    // ausente conta como divergente, então a primeira geração grava normalmente.
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
 * a partir de `fontePath` — nunca escreve em `saidaPath`. Cobre, com uma única comparação de bytes,
 * os quatro jeitos de o catálogo divergir da fonte: desatualizado, editado à mão, fonte mudou sem
 * regeneração, ou qualquer diferença de conteúdo/ordenação/newline/serialização — a regeneração em
 * memória já reflete a forma canônica, então qualquer divergência aparece como bytes diferentes.
 */
export function verificar({ fontePath = FONTE_PATH, saidaPath = SAIDA_PATH } = {}) {
  const { texto: esperado } = gerar({ fontePath, saidaPath, escrever: false });
  let atual;
  try {
    atual = readFileSync(saidaPath, "utf-8");
  } catch (error) {
    if (error.code === "ENOENT") {
      throw new EscalasGeracaoError(`Catálogo versionado não encontrado em ${saidaPath} — rode "npm run saeb:escalas:gerar" primeiro.`);
    }
    throw error;
  }
  if (atual !== esperado) {
    throw new EscalasGeracaoError(
      `Catálogo versionado em ${saidaPath} diverge da fonte em ${fontePath} — rode "npm run saeb:escalas:gerar" para regenerá-lo. Nunca edite o catálogo gerado manualmente.`,
    );
  }
  return { texto: esperado };
}

// Execução direta: node scripts/saeb-escalas/gerar.mjs [--check]
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
    if (error instanceof EscalasGeracaoError) {
      console.error(`${modoCheck ? "Verificação" : "Geração"} interrompida: ${error.message}`);
      process.exitCode = 1;
    } else {
      throw error;
    }
  }
}
