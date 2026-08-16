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
};

export type SkillFilters = {
  query?: string;
  year?: string;
  unit?: string;
  object?: string;
  competencia?: string;
};

export function normalizeSearchText(value?: string): string;
export function parseSearchQuery(value?: string): { query: string; year: string };
export function filterSkills<T extends SearchableSkill>(skills: T[], filters?: SkillFilters): T[];
export function uniqueSorted(values: string[]): string[];
