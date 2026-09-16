"use client";

// Consulta interativa à matriz de referência tradicional (2001) do Saeb — busca por código ou
// palavra-chave, com os descritores agrupados por tópico/tema em accordions nativos <details>/
// <summary>. Nenhuma requisição de rede: o catálogo inteiro (lib/saeb/descritores.ts) já está
// empacotado no bundle, e trocar etapa/componente/busca aqui nunca busca nada em /data/saeb/**.
//
// Filtros na URL: os três controles (etapa, componente, busca) são espelhados na query string via
// history.replaceState — nunca com o roteador do Next e nunca causando navegação ou nova
// renderização no servidor, para não arriscar um descompasso de hidratação. O estado inicial vem
// inteiramente de props resolvidas no servidor (app/saeb/matriz/page.tsx já validou e saneou
// qualquer parâmetro inválido antes de chegar aqui).
import { useEffect, useId, useState } from "react";
import { ArrowUpRight, ChevronDown } from "lucide-react";
import {
  buscarMatriz,
  catalogoDescritores,
  filtrarGrupos,
  type ComponentePiloto,
} from "@/lib/saeb/descritores";
import { ETAPA_LABEL } from "@/lib/saeb/labels";
import type { Etapa } from "@/lib/saeb/types";

const ETAPAS: Etapa[] = ["anosIniciais", "anosFinais", "ensinoMedio"];
const COMPONENTES: ComponentePiloto[] = ["lp", "mt"];
const COMPONENTE_LABEL: Record<ComponentePiloto, string> = { lp: "Língua Portuguesa", mt: "Matemática" };

function atualizarUrl(etapa: Etapa, componente: ComponentePiloto, busca: string) {
  if (typeof window === "undefined") return;
  const url = new URL(window.location.href);
  url.searchParams.set("etapa", etapa);
  url.searchParams.set("componente", componente);
  if (busca.trim()) {
    url.searchParams.set("busca", busca);
  } else {
    url.searchParams.delete("busca");
  }
  window.history.replaceState(null, "", url);
}

export default function MatrizConsulta({
  initialEtapa,
  initialComponente,
  initialBusca,
}: {
  initialEtapa: Etapa;
  initialComponente: ComponentePiloto;
  initialBusca: string;
}) {
  const [etapa, setEtapa] = useState<Etapa>(initialEtapa);
  const [componente, setComponente] = useState<ComponentePiloto>(initialComponente);
  const [busca, setBusca] = useState(initialBusca);
  const etapaLegendId = useId();
  const componenteLegendId = useId();
  const buscaId = useId();

  useEffect(() => {
    atualizarUrl(etapa, componente, busca);
  }, [etapa, componente, busca]);

  const matriz = buscarMatriz(etapa, componente);
  const fonte = catalogoDescritores.fontes[componente];
  const grupos = matriz ? filtrarGrupos(matriz.grupos, busca) : [];
  const totalDescritores = matriz ? matriz.grupos.reduce((soma, g) => soma + g.descritores.length, 0) : 0;
  const totalEncontrados = grupos.reduce((soma, g) => soma + g.descritores.length, 0);
  const estaBuscando = busca.trim().length > 0;
  const rotuloGrupo = matriz?.rotuloAgrupamento === "tema" ? "tema" : "tópico";

  return (
    <div className="saeb-matriz-consulta">
      <div className="saeb-matriz-filtros">
        <fieldset className="saeb-matriz-fieldset">
          <legend id={componenteLegendId}>Componente</legend>
          <div className="saeb-matriz-radio-group" role="radiogroup" aria-labelledby={componenteLegendId}>
            {COMPONENTES.map((valor) => {
              const id = `matriz-componente-${valor}`;
              return (
                <span key={valor} className="saeb-matriz-radio">
                  <input type="radio" id={id} name="matriz-componente" checked={componente === valor} onChange={() => setComponente(valor)} />
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
              const id = `matriz-etapa-${valor}`;
              return (
                <span key={valor} className="saeb-matriz-radio">
                  <input type="radio" id={id} name="matriz-etapa" checked={etapa === valor} onChange={() => setEtapa(valor)} />
                  <label htmlFor={id}>{ETAPA_LABEL[valor]}</label>
                </span>
              );
            })}
          </div>
        </fieldset>

        <div className="saeb-field saeb-matriz-busca-campo">
          <label htmlFor={buscaId}>Buscar por código (ex.: D1) ou palavra-chave</label>
          <input
            id={buscaId}
            type="search"
            value={busca}
            onChange={(event) => setBusca(event.target.value)}
            placeholder="Ex.: D1, ou &quot;inferir&quot;, &quot;porcentagem&quot;..."
          />
        </div>
      </div>

      {matriz ? (
        <>
          <div className="saeb-matriz-identificacao">
            <p>
              Você está consultando a <strong>matriz tradicional (2001)</strong> de <strong>{COMPONENTE_LABEL[componente]}</strong> —{" "}
              <strong>{matriz.etapaLabelOficial}</strong> ({matriz.quadro} da publicação oficial).
            </p>
            <p className="saeb-matriz-contagem">
              {estaBuscando
                ? `${totalEncontrados} de ${totalDescritores} descritores correspondem à busca.`
                : `${totalDescritores} descritores, agrupados em ${matriz.grupos.length} ${rotuloGrupo}s.`}
            </p>
          </div>

          {grupos.length === 0 && (
            <p className="saeb-nao-informado">Nenhum descritor encontrado para esta busca, nesta etapa e componente.</p>
          )}

          <div className="saeb-matriz-grupos" key={`${etapa}-${componente}`}>
            {grupos.map((grupo) => (
              <details key={grupo.numero} className="saeb-matriz-grupo" open>
                <summary>
                  <ChevronDown size={16} aria-hidden="true" className="saeb-interpretacao-chevron" />
                  <span>
                    {grupo.numero}. {grupo.nome}
                  </span>
                  <span className="saeb-matriz-grupo-contagem">{grupo.descritores.length}</span>
                </summary>
                <ul className="saeb-matriz-descritores">
                  {grupo.descritores.map((descritor) => (
                    <li key={descritor.codigo} className="saeb-matriz-descritor">
                      <span className="saeb-matriz-descritor-codigo">{descritor.codigo}</span>
                      <p>{descritor.texto}</p>
                    </li>
                  ))}
                </ul>
              </details>
            ))}
          </div>

          <p className="saeb-fonte saeb-matriz-fonte">
            Fonte:{" "}
            <a href={fonte.url} target="_blank" rel="noopener noreferrer" aria-label={`Abrir ${fonte.titulo} no site do Inep`}>
              {fonte.titulo}
            </a>{" "}
            <ArrowUpRight size={13} aria-hidden="true" style={{ verticalAlign: "-1px" }} /> — {fonte.orgao}, {fonte.versaoPublicacao}. {matriz.fonteInternaCitada}
          </p>
        </>
      ) : (
        <p className="saeb-nao-informado">Não há matriz catalogada para esta combinação de etapa e componente.</p>
      )}
    </div>
  );
}
