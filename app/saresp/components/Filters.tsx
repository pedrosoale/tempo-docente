import { RotateCcw } from "lucide-react";
import SchoolCombobox from "./SchoolCombobox";
import type { FilterOptions, FilterState, SearchableIdentity } from "@/lib/saresp/types";

function SelectFilter({
  label,
  value,
  options,
  onChange,
}: {
  label: string;
  value: string;
  options: string[];
  onChange: (value: string) => void;
}) {
  return (
    <label className="filter-field">
      <span>{label}</span>
      <select value={value} onChange={(event) => onChange(event.target.value)}>
        <option value="">Todos</option>
        {options.map((option) => (
          <option key={option} value={option}>
            {option}
          </option>
        ))}
      </select>
    </label>
  );
}

export default function Filters({
  filters,
  options,
  onChange,
  onSchoolSelect,
  onReset,
}: {
  filters: FilterState;
  options: FilterOptions;
  onChange: (key: keyof FilterState, value: string) => void;
  onSchoolSelect: (entry: SearchableIdentity) => void;
  onReset: () => void;
}) {
  return (
    <section className="panel filters-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Filtros</p>
          <h2>Recorte da análise</h2>
        </div>
        <button className="icon-text-button" type="button" onClick={onReset}>
          <RotateCcw size={17} />
          Limpar
        </button>
      </div>
      <div className="filters-grid">
        <div className="filter-field school-filter">
          {/* explicit htmlFor/id (not wrapping) — SchoolCombobox's <input role="combobox"> is
              nested behind a custom component, which static a11y analysis can't see through */}
          <label htmlFor="school-search">Escola</label>
          <SchoolCombobox
            id="school-search"
            query={filters.school}
            onQueryChange={(value) => onChange("school", value)}
            onSelect={onSchoolSelect}
            index={options.schools}
            placeholder="Digite o nome — escolha a sugestão para selecionar uma escola específica"
          />
        </div>
        <SelectFilter label="Série/Ano" value={filters.series} options={options.series} onChange={(value) => onChange("series", value)} />
        <SelectFilter label="Componente" value={filters.component} options={options.components} onChange={(value) => onChange("component", value)} />
        <SelectFilter label="Período" value={filters.period} options={options.periods} onChange={(value) => onChange("period", value)} />
        <SelectFilter label="Ano" value={filters.year} options={["2024", "2025", "Comparativo"]} onChange={(value) => onChange("year", value)} />
        <SelectFilter label="Rede/dependência" value={filters.network} options={options.networks} onChange={(value) => onChange("network", value)} />
      </div>
    </section>
  );
}
