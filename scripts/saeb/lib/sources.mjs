// Registro declarativo das fontes oficiais. Nada aqui é inferido: cada URL foi
// extraída do href efetivamente publicado na página do Inep, e cada tamanho e
// MD5 foi conferido na auditoria r2 (consulta em 31/08/2026).
//
// Edição piloto: 2025. A auditoria r2 recomenda o MVP "escola como entrada"
// ancorado nos pacotes de divulgação do Ideb por escola — são eles que trazem
// código INEP real, nome da escola, código IBGE do município e as proficiências
// do SAEB em Língua Portuguesa e Matemática de 2005 a 2025.
//
// A planilha agregada do SAEB 2025 (saeb_2025_brasil_estados_municipios_
// censitario.xlsx) NÃO entra nesta rodada: o Inep não publica MD5 oficial para
// ela, e a verificação de MD5 é requisito obrigatório deste importador. Ver
// "Decisões pendentes" no relatório.

export const EDICAO_PILOTO = "2025";

export const PAGINA_OFICIAL =
  "https://www.gov.br/inep/pt-br/areas-de-atuacao/pesquisas-estatisticas-e-indicadores/ideb/resultados/2005-2025";

export const ATRIBUICAO =
  "Ministério da Educação — Instituto Nacional de Estudos e Pesquisas Educacionais Anísio Teixeira (MEC/Inep)";

// União das edições cobertas pelos três pacotes. Cada pacote declara a sua
// cobertura própria abaixo: ela NÃO é a mesma para todos, e assumir que fosse
// produziria colunas inexistentes.
export const EDICOES = ["2005", "2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021", "2023", "2025"];

// Cobertura do Ensino Fundamental: indicadores desde a primeira edição do Ideb.
const EDICOES_FUNDAMENTAL = EDICOES;
// Metas não começam em 2005 porque 2005 é a linha de base — elas foram pactuadas
// a partir dela, para as edições seguintes. E terminam em 2021 porque o primeiro
// ciclo do Ideb encerrou e o indicador está em atualização (Portarias Inep
// nº 26/2024 e nº 188/2024).
const METAS_FUNDAMENTAL = ["2007", "2009", "2011", "2013", "2015", "2017", "2019", "2021"];

// O Ideb por escola no Ensino Médio só passa a existir em 2017, e suas metas
// cobrem apenas 2019 e 2021. Conferido no cabeçalho técnico do próprio pacote.
const EDICOES_ENSINO_MEDIO = ["2017", "2019", "2021", "2023", "2025"];
const METAS_ENSINO_MEDIO = ["2019", "2021"];

export const ULTIMA_EDICAO_COM_META = "2021";

// Ressalvas metodológicas declaradas pelo próprio Inep, no rodapé das planilhas
// e nas notas informativas. Viajam para o manifesto e, no futuro, para a UI.
export const RESSALVAS = {
  2009: {
    restricao: "medias do SAEB e Ideb calculadas somente com escolas urbanas",
    origem: "rodape da planilha oficial de divulgacao",
  },
  2021: {
    restricao: "edicao afetada pela pandemia; ler a nota informativa antes de comparar",
    origem: "nota_informativa_ideb_2021.pdf",
  },
};

/**
 * Os três pacotes que compõem a divulgação por escola da edição 2025.
 *
 * Há dois tipos de âncora de integridade aqui, com proveniências diferentes, e a
 * distinção importa:
 *
 * - `xlsxMd5` é **checksum publicado pelo Inep**. Ele existe no arquivo
 *   `md5_*.txt` dentro de cada pacote; a cópia fixada aqui serve para confrontar
 *   o que vier no pacote com o que foi revisado. As duas cópias estão separadas
 *   no tempo e no armazenamento, mas têm a mesma origem editorial — não são
 *   testemunhas independentes.
 *
 * - `zipSha256` e `xlsxSha256` são **fingerprints locais**, calculados sobre os
 *   bytes de um download oficial já revisado (auditoria r2, 31/08/2026, e
 *   reconferidos num segundo download em 01/09/2026). O Inep não publica
 *   SHA-256; estes valores não são checksum oficial e não devem ser
 *   apresentados como tal. Servem para detectar adulteração em trânsito ou em
 *   repouso no cache, inclusive quando o tamanho é preservado.
 */
export const PACOTES = [
  {
    id: "ideb-2025-anos-iniciais",
    etapa: "anosIniciais",
    etapaLabel: "Ensino Fundamental — Anos Iniciais",
    url: "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_iniciais_escolas_2025.zip",
    zipName: "divulgacao_anos_iniciais_escolas_2025.zip",
    zipSha256: "6addade230d4e6419abee5d1f5177f26abaf7f6d80e7f986a08faac931b35080",
    zipBytes: 112185922,
    innerDir: "divulgacao_anos_iniciais_escolas_2025",
    xlsxName: "divulgacao_anos_iniciais_escolas_2025.xlsx",
    xlsxSha256: "61ba8bed4eea34b016ac25219c6d2869802eceb8c83f9d50d4ecded583779cb2",
    xlsxBytes: 55951332,
    xlsxMd5: "6b4ce48ddcc02b1d4daf08428427342b",
    md5Name: "md5_divulgacao_anos_iniciais_escolas_2025.txt",
    edicoes: EDICOES_FUNDAMENTAL,
    edicoesComMeta: METAS_FUNDAMENTAL,
  },
  {
    id: "ideb-2025-anos-finais",
    etapa: "anosFinais",
    etapaLabel: "Ensino Fundamental — Anos Finais",
    url: "https://download.inep.gov.br/ideb/resultados/divulgacao_anos_finais_escolas_2025.zip",
    zipName: "divulgacao_anos_finais_escolas_2025.zip",
    zipSha256: "4115b81a02f05c908b27eab838e99978b8970b0fcadbf803ee3e69f296ccbc2d",
    zipBytes: 80112586,
    innerDir: "divulgacao_anos_finais_escolas_2025",
    xlsxName: "divulgacao_anos_finais_escolas_2025.xlsx",
    xlsxSha256: "d4391932b956d69ebdb65acafcf8b537b071c9257dbafdc2b579dedfdf2ca5e1",
    xlsxBytes: 38492355,
    xlsxMd5: "47eb0dc191844aec1d90d207dc940e40",
    md5Name: "md5_divulgacao_anos_finais_escolas_2025.txt",
    edicoes: EDICOES_FUNDAMENTAL,
    edicoesComMeta: METAS_FUNDAMENTAL,
  },
  {
    id: "ideb-2025-ensino-medio",
    etapa: "ensinoMedio",
    etapaLabel: "Ensino Médio",
    url: "https://download.inep.gov.br/ideb/resultados/divulgacao_ensino_medio_escolas_2025.zip",
    zipName: "divulgacao_ensino_medio_escolas_2025.zip",
    zipSha256: "85e923b3bcc5b2799b176abb8a611e03716d119b269e6cf3288e07959d29c299",
    zipBytes: 18989748,
    innerDir: "divulgacao_ensino_medio_escolas_2025",
    xlsxName: "divulgacao_ensino_medio_escolas_2025.xlsx",
    xlsxSha256: "bedb3e7155f9736e6ecfdbb6ec8be7f36d8a6bc8a3906e1f156c50c6293eb250",
    xlsxBytes: 8809605,
    xlsxMd5: "a6e7cb51332b85ba95fe6fc7a218dddf",
    md5Name: "md5_divulgacao_ensino_medio_escolas_2025.txt",
    edicoes: EDICOES_ENSINO_MEDIO,
    edicoesComMeta: METAS_ENSINO_MEDIO,
  },
];

/** Caminho da planilha dentro do pacote. */
export function xlsxEntryName(pacote) {
  return `${pacote.innerDir}/${pacote.xlsxName}`;
}

/** Caminho do arquivo de checksum dentro do pacote. */
export function md5EntryName(pacote) {
  return `${pacote.innerDir}/${pacote.md5Name}`;
}

// Layout da planilha, confirmado na auditoria: a linha 10 traz os nomes técnicos
// das colunas e os dados começam na 11. As linhas 1 a 9 são cabeçalho editorial
// (brasão, título, agrupamentos visuais) e não têm valor de dado.
export const LINHA_CABECALHO = 10;
export const PRIMEIRA_LINHA_DADOS = 11;

// Colunas de identificação, obrigatórias em todos os pacotes.
export const COLUNAS_IDENTIFICACAO = ["SG_UF", "CO_MUNICIPIO", "NO_MUNICIPIO", "ID_ESCOLA", "NO_ESCOLA", "REDE"];

/**
 * Colunas de indicador que o dataset preserva, por edição.
 *
 * Descartadas deliberadamente: VL_APROVACAO_<ano>_SI, _SI_4 e _1.._4 — as taxas
 * de aprovação por ano escolar. Elas são insumo do indicador de rendimento, que
 * já é preservado em `p`; mantê-las multiplicaria o payload por ~7 sem que nada
 * no MVP as consuma. A decisão está registrada no manifesto.
 */
export const INDICADORES = [
  { campo: "lp", coluna: "VL_NOTA_PORTUGUES", descricao: "Proficiência média em Língua Portuguesa, na escala do SAEB" },
  { campo: "mt", coluna: "VL_NOTA_MATEMATICA", descricao: "Proficiência média em Matemática, na escala do SAEB" },
  { campo: "n", coluna: "VL_NOTA_MEDIA", descricao: "Nota padronizada N, base SAEB 1997, escala 0 a 10" },
  { campo: "p", coluna: "VL_INDICADOR_REND", descricao: "Indicador de rendimento P, derivado do Censo Escolar" },
  { campo: "ideb", coluna: "VL_OBSERVADO", descricao: "Ideb observado, igual a N x P" },
  { campo: "meta", coluna: "VL_PROJECAO", descricao: "Meta projetada para a escola; existe apenas até 2021" },
];

export const SCHEMA_DATASET = "saeb-escolas-municipio/1";
export const SCHEMA_INDICE = "saeb-municipios-indice/1";
export const SCHEMA_MANIFESTO = 1;
