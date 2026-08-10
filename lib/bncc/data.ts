import arteDataset from "@/data/bncc/arte-anos-finais.json";
import cienciasDataset from "@/data/bncc/ciencias-anos-finais.json";
import competenciasDataset from "@/data/bncc/competencias-gerais.json";
import educacaoFisicaDataset from "@/data/bncc/educacao-fisica-anos-finais.json";
import ensinoReligiosoDataset from "@/data/bncc/ensino-religioso-anos-finais.json";
import geografiaDataset from "@/data/bncc/geografia-anos-finais.json";
import historiaDataset from "@/data/bncc/historia-anos-finais.json";
import linguaInglesaDataset from "@/data/bncc/lingua-inglesa-anos-finais.json";
import linguaPortuguesaDataset from "@/data/bncc/lingua-portuguesa-anos-finais.json";
import matematicaAnosFinaisDataset from "@/data/bncc/matematica-anos-finais.json";
import matematicaAnosIniciaisDataset from "@/data/bncc/matematica-anos-iniciais.json";
import type { BnccRegistro, CompetenciaGeral, HabilidadeFundamental } from "./types";

export const bnccMetadata = matematicaAnosFinaisDataset.metadata;
export const bnccSkills = [...matematicaAnosIniciaisDataset.registros, ...matematicaAnosFinaisDataset.registros] as HabilidadeFundamental[];

export const linguaPortuguesaMetadata = linguaPortuguesaDataset.metadata;
export const linguaPortuguesaSkills = linguaPortuguesaDataset.registros as HabilidadeFundamental[];

export const arteMetadata = arteDataset.metadata;
export const arteSkills = arteDataset.registros as HabilidadeFundamental[];

export const educacaoFisicaMetadata = educacaoFisicaDataset.metadata;
export const educacaoFisicaSkills = educacaoFisicaDataset.registros as HabilidadeFundamental[];

export const linguaInglesaMetadata = linguaInglesaDataset.metadata;
export const linguaInglesaSkills = linguaInglesaDataset.registros as HabilidadeFundamental[];

export const cienciasMetadata = cienciasDataset.metadata;
export const cienciasSkills = cienciasDataset.registros as HabilidadeFundamental[];

export const geografiaMetadata = geografiaDataset.metadata;
export const geografiaSkills = geografiaDataset.registros as HabilidadeFundamental[];

export const historiaMetadata = historiaDataset.metadata;
export const historiaSkills = historiaDataset.registros as HabilidadeFundamental[];

export const ensinoReligiosoMetadata = ensinoReligiosoDataset.metadata;
export const ensinoReligiosoSkills = ensinoReligiosoDataset.registros as HabilidadeFundamental[];

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
