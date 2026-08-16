import { TrendingDown, TrendingUp, type LucideIcon } from "lucide-react";
import { VARIATION_THRESHOLD, formatNumber } from "@/lib/saresp/analysis";
import type { ExecutiveRow } from "@/lib/saresp/types";

function RankingList({
  title,
  icon: Icon,
  rows,
  tone,
  primaryLabel,
  secondaryLabel,
  emptyMessage,
}: {
  title: string;
  icon: LucideIcon;
  rows: ExecutiveRow[];
  tone: string;
  primaryLabel: (row: ExecutiveRow) => string;
  secondaryLabel: (row: ExecutiveRow) => string;
  emptyMessage: string;
}) {
  return (
    <article className="panel ranking-card">
      <div className={`ranking-title ${tone}`}>
        <Icon size={20} />
        <h2>{title}</h2>
      </div>
      {rows.length ? (
        <ol>
          {rows.map((row) => (
            <li key={`${row.codesc}-${row.serieAno}-${row.componente}`}>
              <span>{primaryLabel(row)}</span>
              <small>{secondaryLabel(row)}</small>
              <strong className={tone}>{formatNumber(row.diff)} pts</strong>
            </li>
          ))}
        </ol>
      ) : (
        <p className="ranking-empty">{emptyMessage}</p>
      )}
    </article>
  );
}

// "estado" ranks schools against each other; "escola" ranks a single school's own
// componente/série combinations, since every row shares the same nomesc there. `comparison` must
// come from the executive (period-deduped) layer — otherwise a GERAL+TARDE pair for the same
// result would show up twice. Only real growth/decline (same threshold as classifyVariation) is
// listed — a school with no declines shows an empty state instead of its smallest gains as if
// they were losses.
export default function Rankings({ comparison, scope = "estado" }: { comparison: ExecutiveRow[]; scope?: "estado" | "escola" }) {
  const comparable = comparison.filter((row) => Number.isFinite(row.diff));
  const growth = comparable.filter((row) => (row.diff as number) > VARIATION_THRESHOLD).sort((a, b) => (b.diff as number) - (a.diff as number)).slice(0, 8);
  const decline = comparable.filter((row) => (row.diff as number) < -VARIATION_THRESHOLD).sort((a, b) => (a.diff as number) - (b.diff as number)).slice(0, 8);

  const isSchoolScope = scope === "escola";
  const primaryLabel = isSchoolScope ? (row: ExecutiveRow) => `${row.componente} — ${row.serieAno}` : (row: ExecutiveRow) => row.nomesc;
  // Cód. suffix matters here: this ranking spans every school in the recorte, and two of them can
  // share a nomesc (see lib/saresp/analysis.ts formatSchoolLabel) — the code is what tells them apart.
  const secondaryLabel = isSchoolScope
    ? (row: ExecutiveRow) => row.rede
    : (row: ExecutiveRow) => `${row.serieAno} | ${row.componente} · Cód. ${row.codesc}`;

  return (
    <section className="ranking-grid">
      <RankingList
        title={isSchoolScope ? "Onde a escola mais avançou" : "Escolas que mais cresceram"}
        icon={TrendingUp}
        rows={growth}
        tone="positive-text"
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        emptyMessage={isSchoolScope ? "Nenhum crescimento acima de 1 ponto neste recorte." : "Nenhuma escola com crescimento acima de 1 ponto neste recorte."}
      />
      <RankingList
        title={isSchoolScope ? "Onde a escola mais recuou" : "Escolas que mais caíram"}
        icon={TrendingDown}
        rows={decline}
        tone="negative-text"
        primaryLabel={primaryLabel}
        secondaryLabel={secondaryLabel}
        emptyMessage={
          isSchoolScope ? "Nenhum resultado analisado apresentou redução em relação ao ano anterior." : "Nenhuma escola com queda acima de 1 ponto neste recorte."
        }
      />
    </section>
  );
}
