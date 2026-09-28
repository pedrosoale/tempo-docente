import { ArrowRight, ArrowUpRight } from "lucide-react";
import { HeroPlatformPreview } from "./HeroPlatformPreview";

// O CTA principal aponta para #acessos (os quatro cartões de tarefa logo
// abaixo, ver QuickAccess.tsx) em vez de escolher entre SAEB e SARESP por si
// só. O texto do botão descreve a própria seleção de ferramentas, não uma
// consulta específica — apontar para #acessos e prometer "resultados por
// escola" no texto seria incoerente, já que a seção oferece BNCC, matrizes,
// SAEB e SARESP, não uma consulta direta.
export function Hero() {
  return (
    <section className="hero" id="top">
      <div className="container home-rail hero-grid">
        <div className="hero-copy">
          <div className="section-kicker"><span /> BNCC · SAEB · SARESP</div>
          <h1>BNCC, SAEB e SARESP em um só lugar.</h1>
          <p>
            Consulte habilidades, matrizes de referência e resultados por escola, com fontes
            oficiais e informações organizadas para o planejamento pedagógico.
          </p>
          <p className="hero-badges">Gratuito · Sem cadastro · Fontes identificadas</p>
          <div className="hero-actions">
            <a className="button button-primary" href="#acessos">Escolher uma consulta <ArrowRight size={18} /></a>
            <a className="button button-secondary" href="/bncc">Consultar a BNCC</a>
          </div>
          <a className="hero-tertiary" href="/saeb/matriz">Ver matrizes do SAEB <ArrowUpRight size={17} /></a>
          <div className="hero-topics" aria-label="Temas da plataforma">
            <span>BNCC</span><i /> <span>SAEB</span><i /> <span>SARESP</span><i /> <span>Matrizes de referência</span>
          </div>
        </div>
        <HeroPlatformPreview />
      </div>
    </section>
  );
}
