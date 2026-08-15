import { memo } from "react";
import { RotateCcw } from "lucide-react";
import type { FilterOptions, FilterState } from "@/lib/saresp/types";

// Kept as its own memoized component so typing in the school input (which changes `value` on every
// keystroke) doesn't force React to reconcile ~9.760 <option> nodes each time — `options` only
// changes once, when the JSON finishes loading.
const SchoolDatalist = memo(function SchoolDatalist({ options }: { options: string[] }) {
  return (
    <datalist id="school-options">
      {options.map((option) => (
        <option key={option} value={option} />
      ))}
    </datalist>
  );
});

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

function SchoolFilter({
  value,
  options,
  onChange,
  pending,
}: {
  value: string;
  options: string[];
  onChange: (value: string) => void;
  pending: boolean;
}) {
  return (
    <label className="filter-field school-filter">
      <span>Escola {pending && <em className="filter-pending">atualizando…</em>}</span>
      <input
        type="search"
        value={value}
        list="school-options"
        placeholder="Digite o nome ou parte do nome"
        onChange={(event) => onChange(event.target.value)}
      />
      <SchoolDatalist options={options} />
    </label>
  );
}

export default function Filters({
  filters,
  options,
  onChange,
  onReset,
  searchPending,
}: {
  filters: FilterState;
  options: FilterOptions;
  onChange: (key: keyof FilterState, value: string) => void;
  onReset: () => void;
  searchPending: boolean;
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
        <SchoolFilter value={filters.school} options={options.schools} onChange={(value) => onChange("school", value)} pending={searchPending} />
        <SelectFilter label="Série/Ano" value={filters.series} options={options.series} onChange={(value) => onChange("series", value)} />
        <SelectFilter label="Componente" value={filters.component} options={options.components} onChange={(value) => onChange("component", value)} />
        <SelectFilter label="Período" value={filters.period} options={options.periods} onChange={(value) => onChange("period", value)} />
        <SelectFilter label="Ano" value={filters.year} options={["2024", "2025", "Comparativo"]} onChange={(value) => onChange("year", value)} />
        <SelectFilter label="Rede/dependência" value={filters.network} options={options.networks} onChange={(value) => onChange("network", value)} />
      </div>
    </section>
  );
}
