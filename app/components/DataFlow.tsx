import { ArrowRight } from "lucide-react";

const steps = [
  ["01", "BNCC", "O que deve ser desenvolvido."],
  ["02", "Avaliações", "O que está sendo medido."],
  ["03", "Dados", "O que os resultados mostram."],
  ["04", "Planejamento", "Onde agir."],
] as const;

export function DataFlow() {
  return (
    <section className="section flow-section" id="avaliacoes">
      <div className="container">
        <div className="section-heading flow-heading">
          <div>
            <span className="section-kicker">Visão integrada</span>
            <h2>Da habilidade ao resultado.</h2>
          </div>
          <p>A informação certa, organizada para apoiar decisões pedagógicas melhores.</p>
        </div>
        <div className="flow-grid">
          {steps.map(([number, title, text], index) => (
            <div className="flow-item" key={title}>
              <div className="flow-number">{number}</div>
              <h3>{title}</h3>
              <p>{text}</p>
              {index < steps.length - 1 && <ArrowRight className="flow-arrow" size={20} aria-hidden="true" />}
            </div>
          ))}
        </div>
      </div>
    </section>
  );
}
