import { classifyVariation, formatNumber, formatSigned } from "@/lib/saresp/analysis";
import type { ExecutiveRow } from "@/lib/saresp/types";

export default function ResultSummaryCards({ rows }: { rows: ExecutiveRow[] }) {
  return (
    <section className="summary-section">
      <p className="eyebrow">Resumo</p>
      <h2>Resumo dos resultados</h2>

      {rows.length ? (
        <div className="summary-grid">
          {rows.map((row) => {
            const variation = classifyVariation(row.diff);
            return (
              <article key={`${row.codesc}-${row.serieAno}-${row.componente}`} className={`summary-card ${variation.tone}`}>
                <span className="summary-card-label">
                  {row.componente} — {row.serieAno}
                </span>
                <div className="compare-values">
                  <div>
                    <small>2024</small>
                    <strong>{formatNumber(row.prof2024)}</strong>
                  </div>
                  <div>
                    <small>2025</small>
                    <strong>{formatNumber(row.prof2025)}</strong>
                  </div>
                  <div>
                    <small>Variação</small>
                    <strong>{formatSigned(row.diff)}</strong>
                  </div>
                </div>
                <p className="summary-card-note">{variation.label}</p>
              </article>
            );
          })}
        </div>
      ) : (
        <p className="table-note">Sem dados suficientes para os filtros atuais.</p>
      )}
    </section>
  );
}
