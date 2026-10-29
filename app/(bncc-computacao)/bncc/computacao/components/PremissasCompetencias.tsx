import { obterCompetenciasEnsinoFundamental, obterCompetenciasEnsinoMedio, obterPremissas, type CompetenciaPublica } from "@/lib/bncc/computacao-consulta";

function ListaCompetencias({ competencias }: { competencias: CompetenciaPublica[] }) {
  return (
    <ol className="comp-docs-lista">
      {competencias.map((c) => (
        <li key={c.numero} value={c.numero}>
          <p>{c.texto}</p>
          {c.textoNoQuadro && (
            <details className="comp-docs-divergencia">
              <summary>Texto repetido no quadro de habilidades (difere do texto da lista)</summary>
              <p>{c.textoNoQuadro}</p>
            </details>
          )}
        </li>
      ))}
    </ol>
  );
}

/** Premissas e competências do documento, cada uma UMA vez por etapa (as 7 do Ensino Fundamental são duplicadas fisicamente no catálogo). */
export default function PremissasCompetencias() {
  const premissas = obterPremissas();
  const fundamental = obterCompetenciasEnsinoFundamental();
  const medio = obterCompetenciasEnsinoMedio();

  return (
    <div className="comp-docs">
      <details className="comp-docs-bloco">
        <summary>
          <span>Premissas da Educação Infantil</span>
          <span className="comp-docs-contagem">{premissas.itens.length}</span>
        </summary>
        <div className="comp-docs-corpo">
          {premissas.introducao && <p>{premissas.introducao}</p>}
          <ol className="comp-docs-lista">
            {premissas.itens.map((p) => (
              <li key={p.numero} value={p.numero}><p>{p.texto}</p></li>
            ))}
          </ol>
        </div>
      </details>

      <details className="comp-docs-bloco">
        <summary>
          <span>Competências específicas do Ensino Fundamental</span>
          <span className="comp-docs-contagem">{fundamental.length}</span>
        </summary>
        <div className="comp-docs-corpo">
          <p className="comp-docs-nota">As mesmas sete competências valem para o Ensino Fundamental inteiro (1º ao 9º ano).</p>
          <ListaCompetencias competencias={fundamental} />
        </div>
      </details>

      <details className="comp-docs-bloco">
        <summary>
          <span>Competências específicas do Ensino Médio</span>
          <span className="comp-docs-contagem">{medio.length}</span>
        </summary>
        <div className="comp-docs-corpo">
          <ListaCompetencias competencias={medio} />
        </div>
      </details>
    </div>
  );
}
