// Centralized SARESP benchmark nomenclature. The comparison figure shown everywhere in this
// module is a simple (unweighted) mean of the school-level proficiencies inside the current
// filter recorte (série/ano, componente, período, ano, and rede WHEN a rede filter is applied —
// with no rede filter, the recorte blends every network together) — it is NOT SEDUC-SP's official
// state average, which may use enrollment-weighting or a different aggregation. Every place that
// surfaces this number must import these strings instead of hardcoding "Estado"/"estadual", so
// the wording can't drift out of sync again. See README "Metodologia do benchmark".
export const BENCHMARK_LABEL = "Recorte";
export const BENCHMARK_LABEL_LONG = "média das escolas do recorte";
export const BENCHMARK_LABEL_LONG_CAP = "Média das escolas do recorte";

export const BENCHMARK_METHODOLOGY =
  "É a média simples (não ponderada por matrícula) da proficiência de todas as escolas que " +
  "atendem aos filtros aplicados agora — mesma série/ano, componente curricular, período e rede, " +
  "quando filtrada. Quando o filtro de rede está em “Todos”, o recorte mistura escolas " +
  "de todas as redes disponíveis (estadual, municipal etc.) na mesma média. Não é a média oficial " +
  "divulgada pela SEDUC-SP, que pode usar ponderação ou metodologia diferente; mude os filtros e " +
  "o valor muda junto, porque ele descreve só as escolas visíveis nesse recorte.";
