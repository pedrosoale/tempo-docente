import { ArrowRight, ArrowUpRight, Cpu } from "lucide-react";
import { montarQueryString, type ItemPublicoComputacao } from "@/lib/bncc/computacao-consulta";
import { NOME_CURTO_COMPUTACAO, NOME_OFICIAL_COMPUTACAO } from "@/lib/bncc/computacao";

// Descoberta da BNCC Computação a partir de /bncc. Este arquivo NÃO copia nem reindexa o catálogo: recebe
// itens já projetados pela biblioteca própria (lib/bncc/computacao-consulta.ts) e só os apresenta como
// prévia, sempre em uma seção separada e rotulada, apontando para a consulta própria /bncc/computacao.
const CAMINHO = "/bncc/computacao";

/** Quantidade máxima de resultados de Computação mostrados na prévia de /bncc?q=… (o resto fica na consulta própria). */
export const PREVIA_COMPUTACAO = 6;

export const TITULO_SECAO_COMPUTACAO = `${NOME_CURTO_COMPUTACAO} — Complemento à BNCC`;

/** Acesso visível na página principal da BNCC (sem busca): mesmo sistema visual dos demais cartões. */
export function ComputacaoAcesso({ total }: { total: number }) {
  return (
    <a className="access-card access-card-complemento" href={CAMINHO}>
      <div className="access-card-top">
        <span className="access-icon"><Cpu size={22} aria-hidden="true" /></span>
        <span className="access-label">Complemento oficial à BNCC</span>
      </div>
      <div>
        <h3>{NOME_CURTO_COMPUTACAO}</h3>
        <p className="access-card-titulo-oficial">{NOME_OFICIAL_COMPUTACAO}</p>
        <p>
          Consulte {total} objetivos e habilidades da Educação Infantil, do Ensino Fundamental e do Ensino Médio, com as
          explicações e os exemplos oficiais do documento.
        </p>
      </div>
      <span className="card-action">Explorar {NOME_CURTO_COMPUTACAO} <ArrowUpRight size={17} aria-hidden="true" /></span>
    </a>
  );
}

/** Link “N resultados na BNCC Computação” mostrado no resumo da busca, para quem tem muitos resultados curriculares. */
export function ComputacaoSaltoNoResumo({ total }: { total: number }) {
  return (
    <a className="bncc-comp-salto" href="#bncc-computacao-resultados">
      {total} {total === 1 ? "resultado" : "resultados"} na {NOME_CURTO_COMPUTACAO}
    </a>
  );
}

function descricaoDoItem(item: ItemPublicoComputacao): string {
  return `${item.natureza} · ${item.etapaRotulo} · ${item.grupo}`;
}

/** Seção separada, com título explícito, de prévia dos resultados de Computação (nunca misturada à BNCC curricular). */
export function ComputacaoResultadosPrevia({ itens, q }: { itens: ItemPublicoComputacao[]; q: string }) {
  const total = itens.length;
  const previa = itens.slice(0, PREVIA_COMPUTACAO);
  const destino = `${CAMINHO}${montarQueryString({ q })}#resultados`;

  return (
    <section className="bncc-comp-secao" id="bncc-computacao-resultados" aria-labelledby="bncc-computacao-titulo">
      <div className="bncc-comp-cabecalho">
        <div>
          <h2 id="bncc-computacao-titulo">{TITULO_SECAO_COMPUTACAO}</h2>
          <p>{NOME_OFICIAL_COMPUTACAO}. Resultados do documento oficial, em consulta própria, separados da BNCC curricular.</p>
        </div>
        <strong className="bncc-comp-contagem">
          {total} {total === 1 ? "resultado" : "resultados"}
          {total > previa.length ? <span> · mostrando os {previa.length} primeiros</span> : null}
        </strong>
      </div>

      <div className="bncc-results-list">
        {previa.map((item) => (
          <article className="bncc-result-card bncc-comp-card" key={item.codigo}>
            <div className="bncc-result-meta">
              <code>{item.codigo}</code>
              <span>{descricaoDoItem(item)} · {NOME_CURTO_COMPUTACAO}</span>
            </div>
            <p className="bncc-result-skill">{item.texto}</p>
            <div className="bncc-result-footer">
              <div>
                {item.encontradoSoEmApoio ? <strong>Termo encontrado na explicação ou nos exemplos oficiais.</strong> : null}
              </div>
              <a href={destino}>Ver na {NOME_CURTO_COMPUTACAO} <ArrowRight size={17} aria-hidden="true" /></a>
            </div>
          </article>
        ))}
      </div>

      {total > previa.length ? (
        <p className="bncc-comp-todos">
          <a className="button button-secondary" href={destino}>Ver todos na {NOME_CURTO_COMPUTACAO} <ArrowRight size={17} aria-hidden="true" /></a>
        </p>
      ) : null}
    </section>
  );
}
