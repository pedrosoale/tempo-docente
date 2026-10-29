import { ArrowLeft, ArrowRight } from "lucide-react";
import { montarQueryString, type FiltrosComputacao } from "@/lib/bncc/computacao-consulta";

const CAMINHO = "/bncc/computacao";

const href = (filtros: FiltrosComputacao, pagina: number) => `${CAMINHO}${montarQueryString(filtros, pagina)}#resultados`;

/** Paginação por GET (links comuns): funciona sem JavaScript e preserva todos os filtros e a busca na URL. */
export default function Paginacao({ filtros, pagina, totalPaginas }: { filtros: FiltrosComputacao; pagina: number; totalPaginas: number }) {
  const numeros = Array.from({ length: totalPaginas }, (_, i) => i + 1);
  return (
    <nav className="comp-paginacao" aria-label="Paginação dos resultados">
      <ul>
        <li>
          {pagina > 1 ? (
            <a href={href(filtros, pagina - 1)} rel="prev">
              <ArrowLeft size={16} aria-hidden="true" /> Anterior
            </a>
          ) : (
            <span aria-disabled="true"><ArrowLeft size={16} aria-hidden="true" /> Anterior</span>
          )}
        </li>
        {numeros.map((n) => (
          <li key={n}>
            {n === pagina ? (
              <span className="comp-pagina-atual" aria-current="page"><span className="sr-only">Página </span>{n}</span>
            ) : (
              <a href={href(filtros, n)} aria-label={`Página ${n}`}>{n}</a>
            )}
          </li>
        ))}
        <li>
          {pagina < totalPaginas ? (
            <a href={href(filtros, pagina + 1)} rel="next">
              Próxima <ArrowRight size={16} aria-hidden="true" />
            </a>
          ) : (
            <span aria-disabled="true">Próxima <ArrowRight size={16} aria-hidden="true" /></span>
          )}
        </li>
      </ul>
    </nav>
  );
}
