import { ArrowUpRight, Building2, CalendarDays, Info, TrendingUp } from "lucide-react";

const bars = [
  { label: "2023", first: 48, second: 59 },
  { label: "2024", first: 57, second: 66 },
] as const;

export function DashboardPreview() {
  return (
    <section className="section dashboard-section" id="dados">
      <div className="container dashboard-layout">
        <div className="dashboard-copy">
          <span className="section-kicker">Leitura dos dados</span>
          <h2>Dados mais fáceis de interpretar.</h2>
          <p>Transforme resultados de avaliações externas em informações visuais que ajudam a identificar evolução, diferenças e pontos de atenção.</p>
          <div className="mock-notice"><Info size={17} /><span>Todos os valores desta prévia são <strong>demonstrativos</strong> e não representam dados oficiais.</span></div>
          <a href="#fontes" className="text-link">Entender as fontes <ArrowUpRight size={17} /></a>
        </div>

        <div className="dashboard-window" aria-label="Prévia de dashboard com dados demonstrativos">
          <div className="dashboard-toolbar">
            <div><span className="window-dot" /><span className="window-dot" /><span className="window-dot" /></div>
            <span>Visão de resultados</span>
            <span className="demo-badge">Dados demonstrativos</span>
          </div>
          <div className="dashboard-body">
            <div className="dashboard-filters">
              <div><Building2 size={16} /><span>Escola demonstrativa</span></div>
              <div><CalendarDays size={16} /><span>2023 — 2024</span></div>
            </div>
            <div className="dashboard-metrics">
              <article>
                <span>Indicador ilustrativo</span>
                <strong>248</strong>
                <small><TrendingUp size={15} /> +6 pontos no período</small>
              </article>
              <article>
                <span>Evolução demonstrativa</span>
                <strong>+2,5%</strong>
                <small>Comparação entre períodos</small>
              </article>
            </div>
            <div className="chart-card">
              <div className="chart-header">
                <div><strong>Comparação por período</strong><span>Exemplo sem vínculo com base oficial</span></div>
                <div className="chart-legend"><span><i className="navy" />Período A</span><span><i className="teal" />Período B</span></div>
              </div>
              <div className="chart-area">
                <div className="grid-lines"><i /><i /><i /><i /></div>
                {bars.map((bar) => (
                  <div className="bar-group" key={bar.label}>
                    <div className="bars"><i className="navy" style={{ height: `${bar.first}%` }} /><i className="teal" style={{ height: `${bar.second}%` }} /></div>
                    <span>{bar.label}</span>
                  </div>
                ))}
              </div>
            </div>
          </div>
        </div>
      </div>
    </section>
  );
}
