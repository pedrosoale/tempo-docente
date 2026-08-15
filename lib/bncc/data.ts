import arteAnosFinaisDataset from "@/data/bncc/arte-anos-finais.json";
import arteAnosIniciaisDataset from "@/data/bncc/arte-anos-iniciais.json";
import cienciasAnosFinaisDataset from "@/data/bncc/ciencias-anos-finais.json";
import cienciasAnosIniciaisDataset from "@/data/bncc/ciencias-anos-iniciais.json";
import competenciasDataset from "@/data/bncc/competencias-gerais.json";
import educacaoFisicaAnosFinaisDataset from "@/data/bncc/educacao-fisica-anos-finais.json";
import educacaoFisicaAnosIniciaisDataset from "@/data/bncc/educacao-fisica-anos-iniciais.json";
import ensinoMedioCienciasDaNaturezaDataset from "@/data/bncc/ensino-medio-ciencias-da-natureza.json";
import ensinoMedioCienciasHumanasDataset from "@/data/bncc/ensino-medio-ciencias-humanas.json";
import ensinoMedioLinguaPortuguesaDataset from "@/data/bncc/ensino-medio-lingua-portuguesa.json";
import ensinoMedioLinguagensDataset from "@/data/bncc/ensino-medio-linguagens.json";
import ensinoMedioMatematicaDataset from "@/data/bncc/ensino-medio-matematica.json";
import ensinoReligiosoAnosFinaisDataset from "@/data/bncc/ensino-religioso-anos-finais.json";
import ensinoReligiosoAnosIniciaisDataset from "@/data/bncc/ensino-religioso-anos-iniciais.json";
import geografiaAnosFinaisDataset from "@/data/bncc/geografia-anos-finais.json";
import geografiaAnosIniciaisDataset from "@/data/bncc/geografia-anos-iniciais.json";
import historiaAnosFinaisDataset from "@/data/bncc/historia-anos-finais.json";
import historiaAnosIniciaisDataset from "@/data/bncc/historia-anos-iniciais.json";
import linguaInglesaDataset from "@/data/bncc/lingua-inglesa-anos-finais.json";
import linguaPortuguesaAnosFinaisDataset from "@/data/bncc/lingua-portuguesa-anos-finais.json";
import linguaPortuguesaAnosIniciaisDataset from "@/data/bncc/lingua-portuguesa-anos-iniciais.json";
import matematicaAnosFinaisDataset from "@/data/bncc/matematica-anos-finais.json";
import matematicaAnosIniciaisDataset from "@/data/bncc/matematica-anos-iniciais.json";
import type { BnccRegistro, CompetenciaEspecificaMedio, CompetenciaGeral, HabilidadeFundamental, HabilidadeMedio } from "./types";

export const bnccMetadata = matematicaAnosFinaisDataset.metadata;
export const bnccSkills = [...matematicaAnosIniciaisDataset.registros, ...matematicaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const linguaPortuguesaMetadata = linguaPortuguesaAnosFinaisDataset.metadata;
export const linguaPortuguesaSkills = [...linguaPortuguesaAnosIniciaisDataset.registros, ...linguaPortuguesaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const arteMetadata = arteAnosFinaisDataset.metadata;
export const arteSkills = [...arteAnosIniciaisDataset.registros, ...arteAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const educacaoFisicaMetadata = educacaoFisicaAnosFinaisDataset.metadata;
export const educacaoFisicaSkills = [...educacaoFisicaAnosIniciaisDataset.registros, ...educacaoFisicaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const linguaInglesaMetadata = linguaInglesaDataset.metadata;
export const linguaInglesaSkills = linguaInglesaDataset.registros as HabilidadeFundamental[];

export const cienciasMetadata = cienciasAnosFinaisDataset.metadata;
export const cienciasSkills = [...cienciasAnosIniciaisDataset.registros, ...cienciasAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const geografiaMetadata = geografiaAnosFinaisDataset.metadata;
export const geografiaSkills = [...geografiaAnosIniciaisDataset.registros, ...geografiaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const historiaMetadata = historiaAnosFinaisDataset.metadata;
export const historiaSkills = [...historiaAnosIniciaisDataset.registros, ...historiaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const ensinoReligiosoMetadata = ensinoReligiosoAnosFinaisDataset.metadata;
export const ensinoReligiosoSkills = [...ensinoReligiosoAnosIniciaisDataset.registros, ...ensinoReligiosoAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const competenciasGeraisMetadata = competenciasDataset.metadata;
export const competenciasGerais = competenciasDataset.registros as CompetenciaGeral[];

export const linguagensMedioMetadata = ensinoMedioLinguagensDataset.metadata;
const linguagensMedioRegistros = ensinoMedioLinguagensDataset.registros as (CompetenciaEspecificaMedio | HabilidadeMedio)[];
export const linguagensMedioCompetencias = linguagensMedioRegistros.filter((registro): registro is CompetenciaEspecificaMedio => registro.tipo === "competencia_especifica");
export const linguagensMedioSkills = linguagensMedioRegistros.filter((registro): registro is HabilidadeMedio => registro.tipo === "habilidade");

export const matematicaMedioMetadata = ensinoMedioMatematicaDataset.metadata;
const matematicaMedioRegistros = ensinoMedioMatematicaDataset.registros as (CompetenciaEspecificaMedio | HabilidadeMedio)[];
export const matematicaMedioCompetencias = matematicaMedioRegistros.filter((registro): registro is CompetenciaEspecificaMedio => registro.tipo === "competencia_especifica");
export const matematicaMedioSkills = matematicaMedioRegistros.filter((registro): registro is HabilidadeMedio => registro.tipo === "habilidade");

export const cienciasDaNaturezaMedioMetadata = ensinoMedioCienciasDaNaturezaDataset.metadata;
const cienciasDaNaturezaMedioRegistros = ensinoMedioCienciasDaNaturezaDataset.registros as (CompetenciaEspecificaMedio | HabilidadeMedio)[];
export const cienciasDaNaturezaMedioCompetencias = cienciasDaNaturezaMedioRegistros.filter((registro): registro is CompetenciaEspecificaMedio => registro.tipo === "competencia_especifica");
export const cienciasDaNaturezaMedioSkills = cienciasDaNaturezaMedioRegistros.filter((registro): registro is HabilidadeMedio => registro.tipo === "habilidade");

export const cienciasHumanasMedioMetadata = ensinoMedioCienciasHumanasDataset.metadata;
const cienciasHumanasMedioRegistros = ensinoMedioCienciasHumanasDataset.registros as (CompetenciaEspecificaMedio | HabilidadeMedio)[];
export const cienciasHumanasMedioCompetencias = cienciasHumanasMedioRegistros.filter((registro): registro is CompetenciaEspecificaMedio => registro.tipo === "competencia_especifica");
export const cienciasHumanasMedioSkills = cienciasHumanasMedioRegistros.filter((registro): registro is HabilidadeMedio => registro.tipo === "habilidade");

// Língua Portuguesa não tem competências específicas próprias — suas
// habilidades referenciam as 7 de Linguagens e suas Tecnologias (ver
// linguagensMedioCompetencias, reaproveitadas abaixo em AREAS_ENSINO_MEDIO).
export const linguaPortuguesaMedioMetadata = ensinoMedioLinguaPortuguesaDataset.metadata;
export const linguaPortuguesaMedioSkills = ensinoMedioLinguaPortuguesaDataset.registros as HabilidadeMedio[];

export type ComponenteInfo = {
  slug: string;
  nome: string;
  skills: HabilidadeFundamental[];
  descricao: string;
};

export const COMPONENTES_ANOS_FINAIS: ComponenteInfo[] = [
  { slug: "matematica", nome: "Matemática", skills: bnccSkills, descricao: "Números, álgebra, geometria, grandezas e medidas, probabilidade e estatística." },
  { slug: "lingua-portuguesa", nome: "Língua Portuguesa", skills: linguaPortuguesaSkills, descricao: "Leitura, produção de texto, oralidade e análise linguística, organizadas por campo de atuação." },
  { slug: "arte", nome: "Arte", skills: arteSkills, descricao: "Artes visuais, dança, música, teatro e artes integradas." },
  { slug: "educacao-fisica", nome: "Educação Física", skills: educacaoFisicaSkills, descricao: "Brincadeiras e jogos, esportes, ginásticas, danças, lutas e práticas corporais de aventura." },
  { slug: "lingua-inglesa", nome: "Língua Inglesa", skills: linguaInglesaSkills, descricao: "Oralidade, leitura, escrita, conhecimentos linguísticos e dimensão intercultural." },
  { slug: "ciencias", nome: "Ciências", skills: cienciasSkills, descricao: "Matéria e energia, vida e evolução, Terra e Universo." },
  { slug: "geografia", nome: "Geografia", skills: geografiaSkills, descricao: "O sujeito e seu lugar no mundo, conexões e escalas, mundo do trabalho e mais." },
  { slug: "historia", nome: "História", skills: historiaSkills, descricao: "Processos históricos do mundo antigo à história recente, com foco no Brasil." },
  { slug: "ensino-religioso", nome: "Ensino Religioso", skills: ensinoReligiosoSkills, descricao: "Crenças religiosas, filosofias de vida e manifestações religiosas." },
];

export const fundamentalSkills: HabilidadeFundamental[] = COMPONENTES_ANOS_FINAIS.flatMap((componente) => componente.skills);

export type AreaEnsinoMedioInfo = {
  slug: string;
  nome: string;
  // Igual a `nome` nas 4 áreas simples. Distinto só para Língua Portuguesa,
  // cujas habilidades carregam componente "Língua Portuguesa" mas área
  // "Linguagens e suas Tecnologias" — usado para rotear o breadcrumb da
  // página de detalhe (skill.componente) sem misturar as duas páginas.
  componente: string;
  skills: HabilidadeMedio[];
  competencias: CompetenciaEspecificaMedio[];
  descricao: string;
};

// Diferente de COMPONENTES_ANOS_FINAIS, cada entrada aqui é uma área do
// conhecimento (não um componente por ano) — a BNCC do Ensino Médio organiza
// a Formação Geral Básica por área + competência específica, sem recorte por
// série. Língua Portuguesa é a exceção: é um componente com página própria
// (mesmo padrão do Fundamental), mas sem competências específicas próprias —
// reaproveita as 7 de Linguagens e suas Tecnologias.
export const AREAS_ENSINO_MEDIO: AreaEnsinoMedioInfo[] = [
  {
    slug: "linguagens",
    nome: "Linguagens e suas Tecnologias",
    componente: "Linguagens e suas Tecnologias",
    skills: linguagensMedioSkills,
    competencias: linguagensMedioCompetencias,
    descricao: "Práticas de linguagem artísticas, corporais e verbais, tecnologias digitais e produção cultural.",
  },
  {
    slug: "lingua-portuguesa",
    nome: "Língua Portuguesa",
    componente: "Língua Portuguesa",
    skills: linguaPortuguesaMedioSkills,
    competencias: linguagensMedioCompetencias,
    descricao: "Leitura, produção de texto, oralidade e análise linguística, organizadas por campo de atuação social.",
  },
  {
    slug: "matematica",
    nome: "Matemática e suas Tecnologias",
    componente: "Matemática e suas Tecnologias",
    skills: matematicaMedioSkills,
    competencias: matematicaMedioCompetencias,
    descricao: "Investigação, modelagem e resolução de problemas, com registros de representação algébricos, geométricos e estatísticos.",
  },
  {
    slug: "ciencias-da-natureza",
    nome: "Ciências da Natureza e suas Tecnologias",
    componente: "Ciências da Natureza e suas Tecnologias",
    skills: cienciasDaNaturezaMedioSkills,
    competencias: cienciasDaNaturezaMedioCompetencias,
    descricao: "Fenômenos naturais e processos tecnológicos, matéria e energia, vida, Terra e Cosmos.",
  },
  {
    slug: "ciencias-humanas",
    nome: "Ciências Humanas e Sociais Aplicadas",
    componente: "Ciências Humanas e Sociais Aplicadas",
    skills: cienciasHumanasMedioSkills,
    competencias: cienciasHumanasMedioCompetencias,
    descricao: "Tempo e espaço, território e fronteiras, indivíduo, sociedade, cultura, política e trabalho.",
  },
];

export const medioSkills: HabilidadeMedio[] = AREAS_ENSINO_MEDIO.flatMap((area) => area.skills);

// Built from the 4 áreas directly, not by flattening AREAS_ENSINO_MEDIO's
// own `competencias` field — Língua Portuguesa's entry there deliberately
// reuses linguagensMedioCompetencias (it has none of its own), so flattening
// across all 5 entries would double-count those 7 records.
export const medioCompetencias: CompetenciaEspecificaMedio[] = [
  ...linguagensMedioCompetencias,
  ...matematicaMedioCompetencias,
  ...cienciasDaNaturezaMedioCompetencias,
  ...cienciasHumanasMedioCompetencias,
];

export function getAllRegistros(): BnccRegistro[] {
  return [...fundamentalSkills, ...competenciasGerais, ...medioSkills, ...medioCompetencias];
}

export function getRegistroByCode(code: string): BnccRegistro | undefined {
  const normalized = code.toLowerCase();
  return getAllRegistros().find((registro) => registro.codigo?.toLowerCase() === normalized);
}

export function getAdjacentSkills(code: string) {
  const index = fundamentalSkills.findIndex((skill) => skill.codigo.toLowerCase() === code.toLowerCase());
  if (index < 0) return { previous: undefined, next: undefined };
  const current = fundamentalSkills[index];
  const sameGroup = fundamentalSkills.filter((skill) => skill.componente === current.componente && skill.ano === current.ano);
  const groupIndex = sameGroup.findIndex((skill) => skill.codigo === current.codigo);
  return { previous: sameGroup[groupIndex - 1], next: sameGroup[groupIndex + 1] };
}

export function getRelatedSkills(skill: HabilidadeFundamental, limit = 4) {
  const groupKey = skill.unidade_tematica ?? skill.campo_atuacao;
  return fundamentalSkills
    .filter((candidate) => candidate.codigo !== skill.codigo && candidate.componente === skill.componente && candidate.ano === skill.ano)
    .filter((candidate) => (candidate.unidade_tematica ?? candidate.campo_atuacao) === groupKey)
    .sort((a, b) => {
      const objectScoreA = a.objeto_conhecimento === skill.objeto_conhecimento ? 0 : 1;
      const objectScoreB = b.objeto_conhecimento === skill.objeto_conhecimento ? 0 : 1;
      return objectScoreA - objectScoreB || a.codigo.localeCompare(b.codigo);
    })
    .slice(0, limit);
}

// Habilidades do Ensino Médio não têm "ano" (a BNCC as apresenta sem
// indicação de seriação) — a vizinhança aqui é por componente, na ordem em
// que o dataset já vem ordenado (por código).
export function getAdjacentSkillsMedio(code: string) {
  const index = medioSkills.findIndex((skill) => skill.codigo.toLowerCase() === code.toLowerCase());
  if (index < 0) return { previous: undefined, next: undefined };
  const current = medioSkills[index];
  const sameGroup = medioSkills.filter((skill) => skill.componente === current.componente);
  const groupIndex = sameGroup.findIndex((skill) => skill.codigo === current.codigo);
  return { previous: sameGroup[groupIndex - 1], next: sameGroup[groupIndex + 1] };
}

export function getRelatedSkillsMedio(skill: HabilidadeMedio, limit = 4) {
  return medioSkills
    .filter((candidate) => candidate.codigo !== skill.codigo && candidate.componente === skill.componente)
    .filter((candidate) => candidate.competencias_especificas.some((numero) => skill.competencias_especificas.includes(numero)))
    .sort((a, b) => a.codigo.localeCompare(b.codigo))
    .slice(0, limit);
}

export type { BnccRegistro, CompetenciaEspecificaMedio, CompetenciaGeral, HabilidadeFundamental, HabilidadeMedio } from "./types";
