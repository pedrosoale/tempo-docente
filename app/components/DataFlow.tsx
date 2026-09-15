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
      <div className="container home-rail">
        <div className="section-heading flow-heading">
          <div>
            <span className="section-kicker">No roteiro</span>
            <h2>Da habilidade ao resultado.</h2>
          </div>
          <p>Para onde o produto está indo: conectar BNCC, avaliações externas e dados de planejamento numa visão só. Ainda não é uma funcionalidade disponível — a BNCC e o SARESP, hoje, funcionam como consultas independentes.</p>
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
