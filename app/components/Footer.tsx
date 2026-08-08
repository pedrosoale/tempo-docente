export function Footer() {
  return (
    <footer className="footer" id="sobre">
      <div className="container footer-main">
        <div>
          <a className="wordmark footer-wordmark" href="/">
            <img className="wordmark-mark" src="/mark-light.png" alt="" width={28} height={28} />
            Tempo Docente
          </a>
          <p>Dados, planejamento e inteligência para a educação.</p>
        </div>
        <nav aria-label="Navegação do rodapé">
          <a href="/bncc">BNCC</a>
          <a href="/#avaliacoes">Avaliações</a>
          <a href="/#dados">Dados Educacionais</a>
          <a href="/#sobre">Sobre</a>
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
