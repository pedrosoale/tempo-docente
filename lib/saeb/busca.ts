// Busca por nome — município (índice nacional) e escola (índice municipal ou conteúdo de uma
// partição já carregada). Pura, sem estado; o componente decide o que fazer com o resultado.
import type { Escola, EntradaIndiceMunicipal, EntradaIndiceNacional } from "./types.ts";

/** Remove acentuação, colapsa maiúsculas/minúsculas e espaços nas pontas — nunca a ortografia em si. */
export function normalizarBusca(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLocaleLowerCase("pt-BR")
    .trim();
}

const porNomeEDepoisUf = (a: { nome: string; uf: string }, b: { nome: string; uf: string }) =>
  a.nome.localeCompare(b.nome, "pt-BR") || a.uf.localeCompare(b.uf, "pt-BR");

/**
 * Municípios cujo nome contém a consulta — nunca a UF sozinha, porque a UF é o que distingue
 * homônimos na lista de resultados, não um segundo campo de busca nesta rodada.
 */
export function buscarMunicipios(municipios: EntradaIndiceNacional[], consulta: string): EntradaIndiceNacional[] {
  const normalizada = normalizarBusca(consulta);
  if (!normalizada) return [];
  return municipios.filter((m) => normalizarBusca(m.nome).includes(normalizada)).sort(porNomeEDepoisUf);
}

/** Sem consulta, devolve a lista inteira (municípios subdivididos ainda cabem numa lista curta de rolar). */
export function buscarEscolasNoIndiceMunicipal(escolas: EntradaIndiceMunicipal[], consulta: string): EntradaIndiceMunicipal[] {
  const normalizada = normalizarBusca(consulta);
  const base = normalizada ? escolas.filter((e) => normalizarBusca(e.nome).includes(normalizada)) : escolas;
  return [...base].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}

/** Mesma lógica, para as escolas já carregadas dentro de uma partição (município de partição única). */
export function buscarEscolasNaParticao(escolas: Escola[], consulta: string): Escola[] {
  const normalizada = normalizarBusca(consulta);
  const base = normalizada ? escolas.filter((e) => normalizarBusca(e.nome).includes(normalizada)) : escolas;
  return [...base].sort((a, b) => a.nome.localeCompare(b.nome, "pt-BR"));
}
