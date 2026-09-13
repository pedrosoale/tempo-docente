"use client";

// Dashboard histórico opcional (ver C:\ProjetosIA\saeb-dashboard-historico-relatorio.html) — só
// relê a MESMA partição que a consulta por edição já carregou (prop `escola`, recebida de
// SaebConsulta.tsx). Nenhuma chamada de rede vive aqui: abrir o painel, trocar indicador, etapa ou
// período são só recomputações de lib/saeb/historico.ts sobre dados já em memória.
import { useId, useMemo, useState } from "react";
import { HelpCircle, LineChart as LineChartIcon, Table2, X } from "lucide-react";
import { CartesianGrid, Line, LineChart, ResponsiveContainer, XAxis, YAxis, Tooltip as RechartsTooltip } from "recharts";
import type { DotItemDotProps } from "recharts";
import {
  ETAPA_LABEL,
  INDICADOR_LABEL,
  PACOTE_DIVULGACAO_TEXTO,
  UNIDADE_INDICADOR_HISTORICO,
} from "@/lib/saeb/labels";
import { etapasDisponiveis, formatarValorIndicador } from "@/lib/saeb/registro";
import {
  construirSerieHistorica,
  contarResultadosELacunas,
  decidirExibicao,
  dominioEixoVertical,
  gerarResumoHistorico,
  INDICADORES_HISTORICO,
  intervaloDaSerie,
  pontosParaGrafico,
  recortarPeriodo,
  textoResumoHistorico,
  TEXTO_GRUPOS_DIFERENTES,
  type PontoGrafico,
} from "@/lib/saeb/historico";
import type { CampoIndicador, Escola, Etapa, Municipio } from "@/lib/saeb/types";

const COR_LINHA = "#0d8f76";
const COR_OBSERVACAO = "#12355b";
const COR_GRADE = "#dfe7e5";
const COR_EIXO = "#66788a";

interface Periodo {
  inicio: number;
  fim: number;
}

export default function HistoricoEscola({
  escola,
  municipio,
  etapaInicial,
  onFechar,
}: {
  escola: Escola;
  municipio: Municipio | null;
  etapaInicial: Etapa | null;
  onFechar: () => void;
}) {
  const headingId = useId();
  const etapasPossiveis = useMemo(() => etapasDisponiveis(escola), [escola]);

  const [indicador, setIndicador] = useState<CampoIndicador>("mt");
  const [etapa, setEtapa] = useState<Etapa | null>(etapaInicial && etapasPossiveis.includes(etapaInicial) ? etapaInicial : (etapasPossiveis[0] ?? null));
  const [periodo, setPeriodo] = useState<Periodo | null>(null);
  const [modo, setModo] = useState<"grafico" | "tabela">("grafico");

  const serieCompleta = useMemo(() => (etapa ? construirSerieHistorica(escola, etapa, indicador) : []), [escola, etapa, indicador]);
  const intervaloCompleto = useMemo(() => intervaloDaSerie(serieCompleta), [serieCompleta]);
  const periodoEfetivo: Periodo | null = useMemo(
    () => periodo ?? (intervaloCompleto ? { inicio: intervaloCompleto.min, fim: intervaloCompleto.max } : null),
    [periodo, intervaloCompleto],
  );

  const serieRecortada = useMemo(
    () => (periodoEfetivo ? recortarPeriodo(serieCompleta, periodoEfetivo.inicio, periodoEfetivo.fim) : []),
    [serieCompleta, periodoEfetivo],
  );
  const pontos = useMemo(() => pontosParaGrafico(serieRecortada), [serieRecortada]);
  const dominioY = useMemo(() => dominioEixoVertical(serieCompleta), [serieCompleta]);
  const resumo = useMemo(() => gerarResumoHistorico(serieRecortada), [serieRecortada]);
  const contagem = useMemo(() => contarResultadosELacunas(serieRecortada), [serieRecortada]);

  const anosDisponiveis = useMemo(() => serieCompleta.map((p) => p.ano), [serieCompleta]);
  const info = INDICADOR_LABEL[indicador];
  const unidade = UNIDADE_INDICADOR_HISTORICO[indicador] ?? "";

  function selecionarEtapa(novaEtapa: Etapa) {
    setEtapa(novaEtapa);
    setPeriodo(null); // o período é relativo às edições da etapa — trocar etapa recomeça do intervalo completo dela
  }

  function mudarInicio(novoAno: number) {
    if (!periodoEfetivo) return;
    setPeriodo({ inicio: novoAno, fim: Math.max(novoAno, periodoEfetivo.fim) });
  }

  function mudarFim(novoAno: number) {
    if (!periodoEfetivo) return;
    setPeriodo({ inicio: Math.min(periodoEfetivo.inicio, novoAno), fim: novoAno });
  }

  const textoResumo = textoResumoHistorico(resumo, info, formatarValorIndicador);
  const observacoes = [
    resumo.tipo === "comparacao" || resumo.tipo === "sem_comparacao" ? resumo.observacaoReferencia : undefined,
    resumo.tipo === "comparacao" ? resumo.observacaoAnterior : undefined,
  ].filter((v): v is string => Boolean(v));

  const resumoAcessivelGrafico = `Gráfico de evolução de ${info.label} — ${ETAPA_LABEL[etapa as Etapa]}, de ${periodoEfetivo?.inicio} a ${periodoEfetivo?.fim}. ${contagem.comResultado} edição(ões) com resultado e ${contagem.lacunas} lacuna(s) de divulgação no período. Ative "Tabela" para ver todos os valores.`;

  // Ver lib/saeb/historico.ts (decidirExibicao) para a regra: um período sem nenhum resultado
  // numérico força a tabela de ausências a aparecer mesmo com "Gráfico" selecionado, sem nunca
  // tocar no estado `modo` em si — ao voltar a um período com valores, o modo escolhido volta a
  // valer.
  const semResultadoNoPeriodo = contagem.comResultado === 0;
  const { mostrarGrafico, mostrarTabela } = decidirExibicao(modo, contagem);

  return (
    <section className="saeb-historico" aria-labelledby={headingId}>
      <div className="saeb-historico-head">
        <h4 id={headingId}>Evolução de {escola.nome}</h4>
        <button type="button" className="saeb-historico-close" onClick={onFechar} aria-label="Fechar evolução histórica">
          <X size={18} aria-hidden="true" />
        </button>
      </div>

      <p className="saeb-historico-id">
        Código INEP {escola.codigoInep} · {municipio ? `${municipio.nome}/${municipio.uf}` : "Município não identificado"} · Fonte: MEC/Inep
      </p>

      {etapasPossiveis.length === 0 || !etapa ? (
        <p className="saeb-hint">
          <HelpCircle size={15} aria-hidden="true" /> Esta escola não tem nenhum resultado divulgado para montar uma evolução histórica.
        </p>
      ) : (
        <>
          <div className="saeb-selects saeb-historico-controls">
            <label>
              Indicador
              <select value={indicador} onChange={(e) => setIndicador(e.target.value as CampoIndicador)}>
                {INDICADORES_HISTORICO.map((campo) => (
                  <option key={campo} value={campo}>
                    {INDICADOR_LABEL[campo].label}
                  </option>
                ))}
              </select>
            </label>
            <label>
              Etapa
              <select value={etapa} onChange={(e) => selecionarEtapa(e.target.value as Etapa)}>
                {etapasPossiveis.map((et) => (
                  <option key={et} value={et}>
                    {ETAPA_LABEL[et]}
                  </option>
                ))}
              </select>
            </label>
            {periodoEfetivo && (
              <>
                <label>
                  De
                  <select value={periodoEfetivo.inicio} onChange={(e) => mudarInicio(Number(e.target.value))}>
                    {anosDisponiveis.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Até
                  <select value={periodoEfetivo.fim} onChange={(e) => mudarFim(Number(e.target.value))}>
                    {anosDisponiveis.map((ano) => (
                      <option key={ano} value={ano}>
                        {ano}
                      </option>
                    ))}
                  </select>
                </label>
              </>
            )}
          </div>

          <div className="saeb-historico-toggle" role="group" aria-label="Formato de exibição da evolução">
            <button type="button" aria-pressed={modo === "grafico"} onClick={() => setModo("grafico")}>
              <LineChartIcon size={15} aria-hidden="true" /> Gráfico
            </button>
            <button type="button" aria-pressed={modo === "tabela"} onClick={() => setModo("tabela")}>
              <Table2 size={15} aria-hidden="true" /> Tabela
            </button>
          </div>

          {periodoEfetivo && semResultadoNoPeriodo && (
            <p className="saeb-hint">
              <HelpCircle size={15} aria-hidden="true" /> Nenhuma edição com resultado numérico de {info.label} nesta etapa, no período de{" "}
              {periodoEfetivo.inicio} a {periodoEfetivo.fim} ({contagem.lacunas} lacuna(s) de divulgação). A tabela abaixo lista o motivo de cada
              edição.
            </p>
          )}

          {periodoEfetivo && mostrarGrafico && (
            <div className="saeb-historico-chart" role="img" aria-label={resumoAcessivelGrafico}>
              <ResponsiveContainer width="100%" height={260}>
                <LineChart data={pontos} margin={{ top: 10, right: 18, bottom: 4, left: 0 }}>
                  <CartesianGrid strokeDasharray="3 3" stroke={COR_GRADE} vertical={false} />
                  <XAxis
                    dataKey="ano"
                    type="number"
                    domain={[periodoEfetivo.inicio, periodoEfetivo.fim]}
                    ticks={pontos.map((p) => p.ano)}
                    tick={{ fontSize: 11, fill: COR_EIXO }}
                    stroke={COR_GRADE}
                    allowDecimals={false}
                  />
                  <YAxis
                    domain={dominioY ?? [0, 1]}
                    tick={{ fontSize: 11, fill: COR_EIXO }}
                    stroke={COR_GRADE}
                    tickFormatter={(v: number) => formatarValorIndicador(v)}
                    width={44}
                  />
                  <RechartsTooltip content={(props) => <HistoricoTooltip {...props} pontos={pontos} unidade={unidade} />} />
                  <Line
                    dataKey="valor"
                    stroke={COR_LINHA}
                    strokeWidth={2}
                    connectNulls={false}
                    isAnimationActive={false}
                    dot={(dotProps: DotItemDotProps) => <HistoricoDot {...dotProps} />}
                    activeDot={{ r: 6 }}
                  />
                </LineChart>
              </ResponsiveContainer>
              <p className="saeb-historico-legenda">
                <span className="saeb-historico-legenda-item">
                  <span className="saeb-historico-marcador saeb-historico-marcador-valor" aria-hidden="true" /> Resultado divulgado
                </span>
                <span className="saeb-historico-legenda-item">
                  <span className="saeb-historico-marcador saeb-historico-marcador-obs" aria-hidden="true" /> Com observação oficial (ver tabela)
                </span>
                <span className="saeb-historico-legenda-item">Linha interrompida = lacuna de divulgação, nunca lida como zero</span>
              </p>
            </div>
          )}

          {periodoEfetivo && mostrarTabela && <HistoricoTabela pontos={pontos} unidade={unidade} />}

          <div className="saeb-historico-resumo">
            <p>{textoResumo}</p>
            {observacoes.map((obs, i) => (
              <p key={i} className="saeb-historico-observacao">
                {obs}
              </p>
            ))}
            {periodoEfetivo && (
              <p className="saeb-historico-contagem">
                {contagem.comResultado} edição(ões) com resultado e {contagem.lacunas} lacuna(s) de divulgação no período de {periodoEfetivo.inicio} a{" "}
                {periodoEfetivo.fim}.
              </p>
            )}
          </div>

          <p className="saeb-hint">
            <HelpCircle size={15} aria-hidden="true" /> {TEXTO_GRUPOS_DIFERENTES}
          </p>

          <p className="saeb-fonte">
            Edição do resultado: {resumo.tipo === "comparacao" || resumo.tipo === "sem_comparacao" || resumo.tipo === "sem_valor_na_referencia" ? resumo.edicaoReferencia : "—"}
            {" · "}
            {PACOTE_DIVULGACAO_TEXTO}
          </p>
        </>
      )}
    </section>
  );
}

function HistoricoDot(props: DotItemDotProps) {
  const { cx, cy, payload } = props;
  const ponto = payload as PontoGrafico | undefined;
  if (typeof cx !== "number" || typeof cy !== "number" || !ponto || ponto.valor === null) return null;
  if (ponto.observacao) {
    return (
      <g>
        <circle cx={cx} cy={cy} r={6} fill="#ffffff" stroke={COR_OBSERVACAO} strokeWidth={2} />
        <circle cx={cx} cy={cy} r={2} fill={COR_OBSERVACAO} />
      </g>
    );
  }
  return <circle cx={cx} cy={cy} r={4} fill={COR_LINHA} stroke="#ffffff" strokeWidth={1} />;
}

function HistoricoTooltip({
  active,
  label,
  pontos,
  unidade,
}: {
  active?: boolean;
  label?: number | string;
  pontos: PontoGrafico[];
  unidade: string;
}) {
  if (!active || label === undefined) return null;
  const ponto = pontos.find((p) => p.ano === Number(label));
  if (!ponto) return null;
  return (
    <div className="saeb-historico-tooltip">
      <strong>Edição {ponto.edicao}</strong>
      {ponto.valor !== null ? (
        <>
          <span>
            {formatarValorIndicador(ponto.valor)} {unidade}
          </span>
          {ponto.observacao && <small>{ponto.observacao}</small>}
        </>
      ) : (
        <span className="saeb-historico-tooltip-lacuna">Lacuna de divulgação — {ponto.situacao}</span>
      )}
    </div>
  );
}

function HistoricoTabela({ pontos, unidade }: { pontos: PontoGrafico[]; unidade: string }) {
  return (
    <div className="saeb-historico-tabela-wrap">
      <table className="saeb-historico-tabela">
        <caption className="sr-only">Valores de evolução histórica, os mesmos exibidos no gráfico</caption>
        <thead>
          <tr>
            <th scope="col">Edição</th>
            <th scope="col">Resultado</th>
            <th scope="col">Observação</th>
          </tr>
        </thead>
        <tbody>
          {pontos.map((ponto) => (
            <tr key={ponto.edicao}>
              <td>{ponto.edicao}</td>
              <td>
                {ponto.valor !== null ? (
                  `${formatarValorIndicador(ponto.valor)} ${unidade}`
                ) : (
                  <span className="saeb-ausente">Lacuna — {ponto.situacao}</span>
                )}
              </td>
              <td>{ponto.observacao ?? "—"}</td>
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
