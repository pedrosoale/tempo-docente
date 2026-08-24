import { ArrowDown, BarChart3, CheckCircle2 } from "lucide-react";

export function HeroPlatformPreview() {
  return (
    <div className="hero-preview" aria-label="Recursos já disponíveis no Tempo Docente">
      <div className="preview-label"><span />Disponível agora</div>

      <article className="skill-panel">
        <div className="panel-meta">
          <span className="eyebrow">Base curricular</span>
          <span className="status"><CheckCircle2 size={14} /> Referência oficial</span>
        </div>
        <strong>BNCC</strong>
        <p>Consulta completa, por etapa, código ou busca livre.</p>
        <div className="tag-row">
          <span>Educação Infantil</span><span>Fundamental</span><span>Médio</span>
        </div>
      </article>

      <div className="connection" aria-hidden="true">
        <span>também disponível</span><ArrowDown size={14} />
      </div>

      <article className="matrix-panel">
        <div className="matrix-heading">
          <div>
            <span className="eyebrow">Avaliação estadual</span>
            <strong>SARESP</strong>
          </div>
          <div className="mini-icon"><BarChart3 size={18} /></div>
        </div>
        <div className="tag-row" style={{ marginTop: 14, flexWrap: "wrap" }}>
          <span>Comparação 2024 × 2025</span>
          <span>Diagnóstico automático</span>
        </div>
      </article>

      <aside className="insight-panel">
        <span className="eyebrow">Leitura visual</span>
        <div className="mini-bars" aria-label="Gráfico ilustrativo, sem valores oficiais">
          {[38, 54, 46, 72, 63].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <small>Demonstração visual</small>
      </aside>
    </div>
  );
}
