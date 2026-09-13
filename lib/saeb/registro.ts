// Leitura pura dos registros de uma escola — nenhuma chamada de rede, nenhum estado de UI.
// Responsável por distinguir os quatro jeitos de "não ter número" que scripts/saeb/lib/normalize.mjs
// produz (ver o comentário no topo daquele arquivo): valor genuíno (inclusive zero), ausência
// oficial nomeada, indicador não informado dentro de uma edição existente, e edição/etapa inteira
// ausente. Nunca inventa motivo, faixa ou classificação.
import { MOTIVO_POR_ESTADO_AUSENCIA, OBSERVACAO_AVALIACAO_ESTADUAL_TEXTO } from "./labels.ts";
import type { CampoIndicador, Escola, Etapa, RegistroEdicao } from "./types.ts";

const ORDEM_ETAPAS: Etapa[] = ["anosIniciais", "anosFinais", "ensinoMedio"];

/** Etapas em que a escola tem ao menos uma edição registrada, na ordem canônica (não a de inserção). */
export function etapasDisponiveis(escola: Escola): Etapa[] {
  return ORDEM_ETAPAS.filter((etapa) => escola.etapas[etapa] !== undefined);
}

/** Edições (anos) com ao menos um indicador registrado para a etapa dada, em ordem crescente. */
export function edicoesDisponiveis(escola: Escola, etapa: Etapa): string[] {
  const registros = escola.etapas[etapa];
  if (!registros) return [];
  return Object.keys(registros).sort();
}

export type IndicadorResolvido =
  | { tipo: "valor"; valor: number; observacao?: string }
  | { tipo: "ausente_oficial"; estado: keyof typeof MOTIVO_POR_ESTADO_AUSENCIA; motivo: string }
  | { tipo: "nao_informado" };

/**
 * Resolve uma célula de indicador dentro de um registro de edição já carregado. `registro`
 * ausente (edição inteira sem dados) e campo ausente dentro de um registro existente são
 * distinguidos pelo CHAMADOR (ver edicoesDisponiveis) — aqui os dois produzem "nao_informado"
 * porque, do ponto de vista de "este número existe?", a resposta é a mesma; a UI decide se
 * quer diferenciar visualmente edição inteira ausente de indicador isolado ausente.
 */
export function resolverIndicador(registro: RegistroEdicao | undefined, campo: CampoIndicador): IndicadorResolvido {
  if (!registro) return { tipo: "nao_informado" };
  const bruto = registro[campo];
  if (bruto === undefined) return { tipo: "nao_informado" };
  if (typeof bruto === "number") return { tipo: "valor", valor: bruto };
  if ("estado" in bruto) {
    return { tipo: "ausente_oficial", estado: bruto.estado, motivo: MOTIVO_POR_ESTADO_AUSENCIA[bruto.estado] };
  }
  return {
    tipo: "valor",
    valor: bruto.valor,
    observacao: bruto.obs === "avaliacao_estadual" ? OBSERVACAO_AVALIACAO_ESTADUAL_TEXTO : undefined,
  };
}

/** Formata um valor de indicador para exibição — preserva zero; nunca usado para "ausente"/"nao_informado". */
export function formatarValorIndicador(valor: number): string {
  return valor.toLocaleString("pt-BR", { maximumFractionDigits: 2 });
}
