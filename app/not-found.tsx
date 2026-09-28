import type { Metadata } from "next";
import { SearchX } from "lucide-react";

// Metadados próprios e neutros — sem isto, esta página herdaria a description
// padrão do layout raiz (que agora cita "habilidades da BNCC"), quebrando a
// promessa de que o 404 nunca sugere conteúdo específico que não existe aqui.
const NOT_FOUND_TITLE = "Página não encontrada | Tempo Docente";
const NOT_FOUND_DESCRIPTION = "O endereço acessado não existe no Tempo Docente. Volte ao início ou consulte a BNCC.";

export const metadata: Metadata = {
  title: NOT_FOUND_TITLE,
  description: NOT_FOUND_DESCRIPTION,
  // Next mescla openGraph/twitter com o layout raiz campo a campo quando a
  // página não os declara — título e description próprios sozinhos não bastam
  // para impedir a description da home (que cita "habilidades") de vazar aqui.
  openGraph: { title: NOT_FOUND_TITLE, description: NOT_FOUND_DESCRIPTION },
  twitter: { title: NOT_FOUND_TITLE, description: NOT_FOUND_DESCRIPTION },
};

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
