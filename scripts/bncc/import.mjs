import { createHash } from "node:crypto";
import { readFile, writeFile, mkdir } from "node:fs/promises";
import path from "node:path";
import process from "node:process";

// Each scope keeps its own source snapshot -> dataset -> report, mirroring the
// pattern already established for Matemática. Adding a new scope means adding
// a new process*() function here, never rewriting another scope's output.

const root = process.cwd();
const isCheck = process.argv.includes("--check");
// Control/replacement character codes a clean UTF-8 source snapshot should never
// contain. Built from char codes (not a regex escape literal) so no escape
// sequence in this file can be silently reinterpreted by any tooling.
const CONTROL_CHAR_CODES = [0, 1, 2, 3, 4, 5, 6, 7, 8, 11, 12, 14, 15, 16, 17, 18, 19, 20, 21, 22, 23, 24, 25, 26, 27, 28, 29, 30, 31, 0xfffd];
const CONTROL_CHARS = new RegExp(`[${CONTROL_CHAR_CODES.map((code) => String.fromCharCode(code)).join("")}]`);
const today = new Date().toISOString().slice(0, 10);

function hasControlChars(record) {
  return CONTROL_CHARS.test(JSON.stringify(record));
}

async function readSource(relativePath) {
  const sourcePath = path.join(root, relativePath);
  const raw = await readFile(sourcePath, "utf8");
  return { raw, data: JSON.parse(raw), relativePath: relativePath.replaceAll("\\", "/") };
}

async function writeJsonRaw(relativePath, value) {
  const target = path.join(root, relativePath);
  await mkdir(path.dirname(target), { recursive: true });
  await writeFile(target, `${JSON.stringify(value, null, 2)}\n`, "utf8");
}

async function writeReport(relativePath, report) {
  if (!isCheck) await writeJsonRaw(relativePath, report);
}

async function writeDataset(relativePath, dataset, status) {
  if (!isCheck && status === "valido") await writeJsonRaw(relativePath, dataset);
}

// ---- Escopo: Matemática — Ensino Fundamental, Anos Finais (6º-9º) ----
async function processMatematicaAnosFinais() {
  const loteId = `${today}-matematica-anos-finais`;
  const { raw, data: source, relativePath } = await readSource(
    "data/bncc/source/official-mec-bncc-matematica-anos-finais.json",
  );
  const importedAt = new Date().toISOString();
  const requiredFields = [
    "codigo", "etapa", "segmento", "area", "componente", "ano",
    "unidade_tematica", "objeto_conhecimento", "habilidade",
    "fonte", "fonte_url", "versao_fonte", "classificacao",
  ];
  const duplicates = [];
  const rejected = [];
  const warnings = [];
  const accepted = [];
  const seen = new Set();

  for (const [index, record] of source.habilidades.entries()) {
    const errors = [];
    const code = String(record.codigo ?? "").trim().toUpperCase();

    for (const field of requiredFields) {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        errors.push(`Campo obrigatório vazio: ${field}`);
      }
    }

    if (!/^EF(?:06|07|08|09)MA\d{2}$/.test(code)) {
      errors.push("Código fora do padrão EF06MAxx-EF09MAxx");
    }

    const expectedGrade = code.match(/^EF(\d{2})MA/)?.[1]?.replace(/^0/, "");
    if (expectedGrade && record.ano !== `${expectedGrade}º ano`) {
      errors.push(`Ano ${record.ano} não corresponde ao código ${code}`);
    }

    if (hasControlChars(record)) {
      errors.push("Registro contém caracteres de controle ou substituição");
    }

    if (seen.has(code)) {
      duplicates.push(code);
      errors.push("Código duplicado");
    }
    seen.add(code);

    if (record.habilidade && !/[.!?)]$/.test(record.habilidade.trim())) {
      warnings.push({ codigo: code, alerta: "Texto da habilidade pode estar truncado: pontuação final ausente" });
    }

    if (/\b(?:ax|x|m|cm|km)2\b/i.test(`${record.objeto_conhecimento} ${record.habilidade}`)) {
      warnings.push({ codigo: code, alerta: "Possível sobrescrito ² perdido durante a extração" });
    }

    if (errors.length) {
      rejected.push({ index, codigo: code || null, erros: errors });
      continue;
    }

    accepted.push({
      id: code.toLowerCase(),
      codigo: code,
      tipo: "habilidade",
      etapa: record.etapa,
      segmento: record.segmento,
      area: record.area,
      componente: record.componente,
      ano: record.ano,
      anos_aplicaveis: [record.ano],
      unidade_tematica: record.unidade_tematica,
      objeto_conhecimento: record.objeto_conhecimento,
      texto: record.habilidade,
      fonte: record.fonte,
      fonte_url: record.fonte_url,
      documento_url: record.documento_url,
      versao_fonte: record.versao_fonte,
      pagina_fonte: record.pagina_fonte,
      classificacao: record.classificacao,
      lote_importacao: loteId,
      data_importacao: importedAt,
    });
  }

  const totalsByGrade = Object.fromEntries(
    [6, 7, 8, 9].map((grade) => [
      `${grade}º ano`,
      accepted.filter((record) => record.ano === `${grade}º ano`).length,
    ]),
  );

  for (const grade of [6, 7, 8, 9]) {
    const prefix = `EF0${grade}MA`;
    const numbers = accepted
      .filter((record) => record.codigo.startsWith(prefix))
      .map((record) => Number(record.codigo.slice(-2)))
      .sort((a, b) => a - b);
    const missing = numbers.length
      ? Array.from({ length: numbers.at(-1) }, (_, index) => index + 1).filter((number) => !numbers.includes(number))
      : [];
    if (missing.length) {
      warnings.push({ ano: `${grade}º ano`, alerta: `Códigos ausentes: ${missing.map((number) => String(number).padStart(2, "0")).join(", ")}` });
    }
  }

  const status = rejected.length || duplicates.length || warnings.some((item) => item.alerta?.startsWith("Códigos ausentes"))
    ? "revisao_necessaria"
    : "valido";

  const report = {
    escopo: "matematica-anos-finais",
    data_importacao: importedAt,
    lote_importacao: loteId,
    arquivo_fonte: relativePath,
    hash_sha256_fonte: createHash("sha256").update(raw).digest("hex"),
    versao_fonte: source.metadata.versao_fonte,
    metodo_extracao: source.metadata.metodo_extracao,
    total_por_ano: totalsByGrade,
    total_geral: accepted.length,
    duplicidades: [...new Set(duplicates)],
    registros_rejeitados: rejected,
    alertas: warnings,
    status,
  };

  const dataset = {
    metadata: {
      ...source.metadata,
      data_importacao: importedAt,
      lote_importacao: loteId,
      total_registros: accepted.length,
      hash_sha256_fonte: report.hash_sha256_fonte,
    },
    registros: accepted.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
  };

  await writeReport("data/bncc/matematica-anos-finais.report.json", report);
  await writeDataset("data/bncc/matematica-anos-finais.json", dataset, status);

  return { report, accepted: status === "valido" ? accepted : [] };
}

const LP_GRADE_TO_ANOS = {
  "01": ["1º ano"], "02": ["2º ano"], "03": ["3º ano"], "04": ["4º ano"], "05": ["5º ano"],
  "06": ["6º ano"],
  "07": ["7º ano"],
  "08": ["8º ano"],
  "09": ["9º ano"],
  "12": ["1º ano", "2º ano"], "35": ["3º ano", "4º ano", "5º ano"],
  "15": ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"],
  "67": ["6º ano", "7º ano"],
  "89": ["8º ano", "9º ano"],
  "69": ["6º ano", "7º ano", "8º ano", "9º ano"],
};
const LP_GRADE_TO_LABEL = {
  "01": "1º ano", "02": "2º ano", "03": "3º ano", "04": "4º ano", "05": "5º ano",
  "06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano",
  "12": "1º e 2º ano", "35": "3º ao 5º ano", "15": "1º ao 5º ano",
  "67": "6º e 7º ano", "89": "8º e 9º ano", "69": "6º ao 9º ano",
};
const LP_KNOWN_CAMPOS = new Set([
  "Campo Jornalístico-Midiático",
  "Campo de Atuação na Vida Pública",
  "Campo das Práticas de Estudo e Pesquisa",
  "Campo Artístico-Literário",
  "Todos os Campos de Atuação",
  "Campo da Vida Cotidiana",
  "Campo da Vida Pública",
]);

const LP_SCOPES = [
  {
    scopeId: "lingua-portuguesa-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-lingua-portuguesa-anos-finais.json",
    codeGrades: "06|07|08|09|67|89|69",
    prefixes: ["EF06LP", "EF07LP", "EF08LP", "EF09LP", "EF67LP", "EF89LP", "EF69LP"],
  },
  {
    scopeId: "lingua-portuguesa-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-lingua-portuguesa-anos-iniciais.json",
    codeGrades: "01|02|03|04|05|12|15|35",
    prefixes: ["EF01LP", "EF02LP", "EF03LP", "EF04LP", "EF05LP", "EF12LP", "EF15LP", "EF35LP"],
  },
];

// ---- Escopo: Língua Portuguesa — Ensino Fundamental (Anos Iniciais e Anos Finais) ----
async function processLinguaPortuguesa({ scopeId, sourceFile, codeGrades, prefixes }) {
  const loteId = `${today}-${scopeId}`;
  const { raw, data: source, relativePath } = await readSource(sourceFile);
  const importedAt = new Date().toISOString();
  const requiredFields = [
    "codigo", "etapa", "segmento", "area", "componente", "ano",
    "campo_atuacao", "habilidade", "fonte", "fonte_url", "versao_fonte", "classificacao",
  ];
  const duplicates = [];
  const rejected = [];
  const warnings = [];
  const accepted = [];
  const seen = new Set();
  const knownCampos = LP_KNOWN_CAMPOS;
  const codePattern = new RegExp(`^EF(${codeGrades})LP(\\d{2})$`);

  for (const [index, record] of source.habilidades.entries()) {
    const errors = [];
    const code = String(record.codigo ?? "").trim().toUpperCase();

    for (const field of requiredFields) {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        errors.push(`Campo obrigatório vazio: ${field}`);
      }
    }

    const codeMatch = code.match(codePattern);
    if (!codeMatch) {
      errors.push(`Código fora do padrão EF{${codeGrades}}LPxx`);
    }

    const gradeKey = codeMatch?.[1];
    if (gradeKey && record.ano !== LP_GRADE_TO_LABEL[gradeKey]) {
      errors.push(`Ano "${record.ano}" não corresponde ao código ${code} (esperado "${LP_GRADE_TO_LABEL[gradeKey]}")`);
    }
    if (gradeKey && JSON.stringify(record.anos_aplicaveis) !== JSON.stringify(LP_GRADE_TO_ANOS[gradeKey])) {
      errors.push(`anos_aplicaveis de ${code} não corresponde ao esperado para o código`);
    }

    if (record.campo_atuacao && !knownCampos.has(record.campo_atuacao)) {
      errors.push(`Campo de atuação desconhecido: ${record.campo_atuacao}`);
    }

    if (hasControlChars(record)) {
      errors.push("Registro contém caracteres de controle ou substituição");
    }

    if (seen.has(code)) {
      duplicates.push(code);
      errors.push("Código duplicado");
    }
    seen.add(code);

    if (record.habilidade && !/[.!?)"”]$/.test(record.habilidade.trim())) {
      warnings.push({ codigo: code, alerta: "Texto da habilidade pode estar truncado: pontuação final ausente (conferido contra o PDF oficial — pode ser assim na fonte)" });
    }

    if (errors.length) {
      rejected.push({ index, codigo: code || null, erros: errors });
      continue;
    }

    accepted.push({
      id: code.toLowerCase(),
      codigo: code,
      tipo: "habilidade",
      etapa: record.etapa,
      segmento: record.segmento,
      area: record.area,
      componente: record.componente,
      ano: record.ano,
      anos_aplicaveis: record.anos_aplicaveis,
      campo_atuacao: record.campo_atuacao,
      objeto_conhecimento: record.objeto_conhecimento || undefined,
      texto: record.habilidade,
      fonte: record.fonte,
      fonte_url: record.fonte_url,
      documento_url: record.documento_url,
      versao_fonte: record.versao_fonte,
      pagina_fonte: record.pagina_fonte,
      classificacao: record.classificacao,
      lote_importacao: loteId,
      data_importacao: importedAt,
    });
  }

  const totalsByGrade = {};
  for (const record of accepted) totalsByGrade[record.ano] = (totalsByGrade[record.ano] ?? 0) + 1;

  const totalsByCampo = {};
  for (const record of accepted) totalsByCampo[record.campo_atuacao] = (totalsByCampo[record.campo_atuacao] ?? 0) + 1;

  for (const prefix of prefixes) {
    const numbers = accepted
      .filter((record) => record.codigo.startsWith(prefix))
      .map((record) => Number(record.codigo.slice(prefix.length)))
      .sort((a, b) => a - b);
    const missing = numbers.length
      ? Array.from({ length: numbers.at(-1) }, (_, index) => index + 1).filter((number) => !numbers.includes(number))
      : [];
    if (missing.length) {
      warnings.push({ prefixo: prefix, alerta: `Códigos ausentes: ${missing.map((number) => String(number).padStart(2, "0")).join(", ")}` });
    }
  }

  const status = rejected.length || duplicates.length || warnings.some((item) => item.alerta?.startsWith("Códigos ausentes"))
    ? "revisao_necessaria"
    : "valido";

  const report = {
    escopo: scopeId,
    data_importacao: importedAt,
    lote_importacao: loteId,
    arquivo_fonte: relativePath,
    hash_sha256_fonte: createHash("sha256").update(raw).digest("hex"),
    versao_fonte: source.metadata.versao_fonte,
    metodo_extracao: source.metadata.metodo_extracao,
    total_por_ano: totalsByGrade,
    total_por_campo_atuacao: totalsByCampo,
    total_geral: accepted.length,
    duplicidades: [...new Set(duplicates)],
    registros_rejeitados: rejected,
    alertas: warnings,
    limitacoes_conhecidas: source.metadata.limitacoes ?? [],
    status,
  };

  const dataset = {
    metadata: {
      ...source.metadata,
      data_importacao: importedAt,
      lote_importacao: loteId,
      total_registros: accepted.length,
      hash_sha256_fonte: report.hash_sha256_fonte,
    },
    registros: accepted.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
  };

  await writeReport(`data/bncc/${scopeId}.report.json`, report);
  await writeDataset(`data/bncc/${scopeId}.json`, dataset, status);

  return { report, accepted: status === "valido" ? accepted : [] };
}

const GRADE_TO_LABEL = {
  "01": "1º ano", "02": "2º ano", "03": "3º ano", "04": "4º ano", "05": "5º ano",
  "06": "6º ano", "07": "7º ano", "08": "8º ano", "09": "9º ano",
  "12": "1º e 2º ano", "35": "3º ao 5º ano", "15": "1º ao 5º ano",
  "67": "6º e 7º ano", "89": "8º e 9º ano", "69": "6º ao 9º ano",
};
const GRADE_TO_ANOS = {
  "01": ["1º ano"], "02": ["2º ano"], "03": ["3º ano"], "04": ["4º ano"], "05": ["5º ano"],
  "06": ["6º ano"], "07": ["7º ano"], "08": ["8º ano"], "09": ["9º ano"],
  "12": ["1º ano", "2º ano"], "35": ["3º ano", "4º ano", "5º ano"],
  "15": ["1º ano", "2º ano", "3º ano", "4º ano", "5º ano"],
  "67": ["6º ano", "7º ano"], "89": ["8º ano", "9º ano"],
  "69": ["6º ano", "7º ano", "8º ano", "9º ano"],
};

// ---- Escopos de componente único-unidade-temática: Arte, Educação Física,
// Língua Inglesa, Ciências, Geografia, História, Ensino Religioso ----
// Shares the Matemática/Língua Portuguesa pipeline shape (source snapshot ->
// validated dataset -> report) but factored into one function since these
// components' validation rules are otherwise identical: a code matching
// EF{gradeKey}{componentCode}{seq}, unidade_tematica required, grade derived
// from the code itself.
async function processSimpleComponent(config) {
  const { scopeId, sourceFile, codePattern, requiredFields = ["codigo", "etapa", "segmento", "area", "componente", "ano", "unidade_tematica", "objeto_conhecimento", "habilidade", "fonte", "fonte_url", "versao_fonte", "classificacao"] } = config;
  const loteId = `${today}-${scopeId}`;
  const { raw, data: source, relativePath } = await readSource(sourceFile);
  const importedAt = new Date().toISOString();
  const duplicates = [];
  const rejected = [];
  const warnings = [];
  const accepted = [];
  const seen = new Set();

  for (const [index, record] of source.habilidades.entries()) {
    const errors = [];
    const code = String(record.codigo ?? "").trim().toUpperCase();

    for (const field of requiredFields) {
      if (typeof record[field] !== "string" || !record[field].trim()) {
        errors.push(`Campo obrigatório vazio: ${field}`);
      }
    }

    const codeMatch = code.match(codePattern);
    if (!codeMatch) {
      errors.push(`Código fora do padrão esperado para ${config.componenteLabel}`);
    }
    const gradeKey = codeMatch?.[1];
    if (gradeKey && record.ano !== GRADE_TO_LABEL[gradeKey]) {
      errors.push(`Ano "${record.ano}" não corresponde ao código ${code} (esperado "${GRADE_TO_LABEL[gradeKey]}")`);
    }
    if (gradeKey && JSON.stringify(record.anos_aplicaveis) !== JSON.stringify(GRADE_TO_ANOS[gradeKey])) {
      errors.push(`anos_aplicaveis de ${code} não corresponde ao esperado para o código`);
    }

    if (hasControlChars(record)) {
      errors.push("Registro contém caracteres de controle ou substituição");
    }

    if (seen.has(code)) {
      duplicates.push(code);
      errors.push("Código duplicado");
    }
    seen.add(code);

    if (record.habilidade && !/[.!?)"”]$/.test(record.habilidade.trim())) {
      warnings.push({ codigo: code, alerta: "Texto da habilidade pode estar truncado: pontuação final ausente" });
    }

    if (errors.length) {
      rejected.push({ index, codigo: code || null, erros: errors });
      continue;
    }

    accepted.push({
      id: code.toLowerCase(),
      codigo: code,
      tipo: "habilidade",
      etapa: record.etapa,
      segmento: record.segmento,
      area: record.area,
      componente: record.componente,
      ano: record.ano,
      anos_aplicaveis: record.anos_aplicaveis,
      unidade_tematica: record.unidade_tematica,
      objeto_conhecimento: record.objeto_conhecimento || undefined,
      texto: record.habilidade,
      fonte: record.fonte,
      fonte_url: record.fonte_url,
      documento_url: record.documento_url,
      versao_fonte: record.versao_fonte,
      pagina_fonte: record.pagina_fonte,
      classificacao: record.classificacao,
      lote_importacao: loteId,
      data_importacao: importedAt,
    });
  }

  const totalsByGrade = {};
  for (const record of accepted) totalsByGrade[record.ano] = (totalsByGrade[record.ano] ?? 0) + 1;
  const totalsByUnidade = {};
  for (const record of accepted) totalsByUnidade[record.unidade_tematica] = (totalsByUnidade[record.unidade_tematica] ?? 0) + 1;

  const status = rejected.length || duplicates.length ? "revisao_necessaria" : "valido";

  const report = {
    escopo: scopeId,
    data_importacao: importedAt,
    lote_importacao: loteId,
    arquivo_fonte: relativePath,
    hash_sha256_fonte: createHash("sha256").update(raw).digest("hex"),
    versao_fonte: source.metadata.versao_fonte,
    metodo_extracao: source.metadata.metodo_extracao,
    total_por_ano: totalsByGrade,
    total_por_unidade_tematica: totalsByUnidade,
    total_geral: accepted.length,
    duplicidades: [...new Set(duplicates)],
    registros_rejeitados: rejected,
    alertas: warnings,
    status,
  };

  const dataset = {
    metadata: {
      ...source.metadata,
      data_importacao: importedAt,
      lote_importacao: loteId,
      total_registros: accepted.length,
      hash_sha256_fonte: report.hash_sha256_fonte,
    },
    registros: accepted.sort((a, b) => a.codigo.localeCompare(b.codigo, "pt-BR")),
  };

  await writeReport(`data/bncc/${scopeId}.report.json`, report);
  await writeDataset(`data/bncc/${scopeId}.json`, dataset, status);

  return { report, accepted: status === "valido" ? accepted : [] };
}

const SIMPLE_COMPONENTS = [
  {
    scopeId: "matematica-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-matematica-anos-iniciais.json",
    codePattern: /^EF(01|02|03|04|05)MA\d{2}$/,
    componenteLabel: "Matemática (EF01-05MAxx)",
  },
  {
    scopeId: "arte-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-arte-anos-iniciais.json",
    codePattern: /^EF(15)AR\d{2}$/,
    componenteLabel: "Arte (EF15ARxx)",
  },
  {
    scopeId: "arte-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-arte-anos-finais.json",
    codePattern: /^EF(69)AR\d{2}$/,
    componenteLabel: "Arte (EF69ARxx)",
  },
  {
    scopeId: "educacao-fisica-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-educacao-fisica-anos-iniciais.json",
    codePattern: /^EF(12|35)EF\d{2}$/,
    componenteLabel: "Educação Física (EF12EFxx/EF35EFxx)",
  },
  {
    scopeId: "educacao-fisica-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-educacao-fisica-anos-finais.json",
    codePattern: /^EF(67|89)EF\d{2}$/,
    componenteLabel: "Educação Física (EF67EFxx/EF89EFxx)",
  },
  {
    scopeId: "lingua-inglesa-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-lingua-inglesa-anos-finais.json",
    codePattern: /^EF(06|07|08|09)LI\d{2}$/,
    componenteLabel: "Língua Inglesa (EF06-09LIxx)",
  },
  {
    scopeId: "ciencias-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-ciencias-anos-iniciais.json",
    codePattern: /^EF(01|02|03|04|05)CI\d{2}$/,
    componenteLabel: "Ciências (EF01-05CIxx)",
  },
  {
    scopeId: "ciencias-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-ciencias-anos-finais.json",
    codePattern: /^EF(06|07|08|09)CI\d{2}$/,
    componenteLabel: "Ciências (EF06-09CIxx)",
  },
  {
    scopeId: "geografia-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-geografia-anos-iniciais.json",
    codePattern: /^EF(01|02|03|04|05)GE\d{2}$/,
    componenteLabel: "Geografia (EF01-05GExx)",
  },
  {
    scopeId: "geografia-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-geografia-anos-finais.json",
    codePattern: /^EF(06|07|08|09)GE\d{2}$/,
    componenteLabel: "Geografia (EF06-09GExx)",
  },
  {
    scopeId: "historia-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-historia-anos-iniciais.json",
    codePattern: /^EF(01|02|03|04|05)HI\d{2}$/,
    componenteLabel: "História (EF01-05HIxx)",
  },
  {
    scopeId: "historia-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-historia-anos-finais.json",
    codePattern: /^EF(06|07|08|09)HI\d{2}$/,
    componenteLabel: "História (EF06-09HIxx)",
  },
  {
    scopeId: "ensino-religioso-anos-iniciais",
    sourceFile: "data/bncc/source/official-mec-bncc-ensino-religioso-anos-iniciais.json",
    codePattern: /^EF(01|02|03|04|05)ER\d{2}$/,
    componenteLabel: "Ensino Religioso (EF01-05ERxx)",
  },
  {
    scopeId: "ensino-religioso-anos-finais",
    sourceFile: "data/bncc/source/official-mec-bncc-ensino-religioso-anos-finais.json",
    codePattern: /^EF(06|07|08|09)ER\d{2}$/,
    componenteLabel: "Ensino Religioso (EF06-09ERxx)",
  },
];

// ---- Escopo: Competências Gerais da Educação Básica ----
async function processCompetenciasGerais() {
  const loteId = `${today}-competencias-gerais`;
  const { raw, data: source, relativePath } = await readSource(
    "data/bncc/source/official-mec-bncc-competencias-gerais.json",
  );
  const importedAt = new Date().toISOString();
  const rejected = [];
  const warnings = [];
  const accepted = [];
  const seen = new Set();

  for (const [index, record] of source.competencias.entries()) {
    const errors = [];
    const numero = Number(record.numero);

    if (!Number.isInteger(numero) || numero < 1 || numero > 10) {
      errors.push("Número fora do intervalo esperado (1-10)");
    }
    if (typeof record.texto !== "string" || !record.texto.trim()) {
      errors.push("Campo obrigatório vazio: texto");
    }
    if (hasControlChars(record)) {
      errors.push("Registro contém caracteres de controle ou substituição");
    }
    if (seen.has(numero)) {
      errors.push("Número duplicado");
    }
    seen.add(numero);

    if (record.texto && !/[.!?]$/.test(record.texto.trim())) {
      warnings.push({ numero, alerta: "Texto pode estar truncado: pontuação final ausente" });
    }

    if (errors.length) {
      rejected.push({ index, numero: Number.isInteger(numero) ? numero : null, erros: errors });
      continue;
    }

    accepted.push({
      id: `competencia-geral-${numero}`,
      codigo: null,
      tipo: "competencia_geral",
      etapa: "Educação Básica",
      numero,
      texto: record.texto,
      fonte: source.metadata.fonte,
      fonte_url: source.metadata.fonte_url,
      documento_url: source.metadata.documento_url,
      versao_fonte: source.metadata.versao_fonte,
      pagina_fonte: record.pagina_fonte,
      classificacao: source.metadata.classificacao,
      lote_importacao: loteId,
      data_importacao: importedAt,
    });
  }

  const missingNumbers = Array.from({ length: 10 }, (_, index) => index + 1).filter((number) => !seen.has(number));
  if (missingNumbers.length) {
    warnings.push({ alerta: `Números ausentes: ${missingNumbers.join(", ")}` });
  }

  const status = rejected.length || warnings.some((item) => item.alerta?.startsWith("Números ausentes"))
    ? "revisao_necessaria"
    : "valido";

  const report = {
    escopo: "competencias-gerais",
    data_importacao: importedAt,
    lote_importacao: loteId,
    arquivo_fonte: relativePath,
    hash_sha256_fonte: createHash("sha256").update(raw).digest("hex"),
    versao_fonte: source.metadata.versao_fonte,
    metodo_extracao: source.metadata.metodo_extracao,
    total_geral: accepted.length,
    registros_rejeitados: rejected,
    alertas: warnings,
    status,
  };

  const dataset = {
    metadata: {
      ...source.metadata,
      data_importacao: importedAt,
      lote_importacao: loteId,
      total_registros: accepted.length,
      hash_sha256_fonte: report.hash_sha256_fonte,
    },
    registros: accepted.sort((a, b) => a.numero - b.numero),
  };

  await writeReport("data/bncc/competencias-gerais.report.json", report);
  await writeDataset("data/bncc/competencias-gerais.json", dataset, status);

  return { report, accepted: status === "valido" ? accepted : [] };
}

async function main() {
  const scopes = [
    await processMatematicaAnosFinais(),
    ...(await Promise.all(LP_SCOPES.map((config) => processLinguaPortuguesa(config)))),
    ...(await Promise.all(SIMPLE_COMPONENTS.map((config) => processSimpleComponent(config)))),
    await processCompetenciasGerais(),
  ];
  const allAccepted = scopes.flatMap((scope) => scope.accepted);
  const importedAt = new Date().toISOString();

  const totalPorEtapa = {};
  const totalPorTipo = {};
  const totalPorComponente = {};
  for (const record of allAccepted) {
    totalPorEtapa[record.etapa] = (totalPorEtapa[record.etapa] ?? 0) + 1;
    totalPorTipo[record.tipo] = (totalPorTipo[record.tipo] ?? 0) + 1;
    if (record.componente) totalPorComponente[record.componente] = (totalPorComponente[record.componente] ?? 0) + 1;
  }

  const overallStatus = scopes.every((scope) => scope.report.status === "valido") ? "valido" : "revisao_necessaria";
  const summary = {
    data_importacao: importedAt,
    status: overallStatus,
    total_geral: allAccepted.length,
    total_por_etapa: totalPorEtapa,
    total_por_tipo: totalPorTipo,
    total_por_componente: totalPorComponente,
    escopos: Object.fromEntries(scopes.map((scope) => [
      scope.report.escopo,
      { status: scope.report.status, total: scope.report.total_geral, relatorio: `data/bncc/${scope.report.escopo}.report.json` },
    ])),
  };

  await writeReport("data/bncc/import-report.json", summary);

  for (const scope of scopes) {
    if (scope.report.status !== "valido") {
      console.error(JSON.stringify(scope.report, null, 2));
    }
  }
  console.log(JSON.stringify(summary, null, 2));

  if (overallStatus !== "valido") process.exitCode = 1;
}

await main();
