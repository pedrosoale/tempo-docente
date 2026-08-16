import { formatNumber, formatSigned } from "@/lib/saresp/analysis";
import { BENCHMARK_LABEL } from "@/lib/saresp/labels";
import type { SchoolStateRow, Tone } from "@/lib/saresp/types";

const WIDTH = 560;
const HEIGHT = 300;
const PAD_TOP = 40;
const PAD_BOTTOM = 36;
const LEFT_MARGIN = 150;
const RIGHT_MARGIN = 120;
const MIN_LABEL_GAP = 30;

function toneColor(tone: Tone): string {
  if (tone === "positive") return "var(--teal-dark)";
  if (tone === "negative") return "var(--danger-dark)";
  return "var(--soft-ink)";
}

// Nudges overlapping labels apart along the shared value axis, keeping relative order, so séries
// with close proficiency scores stay readable.
function spreadLabels(points: Array<{ key: string; y: number }>): Map<string, number> {
  const sorted = [...points].sort((a, b) => a.y - b.y);
  for (let i = 1; i < sorted.length; i++) {
    const minY = sorted[i - 1].y + MIN_LABEL_GAP;
    if (sorted[i].y < minY) sorted[i].y = minY;
  }
  return new Map(sorted.map((p) => [p.key, p.y]));
}

function ComponentSlope({ componente, rows }: { componente: string; rows: SchoolStateRow[] }) {
  const hasAnyStateReference = rows.some((row) => row.hasStateReference);
  const values = rows
    .flatMap((row) => [row.prof2024, row.prof2025, row.state2024, row.state2025])
    .filter((value): value is number => Number.isFinite(value as number));

  if (!values.length) {
    return (
      <article className="panel chart-panel slope-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Evolução</p>
            <h2>{componente}</h2>
          </div>
        </div>
        <p className="table-note">Sem dados suficientes para montar o gráfico.</p>
      </article>
    );
  }

  const min = Math.min(...values);
  const max = Math.max(...values);
  const range = max - min || 1;
  const pad = Math.max(range * 0.18, 6);
  const domainMin = min - pad;
  const domainMax = max + pad;
  const plotHeight = HEIGHT - PAD_TOP - PAD_BOTTOM;
  const xLeft = LEFT_MARGIN;
  const xRight = WIDTH - RIGHT_MARGIN;

  function yScale(value: number): number {
    return PAD_TOP + (1 - (value - domainMin) / (domainMax - domainMin)) * plotHeight;
  }

  const schoolLeft = spreadLabels(
    rows.filter((row) => Number.isFinite(row.prof2024)).map((row) => ({ key: row.serieAno, y: yScale(row.prof2024 as number) }))
  );
  const schoolRight = spreadLabels(
    rows.filter((row) => Number.isFinite(row.prof2025)).map((row) => ({ key: row.serieAno, y: yScale(row.prof2025 as number) }))
  );

  return (
    <article className="panel chart-panel slope-panel">
      <div className="panel-heading">
        <div>
          <p className="eyebrow">Evolução</p>
          <h2>{componente}</h2>
        </div>
      </div>

      <div className="slope-wrap">
        <svg
          width={WIDTH}
          height={HEIGHT}
          viewBox={`0 0 ${WIDTH} ${HEIGHT}`}
          role="img"
          aria-label={`Evolução de ${componente}, escola e ${BENCHMARK_LABEL.toLowerCase()}, 2024 a 2025`}
        >
          <text x={xLeft} y={20} textAnchor="middle" className="slope-axis-title">
            2024
          </text>
          <text x={xRight} y={20} textAnchor="middle" className="slope-axis-title">
            2025
          </text>

          {rows.map((row) => {
            const color = toneColor(row.tone);
            const y2024 = schoolLeft.get(row.serieAno);
            const y2025 = schoolRight.get(row.serieAno);
            const stateY2024 = row.hasStateReference && Number.isFinite(row.state2024) ? yScale(row.state2024 as number) : null;
            const stateY2025 = row.hasStateReference && Number.isFinite(row.state2025) ? yScale(row.state2025 as number) : null;

            return (
              <g key={row.serieAno}>
                {Number.isFinite(stateY2024 as number) && Number.isFinite(stateY2025 as number) && (
                  <line x1={xLeft} y1={stateY2024 as number} x2={xRight} y2={stateY2025 as number} stroke="var(--muted)" strokeWidth={2} strokeDasharray="5 4" />
                )}
                {Number.isFinite(y2024 as number) && Number.isFinite(y2025 as number) && (
                  <line x1={xLeft} y1={y2024 as number} x2={xRight} y2={y2025 as number} stroke={color} strokeWidth={2.5} />
                )}

                {Number.isFinite(y2024 as number) && (
                  <>
                    <circle cx={xLeft} cy={y2024} r={5} fill={color} stroke="#fff" strokeWidth={2} />
                    <text x={xLeft - 12} y={(y2024 as number) - 5} textAnchor="end" className="slope-label-name">
                      {row.serieAno}
                    </text>
                    <text x={xLeft - 12} y={(y2024 as number) + 11} textAnchor="end" className="slope-label-value">
                      {formatNumber(row.prof2024)} pts
                    </text>
                  </>
                )}

                {Number.isFinite(y2025 as number) && (
                  <>
                    <circle cx={xRight} cy={y2025} r={5} fill={color} stroke="#fff" strokeWidth={2} />
                    <text x={xRight + 12} y={(y2025 as number) - 5} textAnchor="start" className="slope-label-value">
                      {formatNumber(row.prof2025)} pts
                    </text>
                    <text
                      x={xRight + 12}
                      y={(y2025 as number) + 11}
                      textAnchor="start"
                      className={`slope-label-diff ${row.tone === "positive" ? "positive-text" : row.tone === "negative" ? "negative-text" : ""}`}
                    >
                      {formatSigned(row.diff)} pts
                    </text>
                  </>
                )}
              </g>
            );
          })}
        </svg>
      </div>

      <div className="slope-legend">
        <span className="slope-legend-item">
          <i className="slope-dot positive" /> Evolução positiva
        </span>
        <span className="slope-legend-item">
          <i className="slope-dot neutral" /> Pequena variação
        </span>
        <span className="slope-legend-item">
          <i className="slope-dot negative" /> Evolução negativa
        </span>
        <span className="slope-legend-item">
          <i className="slope-dot state" /> {BENCHMARK_LABEL} (referência)
        </span>
      </div>
      {!hasAnyStateReference && <p className="table-note">Referência do recorte não disponível para esta seleção.</p>}
    </article>
  );
}

export default function EvolutionChart({ rows }: { rows: SchoolStateRow[] }) {
  const componentNames = [...new Set(rows.map((row) => row.componente).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (!componentNames.length) {
    return (
      <section className="component-grid">
        <article className="panel chart-panel">
          <div className="panel-heading">
            <div>
              <p className="eyebrow">Evolução</p>
              <h2>Escola × {BENCHMARK_LABEL}</h2>
            </div>
          </div>
          <p className="table-note">Sem dados suficientes para montar o gráfico com os filtros atuais.</p>
        </article>
      </section>
    );
  }

  return (
    <section className="component-grid">
      {componentNames.map((componente) => (
        <ComponentSlope key={componente} componente={componente} rows={rows.filter((row) => row.componente === componente)} />
      ))}
    </section>
  );
}
