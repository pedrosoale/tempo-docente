export type Proveniencia = {
  fonte: string;
  fonte_url: string;
  documento_url: string;
  versao_fonte: string;
  pagina_fonte?: number;
  classificacao: "dado_oficial";
  data_importacao: string;
  lote_importacao: string;
};

export type RegistroBase = Proveniencia & {
  id: string;
  codigo: string | null;
  tipo: "competencia_geral" | "habilidade" | "objetivo_aprendizagem" | "direito_aprendizagem" | "competencia_especifica";
  etapa: "Educação Básica" | "Educação Infantil" | "Ensino Fundamental" | "Ensino Médio";
  texto: string;
};

export type CompetenciaGeral = RegistroBase & {
  tipo: "competencia_geral";
  etapa: "Educação Básica";
  codigo: null;
  numero: number;
};

export type HabilidadeFundamental = RegistroBase & {
  tipo: "habilidade";
  etapa: "Ensino Fundamental";
  codigo: string;
  segmento: "Anos Iniciais" | "Anos Finais";
  area: string;
  componente: string;
  // Rótulo de exibição — pode descrever um único ano ("6º ano") ou uma faixa
  // oficial de anos agrupados pelo próprio código BNCC ("6º e 7º ano", "6º ao 9º ano").
  ano: string;
  // Todo ano ("Nº ano") ao qual o registro se aplica — sempre [ano] quando ano é
  // um único ano; usado para filtros e páginas por ano sem depender de casar a
  // string de exibição inteira.
  anos_aplicaveis: string[];
  // unidade_tematica e objeto_conhecimento existem para todo componente que
  // organiza sua tabela oficial por unidade temática (Matemática, Arte,
  // Educação Física, Ciências, Geografia, História, Ensino Religioso, Língua
  // Inglesa — esta com "eixo" como unidade_tematica). campo_atuacao é
  // exclusivo de Língua Portuguesa, que organiza por campo de atuação em vez
  // de unidade temática. Continuam opcionais porque um tipo de registro
  // diferente (ex.: Educação Infantil, quando importada) pode não usar
  // nenhum dos dois — nunca porque o componente atual careça do dado.
  unidade_tematica?: string;
  objeto_conhecimento?: string;
  campo_atuacao?: string;
};

// Educação Infantil e Ensino Médio entram aqui quando forem importados.
export type BnccRegistro = CompetenciaGeral | HabilidadeFundamental;
