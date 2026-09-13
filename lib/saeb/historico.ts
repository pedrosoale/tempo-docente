// Preparação pura da série histórica de um indicador da escola — nenhuma chamada de rede, nenhum
// estado de UI. A fonte é sempre a MESMA partição já carregada pelo cliente (ver lib/saeb/client.ts):
// o dashboard histórico nunca dispara uma requisição própria, só relê os registros que a escola já
// trouxe consigo (ver comentário em HistoricoEscola.tsx). Mesma disciplina de lib/saeb/registro.ts:
// nunca inventa uma edição, nunca converte ausência em zero, nunca soma componentes.
import type { DescricaoIndicador } from "./labels.ts";
import { edicoesDisponiveis, resolverIndicador, type IndicadorResolvido } from "./registro.ts";
import type { CampoIndicador, Escola, Etapa } from "./types.ts";

/** Os três únicos indicadores expostos pelo dashboard histórico, na ordem de exibição pedida. */
export const INDICADORES_HISTORICO: readonly CampoIndicador[] = ["mt", "lp", "ideb"];

export interface PontoHistorico {
  edicao: string;
  ano: number;
  resolvido: IndicadorResolvido;
}

/**
 * Um ponto por edição em que a escola tem QUALQUER registro nesta etapa — nunca inventa uma edição
 * que não exista no dataset, mesmo que o indicador pedido esteja ausente/não informado só nela.
 * Ordem cronológica crescente (edicoesDisponiveis já ordena as chaves).
 */
export function construirSerieHistorica(escola: Escola, etapa: Etapa, campo: CampoIndicador): PontoHistorico[] {
  const registros = escola.etapas[etapa];
  return edicoesDisponiveis(escola, etapa).map((edicao) => ({
    edicao,
    ano: Number(edicao),
    resolvido: resolverIndicador(registros?.[edicao], campo),
  }));
}

export interface IntervaloAnos {
  min: number;
  max: number;
}

/** Intervalo de anos coberto pela série COMPLETA — null se a escola não tem nenhuma edição nesta etapa. */
export function intervaloDaSerie(serie: readonly PontoHistorico[]): IntervaloAnos | null {
  if (serie.length === 0) return null;
  const anos = serie.map((p) => p.ano);
  return { min: Math.min(...anos), max: Math.max(...anos) };
}

/** Recorte por período, inclusive nos dois extremos — nunca fabrica uma edição fora da série completa. */
export function recortarPeriodo(serie: readonly PontoHistorico[], anoInicial: number, anoFinal: number): PontoHistorico[] {
  return serie.filter((p) => p.ano >= anoInicial && p.ano <= anoFinal);
}

export interface ContagemPeriodo {
  comResultado: number;
  lacunas: number;
}

/** Quantas edições do recorte têm valor e quantas são lacuna de divulgação (ausência oficial ou não informado). */
export function contarResultadosELacunas(serie: readonly PontoHistorico[]): ContagemPeriodo {
  let comResultado = 0;
  let lacunas = 0;
  for (const ponto of serie) {
    if (ponto.resolvido.tipo === "valor") comResultado += 1;
    else lacunas += 1;
  }
  return { comResultado, lacunas };
}

export type ModoExibicao = "grafico" | "tabela";

export interface DecisaoExibicao {
  mostrarGrafico: boolean;
  mostrarTabela: boolean;
}

/**
 * Decide o que HistoricoEscola.tsx efetivamente renderiza, dado o modo escolhido pelo usuário
 * (Gráfico/Tabela) e a contagem do recorte de período atual. Extraída como função pura — em vez de
 * ficar como booleans soltos dentro do componente — para poder ser testada sem depender de um DOM
 * (o projeto não usa jsdom/testing-library; ver o mesmo raciocínio em selection.ts).
 *
 * Um período sem NENHUM resultado numérico força a tabela de ausências a aparecer, mesmo que o
 * modo escolhido continue sendo "grafico": um gráfico vazio não comunica nada, e o motivo de cada
 * lacuna só é legível em texto/tabela. Note que `modoEscolhido` em si nunca é alterado por esta
 * função — ela só decide o que mostrar PARA ESTE recorte; ao voltar a um período com algum valor,
 * a mesma chamada com o mesmo `modoEscolhido` (não tocado nesse meio tempo) já reflete de volta a
 * escolha original do usuário.
 */
export function decidirExibicao(modoEscolhido: ModoExibicao, contagem: ContagemPeriodo): DecisaoExibicao {
  const semResultadoNoPeriodo = contagem.comResultado === 0;
  return {
    mostrarGrafico: modoEscolhido === "grafico" && !semResultadoNoPeriodo,
    mostrarTabela: modoEscolhido === "tabela" || semResultadoNoPeriodo,
  };
}

function valoresValidos(serie: readonly PontoHistorico[]): number[] {
  const valores: number[] = [];
  for (const ponto of serie) {
    if (ponto.resolvido.tipo === "valor") valores.push(ponto.resolvido.valor);
  }
  return valores;
}

/**
 * Teto do eixo vertical, calculado a partir da série COMPLETA — nunca do recorte de período. É
 * assim que a escala permanece consistente ao mudar só o período dentro do mesmo indicador/etapa:
 * reduzir o recorte não "dá zoom" nos valores restantes, o que exageraria uma variação pequena.
 * Piso sempre em zero (nenhum indicador desta rodada tem valor oficial negativo, e ancorar em
 * zero é o que evita que uma diferença de poucos pontos pareça, visualmente, uma queda dramática).
 * Retorna null quando a série completa não tem nenhum valor (nada para plotar).
 */
export function dominioEixoVertical(serieCompleta: readonly PontoHistorico[]): [number, number] | null {
  const valores = valoresValidos(serieCompleta);
  if (valores.length === 0) return null;
  const max = Math.max(...valores);
  if (max <= 0) return [0, 1];
  const passo = max <= 10 ? 0.5 : max <= 100 ? 10 : 50;
  const teto = Math.ceil((max * 1.15) / passo) * passo;
  return [0, teto];
}

export interface PontoGrafico {
  ano: number;
  edicao: string;
  /** null = lacuna de divulgação — nunca renderizado como zero, nunca conectado por interpolação. */
  valor: number | null;
  observacao?: string;
  /** Motivo em linguagem corrente, presente só quando valor é null. */
  situacao?: string;
}

/**
 * Uma única lista alimenta o gráfico e a tabela, para que os dois nunca divirjam entre si (ver
 * tests/saeb-historico.test.mjs).
 */
export function pontosParaGrafico(serie: readonly PontoHistorico[]): PontoGrafico[] {
  return serie.map((p) => {
    if (p.resolvido.tipo === "valor") {
      return { ano: p.ano, edicao: p.edicao, valor: p.resolvido.valor, observacao: p.resolvido.observacao };
    }
    if (p.resolvido.tipo === "ausente_oficial") {
      return { ano: p.ano, edicao: p.edicao, valor: null, situacao: p.resolvido.motivo };
    }
    return { ano: p.ano, edicao: p.edicao, valor: null, situacao: "Não informado nesta divulgação." };
  });
}

export type ResumoHistorico =
  | { tipo: "sem_dados" }
  | { tipo: "sem_valor_na_referencia"; edicaoReferencia: string }
  | { tipo: "sem_comparacao"; edicaoReferencia: string; valorReferencia: number; observacaoReferencia?: string }
  | {
      tipo: "comparacao";
      edicaoReferencia: string;
      valorReferencia: number;
      observacaoReferencia?: string;
      edicaoAnterior: string;
      valorAnterior: number;
      observacaoAnterior?: string;
      diferenca: number;
    };

/**
 * `edicaoReferencia` é sempre a edição mais recente do RECORTE de período — a "edição selecionada"
 * do painel. Nunca é substituída silenciosamente por outra edição quando falta valor: os tipos
 * sem_valor_na_referencia/sem_comparacao existem exatamente para tornar essa indisponibilidade
 * explícita, em vez de recuar para o ano anterior sem avisar.
 */
export function gerarResumoHistorico(serieRecortada: readonly PontoHistorico[]): ResumoHistorico {
  if (serieRecortada.length === 0) return { tipo: "sem_dados" };

  const referencia = serieRecortada[serieRecortada.length - 1];
  if (referencia.resolvido.tipo !== "valor") {
    return { tipo: "sem_valor_na_referencia", edicaoReferencia: referencia.edicao };
  }

  let anterior: PontoHistorico | undefined;
  for (let i = serieRecortada.length - 2; i >= 0; i -= 1) {
    if (serieRecortada[i].resolvido.tipo === "valor") {
      anterior = serieRecortada[i];
      break;
    }
  }

  if (!anterior || anterior.resolvido.tipo !== "valor") {
    return {
      tipo: "sem_comparacao",
      edicaoReferencia: referencia.edicao,
      valorReferencia: referencia.resolvido.valor,
      observacaoReferencia: referencia.resolvido.observacao,
    };
  }

  return {
    tipo: "comparacao",
    edicaoReferencia: referencia.edicao,
    valorReferencia: referencia.resolvido.valor,
    observacaoReferencia: referencia.resolvido.observacao,
    edicaoAnterior: anterior.edicao,
    valorAnterior: anterior.resolvido.valor,
    observacaoAnterior: anterior.resolvido.observacao,
    diferenca: referencia.resolvido.valor - anterior.resolvido.valor,
  };
}

/** "+3,2" / "−3,2" / "0" — arredondamento só para exibição; o cálculo em gerarResumoHistorico usa os valores originais. */
export function formatarDiferenca(valor: number): string {
  const arredondado = Math.round(valor * 100) / 100;
  if (arredondado === 0) return "0";
  const formatado = Math.abs(arredondado).toLocaleString("pt-BR", { maximumFractionDigits: 2 });
  return arredondado > 0 ? `+${formatado}` : `−${formatado}`;
}

/** Unidade da diferença exibida — nunca a mesma para proficiência (escala do SAEB) e Ideb (índice próprio). */
function unidadeDiferenca(grupo: DescricaoIndicador["grupo"]): string {
  return grupo === "ideb" ? "pontos no índice Ideb" : "pontos na escala de proficiência";
}

/**
 * Texto determinístico e verificável — nunca percentual, nunca qualificação ("melhora
 * significativa"), nunca causa presumida. A identidade do indicador (Ideb vs. proficiência) decide
 * o sujeito da frase pelo campo semântico `grupo` de DescricaoIndicador — NUNCA comparando o texto
 * de `label` (rótulo de apresentação), que poderia mudar sem que a lógica devesse mudar junto:
 * - Matemática/Língua Portuguesa (grupo "saeb"): "A proficiência média em X ..."
 * - Ideb (grupo "ideb"): "O Ideb da escola ..." — nunca "a média de Ideb", que não faz sentido
 *   (Ideb já É um índice calculado, não uma média de provas).
 */
export function textoResumoHistorico(
  resumo: ResumoHistorico,
  indicador: Pick<DescricaoIndicador, "label" | "grupo">,
  formatarValor: (v: number) => string,
): string {
  const { label, grupo } = indicador;
  switch (resumo.tipo) {
    case "sem_dados":
      return `Não há edições registradas para ${label} nesta etapa, no período selecionado.`;
    case "sem_valor_na_referencia":
      return `A edição ${resumo.edicaoReferencia} não tem resultado divulgado de ${label} — não é possível montar um resumo para ela.`;
    case "sem_comparacao": {
      const sujeito =
        grupo === "ideb"
          ? `O Ideb da escola na edição ${resumo.edicaoReferencia} foi`
          : `A proficiência média em ${label} na edição ${resumo.edicaoReferencia} foi`;
      return `${sujeito} ${formatarValor(resumo.valorReferencia)}. Não há edição anterior com resultado dentro do período selecionado para comparar.`;
    }
    case "comparacao": {
      const sujeito = grupo === "ideb" ? "O Ideb da escola" : `A proficiência média em ${label}`;
      return `${sujeito} passou de ${formatarValor(resumo.valorAnterior)} em ${resumo.edicaoAnterior} para ${formatarValor(resumo.valorReferencia)} em ${resumo.edicaoReferencia}, uma diferença de ${formatarDiferenca(resumo.diferenca)} ${unidadeDiferenca(grupo)}.`;
    }
  }
}

export const TEXTO_GRUPOS_DIFERENTES =
  "Cada edição avalia um grupo de estudantes diferente — a série compara grupos avaliados em edições distintas, não acompanha a evolução dos mesmos estudantes ao longo do tempo.";
