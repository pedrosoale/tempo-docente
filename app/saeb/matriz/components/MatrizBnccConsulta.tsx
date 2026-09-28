"use client";

// Consulta interativa à matriz de referência ALINHADA À BNCC do Saeb — busca por código oficial
// (só existe para Matemática) ou palavra-chave, com as habilidades agrupadas por eixo do
// conhecimento e subagrupadas por eixo cognitivo, em accordions nativos <details>/<summary>. Nenhuma
// requisição de rede: o catálogo inteiro (lib/saeb/matriz-bncc.ts) já está empacotado no bundle —
// trocar etapa/componente/busca aqui nunca busca nada em /data/saeb-matriz-bncc/**.
//
// Mesmo padrão de MatrizConsulta.tsx (matriz tradicional): os três controles são espelhados na URL
// via history.replaceState — nunca com o roteador do Next e nunca causando navegação ou nova
// renderização no servidor. O parâmetro `matriz` da URL (que distingue esta matriz da tradicional)
// é responsabilidade exclusiva de MatrizSeletor.tsx — este componente nunca o toca.
//
// IMPORTANTE: `etapa` e `componente` aqui usam o MESMO NOME de parâmetro de URL que a matriz
// tradicional, mas um VOCABULÁRIO DIFERENTE e incompatível (ex.: "2anoEF"/"linguagens", nunca
// "anosIniciais"/"lp") — nunca compartilhar os tipos, rótulos ou funções de validação com
// MatrizConsulta.tsx/app/saeb/matriz/page.tsx (ver `ehEtapaBnccValida`/`ehComponenteBnccValido` lá).
import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  buscarFonte,
  buscarHabilidades,
  filtrarHabilidadesPorTexto,
  agruparPorEixo,
  type ComponenteMatrizBncc,
  type EtapaMatrizBncc,
} from "@/lib/saeb/matriz-bncc";

const ETAPAS: EtapaMatrizBncc[] = ["2anoEF", "5anoEF", "9anoEF"];
const COMPONENTES: ComponenteMatrizBncc[] = ["linguagens", "matematica"];
const ETAPA_LABEL: Record<EtapaMatrizBncc, string> = {
  "2anoEF": "2º ano do Ensino Fundamental",
  "5anoEF": "5º ano do Ensino Fundamental",
  "9anoEF": "9º ano do Ensino Fundamental",
};
const COMPONENTE_LABEL: Record<ComponenteMatrizBncc, string> = {
  linguagens: "Linguagens/Língua Portuguesa",
  matematica: "Matemática",
};

function atualizarUrl(etapa: EtapaMatrizBncc, componente: ComponenteMatrizBncc, busca: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("matriz", "bncc");
  url.searchParams.set("etapa", etapa);
  url.searchParams.set("componente", componente);
  if (busca.trim()) {
    url.searchParams.set("busca", busca);
  } else {
    url.searchParams.delete("busca");
  }
  window.history.replaceState(null, "", url);
}

export default function MatrizBnccConsulta({
  initialEtapa,
  initialComponente,
  initialBusca,
}: {
  initialEtapa: EtapaMatrizBncc;
  initialComponente: ComponenteMatrizBncc;
  initialBusca: string;
}) {
  const [etapa, setEtapa] = useState<EtapaMatrizBncc>(initialEtapa);
  const [componente, setComponente] = useState<ComponenteMatrizBncc>(initialComponente);
  const [busca, setBusca] = useState(initialBusca);
  const etapaLegendId = useId();
  const componenteLegendId = useId();
  const buscaId = useId();

  useEffect(() => {
    atualizarUrl(etapa, componente, busca);
  }, [etapa, componente, busca]);

  const habilidadesDoRecorte = buscarHabilidades(etapa, componente);
  const habilidadesFiltradas = filtrarHabilidadesPorTexto(habilidadesDoRecorte, busca);
  const grupos = agruparPorEixo(habilidadesFiltradas);
  const fonte = buscarFonte(componente);
  const totalHabilidades = habilidadesDoRecorte.length;
  const totalEncontradas = habilidadesFiltradas.length;
  const estaBuscando = busca.trim().length > 0;
  const buscaPorCodigoHabilitada = componente === "matematica";

  return (
    <div className="saeb-matriz-consulta">
      <div className="saeb-matriz-filtros">
        <fieldset className="saeb-matriz-fieldset">
          <legend id={componenteLegendId}>Componente</legend>
          <div className="saeb-matriz-radio-group" role="radiogroup" aria-labelledby={componenteLegendId}>
            {COMPONENTES.map((valor) => {
              const id = `matriz-bncc-componente-${valor}`;
              return (
                <span key={valor} className="saeb-matriz-radio">
                  <input type="radio" id={id} name="matriz-bncc-componente" checked={componente === valor} onChange={() => setComponente(valor)} />
                  <label htmlFor={id}>{COMPONENTE_LABEL[valor]}</label>
                </span>
              );
            })}
          </div>
        </fieldset>

        <fieldset className="saeb-matriz-fieldset">
          <legend id={etapaLegendId}>Etapa</legend>
          <div className="saeb-matriz-radio-group" role="radiogroup" aria-labelledby={etapaLegendId}>
            {ETAPAS.map((valor) => {
              const id = `matriz-bncc-etapa-${valor}`;
              return (
                <span key={valor} className="saeb-matriz-radio">
                  <input type="radio" id={id} name="matriz-bncc-etapa" checked={etapa === valor} onChange={() => setEtapa(valor)} />
                  <label htmlFor={id}>{ETAPA_LABEL[valor]}</label>
                </span>
              );
            })}
          </div>
        </fieldset>

        <div className="saeb-field saeb-matriz-busca-campo">
          <label htmlFor={buscaId}>
            {buscaPorCodigoHabilitada ? "Buscar por código (ex.: 5E2.3) ou palavra-chave" : "Buscar por palavra-chave"}
          </label>
          <input
            id={buscaId}
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder={buscaPorCodigoHabilitada ? 'Ex.: 5E2.3 ou "porcentagem"...' : 'Ex.: "inferir" ou "gêneros textuais"...'}
          />
        </div>
      </div>

      <div className="saeb-matriz-identificacao">
        <p>
          Você está consultando a <strong>matriz alinhada à BNCC</strong> de <strong>{COMPONENTE_LABEL[componente]}</strong> —{" "}
          <strong>{ETAPA_LABEL[etapa]}</strong>.
        </p>
        <p className="saeb-matriz-contagem">
          {estaBuscando
            ? `${totalEncontradas} de ${totalHabilidades} habilidades correspondem à busca.`
            : `${totalHabilidades} habilidades, agrupadas em ${grupos.length} eixo${grupos.length === 1 ? "" : "s"} do conhecimento.`}
        </p>
        {componente === "linguagens" && (
          <p className="saeb-matriz-nota-sem-codigo">
            Esta publicação do Inep não atribui códigos oficiais às habilidades de Linguagens. A busca considera o texto das habilidades.
          </p>
        )}
      </div>

      {grupos.length === 0 && <p className="saeb-nao-informado">Nenhuma habilidade encontrada para esta busca, nesta etapa e componente.</p>}

      <div className="saeb-matriz-grupos" key={`bncc-${etapa}-${componente}`}>
        {grupos.map((grupo) => (
          <details key={grupo.eixoConhecimento} className="saeb-matriz-grupo" open>
            <summary>
              <ChevronDown size={16} aria-hidden="true" className="saeb-interpretacao-chevron" />
              <span>{grupo.eixoConhecimento}</span>
              <span className="saeb-matriz-grupo-contagem">{grupo.totalHabilidades}</span>
            </summary>
            <div className="saeb-matriz-habilidades">
              {grupo.subgrupos.map((subgrupo) => (
                <div key={subgrupo.eixoCognitivo ?? "sem-eixo-cognitivo"} className="saeb-matriz-subgrupo">
                  {subgrupo.eixoCognitivo && <p className="saeb-matriz-eixo-cognitivo">{subgrupo.eixoCognitivo}</p>}
                  <ul className="saeb-matriz-lista-habilidades">
                    {subgrupo.habilidades.map((habilidade) => (
                      <li
                        key={habilidade.idInterno}
                        className={`saeb-matriz-habilidade ${habilidade.codigoOficial ? "tem-codigo" : "sem-codigo"}`}
                      >
                        {habilidade.codigoOficial && <span className="saeb-matriz-habilidade-codigo">{habilidade.codigoOficial}</span>}
                        <p>{habilidade.textoHabilidade}</p>
                      </li>
                    ))}
                  </ul>
                </div>
              ))}
            </div>
          </details>
        ))}
      </div>

      <p className="saeb-fonte saeb-matriz-fonte">
        Fonte:{" "}
        <a href={fonte.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${fonte.titulo} no site do Inep`}>
          {fonte.titulo}
        </a>{" "}
        <ArrowUpRight size={13} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> — {fonte.orgao}, {fonte.anoPublicacao}. Consulta em{" "}
        {fonte.dataConsulta}.
      </p>
    </div>
  );
}
