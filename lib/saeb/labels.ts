// Nomenclatura e explicações em linguagem corrente para o SAEB/Ideb. Espelha deliberadamente
// MARCADORES_AUSENCIA e INDICADORES de scripts/saeb/lib/normalize.mjs e scripts/saeb/lib/sources.mjs
// (mesmo padrão de lib/saresp/labels.ts: a app não importa scripts/*). Qualquer novo estado de
// ausência ou indicador precisa ser adicionado aqui manualmente — nunca inventar um motivo que não
// esteja nesta lista.
import type { CampoIndicador, EstadoAusencia, Etapa } from "./types.ts";

export const MOTIVO_POR_ESTADO_AUSENCIA: Record<EstadoAusencia, string> = {
  nao_divulgado_material_extraviado:
    "Escola com pelo menos 20% do material extraviado, com participação insuficiente para divulgação dos resultados.",
  nao_divulgado_a_pedido: "Não divulgado por solicitação da Secretaria ou da escola, por situações adversas no momento da aplicação.",
  nao_divulgado_por_norma:
    "Solicitação de não divulgação conforme Portaria Inep nº 410, de 3 de novembro de 2011, ou Portaria Inep nº 304, de 24 de junho de 2013.",
  participacao_insuficiente: "Número de participantes no SAEB insuficiente para que os resultados sejam divulgados.",
  ausente: "Sem resultado nesta edição: etapa não avaliada, ou escola inexistente ou sem a etapa na ocasião.",
};

export const OBSERVACAO_AVALIACAO_ESTADUAL_TEXTO =
  "Média calculada a partir dos resultados dos alunos nas avaliações estaduais, em decorrência do extravio de provas e impossibilidade do cálculo da proficiência para o SAEB.";

export const ETAPA_LABEL: Record<Etapa, string> = {
  anosIniciais: "Ensino Fundamental — Anos Iniciais",
  anosFinais: "Ensino Fundamental — Anos Finais",
  ensinoMedio: "Ensino Médio",
};

export interface DescricaoIndicador {
  label: string;
  descricao: string;
  /** "saeb" = proficiência medida diretamente pela avaliação; "ideb" = Ideb ou um de seus componentes. */
  grupo: "saeb" | "ideb";
}

export const INDICADOR_LABEL: Record<CampoIndicador, DescricaoIndicador> = {
  lp: { label: "Língua Portuguesa", descricao: "Proficiência média em Língua Portuguesa, na escala do SAEB.", grupo: "saeb" },
  mt: { label: "Matemática", descricao: "Proficiência média em Matemática, na escala do SAEB.", grupo: "saeb" },
  ideb: { label: "Ideb", descricao: "Ideb observado — combina a proficiência do SAEB (N) com o rendimento escolar (P).", grupo: "ideb" },
  n: { label: "Nota padronizada (N)", descricao: "Nota padronizada N, base SAEB 1997, escala 0 a 10.", grupo: "ideb" },
  p: { label: "Indicador de rendimento (P)", descricao: "Indicador de rendimento P, derivado do Censo Escolar.", grupo: "ideb" },
  meta: { label: "Meta projetada", descricao: "Meta projetada para a escola; existe apenas até 2021.", grupo: "ideb" },
};

/** Ordem de exibição dentro de cada grupo — não a ordem alfabética nem a de INDICADORES. */
export const ORDEM_INDICADORES_SAEB: CampoIndicador[] = ["lp", "mt"];
export const ORDEM_INDICADORES_IDEB: CampoIndicador[] = ["ideb", "n", "p", "meta"];

/**
 * Unidade exibida no dashboard histórico (lib/saeb/historico.ts) — só os três indicadores que ele
 * expõe (Matemática, Língua Portuguesa, Ideb). Nunca "%" nem qualquer unidade que sugira uma escala
 * de 0 a 100: a proficiência do SAEB não é percentual, e o Ideb é um índice próprio, não pontos.
 */
export const UNIDADE_INDICADOR_HISTORICO: Partial<Record<CampoIndicador, string>> = {
  lp: "pontos na escala de proficiência do SAEB",
  mt: "pontos na escala de proficiência do SAEB",
  ideb: "índice Ideb (0 a 10)",
};

/**
 * Espelha, em linguagem corrente, o que scripts/saeb/lib/sources.mjs registra sobre os pacotes
 * oficiais (EDICAO_PILOTO = "2025", PACOTES): a série 2005–2025 inteira de cada escola vem de UM
 * único pacote de divulgação, publicado em 2025, que republica o histórico de várias edições de
 * uma vez. Edição (o ano do resultado avaliado) e pacote (o ano em que o Inep publicou o arquivo)
 * são conceitos distintos, mas NÃO são mutuamente exclusivos: um pacote pode, e neste dataset de
 * fato reúne, resultados de diversas edições — inclusive da edição do mesmo ano do próprio pacote
 * (a edição 2025 é divulgada dentro do pacote 2025). Texto estático (não lido do dado publicado)
 * porque o formato de fio atual (lib/saeb/types.ts) não carrega essa informação por registro;
 * mudar isso exigiria alterar o importador e regenerar os dados, fora do escopo desta rodada.
 */
export const PACOTE_DIVULGACAO_TEXTO =
  "Pacote de divulgação de origem: Ideb por escola, divulgação 2025 (Inep). O ano da edição identifica o resultado apresentado. O pacote de divulgação pode reunir resultados de diferentes edições, inclusive do mesmo ano indicado no pacote.";
