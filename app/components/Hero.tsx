import { HeroPlatformPreview } from "./HeroPlatformPreview";

// Sem CTA/navegação própria no hero: a escolha do destino (BNCC, matrizes do
// SAEB, resultados do SAEB, resultados do SARESP) é feita inteiramente pelos
// quatro cartões de "O que você quer consultar?" logo abaixo (QuickAccess.tsx)
// — duplicar esses destinos aqui como botões ou como uma lista decorativa
// era redundante com essa seção, que já cumpre essa função sozinha.
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
        </div>
        <HeroPlatformPreview />
      </div>
    </section>
  );
}
