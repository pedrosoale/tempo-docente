import { SearchX } from "lucide-react";
import Link from "next/link";

export default function NotFound() {
  return (
    <main className="not-found-page">
      <div>
        <SearchX size={34} aria-hidden="true" />
        <span>404</span>
        <h1>Página não encontrada.</h1>
        <p>O código informado não corresponde a uma habilidade disponível neste módulo.</p>
        <div className="not-found-actions"><Link className="button button-primary" href="/bncc">Consultar a BNCC</Link><Link className="button button-secondary" href="/">Voltar ao início</Link></div>
      </div>
    </main>
  );
}
