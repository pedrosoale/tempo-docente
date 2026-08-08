"use client";

import { AlertCircle } from "lucide-react";
import { useEffect } from "react";

export default function BnccError({ error, reset }: { error: Error & { digest?: string }; reset: () => void }) {
  useEffect(() => {
    console.error("Falha ao renderizar o módulo BNCC", error);
  }, [error]);

  return (
    <section className="container bncc-error" role="alert">
      <AlertCircle size={32} aria-hidden="true" />
      <h1>Não foi possível carregar a consulta da BNCC.</h1>
      <p>Tente novamente. Se o problema continuar, volte à página inicial.</p>
      <button type="button" onClick={reset}>Tentar novamente</button>
    </section>
  );
}
