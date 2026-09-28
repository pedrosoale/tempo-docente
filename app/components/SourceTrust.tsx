import { ShieldCheck } from "lucide-react";

export function SourceTrust() {
  return (
    <section className="section trust-section" id="fontes">
      <div className="container home-rail">
        <div className="trust-card">
          <div className="trust-icon"><ShieldCheck size={26} aria-hidden="true" /></div>
          <div className="trust-copy">
            <span className="section-kicker">Transparência</span>
            <h2>Informação educacional com fonte identificada.</h2>
            <p>
              O Tempo Docente organiza informações de documentos e bases oficiais (BNCC, Inep/SAEB, SARESP),
              preservando a referência à fonte original. Consulta gratuita, sem cadastro. Criado e mantido por
              um professor. <a href="/sobre">Conheça a proposta</a>.
            </p>
          </div>
          <div className="source-chips" aria-label="Bases e fontes consultadas">
            {["BNCC", "INEP", "SAEB", "SARESP"].map((source) => <span key={source}>{source}</span>)}
          </div>
        </div>
        <p className="roadmap-note">
          <strong>Em desenvolvimento:</strong> uma leitura conjunta entre habilidades da BNCC e resultados de
          avaliações, para apoiar ainda mais o planejamento pedagógico.
        </p>
      </div>
    </section>
  );
}
