export function normalizeSearchText(value = "") {
  return String(value)
    .normalize("NFD")
    .replace(/[\u0300-\u036f]/g, "")
    .toLocaleLowerCase("pt-BR")
    .replace(/\s+/g, " ")
    .trim();
}

export function parseSearchQuery(value = "") {
  const normalized = normalizeSearchText(value);
  const yearMatch = normalized.match(/\b([6-9])(?:º|o)?\s*ano\b/);
  const year = yearMatch ? `${yearMatch[1]}º ano` : "";
  const query = normalized
    .replace(/\b([6-9])(?:º|o)?\s*ano\b/g, " ")
    .replace(/\s+/g, " ")
    .trim();

  return { query, year };
}

export function filterSkills(skills, filters = {}) {
  const parsedQuery = parseSearchQuery(filters.query);
  const query = parsedQuery.query;
  const year = filters.year || parsedQuery.year;
  const unit = filters.unit || "";
  const object = filters.object || "";
  const competencia = filters.competencia || "";

  return skills.filter((skill) => {
    if (year) {
      const applicableYears = skill.anos_aplicaveis ?? (skill.ano ? [skill.ano] : []);
      if (!applicableYears.includes(year)) return false;
    }
    // Ensino Médio only — habilidades não têm ano/unidade_tematica fixos,
    // então o filtro equivalente é por competência específica associada.
    if (competencia && !(skill.competencias_especificas ?? []).includes(Number(competencia))) return false;
    if (unit && skill.unidade_tematica !== unit && skill.campo_atuacao !== unit) return false;
    if (object && skill.objeto_conhecimento !== object) return false;
    if (!query) return true;

    return normalizeSearchText([
      skill.codigo,
      skill.texto,
      skill.objeto_conhecimento,
      skill.unidade_tematica,
      skill.campo_atuacao,
      skill.componente,
      skill.area,
    ].filter(Boolean).join(" ")).includes(query);
  });
}

export function uniqueSorted(values) {
  return [...new Set(values)].sort((a, b) => a.localeCompare(b, "pt-BR", { numeric: true }));
}
