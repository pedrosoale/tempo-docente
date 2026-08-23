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

export type CompetenciaEspecificaMedio = RegistroBase & {
  tipo: "competencia_especifica";
  etapa: "Ensino Médio";
  codigo: null;
  // Uma das 4 áreas do conhecimento do Ensino Médio. Língua Portuguesa não
  // tem competências específicas próprias — suas habilidades referenciam as
  // de Linguagens e suas Tecnologias (ver HabilidadeMedio.competencias_especificas).
  area: string;
  numero: number;
};

export type HabilidadeMedio = RegistroBase & {
  tipo: "habilidade";
  etapa: "Ensino Médio";
  codigo: string;
  area: string;
  // Igual a `area` nas 4 áreas do conhecimento; difere só para Língua
  // Portuguesa ("Língua Portuguesa" dentro da área "Linguagens e suas
  // Tecnologias"), mesmo padrão de área vs. componente já usado em
  // HabilidadeFundamental.
  componente: string;
  // Referencia o(s) número(s) de CompetenciaEspecificaMedio da área. Nas 4
  // áreas "simples" vem do próprio código (1 elemento); em Língua Portuguesa
  // vem de uma coluna própria no documento oficial e pode ter mais de um
  // valor (uma habilidade pode servir a mais de uma competência).
  competencias_especificas: number[];
  // Exclusivo de Língua Portuguesa (organizada por campo de atuação social,
  // não por competência específica).
  campo_atuacao?: string;
  // Exclusivo de Matemática — vem de uma tabela oficial separada que
  // reagrupa as mesmas habilidades por unidade temática (Números e Álgebra,
  // Geometria e Medidas, Probabilidade e Estatística). Ausente nas demais
  // áreas, que não têm essa segunda tabela no documento oficial.
  unidade_tematica?: string;
};

// Educação Infantil — a BNCC nunca chama estes registros de "habilidade": o
// rótulo oficial é "objetivo de aprendizagem e desenvolvimento" para os 93
// itens codificados (código EI...) e "direito de aprendizagem e
// desenvolvimento" para os 6 sem código. Nenhum dos dois tem "ano"/
// "anos_aplicaveis" (a Educação Infantil não é seriada), nem "componente"/
// "área"/"unidade_tematica"/"objeto_conhecimento" (não organiza por
// componente curricular) — a chave própria é campo de experiências × grupo
// por faixa etária.
export type ObjetivoInfantil = RegistroBase & {
  tipo: "objetivo_aprendizagem";
  etapa: "Educação Infantil";
  codigo: string;
  campo_experiencia: string;
  campo_experiencia_sigla: "EO" | "CG" | "TS" | "EF" | "ET";
  faixa_etaria: "Bebês" | "Crianças bem pequenas" | "Crianças pequenas";
  faixa_etaria_codigo: "01" | "02" | "03";
  // Texto oficial por extenso ("1 ano e 7 meses a 3 anos e 11 meses") — nunca
  // um formato aproximado inventado (ex.: "0–1,5 anos").
  faixa_etaria_descricao: string;
};

export type DireitoAprendizagem = RegistroBase & {
  tipo: "direito_aprendizagem";
  etapa: "Educação Infantil";
  // A fonte não atribui código nem número de ordem aos 6 direitos — nunca
  // inventar um para caber no padrão de HabilidadeFundamental/HabilidadeMedio.
  codigo: null;
  nome: string;
  slug: string;
};

export type BnccRegistro = CompetenciaGeral | HabilidadeFundamental | CompetenciaEspecificaMedio | HabilidadeMedio | ObjetivoInfantil | DireitoAprendizagem;
