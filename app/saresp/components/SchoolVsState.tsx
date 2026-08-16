import { POSITION_BADGE_CLASS, formatNumber, formatSigned } from "@/lib/saresp/analysis";
import { BENCHMARK_LABEL } from "@/lib/saresp/labels";
import type { SchoolStateRow } from "@/lib/saresp/types";

function GapCell({ value }: { value: number | null }) {
  if (!Number.isFinite(value as number)) return <span>—</span>;
  const tone = (value as number) > 0 ? "positive-text" : (value as number) < 0 ? "negative-text" : "";
  return <span className={tone}>{formatSigned(value)}</span>;
}

export default function SchoolVsState({ schoolLabel, rows }: { schoolLabel: string; rows: SchoolStateRow[] }) {
  return (
    <section className="panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Comparação</p>
          <h2>Escola × {BENCHMARK_LABEL}</h2>
        </div>
      </div>

      {rows.length ? (
        <div className="table-wrap">
          <table>
            <thead>
              <tr>
                <th>Componente</th>
                <th>Série</th>
                <th>Escola 2024</th>
                <th>Escola 2025</th>
                <th>Var. escola</th>
                <th>{BENCHMARK_LABEL} 2024</th>
                <th>{BENCHMARK_LABEL} 2025</th>
                <th>Var. {BENCHMARK_LABEL.toLowerCase()}</th>
                <th>Gap 2024</th>
                <th>Gap 2025</th>
                <th>Δ Gap</th>
                <th>Classificação</th>
              </tr>
            </thead>
            <tbody>
              {rows.map((row) => (
                <tr key={`${row.codesc}-${row.serieAno}-${row.componente}`}>
                  <td>{row.componente}</td>
                  <td>{row.serieAno}</td>
                  <td className="numeric">{formatNumber(row.prof2024)}</td>
                  <td className="numeric">{formatNumber(row.prof2025)}</td>
                  <td className="numeric">
                    <GapCell value={row.diff} />
                  </td>
                  <td className="numeric">{row.hasStateReference ? formatNumber(row.state2024) : "—"}</td>
                  <td className="numeric">{row.hasStateReference ? formatNumber(row.state2025) : "—"}</td>
                  <td className="numeric">{row.hasStateReference ? <GapCell value={row.stateDiff} /> : "—"}</td>
                  <td className="numeric">{row.hasStateReference ? <GapCell value={row.gap2024} /> : "—"}</td>
                  <td className="numeric">{row.hasStateReference ? <GapCell value={row.gap2025} /> : "—"}</td>
                  <td className="numeric">{row.hasStateReference ? <GapCell value={row.gapChange} /> : "—"}</td>
                  <td>
                    <span className={`status ${POSITION_BADGE_CLASS[row.position.key]}`}>{row.position.label}</span>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      ) : (
        <p className="table-note">Sem dados suficientes para comparar {schoolLabel || "esta seleção"} com o recorte.</p>
      )}
    </section>
  );
}
