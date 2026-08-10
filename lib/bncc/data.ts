import arteAnosFinaisDataset from "@/data/bncc/arte-anos-finais.json";
import arteAnosIniciaisDataset from "@/data/bncc/arte-anos-iniciais.json";
import cienciasAnosFinaisDataset from "@/data/bncc/ciencias-anos-finais.json";
import cienciasAnosIniciaisDataset from "@/data/bncc/ciencias-anos-iniciais.json";
import competenciasDataset from "@/data/bncc/competencias-gerais.json";
import educacaoFisicaAnosFinaisDataset from "@/data/bncc/educacao-fisica-anos-finais.json";
import educacaoFisicaAnosIniciaisDataset from "@/data/bncc/educacao-fisica-anos-iniciais.json";
import ensinoReligiosoAnosFinaisDataset from "@/data/bncc/ensino-religioso-anos-finais.json";
import ensinoReligiosoAnosIniciaisDataset from "@/data/bncc/ensino-religioso-anos-iniciais.json";
import geografiaAnosFinaisDataset from "@/data/bncc/geografia-anos-finais.json";
import geografiaAnosIniciaisDataset from "@/data/bncc/geografia-anos-iniciais.json";
import historiaAnosFinaisDataset from "@/data/bncc/historia-anos-finais.json";
import historiaAnosIniciaisDataset from "@/data/bncc/historia-anos-iniciais.json";
import linguaInglesaDataset from "@/data/bncc/lingua-inglesa-anos-finais.json";
import linguaPortuguesaDataset from "@/data/bncc/lingua-portuguesa-anos-finais.json";
import matematicaAnosFinaisDataset from "@/data/bncc/matematica-anos-finais.json";
import matematicaAnosIniciaisDataset from "@/data/bncc/matematica-anos-iniciais.json";
import type { BnccRegistro, CompetenciaGeral, HabilidadeFundamental } from "./types";

export const bnccMetadata = matematicaAnosFinaisDataset.metadata;
export const bnccSkills = [...matematicaAnosIniciaisDataset.registros, ...matematicaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const linguaPortuguesaMetadata = linguaPortuguesaDataset.metadata;
export const linguaPortuguesaSkills = linguaPortuguesaDataset.registros as HabilidadeFundamental[];

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

export function getAllRegistros(): BnccRegistro[] {
  return [...fundamentalSkills, ...competenciasGerais];
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

export type { BnccRegistro, CompetenciaGeral, HabilidadeFundamental } from "./types";
