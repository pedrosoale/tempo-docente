export function Footer() {
  return (
    <footer className="footer">
      <div className="container footer-main">
        <div>
          <a className="wordmark footer-wordmark" href="/">
            <img className="wordmark-mark" src="/mark-light.png" alt="" width={28} height={28} />
            Tempo Docente
          </a>
          <p>Dados, planejamento e inteligência para a educação.</p>
        </div>
        <nav aria-label="Navegação do rodapé">
          <a href="/">Início</a>
          <a href="/bncc">BNCC</a>
          <a href="/bncc/educacao-infantil">Educação Infantil</a>
          <a href="/bncc/ensino-fundamental">Ensino Fundamental</a>
          <a href="/bncc/ensino-medio">Ensino Médio</a>
          <a href="/bncc/competencias-gerais">Competências Gerais</a>
          <a href="/saresp">SARESP</a>
          <a href="/sobre">Sobre</a>
          <a href="/privacidade">Privacidade</a>
          <a href="mailto:tempodocente@gmail.com">Contato</a>
        </nav>
      </div>
      <div className="container footer-bottom">
        <span>© 2026 Tempo Docente</span>
        <span>tempodocente.com.br</span>
      </div>
    </footer>
  );
}
