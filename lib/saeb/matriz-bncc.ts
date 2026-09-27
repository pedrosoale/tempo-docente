// Catálogo da matriz de referência do SAEB ALINHADA À BNCC — Linguagens/Língua Portuguesa e
// Matemática, nas etapas 2º/5º/9º ano do Ensino Fundamental. Importado como módulo estático — o
// JSON é empacotado no bundle, não buscado em tempo de execução: nenhuma consulta aqui faz rede.
//
// data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json é gerado por
// scripts/saeb-matriz-bncc/gerar.mjs a partir da fonte hand-verified em
// data/saeb-matriz-bncc/source/official-inep-matrizes-bncc.json — nunca editar o arquivo gerado
// diretamente. Ver data/saeb-matriz-bncc/README.md e a Rodada 9 do relatório do piloto
// (C:\ProjetosIA\saeb-descritores-relatorio.html) para a auditoria documental completa.
//
// QUATRO CATÁLOGOS DISTINTOS, deliberadamente nunca misturados neste módulo nem em quem o consome:
//   - ESTE MÓDULO (matriz Saeb ALINHADA À BNCC): habilidades das matrizes publicadas pelo Inep em
//     2022 — Linguagens não tem código oficial (ver `CodigoOficialMatematica`, sempre `null` aqui
//     para Linguagens); Matemática tem código próprio desta matriz (ex.: "9G2.7"), que NUNCA reusa
//     nem se parece com os códigos "D<n>" da matriz TRADICIONAL.
//   - lib/saeb/descritores.ts (matriz TRADICIONAL, 2001): descritores codificados "D<n>" — outro
//     documento, outra estrutura (ver `Descritor` lá). Este módulo nunca importa nem reexporta nada
//     de lá, e `HabilidadeMatrizBncc.codigoOficial` nunca deve ser comparado a um `Descritor.codigo`
//     como se fossem o mesmo vocabulário.
//   - lib/bncc/types.ts (base curricular completa da BNCC): `HabilidadeFundamental`/`HabilidadeMedio`
//     têm campo `codigo` (não `codigoOficial`) e `etapa` num universo de valores completamente
//     diferente ("Ensino Fundamental" | "Ensino Médio", não "2anoEF" | "5anoEF" | "9anoEF") — a
//     matriz Saeb–BNCC é um RECORTE avaliativo, nunca o currículo inteiro, e nenhuma associação
//     automática entre uma habilidade daqui e um código curricular da BNCC é feita neste módulo.
//   - data/saeb-escalas (escalas de proficiência): réguas numéricas, sem código, outro documento.
//
// NUNCA AFIRMAR APLICAÇÃO: a existência de uma habilidade aqui não implica que a matriz de
// Linguagens/Matemática do 5º ou 9º ano foi de fato aplicada em alguma edição específica do Saeb —
// ver `situacaoAplicacao` em `FonteMatrizBncc`, que registra isso como documentalmente inconclusivo
// (a única aplicação de 2019 confirmada nas fontes consultadas foi a matriz do 2º ano).
import catalogoDataset from "../../data/saeb-matriz-bncc/matriz-linguagens-matematica-bncc.json" with { type: "json" };

/** As três etapas cobertas pelas duas matrizes BNCC auditadas — nenhuma das duas tem 3ª série do
 * Ensino Médio. Deliberadamente distinto do tipo `Etapa` de lib/saeb/types.ts (que cobre a matriz
 * tradicional, com "ensinoMedio" e sem "2anoEF") — os dois tipos não devem ser intercambiáveis. */
export type EtapaMatrizBncc = "2anoEF" | "5anoEF" | "9anoEF";

/** Linguagens/Língua Portuguesa (sem código oficial) ou Matemática (com código oficial próprio). */
export type ComponenteMatrizBncc = "linguagens" | "matematica";

/** Eixos cognitivos de Linguagens — só existem nos Quadros 2 e 3 (5º/9º ano); o Quadro 1 (2º ano)
 * não usa eixo cognitivo (`eixoCognitivo: null` nesse caso). */
export type EixoCognitivoLinguagens = "Reconhecer" | "Analisar" | "Avaliar" | "Produzir";

/** Eixos cognitivos de Matemática — vocabulário fechado, diferente do de Linguagens (dois valores,
 * sempre presentes, nunca `null`). */
export type EixoCognitivoMatematica = "Compreender e aplicar conceitos e procedimentos" | "Resolver problemas e argumentar";

export type EixoCognitivoMatrizBncc = EixoCognitivoLinguagens | EixoCognitivoMatematica;

/** Uma habilidade da matriz Saeb–BNCC. `codigoOficial` é `null` sempre que `componente ===
 * "linguagens"` (nenhum código existe nessa matriz) e sempre uma string não vazia quando
 * `componente === "matematica"` — ver validação em scripts/saeb-matriz-bncc/gerar.mjs. */
export interface HabilidadeMatrizBncc {
  /** Identificador TÉCNICO deste catálogo (ex.: "matematica.9anoEF.geometria.resolver-problemas-e-argumentar.7")
   * — nunca um código do Inep, mesmo quando coincide numericamente com o sufixo de `codigoOficial`.
   * Estável entre gerações do catálogo (determinístico a partir de componente/etapa/eixos/ordem). */
  idInterno: string;
  /** Código oficial próprio da matriz Saeb–BNCC de Matemática (ex.: "9G2.7") — sempre `null` para
   * Linguagens. NUNCA um código "D<n>" da matriz tradicional. */
  codigoOficial: string | null;
  componente: ComponenteMatrizBncc;
  etapa: EtapaMatrizBncc;
  /** Rótulo do quadro oficial de onde a habilidade veio (ex.: "Quadro 2"). */
  quadro: string;
  paginaRealPdf: number;
  eixoConhecimento: string;
  /** `null` só para Linguagens/2º ano (Quadro 1, que não usa eixo cognitivo). */
  eixoCognitivo: EixoCognitivoMatrizBncc | null;
  /** Posição da habilidade dentro da célula (eixo do conhecimento × eixo cognitivo) — uma
   * localização EDITORIAL deste catálogo, nunca um código oficial (mesmo para Matemática, onde
   * coincide com o sufixo numérico do código por construção). */
  ordemEditorial: number;
  textoHabilidade: string;
  /** Chave para localizar os metadados de proveniência em `CatalogoMatrizBncc.fontes`. */
  fonteRef: ComponenteMatrizBncc;
}

export interface FonteMatrizBncc {
  id: string;
  titulo: string;
  orgao: string;
  componente: ComponenteMatrizBncc;
  anoPublicacao: number;
  url: string;
  hashSha256: string;
  tamanhoBytes: number;
  totalPaginasPdf: number;
  dataConsulta: string;
  etapasCobertas: EtapaMatrizBncc[];
  /** Estado documental da aplicação desta matriz em edições do Saeb — nunca uma afirmação de que
   * a matriz FOI aplicada além do que a fonte citada sustenta explicitamente. */
  situacaoAplicacao: string;
  distintaDaMatrizTradicional: true;
  notaDocumental?: string;
}

export interface MetadadoMatriz {
  componente: ComponenteMatrizBncc;
  etapa: EtapaMatrizBncc;
  quadro: string;
  tituloOficial: string;
}

export interface NotaEditorial {
  componente: ComponenteMatrizBncc;
  etapa: EtapaMatrizBncc;
  eixoConhecimento: string;
  paginaRealPdf: number;
  texto: string;
  observacao: string;
}

export interface CatalogoMatrizBncc {
  schema: string;
  catalogo: {
    componentes: ComponenteMatrizBncc[];
    etapas: EtapaMatrizBncc[];
    distintoDaMatrizTradicional: true;
    totalHabilidades: number;
    totalPorComponente: Record<ComponenteMatrizBncc, number>;
  };
  fontes: Record<ComponenteMatrizBncc, FonteMatrizBncc>;
  matrizes: MetadadoMatriz[];
  habilidades: HabilidadeMatrizBncc[];
  notasEditoriais: NotaEditorial[];
}

export const catalogoMatrizBncc = catalogoDataset as CatalogoMatrizBncc;

/** Todas as etapas cobertas pelo catálogo, na ordem declarada (2º, 5º, 9º ano). */
export function listarEtapas(): EtapaMatrizBncc[] {
  return catalogoMatrizBncc.catalogo.etapas;
}

/** Os dois componentes cobertos pelo catálogo (linguagens, matematica). */
export function listarComponentes(): ComponenteMatrizBncc[] {
  return catalogoMatrizBncc.catalogo.componentes;
}

/** Habilidade de Matemática pelo código oficial (ex.: "9G2.7"), ou `undefined` se não existir.
 * Nunca aceita um código de Linguagens (que não tem código) nem um código "D<n>" da matriz
 * tradicional — ambos simplesmente não têm correspondência aqui. */
export function buscarPorCodigoOficial(codigo: string): HabilidadeMatrizBncc | undefined {
  return catalogoMatrizBncc.habilidades.find((h) => h.codigoOficial === codigo);
}

/** Habilidade pelo identificador interno deste catálogo — nunca um código do Inep (ver
 * `HabilidadeMatrizBncc.idInterno`). */
export function buscarPorIdInterno(idInterno: string): HabilidadeMatrizBncc | undefined {
  return catalogoMatrizBncc.habilidades.find((h) => h.idInterno === idInterno);
}

/** Metadados de proveniência (URL, hash, situação de aplicação etc.) para um componente. */
export function buscarFonte(componente: ComponenteMatrizBncc): FonteMatrizBncc {
  return catalogoMatrizBncc.fontes[componente];
}

export function filtrarPorEtapa(etapa: EtapaMatrizBncc): HabilidadeMatrizBncc[] {
  return catalogoMatrizBncc.habilidades.filter((h) => h.etapa === etapa);
}

export function filtrarPorComponente(componente: ComponenteMatrizBncc): HabilidadeMatrizBncc[] {
  return catalogoMatrizBncc.habilidades.filter((h) => h.componente === componente);
}

export function filtrarPorEixoConhecimento(eixoConhecimento: string): HabilidadeMatrizBncc[] {
  return catalogoMatrizBncc.habilidades.filter((h) => h.eixoConhecimento === eixoConhecimento);
}

export function filtrarPorEixoCognitivo(eixoCognitivo: EixoCognitivoMatrizBncc): HabilidadeMatrizBncc[] {
  return catalogoMatrizBncc.habilidades.filter((h) => h.eixoCognitivo === eixoCognitivo);
}

function removerAcentos(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}

/**
 * Busca textual livre, sem diferenciar maiúsculas/minúsculas ou acentuação — compara contra
 * `textoHabilidade` e, quando presente, `codigoOficial` (comparação exata de prefixo, já que o
 * código não tem acento). Nunca reescreve nem abrevia o texto encontrado; string vazia devolve o
 * catálogo inteiro (mesmo padrão de `filtrarGrupos` em lib/saeb/descritores.ts).
 */
export function buscarPorTexto(consulta: string): HabilidadeMatrizBncc[] {
  const consultaAparada = consulta.trim();
  if (!consultaAparada) return catalogoMatrizBncc.habilidades;

  const consultaNormalizada = removerAcentos(consultaAparada.toLowerCase());
  return catalogoMatrizBncc.habilidades.filter((h) => corresponde(h, consultaNormalizada));
}

function corresponde(h: HabilidadeMatrizBncc, consultaNormalizada: string): boolean {
  const casaPorTexto = removerAcentos(h.textoHabilidade.toLowerCase()).includes(consultaNormalizada);
  // Busca por código só existe para Matemática (`codigoOficial` sempre `null` em Linguagens) — nunca
  // inventa nem casa um código para Linguagens (ver comentário de topo do arquivo).
  const casaPorCodigo = h.codigoOficial ? removerAcentos(h.codigoOficial.toLowerCase()).includes(consultaNormalizada) : false;
  return casaPorTexto || casaPorCodigo;
}

/** Habilidades de um recorte etapa×componente, na mesma ordem do catálogo (que já segue a ordem dos
 * quadros oficiais) — a contraparte, para a matriz BNCC, de `buscarMatriz` em lib/saeb/descritores.ts.
 * Nunca lança: um recorte sem habilidades (não deveria ocorrer, dadas as 6 combinações do catálogo)
 * devolve array vazio, não `undefined` — a interface trata isso como "nenhuma habilidade", não como
 * "matriz inexistente" (diferente de `buscarMatriz`, que modela combinações inteiramente ausentes). */
export function buscarHabilidades(etapa: EtapaMatrizBncc, componente: ComponenteMatrizBncc): HabilidadeMatrizBncc[] {
  return catalogoMatrizBncc.habilidades.filter((h) => h.etapa === etapa && h.componente === componente);
}

/**
 * Filtra um recorte já obtido (ex.: de `buscarHabilidades`) por uma consulta livre — mesma
 * comparação de `buscarPorTexto` (sem diferenciar maiúsculas/minúsculas ou acentuação; código só
 * casa para Matemática), mas operando sobre um subconjunto arbitrário em vez do catálogo inteiro.
 * String vazia devolve o subconjunto original sem cópia desnecessária (mesmo padrão de
 * `filtrarGrupos` em lib/saeb/descritores.ts).
 */
export function filtrarHabilidadesPorTexto(habilidades: HabilidadeMatrizBncc[], consulta: string): HabilidadeMatrizBncc[] {
  const consultaAparada = consulta.trim();
  if (!consultaAparada) return habilidades;
  const consultaNormalizada = removerAcentos(consultaAparada.toLowerCase());
  return habilidades.filter((h) => corresponde(h, consultaNormalizada));
}

/** Um subgrupo de habilidades que compartilham o mesmo eixo cognitivo dentro de um eixo do
 * conhecimento — `eixoCognitivo: null` só ocorre para Linguagens/2º ano (Quadro 1, sem eixo
 * cognitivo; ver `HabilidadeMatrizBncc.eixoCognitivo`). Habilidades em ordem editorial. */
export interface SubgrupoEixoCognitivo {
  eixoCognitivo: EixoCognitivoMatrizBncc | null;
  habilidades: HabilidadeMatrizBncc[];
}

/** Um grupo por eixo do conhecimento (ex.: "Leitura", "Números"), com seus subgrupos por eixo
 * cognitivo — a contraparte, para a matriz BNCC, de `GrupoDescritores`/`GrupoFiltrado` em
 * lib/saeb/descritores.ts (que agrupa por tópico/tema, não por eixo). */
export interface GrupoEixoConhecimento {
  eixoConhecimento: string;
  subgrupos: SubgrupoEixoCognitivo[];
  totalHabilidades: number;
}

/**
 * Agrupa uma lista de habilidades (já filtrada por etapa/componente e, opcionalmente, por busca) em
 * grupos por eixo do conhecimento e subgrupos por eixo cognitivo, preservando a ordem de primeira
 * ocorrência de cada eixo (que já segue a ordem dos quadros oficiais, por vir de
 * `catalogoMatrizBncc.habilidades` sem reordenação) e ordenando cada subgrupo por `ordemEditorial`.
 * Nunca reordena alfabeticamente — isso embaralharia a ordem em que o Inep apresenta os eixos.
 */
export function agruparPorEixo(habilidades: HabilidadeMatrizBncc[]): GrupoEixoConhecimento[] {
  const porEixo = new Map<string, HabilidadeMatrizBncc[]>();
  for (const h of habilidades) {
    const lista = porEixo.get(h.eixoConhecimento) ?? [];
    lista.push(h);
    porEixo.set(h.eixoConhecimento, lista);
  }

  return [...porEixo.entries()].map(([eixoConhecimento, listaDoEixo]) => {
    const porCognitivo = new Map<string, HabilidadeMatrizBncc[]>();
    for (const h of listaDoEixo) {
      const chave = h.eixoCognitivo ?? "";
      const lista = porCognitivo.get(chave) ?? [];
      lista.push(h);
      porCognitivo.set(chave, lista);
    }
    const subgrupos: SubgrupoEixoCognitivo[] = [...porCognitivo.entries()].map(([chave, itens]) => ({
      eixoCognitivo: chave === "" ? null : (chave as EixoCognitivoMatrizBncc),
      habilidades: [...itens].sort((a, b) => a.ordemEditorial - b.ordemEditorial),
    }));
    return { eixoConhecimento, subgrupos, totalHabilidades: listaDoEixo.length };
  });
}
