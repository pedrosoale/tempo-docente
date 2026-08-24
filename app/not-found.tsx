import { SearchX } from "lucide-react";

export default function NotFound() {
  return (
    <main className="not-found-page" id="main-content">
      <div>
        <SearchX size={34} aria-hidden="true" />
        <span>404</span>
        <h1>Página não encontrada.</h1>
        <p>Não encontramos o endereço que você tentou acessar.</p>
        <div className="not-found-actions"><a className="button button-primary" href="/bncc">Consultar a BNCC</a><a className="button button-secondary" href="/">Voltar ao início</a></div>
      </div>
    </main>
  );
}
