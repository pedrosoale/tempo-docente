import Link from "next/link";

export function Footer() {
  return (
    <footer className="footer" id="sobre">
      <div className="container footer-main">
        <div>
          <Link className="wordmark footer-wordmark" href="/">Tempo Docente<span className="wordmark-dot" aria-hidden="true" /></Link>
          <p>Dados, planejamento e inteligência para a educação.</p>
        </div>
        <nav aria-label="Navegação do rodapé">
          <Link href="/bncc">BNCC</Link>
          <Link href="/#avaliacoes">Avaliações</Link>
          <Link href="/#dados">Dados Educacionais</Link>
          <Link href="/#sobre">Sobre</Link>
          <a href="mailto:contato@tempodocente.com.br">Contato</a>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Tempo Docente</span>
        <span>tempodocente.com.br</span>
      </div>
    </footer>
  );
}
