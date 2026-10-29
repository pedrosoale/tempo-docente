import type { ItemPublicoComputacao } from "@/lib/bncc/computacao-consulta";

function rotuloApoio(item: ItemPublicoComputacao): string | null {
  const temExplicacao = item.explicacao !== null;
  const temExemplo = item.exemplos.length > 0;
  if (temExplicacao && temExemplo) return "Explicação e exemplo do documento oficial";
  if (temExplicacao) return "Explicação do documento oficial";
  if (temExemplo) return "Exemplo do documento oficial";
  return null;
}

/** Etapa e, quando acrescenta algo, o ano ou bloco de anos (a competência do Ensino Médio já aparece nos fatos). */
function contextoDe(item: ItemPublicoComputacao): string {
  return item.grupo && item.grupo !== item.etapaRotulo && item.competenciaEspecifica === null ? `${item.etapaRotulo} · ${item.grupo}` : item.etapaRotulo;
}

/** Uma habilidade ou um objetivo, só com dados oficiais: nenhum id interno, hash, página ou campo do gerador. */
export default function ResultadoItem({ item }: { item: ItemPublicoComputacao }) {
  const rotulo = rotuloApoio(item);
  const fatos: [string, string][] = [];
  if (item.eixo) fatos.push(["Eixo", item.eixo]);
  if (item.objeto) fatos.push(["Objeto de conhecimento", item.objeto]);
  if (item.competenciaEspecifica !== null) fatos.push(["Competência específica", String(item.competenciaEspecifica)]);

  return (
    <li className="comp-item" id={item.codigo.toLowerCase()}>
      <div className="comp-item-topo">
        <code className="comp-codigo">{item.codigo}</code>
        <span className="comp-contexto">{contextoDe(item)}</span>
      </div>
      <p className="comp-texto">{item.texto}</p>

      {item.codigoImpresso && (
        <p className="comp-nota">
          {`Nota: no documento oficial este código aparece impresso como “${item.codigoImpresso}” (com um dígito a mais). Aqui ele segue o padrão dos demais códigos do documento.`}
        </p>
      )}

      {item.normalizacoes.map((nota) => (
        <p className="comp-nota" key={nota}>{nota}</p>
      ))}

      {fatos.length > 0 && (
        <dl className="comp-fatos">
          {fatos.map(([nome, valor]) => (
            <div key={nome}>
              <dt>{nome}</dt>
              <dd>{valor}</dd>
            </div>
          ))}
        </dl>
      )}

      {item.relacoes.length > 0 && (
        <p className="comp-nota">
          O documento oficial indica relação direta com{" "}
          {item.relacoes.map((codigo, i) => (
            <span key={codigo}>
              {i > 0 && ", "}
              <a href={`/bncc/${codigo.toLowerCase()}`}>{codigo}</a>
            </span>
          ))}{" "}
          (outro componente da BNCC). É uma relação indicada pela fonte, não uma equivalência.
        </p>
      )}

      {rotulo && (
        <details className="comp-apoio">
          <summary>{rotulo}</summary>
          <div className="comp-apoio-corpo">
            {item.encontradoSoEmApoio && <p className="comp-nota">Os termos buscados aparecem na explicação ou nos exemplos desta habilidade.</p>}
            {item.explicacao && (
              <section>
                <h4>Explicação</h4>
                <p className="comp-apoio-texto">{item.explicacao}</p>
              </section>
            )}
            {item.exemplos.length > 0 && (
              <section>
                <h4>{item.exemplos.length > 1 ? "Exemplos" : "Exemplo"}</h4>
                {item.exemplos.map((exemplo, i) => (
                  <p className="comp-apoio-texto" key={i}>{exemplo}</p>
                ))}
              </section>
            )}
            {item.notasDoDocumento.map((nota) => (
              <p className="comp-nota" key={nota}>Nota sobre o documento oficial: {nota}</p>
            ))}
          </div>
        </details>
      )}
    </li>
  );
}
