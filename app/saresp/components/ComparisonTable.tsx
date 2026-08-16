import { ArrowDownRight, ArrowUpRight, Download, Minus, Printer, type LucideIcon } from "lucide-react";
import { formatNumber, formatSigned } from "@/lib/saresp/analysis";
import { BENCHMARK_LABEL } from "@/lib/saresp/labels";
import type { DetailedRow, StateBenchmark, Tone } from "@/lib/saresp/types";

const TONE_ICON: Record<Tone, LucideIcon> = { positive: ArrowUpRight, negative: ArrowDownRight, neutral: Minus };
const TONE_CLASS: Record<Tone, string> = { positive: "positive-text", negative: "negative-text", neutral: "" };

function DiffCell({ diff, tone }: { diff: number | null; tone: Tone }) {
  if (!Number.isFinite(diff as number)) return <span>-</span>;
  const Icon = TONE_ICON[tone] || Minus;
  return (
    <span className={`diff-cell ${TONE_CLASS[tone] || ""}`}>
      <Icon size={14} />
      {formatNumber(diff)}
    </span>
  );
}

export default function ComparisonTable({
  rows,
  stateBenchmark,
  onExport,
  onPrint,
}: {
  rows: DetailedRow[];
  stateBenchmark: StateBenchmark;
  onExport: () => void;
  onPrint: () => void;
}) {
  return (
    <section className="panel table-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Tabela</p>
          <h2>Comparação detalhada</h2>
        </div>
        <div className="table-actions">
          <button className="icon-text-button" type="button" onClick={onExport}>
            <Download size={17} />
            Exportar CSV
          </button>
          <button className="icon-text-button" type="button" onClick={onPrint}>
            <Printer size={17} />
            Relatório
          </button>
        </div>
      </div>
      <div className="table-wrap">
        <table>
          <thead>
            <tr>
              <th>Escola</th>
              <th>Código</th>
              <th>Série</th>
              <th>Componente</th>
              <th>Período</th>
              <th>2024</th>
              <th>2025</th>
              <th>Diferença</th>
              <th>Status</th>
              <th>{BENCHMARK_LABEL} 2025</th>
              <th>Gap</th>
            </tr>
          </thead>
          <tbody>
            {rows.slice(0, 300).map((row) => {
              const state = stateBenchmark.get(`${row.serieAno}|${row.componente}`);
              const gap = state && Number.isFinite(row.prof2025) && Number.isFinite(state.prof2025) ? (row.prof2025 as number) - (state.prof2025 as number) : null;

              return (
                <tr key={`${row.codesc}-${row.serieAno}-${row.periodo}-${row.componente}`}>
                  <td>{row.nomesc}</td>
                  <td className="numeric">{row.codesc}</td>
                  <td>{row.serieAno}</td>
                  <td>{row.componente}</td>
                  <td>{row.periodo}</td>
                  <td className="numeric">{formatNumber(row.prof2024)}</td>
                  <td className="numeric">{formatNumber(row.prof2025)}</td>
                  <td className="numeric">
                    <DiffCell diff={row.diff} tone={row.tone} />
                  </td>
                  <td>
                    <span className={`status ${row.tone}`}>{row.statusLabel}</span>
                  </td>
                  <td className="numeric">{state && Number.isFinite(state.prof2025) ? formatNumber(state.prof2025) : "—"}</td>
                  <td className="numeric">{Number.isFinite(gap as number) ? formatSigned(gap) : "—"}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {rows.length > 300 && <p className="table-note">Mostrando as primeiras 300 linhas. Use os filtros ou exporte o CSV para ver o conjunto completo.</p>}
    </section>
  );
}
