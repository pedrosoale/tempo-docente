// Gerador determinístico do catálogo "Computação na Educação Básica — Complemento à BNCC" (nome curto
// interno: "BNCC Computação"), a partir das quatro fontes auditadas em
// data/bncc/source/official-mec-bncc-computacao-<escopo>.json. Mesmo padrão de
// scripts/saeb-matriz-bncc/gerar.mjs: uma única lógica (`gerar`) e dois modos:
//
//   node gerar.mjs           valida as quatro fontes e grava data/bncc/computacao-<escopo>.json —
//                            só quando os bytes mudam (senão: "já em dia", mtime preservado)
//   node gerar.mjs --check   gera em memória (nunca escreve) e compara byte a byte com o versionado
//
// Opções: --fonte-dir <dir> e --saida-dir <dir> (usadas pelos testes, sempre em diretório temporário).
//
// O conteúdo é o COMPLEMENTO NACIONAL à BNCC (Resolução CNE/CEB nº 1/2022 + Anexo ao Parecer CNE/CEB nº
// 2/2022). NÃO é currículo estadual/municipal, NÃO é a matriz do SAEB, NÃO é habilidade de Língua
// Portuguesa e não substitui nenhuma habilidade da BNCC já publicada (data/bncc/*.json).
//
// A validação de IDENTIDADE nunca depende só de contagens agregadas: a tabela canônica de códigos e os
// hashes aprovados por registro (scripts/bncc-computacao/referencia-aprovada.mjs) são literais
// congelados, independentes do arquivo-fonte que está sendo validado.
import { createHash } from "node:crypto";
import { readFileSync, writeFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

import {
  ANEXO_SHA256,
  ANEXO_TAMANHO_BYTES,
  ANEXO_TOTAL_PAGINAS,
  CODIGOS_CANONICOS,
  HASHES_APROVADOS,
  HASH_METADADOS,
  TOTAIS_POR_ESCOPO,
  TOTAIS_POR_GRUPO,
  TOTAL_HABILIDADES_E_OBJETIVOS,
} from "./referencia-aprovada.mjs";

const __dirname = dirname(fileURLToPath(import.meta.url));
const REPO_ROOT = join(__dirname, "..", "..");
export const DIR_FONTE_PADRAO = join(REPO_ROOT, "data", "bncc", "source");
export const DIR_SAIDA_PADRAO = join(REPO_ROOT, "data", "bncc");

export class BnccComputacaoGeracaoError extends Error {
  constructor(message) {
    super(message);
    this.name = "BnccComputacaoGeracaoError";
  }
}

export const ESCOPOS = ["educacao-infantil", "anos-iniciais", "anos-finais", "ensino-medio"];
export const arquivoFonte = (escopo) => `official-mec-bncc-computacao-${escopo}.json`;
export const arquivoSaida = (escopo) => `computacao-${escopo}.json`;

const INFO = {
  "educacao-infantil": { etapa: "Educação Infantil", segmento: null, tipo: "objetivo_aprendizagem", formato: /^EI03CO(0[1-9]|1[01])$/, sufixoId: "ei" },
  "anos-iniciais": { etapa: "Ensino Fundamental", segmento: "Anos Iniciais", tipo: "habilidade", formato: /^EF(0[1-5]|15)CO\d{2}$/, sufixoId: "ef" },
  "anos-finais": { etapa: "Ensino Fundamental", segmento: "Anos Finais", tipo: "habilidade", formato: /^EF(0[6-9]|69)CO\d{2}$/, sufixoId: "ef" },
  "ensino-medio": { etapa: "Ensino Médio", segmento: null, tipo: "habilidade", formato: /^EM13CO\d{2}$/, sufixoId: "em" },
};

const EIXO_SIGLA = { "Pensamento Computacional": "PC", "Mundo Digital": "MD", "Cultura Digital": "CD" };
const HASH_HEX_64 = /^[0-9a-f]{64}$/;
const CODIGO_OUTRA_BNCC = /^E[IFM]\d{2}[A-Z]{3}\d{3}$/;
const NOME_OFICIAL = "Computação na Educação Básica — Complemento à BNCC";
const EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE = [4, 5, 7];
const DESLOCAMENTO_PAGINA_IMPRESSA = 4;
/** Chaves do arquivo-fonte que são listas de registros (cada item tem hash próprio); todo o resto é metadado. */
const CHAVES_DE_REGISTROS = ["premissas", "competencias", "registros"];

/** Hosts oficiais aceitos: o gov.br só vale sob o caminho /mec/ (nunca outro órgão ou domínio parecido). */
export function urlEhOficial(valor) {
  let url;
  try {
    url = new URL(valor);
  } catch {
    return false;
  }
  if (!["https:", "http:"].includes(url.protocol)) return false;
  if (url.hostname === "www.gov.br") return url.pathname.startsWith("/mec/");
  return url.hostname === "portal.mec.gov.br" || url.hostname === "basenacionalcomum.mec.gov.br";
}

const ehTexto = (v) => typeof v === "string" && v.trim() !== "";
const iguais = (a, b) => JSON.stringify(a) === JSON.stringify(b);

export function ordenarProfundo(v) {
  if (Array.isArray(v)) return v.map(ordenarProfundo);
  if (v && typeof v === "object") return Object.fromEntries(Object.keys(v).sort().map((k) => [k, ordenarProfundo(v[k])]));
  return v;
}
export const serializar = (v) => `${JSON.stringify(ordenarProfundo(v), null, 2).replace(/\r\n/g, "\n")}\n`;
export const hashRegistro = (r) => createHash("sha256").update(JSON.stringify(ordenarProfundo(r))).digest("hex");

function erro(contexto, mensagem) {
  throw new BnccComputacaoGeracaoError(`${contexto}: ${mensagem}`);
}

// ---------------------------------------------------------------------------------------------------
// Texto
// ---------------------------------------------------------------------------------------------------
const VAZAMENTO = /EXPLICAÇÃO DA HABILIDADE|\bEXEMPLOS\b|OBJETO DE CONHECIMENTO|OBJETIVO DE APRENDIZAGEM|COMPETÊNCIA ESPECÍFICA|COMPUTAÇÃO - |COMPUTAÇÃO \/ POR ETAPA|ENSINO FUNDAMENTAL|ENSINO MÉDIO|EDUCAÇÃO INFANTIL|Diagramação:|^\d{1,3}$|\(CONTINUAÇÃO\)|\(cont\.\)/m;
const INICIO_DE_EXPLICACAO_OU_EXEMPLO = /^(O professor|Professor|Os alunos|Nesta habilidade|Esta habilidade|Nessa habilidade|Computação (de)?splugada|Computação plugada|Computação \(Des\)plugada|Possui relação|Pode-se|Exemplos? )/i;
const INFINITIVO = /^[A-ZÁÂÃÀÉÊÍÓÔÕÚÇ][a-záâãàéêíóôõúç]+(ar|er|ir|or)(-se)?\b/;

export function validarTextoDeHabilidade(texto, contexto) {
  if (!ehTexto(texto)) erro(contexto, "texto da habilidade vazio ou ausente");
  if (texto !== texto.trim() || /\s{2,}/.test(texto) || /\n/.test(texto)) erro(contexto, "texto com espaçamento não normalizado ou quebra de linha");
  if (texto.includes("�")) erro(contexto, "texto contém caractere de substituição (U+FFFD)");
  if (/\.\.\.|…/.test(texto)) erro(contexto, "texto contém reticências (possível truncamento)");
  if (texto.length < 20 || texto.length > 600) erro(contexto, `texto com tamanho implausível (${texto.length} caracteres) — possível truncamento ou texto de outra célula`);
  if (!/[.!?)"”’']$/.test(texto)) erro(contexto, `texto não termina em pontuação nem fecha aspas — possível truncamento: ${JSON.stringify(texto.slice(-40))}`);
  if (!INFINITIVO.test(texto) || INICIO_DE_EXPLICACAO_OU_EXEMPLO.test(texto)) {
    erro(contexto, `o texto de uma habilidade/objetivo começa com um verbo no infinitivo; este começa como explicação ou exemplo: ${JSON.stringify(texto.slice(0, 50))}`);
  }
  if (/\(E[IFM]\d{2}[A-Z]{2,3}\d{2,3}\)/.test(texto)) erro(contexto, "o texto contém um código entre parênteses — código vazando para o texto");
  if (VAZAMENTO.test(texto)) erro(contexto, "cabeçalho, rodapé, título de tabela ou marcador de continuação vazou para o texto");
}

function validarTextoLivre(valor, contexto, campo) {
  if (!ehTexto(valor)) erro(contexto, `${campo} vazio`);
  if (valor.includes("�")) erro(contexto, `${campo} contém U+FFFD`);
  if (valor !== valor.trim()) erro(contexto, `${campo} com espaços nas bordas`);
  if (VAZAMENTO.test(valor)) erro(contexto, `${campo}: cabeçalho, rodapé ou marcador de continuação vazou para o texto`);
}

// ---------------------------------------------------------------------------------------------------
// Fontes (proveniência)
// ---------------------------------------------------------------------------------------------------
export function validarFontes(fonte, contexto) {
  if (!Array.isArray(fonte.fontes) || fonte.fontes.length === 0) erro(contexto, "fontes ausentes");
  const ids = new Set();
  for (const f of fonte.fontes) {
    for (const campo of ["id", "titulo", "orgao", "url", "sha256", "mime", "papel", "acessado_em"]) {
      if (!ehTexto(f[campo])) erro(contexto, `fonte ${f.id ?? "?"}: campo "${campo}" precisa ser texto não vazio`);
    }
    if (ids.has(f.id)) erro(contexto, `fonte duplicada: ${f.id}`);
    ids.add(f.id);
    if (!HASH_HEX_64.test(f.sha256)) erro(contexto, `fonte ${f.id}: sha256 inválido (${JSON.stringify(f.sha256)}) — precisa ter 64 caracteres hexadecimais minúsculos`);
    if (!urlEhOficial(f.url) || !f.url.startsWith("https://")) erro(contexto, `fonte ${f.id}: URL fora do domínio oficial do MEC/CNE (gov.br/mec, portal.mec.gov.br, basenacionalcomum.mec.gov.br): ${f.url}`);
    if (!Number.isInteger(f.tamanho_bytes) || f.tamanho_bytes <= 0) erro(contexto, `fonte ${f.id}: tamanho_bytes inválido`);
    if (!Number.isInteger(f.total_paginas_pdf) || f.total_paginas_pdf <= 0) erro(contexto, `fonte ${f.id}: total_paginas_pdf inválido`);
    if (f.mime !== "application/pdf") erro(contexto, `fonte ${f.id}: mime inesperado ${f.mime}`);
  }
  const anexo = fonte.fontes.find((f) => f.papel === "fonte_das_tabelas");
  if (!anexo) erro(contexto, "fonte das tabelas (Anexo) ausente");
  if (anexo.sha256 !== ANEXO_SHA256) erro(contexto, `o SHA-256 do Anexo (${anexo.sha256}) não é o hash literal aprovado (${ANEXO_SHA256})`);
  if (anexo.tamanho_bytes !== ANEXO_TAMANHO_BYTES || anexo.total_paginas_pdf !== ANEXO_TOTAL_PAGINAS) erro(contexto, "tamanho ou número de páginas do Anexo diverge do aprovado");
  for (const f of fonte.fontes) {
    if (f.papel === "equivalente_oficial_identico_ao_anexo" && f.sha256 !== ANEXO_SHA256) erro(contexto, "o PDF equivalente declarado como idêntico ao Anexo tem outro SHA-256");
  }
  for (const u of fonte.fontes_indisponiveis ?? []) {
    if (!urlEhOficial(u.url)) erro(contexto, `fonte indisponível com URL fora do domínio oficial: ${u.url}`);
  }
  return anexo;
}

// ---------------------------------------------------------------------------------------------------
// Registros
// ---------------------------------------------------------------------------------------------------
const ORDINAIS = Object.fromEntries([1, 2, 3, 4, 5, 6, 7, 8, 9].map((n) => [n, `${n}º ano`]));
function anosDoCodigoEF(codigo) {
  const m = /^EF(\d)(\d)CO\d{2}$/.exec(codigo);
  const a = Number(m[1]);
  const b = Number(m[2]);
  if (a === 1 && b === 5) return { ano: null, bloco: "1º ao 5º ano", anos: [1, 2, 3, 4, 5].map((n) => ORDINAIS[n]) };
  if (a === 6 && b === 9) return { ano: null, bloco: "6º ao 9º ano", anos: [6, 7, 8, 9].map((n) => ORDINAIS[n]) };
  const n = Number(`${a}${b}`);
  return { ano: ORDINAIS[n], bloco: null, anos: [ORDINAIS[n]] };
}

function validarRegistro(r, escopo, contexto) {
  const info = INFO[escopo];
  if (r.tipo !== info.tipo) erro(contexto, `tipo "${r.tipo}" incompatível com o escopo ${escopo} (esperado "${info.tipo}") — explicação, exemplo ou relação nunca podem ser tratados como habilidade`);
  if (typeof r.codigo !== "string" || !/^E[IFM]\d{2}CO\d{2}$/.test(r.codigo)) erro(contexto, `código com formato inválido: ${JSON.stringify(r.codigo)}`);
  if (!info.formato.test(r.codigo)) erro(contexto, `código ${r.codigo} incompatível com a etapa/segmento do escopo ${escopo}`);
  const ref = CODIGOS_CANONICOS[r.codigo];
  if (!ref) erro(contexto, `código ${r.codigo} não existe na tabela canônica aprovada — código inventado ou sequência preenchida artificialmente`);
  if (ref.escopo !== escopo) erro(contexto, `código ${r.codigo} pertence ao escopo "${ref.escopo}", mas está arquivado em "${escopo}" — habilidade em etapa errada`);
  if (r.etapa !== info.etapa || r.segmento !== info.segmento) erro(contexto, `etapa/segmento (${r.etapa}/${r.segmento}) incompatível com o escopo ${escopo}`);

  // ano / bloco
  if (escopo === "anos-iniciais" || escopo === "anos-finais") {
    const esperado = anosDoCodigoEF(r.codigo);
    if (r.ano !== esperado.ano || r.bloco_anos !== esperado.bloco || !iguais(r.anos_aplicaveis, esperado.anos)) {
      erro(contexto, `ano/bloco (${r.ano}/${r.bloco_anos}/${JSON.stringify(r.anos_aplicaveis)}) incompatível com o código ${r.codigo} (esperado ${esperado.ano}/${esperado.bloco})`);
    }
    if ((r.ano ?? null) !== ref.ano || (r.bloco_anos ?? null) !== ref.bloco) erro(contexto, `ano/bloco de ${r.codigo} diverge da tabela canônica`);
  } else if (r.ano !== null || r.bloco_anos !== null || r.anos_aplicaveis !== null) {
    erro(contexto, "ano, bloco de anos e anos aplicáveis precisam ser null nesta etapa (a fonte não os declara)");
  }

  // eixo / objeto / competência
  if (escopo === "ensino-medio") {
    if (r.eixo !== null) erro(contexto, "o quadro do Ensino Médio não tem eixo — esperado null");
    if (!Number.isInteger(r.competencia_especifica) || r.competencia_especifica < 1 || r.competencia_especifica > 7) erro(contexto, `competência específica ausente ou fora de 1–7: ${JSON.stringify(r.competencia_especifica)}`);
    if (r.competencia_especifica !== ref.competencia) erro(contexto, `competência específica ${r.competencia_especifica} diverge da tabela canônica (${ref.competencia}) para ${r.codigo}`);
    if (r.objeto_conhecimento !== null) erro(contexto, "o quadro do Ensino Médio não tem objeto de conhecimento — esperado null");
  } else {
    if (!(r.eixo in EIXO_SIGLA)) erro(contexto, `eixo inexistente: ${JSON.stringify(r.eixo)}`);
    if (EIXO_SIGLA[r.eixo] !== ref.eixo) erro(contexto, `eixo "${r.eixo}" incompatível com o eixo canônico de ${r.codigo} — habilidade arquivada no eixo errado`);
    if (r.competencia_especifica !== null) erro(contexto, "os quadros da Educação Infantil e do Ensino Fundamental não associam habilidade a competência — esperado null");
    if (escopo !== "educacao-infantil") {
      if (!ehTexto(r.objeto_conhecimento)) erro(contexto, "objeto de conhecimento ausente (obrigatório no Ensino Fundamental)");
      if (r.objeto_conhecimento !== ref.objeto) erro(contexto, `objeto de conhecimento "${r.objeto_conhecimento}" diverge do canônico "${ref.objeto}" para ${r.codigo}`);
    } else if (r.objeto_conhecimento !== null) erro(contexto, "a Educação Infantil não tem objeto de conhecimento — esperado null");
  }
  const hierarquico = /^EF(0[6-9]|69)CO/.test(r.codigo);
  for (const campo of ["objeto_conhecimento_nivel_2", "enunciado_agrupador"]) {
    if (hierarquico) validarTextoLivre(r[campo], contexto, campo);
    else if (r[campo] !== null) erro(contexto, `${campo} só existe nos quadros do 6º ao 9º ano — esperado null`);
  }

  // páginas
  if (!Number.isInteger(r.pagina_fonte) || r.pagina_fonte < 1 || r.pagina_fonte > ANEXO_TOTAL_PAGINAS) erro(contexto, `página inválida: ${JSON.stringify(r.pagina_fonte)}`);
  if (r.pagina_fonte !== ref.pagina) erro(contexto, `pagina_fonte ${r.pagina_fonte} diverge da página canônica ${ref.pagina} de ${r.codigo}`);
  if (r.pagina_impressa !== r.pagina_fonte - DESLOCAMENTO_PAGINA_IMPRESSA) erro(contexto, `pagina_impressa ${r.pagina_impressa} incompatível com a página real ${r.pagina_fonte}`);
  if (r.pagina_fonte_complemento !== r.pagina_fonte + 1 || r.pagina_impressa_complemento !== r.pagina_impressa + 1) erro(contexto, "páginas de complemento (explicação/exemplos) incompatíveis com as páginas espelhadas da tabela");
  if (!ehTexto(r.quadro_fonte) || !r.quadro_fonte.startsWith("COMPUTAÇÃO")) erro(contexto, `quadro_fonte inválido: ${JSON.stringify(r.quadro_fonte)}`);

  // texto / explicação / exemplos / relações
  validarTextoDeHabilidade(r.texto, contexto);
  if (escopo === "educacao-infantil") {
    if (r.explicacao !== null) erro(contexto, "a Educação Infantil não tem coluna de explicação — esperado null");
  } else validarTextoLivre(r.explicacao, contexto, "explicacao");
  if (!Array.isArray(r.exemplos) || r.exemplos.length === 0) erro(contexto, "exemplos ausentes");
  for (const ex of r.exemplos) validarTextoLivre(ex, contexto, "exemplo");
  if (r.explicacao !== null && r.explicacao === r.texto) erro(contexto, "a explicação é idêntica ao texto da habilidade — explicação tratada como habilidade");
  if (r.exemplos.includes(r.texto)) erro(contexto, "um exemplo é idêntico ao texto da habilidade — exemplo tratado como texto oficial");
  if (!Array.isArray(r.relacoes_transversais)) erro(contexto, "relacoes_transversais precisa ser um array");
  for (const rel of r.relacoes_transversais) {
    if (!CODIGO_OUTRA_BNCC.test(rel.codigo ?? "")) erro(contexto, `relação transversal com código inválido: ${JSON.stringify(rel.codigo)}`);
    if (CODIGOS_CANONICOS[rel.codigo]) erro(contexto, `a relação transversal ${rel.codigo} é um código desta própria base — uma relação nunca é uma habilidade`);
    if (rel.natureza !== "relacao_direta_indicada_pela_fonte" || rel.campo_na_fonte !== "EXEMPLOS" || !String(rel.trecho_na_fonte).includes(rel.codigo)) erro(contexto, "relação transversal sem natureza/campo/trecho coerentes com a fonte");
  }
  if (!Array.isArray(r.notas_documentais) || r.notas_documentais.some((n) => !ehTexto(n))) erro(contexto, "notas_documentais inválidas");
}

function validarPremissasECompetencias(f, escopo, contexto) {
  const info = INFO[escopo];
  const esperado = TOTAIS_POR_ESCOPO[escopo];
  if (f.premissas.length !== esperado.premissas) erro(contexto, `esperadas ${esperado.premissas} premissas, encontradas ${f.premissas.length}`);
  if (f.competencias.length !== esperado.competencias) erro(contexto, `esperadas ${esperado.competencias} competências específicas, encontradas ${f.competencias.length}`);
  for (const [lista, tipo] of [[f.premissas, "premissa"], [f.competencias, "competencia_especifica"]]) {
    lista.forEach((item, i) => {
      const ctx = `${contexto} ${tipo} ${i + 1}`;
      if (item.tipo !== tipo) erro(ctx, `tipo "${item.tipo}" inesperado`);
      if (item.numero !== i + 1) erro(ctx, `numeração fora de sequência (esperado ${i + 1}, recebeu ${item.numero})`);
      if (item.etapa !== info.etapa) erro(ctx, "etapa incompatível");
      validarTextoLivre(item.texto, ctx, "texto");
      if (!Number.isInteger(item.pagina_fonte) || item.pagina_fonte < 1 || item.pagina_fonte > ANEXO_TOTAL_PAGINAS) erro(ctx, "página inválida");
      if (item.pagina_impressa !== item.pagina_fonte - DESLOCAMENTO_PAGINA_IMPRESSA) erro(ctx, "página impressa incompatível");
    });
  }
  if (escopo === "ensino-medio") {
    f.competencias.forEach((c) => {
      validarTextoLivre(c.texto_no_quadro_de_habilidades, contexto, "texto_no_quadro_de_habilidades");
      const divergeEsperado = EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE.includes(c.numero);
      if ((c.texto !== c.texto_no_quadro_de_habilidades) !== divergeEsperado || c.textos_divergem !== divergeEsperado) {
        erro(contexto, `competência ${c.numero}: a divergência entre o texto da lista e o do quadro (${c.textos_divergem}) contradiz a divergência documentada (competências ${EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE.join(", ")})`);
      }
    });
    if ((f.divergencias_documentais ?? []).length !== EM_COMPETENCIAS_COM_TEXTO_DIVERGENTE.length) erro(contexto, "divergências documentais das competências do Ensino Médio ausentes ou em número inesperado");
  }
}

// ---------------------------------------------------------------------------------------------------
// Fonte inteira
// ---------------------------------------------------------------------------------------------------
export function validarFonteDoEscopo(f, escopo) {
  const contexto = `fonte ${escopo}`;
  if (!f || typeof f !== "object") erro(contexto, "arquivo-fonte ilegível");
  if (f.schema !== "bncc-computacao-fonte/1") erro(contexto, `schema inesperado: ${JSON.stringify(f.schema)}`);
  if (f.escopo !== escopo) erro(contexto, `campo "escopo" (${JSON.stringify(f.escopo)}) diferente do escopo esperado`);
  if (f.nome_oficial !== NOME_OFICIAL) erro(contexto, `nome oficial inesperado: ${JSON.stringify(f.nome_oficial)}`);
  if (f.classificacao !== "dado_oficial") erro(contexto, "classificacao precisa ser dado_oficial");
  if (/paulista|seduc|estadual|municipal/i.test(JSON.stringify(f.nome_oficial) + JSON.stringify(f.nome_curto))) erro(contexto, "o nome do catálogo não pode remeter a currículo estadual/municipal");
  validarFontes(f, contexto);

  const registros = f.registros;
  if (!Array.isArray(registros) || registros.length === 0) erro(contexto, "sem registros");
  validarPremissasECompetencias(f, escopo, contexto);

  const vistos = new Set();
  for (const r of registros) {
    const ctx = `${contexto} ${r?.codigo ?? "?"}`;
    validarRegistro(r, escopo, ctx);
    if (vistos.has(r.codigo)) erro(ctx, "código duplicado (inclusive por continuação de tabela)");
    vistos.add(r.codigo);
  }
  if (registros.length !== TOTAIS_POR_ESCOPO[escopo].registros) erro(contexto, `esperados exatamente ${TOTAIS_POR_ESCOPO[escopo].registros} registros, encontrados ${registros.length}`);

  // conjunto de códigos == conjunto canônico do escopo (falta ou excesso)
  const canonicosDoEscopo = Object.keys(CODIGOS_CANONICOS).filter((c) => CODIGOS_CANONICOS[c].escopo === escopo);
  const faltando = canonicosDoEscopo.filter((c) => !vistos.has(c));
  const sobrando = [...vistos].filter((c) => !CODIGOS_CANONICOS[c] || CODIGOS_CANONICOS[c].escopo !== escopo);
  if (faltando.length || sobrando.length) erro(contexto, `conjunto de códigos diverge da tabela canônica — faltando: ${JSON.stringify(faltando)}; a mais: ${JSON.stringify(sobrando)}`);

  // contagem exata por (ano | bloco | competência) e por eixo — segunda via, redundante de propósito
  const grupos = {};
  for (const r of registros) {
    const grupo = r.ano ?? r.bloco_anos ?? (r.competencia_especifica !== null ? `competencia ${r.competencia_especifica}` : "objetivos");
    const g = (grupos[`${escopo}/${grupo}`] ??= { total: 0, eixos: {} });
    g.total += 1;
    if (r.eixo) g.eixos[EIXO_SIGLA[r.eixo]] = (g.eixos[EIXO_SIGLA[r.eixo]] ?? 0) + 1;
  }
  const esperadoGrupos = Object.fromEntries(Object.entries(TOTAIS_POR_GRUPO).filter(([k]) => k.startsWith(`${escopo}/`)));
  if (!iguais(ordenarProfundo(grupos), ordenarProfundo(esperadoGrupos))) {
    erro(contexto, `contagens por ano/bloco/competência/eixo divergem do aprovado.\n  encontrado: ${JSON.stringify(ordenarProfundo(grupos))}\n  esperado:   ${JSON.stringify(ordenarProfundo(esperadoGrupos))}`);
  }

  // Identidade por registro: o conjunto de hashes aprovados precisa coincidir exatamente.
  const produzidos = [...f.premissas, ...f.competencias, ...registros].map(hashRegistro);
  if (new Set(produzidos).size !== produzidos.length) erro(contexto, "dois registros produziram o mesmo hash — registro duplicado");
  const aprovados = new Set(HASHES_APROVADOS[escopo]);
  const setProduzidos = new Set(produzidos);
  const hashesAusentes = [...aprovados].filter((h) => !setProduzidos.has(h)).length;
  const hashesNovos = [...setProduzidos].filter((h) => !aprovados.has(h)).length;
  if (hashesAusentes || hashesNovos) {
    erro(
      contexto,
      `o conjunto de ${aprovados.size} registros aprovados (hash SHA-256 do registro inteiro) não bate com o produzido: ${hashesAusentes} aprovado(s) ausente(s), ${hashesNovos} registro(s) não reconhecido(s). ` +
        "Isto detecta qualquer alteração de texto, código, eixo, objeto, página, explicação, exemplo ou relação — inclusive trocas simétricas que preservam as contagens. " +
        "Se a mudança for uma correção documental legítima, reconfira visualmente contra o PDF e atualize scripts/bncc-computacao/referencia-aprovada.mjs deliberadamente.",
    );
  }
  const metadados = Object.fromEntries(Object.entries(f).filter(([chave]) => !CHAVES_DE_REGISTROS.includes(chave)));
  if (hashRegistro(metadados) !== HASH_METADADOS[escopo]) erro(contexto, "os metadados do arquivo-fonte (fundamento normativo, fontes, URLs, correções, divergências, junções, introdução) diferem do aprovado");
}

// ---------------------------------------------------------------------------------------------------
// Catálogo
// ---------------------------------------------------------------------------------------------------
function montarCatalogo(f, escopo) {
  const anexo = f.fontes.find((x) => x.papel === "fonte_das_tabelas");
  const proveniencia = { documento_fonte: anexo.titulo, documento_url: anexo.url, documento_sha256: anexo.sha256 };
  const info = INFO[escopo];
  const registros = [
    ...f.premissas.map((p) => ({ ...p, id_interno: `computacao.${info.sufixoId}.premissa-${p.numero}`, codigo: null, ...proveniencia })),
    ...f.competencias.map((c) => ({ ...c, id_interno: `computacao.${info.sufixoId}.competencia-${c.numero}`, codigo: null, ...proveniencia })),
    ...[...f.registros]
      .sort((a, b) => (a.codigo < b.codigo ? -1 : a.codigo > b.codigo ? 1 : 0))
      .map((r) => ({ ...r, id_interno: `computacao.${r.codigo.toLowerCase()}`, ...proveniencia })),
  ];
  const ids = new Set();
  for (const r of registros) {
    if (ids.has(r.id_interno)) erro(`catálogo ${escopo}`, `id_interno duplicado: ${r.id_interno}`);
    ids.add(r.id_interno);
  }
  const porTipo = {};
  for (const r of registros) porTipo[r.tipo] = (porTipo[r.tipo] ?? 0) + 1;
  const metadata = {
    schema: "bncc-computacao/1",
    escopo,
    nome_oficial: f.nome_oficial,
    nome_curto: f.nome_curto,
    etapa: f.etapa,
    segmento: f.segmento,
    classificacao: f.classificacao,
    natureza_do_conteudo: f.natureza_do_conteudo,
    publicado_na_interface: true,
    nota_de_interface: "Este catálogo é publicado exclusivamente na página /bncc/computacao, com a entrada \"BNCC Computação\" no submenu BNCC e uma entrada no sitemap. Não está incorporado a lib/bncc/data.ts, a data/bncc/import-report.json, à busca geral de /bncc nem à homepage.",
    id_interno_nao_e_codigo_oficial: "O campo id_interno é um identificador técnico deste catálogo e NUNCA um código oficial; o código oficial fica em `codigo` (null para premissas e competências, que a fonte não codifica).",
    fundamento_normativo: f.fundamento_normativo,
    fontes: f.fontes,
    paginas_oficiais_de_listagem: f.paginas_oficiais_de_listagem,
    fontes_indisponiveis: f.fontes_indisponiveis,
    validacao_cruzada: f.validacao_cruzada,
    metodo: f.metodo,
    premissas_introducao: f.premissas_introducao ?? null,
    correcoes_tipograficas: f.correcoes_tipograficas,
    marcadores_de_continuacao_removidos: f.marcadores_de_continuacao_removidos,
    divergencias_documentais: f.divergencias_documentais,
    juncoes_de_linha: f.juncoes_de_linha,
    total_registros: registros.length,
    total_por_tipo: porTipo,
    total_habilidades_e_objetivos: f.registros.length,
  };
  return { metadata, registros };
}

function lerFonte(dir, escopo) {
  const caminho = join(dir, arquivoFonte(escopo));
  let bruto;
  try {
    bruto = readFileSync(caminho, "utf-8");
  } catch (e) {
    erro(`fonte ${escopo}`, `não foi possível ler ${caminho}: ${e.code ?? e.message}`);
  }
  try {
    return JSON.parse(bruto);
  } catch (e) {
    erro(`fonte ${escopo}`, `JSON inválido em ${caminho}: ${e.message}`);
  }
}

export function gerar({ fonteDir = DIR_FONTE_PADRAO, saidaDir = DIR_SAIDA_PADRAO, escrever = true } = {}) {
  // 1) lê e valida TUDO antes de escrever qualquer arquivo
  const fontes = Object.fromEntries(ESCOPOS.map((e) => [e, lerFonte(fonteDir, e)]));
  for (const e of ESCOPOS) validarFonteDoEscopo(fontes[e], e);

  // 2) consistência entre os dois arquivos do Ensino Fundamental (mesmas 7 competências)
  if (!iguais(fontes["anos-iniciais"].competencias, fontes["anos-finais"].competencias)) erro("Ensino Fundamental", "as 7 competências dos Anos Iniciais e dos Anos Finais precisam ser idênticas");
  const total = ESCOPOS.reduce((n, e) => n + fontes[e].registros.length, 0);
  if (total !== TOTAL_HABILIDADES_E_OBJETIVOS) erro("catálogo", `total geral deveria ser ${TOTAL_HABILIDADES_E_OBJETIVOS}, encontrado ${total}`);
  const todos = ESCOPOS.flatMap((e) => fontes[e].registros.map((r) => r.codigo));
  if (new Set(todos).size !== todos.length) erro("catálogo", "código duplicado entre escopos");

  // 3) monta e (só então) escreve, apenas quando os bytes mudam
  const resultado = {};
  for (const e of ESCOPOS) {
    const catalogo = montarCatalogo(fontes[e], e);
    const texto = serializar(catalogo);
    const caminho = join(saidaDir, arquivoSaida(e));
    let escrito = false;
    if (escrever) {
      let atual;
      try {
        atual = readFileSync(caminho, "utf-8");
      } catch (err) {
        if (err.code !== "ENOENT") throw err;
      }
      if (atual !== texto) {
        writeFileSync(caminho, texto, "utf-8");
        escrito = true;
      }
    }
    resultado[e] = { catalogo, texto, escrito, caminho };
  }
  return resultado;
}

export function verificar({ fonteDir = DIR_FONTE_PADRAO, saidaDir = DIR_SAIDA_PADRAO } = {}) {
  const esperado = gerar({ fonteDir, saidaDir, escrever: false });
  for (const e of ESCOPOS) {
    let atual;
    try {
      atual = readFileSync(esperado[e].caminho, "utf-8");
    } catch (err) {
      if (err.code === "ENOENT") erro(`catálogo ${e}`, `${esperado[e].caminho} não existe — rode "npm run bncc:computacao:gerar" primeiro.`);
      throw err;
    }
    if (atual !== esperado[e].texto) {
      erro(`catálogo ${e}`, `${esperado[e].caminho} diverge da fonte — rode "npm run bncc:computacao:gerar" para regenerá-lo. Nunca edite o catálogo gerado manualmente.`);
    }
  }
  return esperado;
}

// Execução direta: node scripts/bncc-computacao/gerar.mjs [--check] [--fonte-dir d] [--saida-dir d]
const executadoDiretamente = process.argv[1] && fileURLToPath(import.meta.url) === process.argv[1];
if (executadoDiretamente) {
  const arg = (nome) => {
    const i = process.argv.indexOf(nome);
    return i >= 0 ? process.argv[i + 1] : undefined;
  };
  const opcoes = { fonteDir: arg("--fonte-dir") ?? DIR_FONTE_PADRAO, saidaDir: arg("--saida-dir") ?? DIR_SAIDA_PADRAO };
  const modoCheck = process.argv.includes("--check");
  try {
    if (modoCheck) {
      verificar(opcoes);
      console.log(`Catálogo BNCC Computação em dia com a fonte (${ESCOPOS.length} arquivos): ${opcoes.saidaDir}`);
    } else {
      const r = gerar(opcoes);
      const alterados = ESCOPOS.filter((e) => r[e].escrito);
      if (alterados.length === 0) console.log(`Catálogo BNCC Computação já em dia (nada escrito): ${opcoes.saidaDir}`);
      for (const e of alterados) console.log(`Catálogo gerado: ${r[e].caminho} (${Buffer.byteLength(r[e].texto, "utf-8")} bytes)`);
    }
  } catch (error) {
    if (error instanceof BnccComputacaoGeracaoError) {
      console.error(`${modoCheck ? "Verificação" : "Geração"} interrompida: ${error.message}`);
      process.exitCode = 1;
    } else throw error;
  }
}
