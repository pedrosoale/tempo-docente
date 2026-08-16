import { Search } from "lucide-react";
import { BENCHMARK_LABEL_LONG } from "@/lib/saresp/labels";
import type { ExecutiveRow } from "@/lib/saresp/types";
import { ComponentBreakdownCharts } from "./Charts";
import Rankings from "./Rankings";

// `comparison` is expected to already be the executive (period-deduped) layer — see
// makeExecutiveComparison in lib/saresp/analysis.ts — so componente/série averages and rankings
// here aren't inflated by GERAL+TARDE double counting.
export default function StateOverview({ comparison }: { comparison: ExecutiveRow[] }) {
  return (
    <>
      <p className="overview-hint">
        <Search size={17} />
        Visão geral do recorte atual. Digite o nome de uma escola no filtro acima para investigar uma unidade e comparar seus resultados com a{" "}
        {BENCHMARK_LABEL_LONG}.
      </p>
      <ComponentBreakdownCharts comparison={comparison} />
      <Rankings comparison={comparison} />
    </>
  );
}
