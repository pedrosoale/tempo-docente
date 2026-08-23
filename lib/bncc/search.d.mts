export type SearchableSkill = {
  codigo: string | null;
  texto: string;
  ano?: string;
  anos_aplicaveis?: string[];
  unidade_tematica?: string;
  objeto_conhecimento?: string;
  campo_atuacao?: string;
  componente?: string;
  area?: string;
  // Educação Infantil only — objetivos (campo de experiências + faixa
  // etária) e direitos (nome oficial, sem código).
  campo_experiencia?: string;
  faixa_etaria?: string;
  faixa_etaria_codigo?: string;
  faixa_etaria_descricao?: string;
  nome?: string;
};

export type SkillFilters = {
  query?: string;
  year?: string;
  unit?: string;
  object?: string;
  competencia?: string;
  faixa?: string;
};

export function normalizeSearchText(value?: string): string;
export function parseSearchQuery(value?: string): { query: string; year: string };
export function filterSkills<T extends SearchableSkill>(skills: T[], filters?: SkillFilters): T[];
export function uniqueSorted(values: string[]): string[];
