// Catálogo dos descritores da matriz de referência TRADICIONAL (2001) do SAEB — Língua Portuguesa e
// Matemática, nas mesmas três etapas do piloto de escalas de proficiência (5º ano do Ensino
// Fundamental / Anos Iniciais, 9º ano do Ensino Fundamental / Anos Finais, e 3ª série do Ensino
// Médio). Importado como módulo estático — o JSON é empacotado no bundle, não buscado em tempo de
// execução: a consulta de descritores nunca faz rede.
//
// data/saeb-descritores/matriz-lp-mt-2001.json é gerado por scripts/saeb-descritores/gerar.mjs a
// partir da fonte hand-verified em data/saeb-descritores/source/official-inep-matriz-lp-mt-2001.json
// (diretório próprio deste piloto, separado de data/saeb/ e de data/saeb-escalas/) — nunca editar o
// arquivo gerado diretamente.
//
// QUATRO CONCEITOS DISTINTOS, deliberadamente não tratados como sinônimos neste módulo nem na
// interface que o consome (ver app/saeb/matriz/):
//   - MATRIZ DE REFERÊNCIA: o documento que orienta a construção dos itens de uma avaliação — um
//     recorte do currículo, nunca o currículo inteiro (ver texto oficial do Inep em
//     app/saeb/matriz/page.tsx). Este módulo carrega a matriz tradicional (2001); a matriz alinhada
//     à BNCC é um documento diferente, com estrutura própria (ver nota "BNCC" abaixo).
//   - DESCRITOR: um item codificado (ex.: "D1") dentro da matriz tradicional, associando uma
//     habilidade avaliável a um tema ou tópico. É a unidade que este módulo modela.
//   - ESCALA DE PROFICIÊNCIA: a régua numérica (ver lib/saeb/escalas.ts) que situa uma média de
//     proficiência em um nível, com sua própria descrição textual por nível. Não tem código "D" e
//     não é o mesmo documento que a matriz de referência, embora as duas sejam publicadas pelo Inep
//     e usem o mesmo vocabulário de "habilidades".
//   - HABILIDADE DA BNCC: um código de outro documento curricular (ver lib/bncc/), de outra origem e
//     outra estrutura. Nunca associada a um descritor aqui sem correspondência oficial publicada.
//
// NOTA "BNCC": desde 2019 o Saeb está em transição de matrizes — a matriz tradicional (2001) está
// sendo progressivamente substituída por matrizes alinhadas à BNCC, com estrutura e terminologia
// próprias (o Inep não usa códigos "D" na documentação BNCC consultada nesta rodada). A edição de
// 2025 usa AMBAS: a matriz tradicional (para a continuidade da série histórica de Língua Portuguesa
// e Matemática no 5º e 9º ano e na 3ª série do Ensino Médio) e matrizes alinhadas à BNCC (conforme
// a página oficial "Matrizes e Escalas" do Inep). Esta rodada do piloto cobre só a matriz
// tradicional — a matriz BNCC não é importada aqui, para não misturar as duas estruturas nem
// converter uma na outra silenciosamente.
import catalogoDataset from "../../data/saeb-descritores/matriz-lp-mt-2001.json" with { type: "json" };
import type { ComponentePiloto } from "./escalas.ts";
import type { Etapa } from "./types.ts";

export type { ComponentePiloto };

/** "topico" quando a fonte oficial rotula o agrupamento como "TÓPICOS" (Língua Portuguesa); "tema"
 * quando rotula como "TEMAS" (Matemática) — preservado tal como a fonte nomeia, nunca unificado. */
export type RotuloAgrupamento = "topico" | "tema";

export interface Descritor {
  /** Código oficial, ex.: "D1" — só existe porque a matriz tradicional codifica descritores assim;
   * nunca inventado para outro tipo de item. */
  codigo: string;
  texto: string;
  paginasPdf: number[];
  paginasImpressas: number[];
}

/** Um agrupamento de descritores sob um tópico (LP) ou tema (MT) numerado em algarismos romanos,
 * exatamente como o quadro oficial apresenta (ex.: "I. Procedimentos de leitura"). */
export interface GrupoDescritores {
  numero: string;
  nome: string;
  descritores: Descritor[];
}

export interface MatrizComponenteEtapa {
  etapa: Etapa;
  etapaLabelOficial: string;
  componente: ComponentePiloto;
  quadro: string;
  tituloOficial: string;
  fonteInternaCitada: string;
  rotuloAgrupamento: RotuloAgrupamento;
  grupos: GrupoDescritores[];
}

export interface FonteMatrizPublicacao {
  titulo: string;
  orgao: string;
  url: string;
  versaoPublicacao: string;
  hashSha256: string;
  totalPaginasPdf: number;
  /** Discrepância documental observada na ficha catalográfica do PDF oficial — preservada tal como
   * apurada, para nunca esconder uma inconsistência da própria fonte (ver comentário de topo). */
  notaDocumental?: string;
}

export interface CatalogoDescritoresSaeb {
  schema: string;
  piloto: {
    etapas: Etapa[];
    componentes: ComponentePiloto[];
    matrizAbrangida: string;
  };
  fontes: Record<ComponentePiloto, FonteMatrizPublicacao>;
  matrizes: MatrizComponenteEtapa[];
}

export const catalogoDescritores = catalogoDataset as CatalogoDescritoresSaeb;

/** Matriz para um par etapa/componente, ou `undefined` se o catálogo não cobrir esse recorte. Nunca
 * lança: a ausência é um estado válido que o chamador precisa distinguir explicitamente — igual ao
 * padrão de `buscarEscala` em lib/saeb/escalas.ts. */
export function buscarMatriz(etapa: Etapa, componente: ComponentePiloto): MatrizComponenteEtapa | undefined {
  return catalogoDescritores.matrizes.find((matriz) => matriz.etapa === etapa && matriz.componente === componente);
}

/** Todos os descritores de uma matriz, em ordem de grupo, cada um anotado com o grupo a que pertence
 * — usado pela busca textual/por código, que não precisa preservar a estrutura de grupos. */
export function listarDescritoresComGrupo(matriz: MatrizComponenteEtapa): Array<Descritor & { grupoNumero: string; grupoNome: string }> {
  return matriz.grupos.flatMap((grupo) =>
    grupo.descritores.map((descritor) => ({ ...descritor, grupoNumero: grupo.numero, grupoNome: grupo.nome })),
  );
}

/** Normaliza um código de busca do usuário ("d1", " D1 ", "d 1") para o formato oficial ("D1"), ou
 * `null` se não corresponder ao vocabulário de código de descritor. Usada só para comparação — nunca
 * para reescrever o dado exibido. */
export function normalizarCodigoBusca(entrada: string): string | null {
  const compacto = entrada.trim().toUpperCase().replace(/\s+/g, "");
  const match = /^D([1-9][0-9]*)$/.exec(compacto);
  return match ? `D${match[1]}` : null;
}

export interface GrupoFiltrado extends GrupoDescritores {
  descritores: Descritor[];
}

/**
 * Filtra os grupos de uma matriz por uma consulta livre, preservando a estrutura de grupos (só
 * descarta grupos que ficam sem nenhum descritor correspondente). Sem consulta (string vazia ou só
 * espaços), devolve os grupos originais sem cópia desnecessária. A comparação cobre as duas formas
 * de busca pedidas — por código (`normalizarCodigoBusca`, comparado por prefixo: "d1" casa com D1,
 * D10..D19) e por palavra do texto oficial (substring, sem diferenciar maiúsculas/minúsculas ou
 * acentuação) — nunca reescreve nem abrevia o texto encontrado.
 */
export function filtrarGrupos(grupos: GrupoDescritores[], consulta: string): GrupoFiltrado[] {
  const consultaAparada = consulta.trim();
  if (!consultaAparada) return grupos;

  const codigoNormalizado = normalizarCodigoBusca(consultaAparada);
  const consultaTexto = removerAcentos(consultaAparada.toLowerCase());

  return grupos
    .map((grupo) => ({
      ...grupo,
      descritores: grupo.descritores.filter((descritor) => {
        const casaPorCodigo = codigoNormalizado ? descritor.codigo.startsWith(codigoNormalizado) : false;
        const casaPorTexto = removerAcentos(descritor.texto.toLowerCase()).includes(consultaTexto);
        return casaPorCodigo || casaPorTexto;
      }),
    }))
    .filter((grupo) => grupo.descritores.length > 0);
}

function removerAcentos(valor: string): string {
  return valor.normalize("NFD").replace(/[̀-ͯ]/g, "");
}
