// Catálogo das escalas de proficiência do SAEB (Língua Portuguesa e Matemática — 5º ano do Ensino
// Fundamental / Anos Iniciais, 9º ano do Ensino Fundamental / Anos Finais, e 3ª série do Ensino
// Médio) usado pelo painel "Entenda este resultado". Importado como módulo estático — o JSON é
// empacotado no bundle pelo bundler, não buscado em tempo de execução. Isso é proposital: o painel
// nunca faz rede para mostrar a descrição de um nível, ao contrário do SaebClient, que busca
// partições de resultado sob demanda.
//
// data/saeb-escalas/escalas-lp-mt.json é gerado por scripts/saeb-escalas/gerar.mjs a partir da
// fonte hand-verified em data/saeb-escalas/source/official-inep-escalas-lp-mt.json (diretório
// próprio deste piloto, separado de data/saeb/ — ver comentário em gerar.mjs) — nunca editar o
// arquivo gerado diretamente.
import catalogoDataset from "../../data/saeb-escalas/escalas-lp-mt.json" with { type: "json" };
import type { CampoIndicador, Etapa } from "./types.ts";

export type OperadorLimite = ">=" | "<";
export type OrigemNomeNivel = "quadro" | "nota_rodape";

export interface FaixaNivel {
  nivel: number;
  nomeNivel: string;
  origemNome: OrigemNomeNivel;
  /** false = nível implícito de nota de rodapé (abaixo do primeiro nível tabulado), nunca inventado. */
  tabulado: boolean;
  limiteInferior: number | null;
  operadorInferior: OperadorLimite | null;
  limiteSuperior: number | null;
  operadorSuperior: OperadorLimite | null;
  descricaoOficial: string;
  paginasPdf: number[];
  paginasImpressas: number[];
}

/** Componente coberto pelo piloto — só "lp" ou "mt"; nunca ideb/n/p/meta (ver PILOTO_CAMPOS). */
export type ComponentePiloto = Extract<CampoIndicador, "lp" | "mt">;

export interface EscalaComponente {
  etapa: Etapa;
  etapaLabelOficial: string;
  componente: ComponentePiloto;
  quadro: string;
  tituloOficial: string;
  fonteInternaCitada: string;
  /** Edições (ano) em que esta escala está documentada como associada ao resultado divulgado. */
  edicoesAssociadas: string[];
  niveis: FaixaNivel[];
}

export interface FontePublicacao {
  titulo: string;
  orgao: string;
  url: string;
  versaoPublicacao: string;
  hashSha256: string;
  totalPaginasPdf: number;
}

export interface CatalogoEscalasSaeb {
  schema: string;
  piloto: {
    etapas: Etapa[];
    componentes: ComponentePiloto[];
  };
  fonte: FontePublicacao;
  escalas: EscalaComponente[];
}

export const catalogoEscalas = catalogoDataset as CatalogoEscalasSaeb;

/**
 * Escala para um par etapa/componente, ou `undefined` se o catálogo não cobre esse recorte — o
 * piloto cobre anosIniciais, anosFinais e ensinoMedio, sempre só para lp | mt. Nunca lança: a
 * ausência é um estado válido que o chamador (resolverPosicaoNaEscala) precisa distinguir
 * explicitamente.
 */
export function buscarEscala(etapa: Etapa, componente: CampoIndicador): EscalaComponente | undefined {
  return catalogoEscalas.escalas.find((escala) => escala.etapa === etapa && escala.componente === componente);
}
