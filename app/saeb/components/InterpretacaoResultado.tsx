"use client";

// Painel opcional "Entenda este resultado" (piloto local — ver
// C:\ProjetosIA\saeb-interpretacao-pedagogica-piloto-relatorio.html). Só interpreta o recorte já
// selecionado na consulta (escola, etapa, edição); nunca refaz a seleção, nunca busca partição de
// resultado (o registro — e o da edição anterior, para a comparação — já foram carregados pela
// consulta) e nunca troca a edição escolhida. O único dado que este painel carrega por conta própria
// é o catálogo de escalas de lib/saeb/escalas.ts — um módulo estático empacotado no bundle, sem
// requisição de rede.
//
// Ordem de leitura fixa (ver relatório do piloto): (1) resultado da escola já nomeando o nível
// oficial quando comprovado — frase direta, sem afirmar nada sobre estudantes individuais nela —,
// (2) o que esse valor indica, (3) nível e faixa oficial (intervalo + habilidades do nível atual +
// consulta opcional aos níveis anteriores, um por um, sob demanda), (5) comparação com a edição
// documentada anterior, (6) limites da interpretação — incluindo a distinção entre média e
// distribuição por nível —, (7) fonte oficial.
import { useId, useState } from "react";
import { ChevronDown, HelpCircle, X } from "lucide-react";
import { buscarEscala, catalogoEscalas, type FaixaNivel } from "@/lib/saeb/escalas";
import {
  comPreposicao,
  compararComEdicaoAnterior,
  edicaoAnteriorDocumentada,
  faixasAnteriores,
  linhasDaDescricaoSemIntroducaoOficial,
  PILOTO_COMPONENTES,
  resolverPosicaoNaEscala,
  textoIntervalo,
  type ComponentePiloto,
} from "@/lib/saeb/interpretacao";
import { ETAPA_LABEL, INDICADOR_LABEL } from "@/lib/saeb/labels";
import { formatarValorIndicador, resolverIndicador } from "@/lib/saeb/registro";
import type { Escola, Etapa, RegistroEdicao } from "@/lib/saeb/types";

/** Consulta pública oficial do Boletim da Escola — único ponto de acesso à distribuição percentual
 * por nível encontrado na auditoria documental (ver relatório do piloto). Nunca é buscado por este
 * painel: é só um link para o professor/gestor consultar por conta própria, escola por escola. */
const BOLETIM_ESCOLA_URL = "https://saeb.inep.gov.br/saeb/resultado-final-externo";

/**
 * Corpo de um nível — reusado tanto para o nível correspondente à média quanto para cada nível
 * anterior consultado sob demanda (ver seção "Ver habilidades dos níveis anteriores"). Nunca
 * inventa descrição: sempre o texto oficial de `faixa.descricaoOficial`, só reorganizado.
 */
function ConteudoNivel({ faixa }: { faixa: FaixaNivel }) {
  return (
    <>
      {faixa.nivel > 0 ? (
        <p className="saeb-interpretacao-acumulado">
          Na escala do SAEB, os níveis são cumulativos. Para {comPreposicao("o", faixa.nomeNivel)}, o Inep descreve as
          seguintes habilidades, além das previstas nos níveis anteriores:
        </p>
      ) : (
        // "Nível 0" (duas escalas de 5º ano) e "Abaixo do Nível 1" (as outras quatro escalas) não
        // combinam com o mesmo artigo definido — por isso a frase não repete o nome do nível aqui;
        // ele já aparece no título (nível atual) ou no <summary> (nível anterior) logo acima.
        <p className="saeb-interpretacao-acumulado">O Inep descreve este nível da seguinte forma:</p>
      )}
      {linhasDaDescricaoSemIntroducaoOficial(faixa).map((linha, i) => (
        <p key={i}>{linha}</p>
      ))}
    </>
  );
}

export default function InterpretacaoResultado({
  escola,
  etapa,
  edicao,
  registro,
  onFechar,
}: {
  escola: Escola;
  etapa: Etapa;
  edicao: string;
  registro: RegistroEdicao | undefined;
  onFechar: () => void;
}) {
  const headingId = useId();
  const [componente, setComponente] = useState<ComponentePiloto>("lp");

  const resultado = resolverIndicador(registro, componente);
  const estado = resolverPosicaoNaEscala({ etapa, componente, edicao, resultado });
  const info = INDICADOR_LABEL[componente];

  // A comparação com a edição anterior não depende de a edição ATUAL ter sido classificada por
  // nível — só de haver, nas duas pontas, um valor numérico simples (ver compararComEdicaoAnterior).
  // Por isso a escala é buscada direto aqui, independente do resultado de resolverPosicaoNaEscala.
  const escala = buscarEscala(etapa, componente);
  const edicaoAnterior = escala ? edicaoAnteriorDocumentada(escala, edicao) : null;
  const registroAnterior = edicaoAnterior ? escola.etapas[etapa]?.[edicaoAnterior] : undefined;
  const resultadoAnterior = edicaoAnterior ? resolverIndicador(registroAnterior, componente) : undefined;
  const comparacao =
    edicaoAnterior && resultadoAnterior
      ? compararComEdicaoAnterior({ edicaoAtual: edicao, resultadoAtual: resultado, edicaoAnterior, resultadoAnterior })
      : null;

  const temValorAtual = resultado.tipo === "valor";

  // Níveis abaixo do nível correspondente à média — ver faixasAnteriores em lib/saeb/interpretacao.ts.
  const niveisAnteriores: FaixaNivel[] = estado.tipo === "resolvido" ? faixasAnteriores(estado.escala, estado.faixa.nivel) : [];

  return (
    <section className="saeb-interpretacao" aria-labelledby={headingId}>
      <div className="saeb-historico-head">
        <h4 id={headingId}>Entenda este resultado</h4>
        <button type="button" className="saeb-historico-close" onClick={onFechar} aria-label="Fechar explicação do resultado">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <p className="saeb-historico-id">
        {escola.nome} · Código INEP {escola.codigoInep}
      </p>

      <div className="saeb-historico-toggle" role="group" aria-label="Componente a interpretar">
        {PILOTO_COMPONENTES.map((campo) => (
          <button key={campo} type="button" aria-pressed={componente === campo} onClick={() => setComponente(campo)}>
            {INDICADOR_LABEL[campo].label}
          </button>
        ))}
      </div>

      <p className="saeb-interpretacao-recorte">
        {ETAPA_LABEL[etapa]} · edição {edicao}
      </p>

      {/* 1 e 3 — Resultado da escola e nível oficial, numa frase direta que já nomeia o nível quando
          a classificação está comprovada; sem afirmar nada sobre estudantes individuais aqui. */}
      {estado.tipo === "resolvido" ? (
        <p className="saeb-interpretacao-frase">
          A proficiência média da escola foi <strong>{formatarValorIndicador(estado.valor)}</strong>. Esse resultado situa-se{" "}
          {estado.faixa.nomeNivel.startsWith("Nível") ? "no " : ""}
          <strong>{estado.faixa.nomeNivel}</strong> da escala de {info.label} do SAEB.
        </p>
      ) : (
        temValorAtual && (
          <p className="saeb-interpretacao-frase">
            A proficiência média da escola foi <strong>{formatarValorIndicador(resultado.valor)}</strong> em {info.label}, edição {edicao}.
          </p>
        )
      )}
      {estado.tipo === "ausente_oficial" && <p className="saeb-ausente">Não divulgado — {estado.motivo}</p>}
      {estado.tipo === "nao_informado" && (
        <p className="saeb-nao-informado">Não informado nesta divulgação — sem resultado para interpretar.</p>
      )}

      {/* 2 — O que esse valor indica (qualquer valor numérico simples, com ou sem faixa confirmada) */}
      {temValorAtual && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> Esse número é a proficiência média da escola nesta edição, numa escala contínua construída
          pelo Inep — não é uma nota de 0 a 10, não é um percentual de acertos e não corresponde ao desempenho de nenhum estudante específico.
        </p>
      )}

      {/* 3 e 4 — Nível/faixa oficial, aprendizagens associadas e consulta aos níveis anteriores, só
          quando a associação à escala está comprovada */}
      {estado.tipo === "resolvido" && (
        <div className="saeb-interpretacao-corpo">
          <p className="saeb-interpretacao-intervalo">
            {estado.faixa.nomeNivel} — intervalo oficial: {textoIntervalo(estado.faixa)}.
          </p>

          <div className="saeb-interpretacao-descricao">
            <h5>O que caracteriza {comPreposicao("o", estado.faixa.nomeNivel)} na escala do SAEB</h5>
            <ConteudoNivel faixa={estado.faixa} />
          </div>

          {niveisAnteriores.length > 0 && (
            <details key={componente} className="saeb-interpretacao-niveis-anteriores">
              <summary>
                <ChevronDown size={16} aria-hidden="true" className="saeb-interpretacao-chevron" />
                Ver habilidades dos níveis anteriores
              </summary>
              <div className="saeb-interpretacao-niveis-anteriores-lista">
                {niveisAnteriores.map((faixaAnterior) => (
                  <details key={faixaAnterior.nivel} className="saeb-interpretacao-nivel-anterior">
                    <summary>
                      <ChevronDown size={14} aria-hidden="true" className="saeb-interpretacao-chevron" />
                      {faixaAnterior.nomeNivel}
                    </summary>
                    <div className="saeb-interpretacao-descricao">
                      <ConteudoNivel faixa={faixaAnterior} />
                    </div>
                  </details>
                ))}
              </div>
            </details>
          )}
        </div>
      )}

      {/* 5 — Comparação com a edição documentada anterior */}
      {comparacao && (
        <div className="saeb-interpretacao-comparacao">
          <h5>
            Comparação com {comparacao.edicaoAnterior}
          </h5>
          <p>
            {formatarValorIndicador(comparacao.valorAnterior)} em {comparacao.edicaoAnterior} → {formatarValorIndicador(comparacao.valorAtual)} em{" "}
            {comparacao.edicaoAtual}
            {" "}
            <strong>
              (
              {comparacao.direcao === "aumento" && `aumento de ${formatarValorIndicador(Math.abs(comparacao.diferenca))} pontos`}
              {comparacao.direcao === "reducao" && `redução de ${formatarValorIndicador(Math.abs(comparacao.diferenca))} pontos`}
              {comparacao.direcao === "estavel" && "sem variação"}
              )
            </strong>
          </p>
          <p className="saeb-interpretacao-caveat">
            <HelpCircle size={15} aria-hidden="true" /> Essa diferença descreve apenas a variação entre as duas edições — ela não prova, sozinha,
            que algo específico causou o resultado, nem que houve melhora ou piora no trabalho da escola.
          </p>
        </div>
      )}
      {!comparacao && temValorAtual && edicaoAnterior === null && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> Não há uma edição documentada anterior a {edicao} para comparar, nesta escala.
        </p>
      )}

      {/* 6 — Limites da interpretação (sempre presente quando há algum valor a comentar) */}
      {temValorAtual && (
        <div className="saeb-interpretacao-limites">
          <p className="saeb-interpretacao-caveat">
            <HelpCircle size={15} aria-hidden="true" /> Esta é a média da escola nesta edição — ela não descreve o desempenho de cada estudante
            individualmente; alunos da mesma escola podem estar em níveis diferentes.
          </p>
          <p className="saeb-interpretacao-caveat">
            <HelpCircle size={15} aria-hidden="true" />
            <span>
              Esta ferramenta classifica apenas a média da escola dentro da escala oficial — o conjunto de dados importado não contém a
              distribuição percentual de estudantes por nível. Quando essa distribuição existir para a escola, ela está no{" "}
              <a href={BOLETIM_ESCOLA_URL} target="_blank" rel="noopener noreferrer">
                Boletim da Escola, na consulta oficial do Inep
              </a>{" "}
              — este painel não a preenche automaticamente.
            </span>
          </p>
        </div>
      )}

      {estado.tipo === "observacao_nao_confirmada" && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> O resultado divulgado ({formatarValorIndicador(estado.valor)}) traz uma ressalva oficial:
          &ldquo;{estado.observacao}&rdquo;. {estado.motivo} Por isso, nenhuma faixa da escala é indicada para esta edição deste indicador.
        </p>
      )}

      {estado.tipo === "fora_do_piloto" && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> {estado.motivo}
        </p>
      )}

      {estado.tipo === "edicao_nao_documentada" && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> {estado.motivo} Escolha outra edição no seletor da consulta para ver a interpretação — este
          painel não troca a edição selecionada automaticamente.
        </p>
      )}

      {estado.tipo === "invalido" && (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> {estado.motivo}
        </p>
      )}

      {/* 7 — Fonte oficial, só quando há escala/quadro/página concretos para citar */}
      {estado.tipo === "resolvido" && (
        <p className="saeb-fonte">
          Fonte:{" "}
          <a
            href={catalogoEscalas.fonte.url}
            target="_blank"
            rel="noopener noreferrer"
            aria-label={`Abrir ${catalogoEscalas.fonte.titulo} no site do Inep`}
          >
            {catalogoEscalas.fonte.titulo}
          </a>{" "}
          — {catalogoEscalas.fonte.orgao}, {catalogoEscalas.fonte.versaoPublicacao}. Matriz de referência 2001, {estado.escala.quadro}, página
          impressa {estado.faixa.paginasImpressas.join(", ")} do documento (PDF: {estado.faixa.paginasPdf.join(", ")}).
        </p>
      )}
    </section>
  );
}
