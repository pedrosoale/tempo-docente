import { ArrowDown, BarChart3, CheckCircle2 } from "lucide-react";

export function HeroPlatformPreview() {
  return (
    <div className="hero-preview" aria-label="Prévia ilustrativa da plataforma">
      <div className="preview-label"><span />Visão conectada</div>

      <article className="skill-panel">
        <div className="panel-meta">
          <span className="eyebrow">Habilidade BNCC</span>
          <span className="status"><CheckCircle2 size={14} /> Referência</span>
        </div>
        <strong>EF07MA03</strong>
        <p>Números inteiros</p>
        <div className="tag-row">
          <span>Matemática</span><span>7º ano</span>
        </div>
      </article>

      <div className="connection" aria-hidden="true">
        <span>conecta</span><ArrowDown size={14} />
      </div>

      <article className="matrix-panel">
        <div className="matrix-heading">
          <div>
            <span className="eyebrow">Matriz de avaliação</span>
            <strong>SAEB</strong>
          </div>
          <div className="mini-icon"><BarChart3 size={18} /></div>
        </div>
        <div className="descriptor-row"><span>D</span><div><i /><i /></div></div>
        <div className="descriptor-row"><span>D</span><div><i /><i /></div></div>
      </article>

      <aside className="insight-panel">
        <span className="eyebrow">Leitura visual</span>
        <div className="mini-bars" aria-label="Gráfico demonstrativo sem valores oficiais">
          {[38, 54, 46, 72, 63].map((height, index) => (
            <i key={index} style={{ height: `${height}%` }} />
          ))}
        </div>
        <small>Demonstração visual</small>
      </aside>
    </div>
  );
}
