// Resolução pura da posição de uma média de proficiência na escala oficial do SAEB — nenhuma
// chamada de rede, nenhum estado de UI. Consome o mesmo IndicadorResolvido que o resto do módulo
// SAEB (ver lib/saeb/registro.ts) e o catálogo estático de lib/saeb/escalas.ts.
//
// Escopo deste piloto: 5º ano do Ensino Fundamental (Anos Iniciais), 9º ano do Ensino Fundamental
// (Anos Finais) e 3ª série do Ensino Médio, em Língua Portuguesa e Matemática, nas edições cuja
// associação à escala está documentada por etapa (ver edicoesAssociadas no catálogo).
//
// 2025 passou a fazer parte da classificação automática nesta rodada: a cartilha oficial "Saeb
// 2025 — Diretrizes da edição" afirma que, no 5º e 9º ano do ensino fundamental e na 3ª e 4ª série
// do ensino médio, os estudantes fazem as provas de Língua Portuguesa e Matemática "com o mesmo
// conteúdo das edições anteriores do Saeb, ligadas à matriz 2001", e a Nota Informativa do Ideb
// 2025 confirma que os resultados "são comparáveis com as edições anteriores" — ver o relatório do
// piloto para a citação completa. Uma edição só fica fora da classificação quando ela não aparece
// em `edicoesAssociadas` da escala (nunca por presumir continuidade a partir dos números).
import { buscarEscala, type ComponentePiloto, type EscalaComponente, type FaixaNivel } from "./escalas.ts";

export type { ComponentePiloto };
import type { IndicadorResolvido } from "./registro.ts";
import type { CampoIndicador, EstadoAusencia, Etapa } from "./types.ts";

export const PILOTO_ETAPAS: readonly Etapa[] = ["anosIniciais", "anosFinais", "ensinoMedio"];
export const PILOTO_COMPONENTES: readonly ComponentePiloto[] = ["lp", "mt"];

function ehComponentePiloto(campo: CampoIndicador): campo is ComponentePiloto {
  return campo === "lp" || campo === "mt";
}

export type EstadoInterpretacao =
  /** Média resolvida em uma faixa da escala — o único estado com faixa/escala para exibir. */
  | { tipo: "resolvido"; escala: EscalaComponente; faixa: FaixaNivel; valor: number }
  /**
   * Valor presente, mas com uma ressalva metodológica cuja aplicabilidade à escala não foi
   * confirmada nesta rodada (ex.: média calculada a partir de avaliação estadual). A ressalva é
   * preservada tal como veio do dado; nenhuma faixa é resolvida sem fundamentação específica.
   */
  | { tipo: "observacao_nao_confirmada"; valor: number; observacao: string; motivo: string }
  /** Ausência oficial nomeada (ND, ND*, ND**, ND***, "-") — nunca convertida em zero ou faixa. */
  | { tipo: "ausente_oficial"; estado: EstadoAusencia; motivo: string }
  /** Indicador não informado nesta edição, ou edição inteira ausente do registro da escola. */
  | { tipo: "nao_informado" }
  /** Etapa ou componente fora do escopo deste piloto (inclui Ideb/N/P/meta e qualquer etapa fora de 5º/9º ano e Ensino Médio). */
  | { tipo: "fora_do_piloto"; motivo: string }
  /** Edição sem associação documentada a esta escala — ver `edicoesAssociadas` no catálogo. */
  | { tipo: "edicao_nao_documentada"; motivo: string }
  /** Valor numérico inválido (NaN, Infinity, ou de outra forma não finito). */
  | { tipo: "invalido"; motivo: string };

export interface ResolverPosicaoNaEscalaInput {
  etapa: Etapa;
  componente: CampoIndicador;
  edicao: string;
  resultado: IndicadorResolvido;
}

/** Localiza a faixa cujo intervalo [limiteInferior, limiteSuperior) contém `valor` — limites nulos são abertos. */
function encontrarFaixa(escala: EscalaComponente, valor: number): FaixaNivel | undefined {
  return escala.niveis.find((faixa) => {
    const acimaDoPiso = faixa.limiteInferior === null || valor >= faixa.limiteInferior;
    const abaixoDoTeto = faixa.limiteSuperior === null || valor < faixa.limiteSuperior;
    return acimaDoPiso && abaixoDoTeto;
  });
}

/**
 * Resolve a posição de um resultado na escala oficial. Nunca arredonda, nunca arredonda/limita o
 * valor para caber na escala (um valor fora de qualquer faixa tabulada é uma falha de integridade
 * do catálogo, não uma entrada do usuário — ver validação em scripts/saeb-escalas/gerar.mjs, que
 * garante cobertura contínua de -∞ a +∞ antes de qualquer geração).
 */
export function resolverPosicaoNaEscala({ etapa, componente, edicao, resultado }: ResolverPosicaoNaEscalaInput): EstadoInterpretacao {
  if (!ehComponentePiloto(componente)) {
    return { tipo: "fora_do_piloto", motivo: "Este piloto interpreta apenas Língua Portuguesa e Matemática — nenhuma escala de proficiência se aplica a Ideb, N, P ou meta." };
  }
  if (!PILOTO_ETAPAS.includes(etapa)) {
    return { tipo: "fora_do_piloto", motivo: "Este piloto interpreta apenas o 5º ano e o 9º ano do Ensino Fundamental e a 3ª série do Ensino Médio." };
  }

  const escala = buscarEscala(etapa, componente);
  if (!escala) {
    return { tipo: "fora_do_piloto", motivo: "Não há escala de proficiência catalogada para este recorte." };
  }

  if (resultado.tipo === "nao_informado") return { tipo: "nao_informado" };
  if (resultado.tipo === "ausente_oficial") return { tipo: "ausente_oficial", estado: resultado.estado, motivo: resultado.motivo };

  const { valor, observacao } = resultado;
  if (typeof valor !== "number" || !Number.isFinite(valor)) {
    return { tipo: "invalido", motivo: "Valor de proficiência ausente ou não numérico." };
  }

  if (!escala.edicoesAssociadas.includes(edicao)) {
    return {
      tipo: "edicao_nao_documentada",
      motivo: `A associação da edição ${edicao} a esta escala de proficiência não está documentada neste piloto.`,
    };
  }

  if (observacao) {
    return {
      tipo: "observacao_nao_confirmada",
      valor,
      observacao,
      motivo: "A aplicabilidade desta escala a um resultado com essa ressalva não foi confirmada nesta rodada.",
    };
  }

  const faixa = encontrarFaixa(escala, valor);
  if (!faixa) {
    throw new Error(`Catálogo de escalas incompleto: nenhuma faixa cobre o valor ${valor} em ${etapa}/${componente}`);
  }

  return { tipo: "resolvido", escala, faixa, valor };
}

/** Texto curto do intervalo de uma faixa, no vocabulário oficial ("maior ou igual a X e menor que Y"). */
export function textoIntervalo(faixa: FaixaNivel): string {
  const fmt = (n: number) => n.toLocaleString("pt-BR");
  if (faixa.limiteInferior === null && faixa.limiteSuperior !== null) {
    return `menor que ${fmt(faixa.limiteSuperior)}`;
  }
  if (faixa.limiteInferior !== null && faixa.limiteSuperior === null) {
    return `maior ou igual a ${fmt(faixa.limiteInferior)}`;
  }
  if (faixa.limiteInferior !== null && faixa.limiteSuperior !== null) {
    return `maior ou igual a ${fmt(faixa.limiteInferior)} e menor que ${fmt(faixa.limiteSuperior)}`;
  }
  throw new Error("Faixa sem nenhum limite definido");
}

/**
 * A edição documentada imediatamente anterior a `edicaoAtual`, dentro da mesma escala — ou `null`
 * se `edicaoAtual` for a primeira edição documentada (ou não estiver na lista). Não presume uma
 * distância fixa de anos: apenas anda um passo para trás na lista de edições realmente associadas
 * a esta escala (`edicoesAssociadas`, já em ordem crescente), então uma etapa cuja série começa
 * depois (Ensino Médio, 2017+) nunca aponta para uma edição que ela não tem.
 */
export function edicaoAnteriorDocumentada(escala: EscalaComponente, edicaoAtual: string): string | null {
  const indice = escala.edicoesAssociadas.indexOf(edicaoAtual);
  if (indice <= 0) return null;
  return escala.edicoesAssociadas[indice - 1];
}

/** Resultado de comparar a mesma escola/etapa/componente entre duas edições — sempre a diferença
 * bruta entre médias, nunca a posição na escala (ver seção "Comparação com..." no painel: a
 * classificação por nível e a comparação numérica são dois cálculos independentes). */
export interface ComparacaoEdicoes {
  edicaoAtual: string;
  valorAtual: number;
  edicaoAnterior: string;
  valorAnterior: number;
  diferenca: number;
  direcao: "aumento" | "reducao" | "estavel";
}

/**
 * Compara o valor de duas edições da mesma escola/etapa/componente. Devolve `null` sempre que a
 * comparação não puder ser feita com segurança: quando qualquer um dos dois lados não for um valor
 * numérico simples (ausência, não informado, valor inválido) ou quando qualquer um dos dois carregue
 * uma ressalva oficial não confirmada (ver `observacao` em IndicadorResolvido) — uma média já
 * sinalizada pelo Inep como calculada em condição excepcional não deve alimentar uma diferença
 * numérica sem essa mesma ressalva. Nunca calcula significância estatística nem atribui causa à
 * diferença — isso é responsabilidade de quem lê o resultado, não desta função.
 */
export function compararComEdicaoAnterior(input: {
  edicaoAtual: string;
  resultadoAtual: IndicadorResolvido;
  edicaoAnterior: string;
  resultadoAnterior: IndicadorResolvido;
}): ComparacaoEdicoes | null {
  const { edicaoAtual, resultadoAtual, edicaoAnterior, resultadoAnterior } = input;
  if (resultadoAtual.tipo !== "valor" || resultadoAnterior.tipo !== "valor") return null;
  if (resultadoAtual.observacao || resultadoAnterior.observacao) return null;

  const diferenca = resultadoAtual.valor - resultadoAnterior.valor;
  const direcao = diferenca > 0 ? "aumento" : diferenca < 0 ? "reducao" : "estavel";
  return {
    edicaoAtual,
    valorAtual: resultadoAtual.valor,
    edicaoAnterior,
    valorAnterior: resultadoAnterior.valor,
    diferenca,
    direcao,
  };
}

/**
 * Níveis abaixo de `nivelAtual`, do imediatamente anterior ao mais baixo (ordem decrescente) —
 * nunca o próprio nível atual, nunca níveis posteriores. Consulta pura ao catálogo já em memória
 * (o mesmo `escala.niveis` usado por `resolverPosicaoNaEscala`); nenhuma requisição nova. Usada
 * pelo painel para a consulta opcional "Ver habilidades dos níveis anteriores" — cada item
 * devolvido é exibido com seu próprio controle de abrir/fechar, nunca misturado com outro nível.
 */
export function faixasAnteriores(escala: EscalaComponente, nivelAtual: number): FaixaNivel[] {
  return [...escala.niveis].filter((faixa) => faixa.nivel < nivelAtual).sort((a, b) => b.nivel - a.nivel);
}

/**
 * As duas únicas frases de abertura que o Inep usa, verbatim, no início da lista de habilidades de
 * todo nível tabulado > 0 (conferido nos 60 níveis do catálogo) — puramente uma ponte editorial do
 * PDF original para o nível anterior, que a interface agora contextualiza com uma frase própria
 * (ver `descricaoNivelSemIntroducaoOficial`). Omitidas só na apresentação — a string armazenada em
 * data/saeb-escalas/ nunca é alterada. Comparação por igualdade exata — nunca um "startsWith"
 * solto — para nunca cortar conteúdo real por engano caso o texto oficial mude.
 */
const INTRODUCOES_OFICIAIS_A_OMITIR = new Set([
  "Os estudantes provavelmente são capazes de:",
  "Além das habilidades anteriormente citadas, os estudantes provavelmente são capazes de:",
]);

/** As linhas de `faixa.descricaoOficial`, sem a frase de abertura editorial do Inep quando ela é
 * exatamente uma das duas conhecidas (ver `INTRODUCOES_OFICIAIS_A_OMITIR`) — nunca remove uma
 * primeira linha que não seja exatamente uma dessas duas, e nunca esvazia a descrição por completo. */
export function linhasDaDescricaoSemIntroducaoOficial(faixa: FaixaNivel): string[] {
  const linhas = faixa.descricaoOficial.split("\n");
  if (linhas.length > 1 && INTRODUCOES_OFICIAIS_A_OMITIR.has(linhas[0])) {
    return linhas.slice(1);
  }
  return linhas;
}

/**
 * Antepõe uma preposição+artigo definido ao nome do nível, só quando ele tem a forma "Nível N" —
 * "Abaixo do Nível 1" (nome do nível 0 em quatro das seis escalas — ver relatório do piloto) já é
 * uma locução completa e fica agramatical com outro artigo na frente ("o Abaixo do Nível 1", "no
 * Abaixo do Nível 1"); nesse caso a preposição é omitida e o nome entra sozinho na frase.
 */
export function comPreposicao(preposicao: "o" | "no", nomeNivel: string): string {
  return nomeNivel.startsWith("Nível") ? `${preposicao} ${nomeNivel}` : nomeNivel;
}
