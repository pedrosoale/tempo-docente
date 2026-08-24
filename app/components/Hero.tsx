import { ArrowRight } from "lucide-react";
import { HeroPlatformPreview } from "./HeroPlatformPreview";

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="section-kicker"><span /> Inteligência educacional</div>
          <h1>Dados educacionais que fazem sentido para quem ensina.</h1>
          <p>
            Consulte a BNCC da Educação Infantil ao Ensino Médio, analise os resultados
            do SARESP por escola e organize informações mais claras para o seu planejamento pedagógico.
          </p>
          <div className="hero-actions">
            <a className="button button-primary" href="/bncc">Explorar a BNCC <ArrowRight size={18} /></a>
            <a className="button button-secondary" href="/saresp">Consultar o SARESP</a>
          </div>
          <div className="hero-topics" aria-label="Temas da plataforma">
            <span>Educação Infantil</span><i /> <span>Ensino Fundamental</span><i /> <span>Ensino Médio</span><i /> <span>SARESP</span>
          </div>
        </div>
        <HeroPlatformPreview />
      </div>
    </section>
  );
}
