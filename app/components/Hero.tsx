import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { HeroPlatformPreview } from "./HeroPlatformPreview";

export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container hero-grid">
        <div className="hero-copy">
          <div className="section-kicker"><span /> Inteligência educacional</div>
          <h1>Dados educacionais que fazem sentido para quem ensina.</h1>
          <p>
            Consulte a BNCC, conecte habilidades às avaliações externas e transforme
            dados educacionais em informações mais claras para o planejamento pedagógico.
          </p>
          <div className="hero-actions">
            <Link className="button button-primary" href="/bncc">Explorar a BNCC <ArrowRight size={18} /></Link>
            <a className="button button-secondary" href="#avaliacoes">Ver avaliações externas</a>
          </div>
          <div className="hero-topics" aria-label="Temas da plataforma">
            <span>BNCC</span><i /> <span>SAEB</span><i /> <span>SARESP</span><i /> <span>Dados educacionais</span>
          </div>
        </div>
        <HeroPlatformPreview />
      </div>
    </section>
  );
}
