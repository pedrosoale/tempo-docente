"use client";

import { ArrowRight } from "lucide-react";
import { Bar, BarChart, CartesianGrid, Legend, ResponsiveContainer, Tooltip, XAxis, YAxis } from "recharts";
import { average, formatNumber, formatSigned, groupAverage } from "@/lib/saresp/analysis";
import type { ExecutiveRow } from "@/lib/saresp/types";

function tooltipFormatter(value: number) {
  return formatNumber(value);
}

const tooltipContentStyle = {
  padding: "10px 12px",
  border: "1px solid #dfe7e5",
  borderRadius: 10,
  background: "#ffffff",
  boxShadow: "0 10px 30px rgba(18, 53, 91, 0.1)",
  fontSize: 12,
};

const tooltipLabelStyle = { color: "#12355b", fontWeight: 700, marginBottom: 4 };
const axisTick = { fontSize: 11, fill: "#66788a" };

export function ComponentBreakdownCharts({ comparison }: { comparison: ExecutiveRow[] }) {
  const componentNames = [...new Set(comparison.map((row) => row.componente).filter(Boolean))].sort((a, b) => a.localeCompare(b, "pt-BR"));

  if (!componentNames.length) {
    return (
      <article className="panel chart-panel">
        <div className="panel-heading">
          <div>
            <p className="eyebrow">Comparação</p>
            <h2>Evolução por componente curricular</h2>
          </div>
        </div>
        <p className="table-note">Sem dados suficientes para montar o gráfico com os filtros atuais.</p>
      </article>
    );
  }

  return (
    <section className="component-grid">
      {componentNames.map((name) => {
        const rows = comparison.filter((row) => row.componente === name);
        const bySerie = groupAverage(rows, "serieAno")
          .filter((row) => Number.isFinite(row.prof2024) || Number.isFinite(row.prof2025))
          .sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));

        const avg2024 = average(rows.map((row) => row.prof2024));
        const avg2025 = average(rows.map((row) => row.prof2025));
        const diff = Number.isFinite(avg2024 as number) && Number.isFinite(avg2025 as number) ? (avg2025 as number) - (avg2024 as number) : null;
        const tone = (diff as number) > 1 ? "positive-text" : (diff as number) < -1 ? "negative-text" : "";

        return (
          <article className="panel chart-panel" key={name}>
            <div className="panel-heading">
              <div>
                <p className="eyebrow">Por série/ano</p>
                <h2>{name}</h2>
              </div>
              <div className={`chart-stat ${tone}`}>
                {formatNumber(avg2024)} <ArrowRight size={13} /> {formatNumber(avg2025)}
                <span>{formatSigned(diff)} pts</span>
              </div>
            </div>
            <ResponsiveContainer width="100%" height={300}>
              <BarChart data={bySerie} margin={{ left: 0, right: 12, bottom: 12 }}>
                <CartesianGrid strokeDasharray="3 3" stroke="#e7ecea" vertical={false} />
                <XAxis dataKey="name" tick={axisTick} stroke="#dfe7e5" />
                <YAxis tickFormatter={(value: number) => formatNumber(value, 0)} tick={axisTick} stroke="#dfe7e5" />
                <Tooltip formatter={tooltipFormatter} contentStyle={tooltipContentStyle} labelStyle={tooltipLabelStyle} cursor={{ fill: "rgba(18, 53, 91, 0.04)" }} />
                <Legend wrapperStyle={{ fontSize: 12, color: "#385269" }} />
                <Bar dataKey="prof2024" name="2024" fill="#12355b" radius={[4, 4, 0, 0]} />
                <Bar dataKey="prof2025" name="2025" fill="#18ae8f" radius={[4, 4, 0, 0]} />
              </BarChart>
            </ResponsiveContainer>
          </article>
        );
      })}
    </section>
  );
}
