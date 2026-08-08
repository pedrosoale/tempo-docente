import { ExternalLink, ShieldCheck } from "lucide-react";

export function SourceTrust() {
  return (
    <section className="section trust-section" id="fontes">
      <div className="container trust-card">
        <div className="trust-icon"><ShieldCheck size={26} aria-hidden="true" /></div>
        <div className="trust-copy">
          <span className="section-kicker">Transparência</span>
          <h2>Informação educacional com fonte identificada.</h2>
          <p>O Tempo Docente organiza informações provenientes de documentos e bases oficiais, preservando a referência à fonte original.</p>
        </div>
        <div className="source-chips" aria-label="Fontes previstas">
          {["BNCC", "INEP", "SAEB", "SARESP"].map((source) => <span key={source}>{source} <ExternalLink size={13} aria-hidden="true" /></span>)}
        </div>
      </div>
    </section>
  );
}
