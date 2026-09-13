// Camada de busca dos dados do SAEB — sem React, sem DOM além de `fetch`. Mantida assim de
// propósito: o projeto não tem jsdom/testing-library (ver package.json), então toda lógica que
// precisa de cobertura automatizada real vive aqui, testável com um `fetch` falso em node:test puro
// (tests/saeb-consulta-client.test.mjs, tests/saeb-consulta-integracao.test.mjs). O componente React
// (app/saeb/components/SaebConsulta.tsx) é uma casca fina sobre isto, verificada manualmente no
// navegador.
//
// Estratégia de versão (ver "Versão e consistência dos dados" nos relatórios desta área):
//   1. current.json é buscado primeiro, sempre sem cache HTTP (`cache: "no-store"`) — é pequeno e
//      precisa refletir a geração mais recente.
//   2. Toda busca seguinte carrega `?v=<versao>` na própria URL — isto por si só já impede que o
//      cache HTTP do navegador combine bytes de gerações diferentes: são, literalmente, recursos
//      diferentes de um cache HTTP.
//   3. Em cima disso, cada arquivo já teve a MESMA versão embutida no seu próprio conteúdo (ver
//      calcularVersaoDados em scripts/saeb-query-prototype/materialize.mjs) — lib/saeb/validacao.ts
//      confere essa versão embutida contra a esperada e rejeita explicitamente
//      (SaebVersionMismatchError) se algum proxy/cache intermediário ignorar a query string e
//      servir um arquivo de outra geração. Duas camadas independentes: a URL e o conteúdo.
//   4. Se uma incompatibilidade de versão for detectada EM QUALQUER busca, reiniciar() descarta a
//      versão conhecida e todo o cache — a próxima chamada busca current.json de novo, sem cache
//      HTTP, e nenhuma resposta presa a uma versão antiga pode repovoar o cache depois disso (ver
//      "Recuperação após mudança de versão" no relatório; SaebConsulta.tsx usa isso ao detectar
//      SaebVersionMismatchError em qualquer ponto do fluxo).
//
// Todo dado recebido passa por lib/saeb/validacao.ts antes de entrar no cache ou ser devolvido ao
// chamador — os tipos de lib/saeb/types.ts descrevem a forma esperada, mas nunca são checados pelo
// TypeScript em runtime; um índice com `municipios: null` ou sem `versao` só é rejeitado porque
// valida-se o valor de verdade, não porque o tipo declarado "garante" nada.
import {
  SaebFetchError,
  SaebSchemaError,
  SaebVersionMismatchError,
  validarIndiceMunicipal,
  validarIndiceNacional,
  validarParticao,
  validarVersaoAtual,
} from "./validacao.ts";
import type { IndiceMunicipal, IndiceNacional, Particao, VersaoAtual } from "./types.ts";

export { SaebFetchError, SaebSchemaError, SaebVersionMismatchError };

function isAbortError(error: unknown): boolean {
  return error instanceof Error && error.name === "AbortError";
}

function criarErroAbort(mensagem = "A operação foi cancelada."): Error {
  const erro = new Error(mensagem);
  erro.name = "AbortError";
  return erro;
}

async function buscarJson(fetchImpl: typeof fetch, url: string, init: RequestInit): Promise<unknown> {
  let resposta: Response;
  try {
    resposta = await fetchImpl(url, init);
  } catch (error) {
    if (isAbortError(error)) throw error;
    throw new SaebFetchError(`Falha de rede ao buscar ${url}.`);
  }
  if (!resposta.ok) {
    throw new SaebFetchError(`${url} respondeu HTTP ${resposta.status}.`);
  }
  try {
    return await resposta.json();
  } catch {
    throw new SaebSchemaError(`Resposta de ${url} não é um JSON válido.`);
  }
}

interface CarregarOpcoes {
  signal?: AbortSignal;
}

// ---- Cache por chave: compartilhamento seguro + limite explícito -----------------------------
//
// Cada chave passa por dois estados possíveis: "em-voo" (uma requisição real acontecendo, com
// SEU PRÓPRIO AbortController — nunca o signal de quem chamou) e "concluida" (um valor já
// validado, guardado até ser descartado por LRU ou por reiniciar()).
//
// Por que o controller é interno, não o do chamador — o bug que esta rodada corrige: antes, o
// signal passado por quem chamou `obter()` era usado DIRETO como o signal do fetch. Se a escola A
// iniciasse o download de uma partição e, antes de terminar, a escola B (mesma partição) fosse
// selecionada, o SelectionController de B abortava o signal de A — que por acaso era o mesmo
// signal usado pela ÚNICA requisição de rede compartilhada. B então herdava uma promessa já
// rejeitada com AbortError, mesmo a partição sendo exatamente o que B precisava. A correção:
// o signal de quem chama só decide se ESSA chamada específica desiste de esperar (ver a corrida
// contra `sinalDoChamador` abaixo); a requisição de rede real só é cancelada quando a CONTAGEM DE
// REFERÊNCIAS da chave chega a zero — ou seja, quando literalmente ninguém mais precisa dela.
interface EntradaEmVoo<T> {
  tipo: "em-voo";
  promise: Promise<T>;
  controller: AbortController;
  referencias: number;
}
interface EntradaConcluida<T> {
  tipo: "concluida";
  valor: T;
  bytesAprox: number;
}
type EntradaCache<T> = EntradaEmVoo<T> | EntradaConcluida<T>;

export interface LimitesCache {
  /** Máximo de respostas CONCLUÍDAS mantidas ao mesmo tempo — requisições em voo não contam aqui. */
  maxEntradasConcluidas?: number;
  /** Orçamento aproximado (soma de `JSON.stringify(valor).length` de cada entrada concluída). */
  orcamentoBytesAprox?: number;
}

const MAX_ENTRADAS_CONCLUIDAS_PADRAO = 60;
// ~6 MB — folga generosa acima da maior partição real medida (São Paulo, ~468 KB brutos por
// partição; ver relatório da rodada anterior), o bastante para manter dezenas de partições e
// índices municipais simultâneos numa sessão de navegação sem crescer sem limite.
const ORCAMENTO_BYTES_PADRAO = 6 * 1024 * 1024;

function estimarBytes(valor: unknown): number {
  try {
    return JSON.stringify(valor).length;
  } catch {
    return 0;
  }
}

/**
 * Requisições em voo NÃO têm um teto numérico separado nesta rodada — o próprio fluxo da
 * ferramenta já as mantém controladas: cada seleção (município, escola) passa por um único
 * SelectionController que cancela sua PRÓPRIA chamada anterior antes de iniciar a próxima (ver
 * lib/saeb/selection.ts), então nunca existem mais do que ~2-3 chamadas *iniciadas pela UI*
 * simultâneas (uma por controlador, mais uma sobreposição breve durante a troca). Uma entrada em
 * voo só permanece além disso enquanto tiver referências ativas — e cada referência corresponde a
 * uma chamada real de algum controlador, nunca a um acúmulo sem limite.
 */
class CachePorChave {
  private mapa = new Map<string, EntradaCache<unknown>>();
  private bytesTotais = 0;
  private readonly maxEntradasConcluidas: number;
  private readonly orcamentoBytesAprox: number;

  constructor(limites: LimitesCache = {}) {
    this.maxEntradasConcluidas = limites.maxEntradasConcluidas ?? MAX_ENTRADAS_CONCLUIDAS_PADRAO;
    this.orcamentoBytesAprox = limites.orcamentoBytesAprox ?? ORCAMENTO_BYTES_PADRAO;
  }

  private contarConcluidas(): number {
    let n = 0;
    for (const entrada of this.mapa.values()) if (entrada.tipo === "concluida") n += 1;
    return n;
  }

  /** Move `chave` para o fim do mapa — Map preserva ordem de inserção, então isto marca "uso mais recente". */
  private marcarUsoRecente(chave: string, entrada: EntradaCache<unknown>): void {
    this.mapa.delete(chave);
    this.mapa.set(chave, entrada);
  }

  /** Descarta entradas CONCLUÍDAS menos usadas recentemente (início do mapa) até caber nos limites. Nunca toca em requisições em voo. */
  private evictarSeNecessario(): void {
    for (const [chave, entrada] of this.mapa) {
      if (this.contarConcluidas() <= this.maxEntradasConcluidas && this.bytesTotais <= this.orcamentoBytesAprox) return;
      if (entrada.tipo !== "concluida") continue;
      this.mapa.delete(chave);
      this.bytesTotais -= entrada.bytesAprox;
    }
  }

  /**
   * Busca (ou inicia) o valor de `chave`. `criar(signal)` só roda quando não há entrada em voo
   * nem concluída para essa chave, e recebe o signal INTERNO desta entrada — nunca o do chamador.
   * `sinalDoChamador`, se fornecido e abortado, faz ESTA chamada específica desistir de esperar
   * (rejeita com um erro `AbortError` só para quem chamou), sem afetar nenhum outro interessado na
   * mesma chave. A requisição real só é cancelada quando a contagem de referências chega a zero.
   */
  async obter<T>(chave: string, criar: (signal: AbortSignal) => Promise<T>, sinalDoChamador?: AbortSignal): Promise<T> {
    const existente = this.mapa.get(chave) as EntradaCache<T> | undefined;
    if (existente?.tipo === "concluida") {
      this.marcarUsoRecente(chave, existente);
      return existente.valor;
    }

    let emVoo = existente as EntradaEmVoo<T> | undefined;
    if (!emVoo) {
      const controller = new AbortController();
      const entrada: EntradaEmVoo<T> = { tipo: "em-voo", controller, referencias: 0, promise: undefined as unknown as Promise<T> };
      entrada.promise = criar(controller.signal)
        .then((valor) => {
          // Só grava no cache se esta entrada ainda for A ATUAL para esta chave — se reiniciar()
          // já limpou tudo, ou se (por alguma outra via) esta chave já foi substituída, uma
          // resposta atrasada NUNCA pode repovoar o cache por baixo dos panos. Quem estava
          // esperando especificamente por ESTA chamada (ver referências abaixo) ainda recebe o
          // valor normalmente — só a gravação no cache compartilhado é que é condicional.
          if (this.mapa.get(chave) === entrada) {
            const bytesAprox = estimarBytes(valor);
            this.bytesTotais += bytesAprox;
            this.mapa.set(chave, { tipo: "concluida", valor, bytesAprox });
            this.evictarSeNecessario();
          }
          return valor;
        })
        .catch((error: unknown) => {
          // Só remove do cache se a entrada ainda for ESTA — uma chamada mais nova pode já ter
          // substituído esta pela sua própria entrada (ou por um resultado concluído) antes desta
          // rejeição chegar aqui, e apagar a entrada nova por engano perderia trabalho já pronto.
          if (this.mapa.get(chave) === entrada) this.mapa.delete(chave);
          throw error;
        });
      emVoo = entrada;
      this.mapa.set(chave, entrada);
    }

    emVoo.referencias += 1;
    const referenciaViva = emVoo;
    const liberar = () => {
      referenciaViva.referencias -= 1;
      if (referenciaViva.referencias <= 0 && this.mapa.get(chave) === referenciaViva) {
        // Ninguém mais espera por isto — só agora cancela a requisição de verdade.
        referenciaViva.controller.abort();
        this.mapa.delete(chave);
      }
    };

    if (!sinalDoChamador) {
      try {
        return await emVoo.promise;
      } finally {
        liberar();
      }
    }

    try {
      return await new Promise<T>((resolve, reject) => {
        if (sinalDoChamador.aborted) {
          reject(criarErroAbort());
          // Mesmo desistindo antes de esperar, esta chamada ainda CONTA como referência (já
          // incrementada acima) e só solta a promessa compartilhada quando liberar() rodar — se
          // ninguém "consumir" essa eventual liquidação (ex.: quando a contagem de referências
          // chegar a zero e a requisição interna for abortada de verdade), ela se tornaria uma
          // rejeição não tratada global, mesmo já sendo irrelevante para este chamador.
          referenciaViva.promise.catch(() => {});
          return;
        }
        const aoAbortar = () => reject(criarErroAbort());
        sinalDoChamador.addEventListener("abort", aoAbortar, { once: true });
        referenciaViva.promise.then(resolve, reject).finally(() => sinalDoChamador.removeEventListener("abort", aoAbortar));
      });
    } finally {
      liberar();
    }
  }

  /** Cancela toda requisição em voo e esquece tudo — usado por reiniciar() após mudança de versão. */
  limparTudo(): void {
    for (const entrada of this.mapa.values()) {
      if (entrada.tipo === "em-voo") entrada.controller.abort();
    }
    this.mapa.clear();
    this.bytesTotais = 0;
  }

  /** Só para teste/diagnóstico — número de chaves atualmente rastreadas (em voo + concluídas). */
  get tamanho(): number {
    return this.mapa.size;
  }
}

export interface SaebClientOptions {
  /** Injeção de dependência para teste — default é o `fetch` global. */
  fetchImpl?: typeof fetch;
  /** Default "/data/saeb" — a raiz pública onde publish-local.mjs grava. */
  baseUrl?: string;
  /** Ver LimitesCache — defaults documentados ao lado das constantes acima. */
  limitesCache?: LimitesCache;
}

export function createSaebClient({ fetchImpl = fetch, baseUrl = "/data/saeb", limitesCache }: SaebClientOptions = {}) {
  // Separado do cache de índices/partições de propósito — não é "se necessário" teórico, foi um
  // bug real encontrado ao testar o limite: current.json é tocado em TODA chamada (via
  // resolverVersao), então marcarUsoRecente() o reinseria no fim do mapa compartilhado a cada
  // requisição — empurrando a fronteira de descarte para cima e fazendo o LRU expulsar dados reais
  // (um índice municipal recém-usado) mais cedo do que devia, só porque current.json "roubava"
  // uma vaga do orçamento a cada chamada. Uma única chave, nunca disputa espaço com dados reais.
  const cacheVersao = new CachePorChave({ maxEntradasConcluidas: 1 });
  const cache = new CachePorChave(limitesCache);

  function carregarVersaoAtual(opcoes: CarregarOpcoes): Promise<VersaoAtual> {
    return cacheVersao.obter(
      "current",
      (signal) => buscarJson(fetchImpl, `${baseUrl}/current.json`, { signal, cache: "no-store" }).then(validarVersaoAtual),
      opcoes.signal,
    );
  }

  function getVersaoAtual(opcoes: CarregarOpcoes = {}): Promise<VersaoAtual> {
    return carregarVersaoAtual(opcoes);
  }

  function resolverVersao(opcoes: CarregarOpcoes): Promise<string> {
    return carregarVersaoAtual(opcoes).then((v) => v.versao);
  }

  async function getIndiceNacional(opcoes: CarregarOpcoes = {}): Promise<{ versao: string; indice: IndiceNacional }> {
    const versao = await resolverVersao(opcoes);
    const indice = await cache.obter(
      `nacional:${versao}`,
      (signal) => buscarJson(fetchImpl, `${baseUrl}/municipios-index.json?v=${versao}`, { signal }).then((d) => validarIndiceNacional(d, versao)),
      opcoes.signal,
    );
    return { versao, indice };
  }

  async function getIndiceMunicipal(codigoIbge: string, opcoes: CarregarOpcoes = {}): Promise<{ versao: string; indice: IndiceMunicipal }> {
    const versao = await resolverVersao(opcoes);
    const indice = await cache.obter(
      `municipal:${versao}:${codigoIbge}`,
      (signal) =>
        buscarJson(fetchImpl, `${baseUrl}/municipios/${codigoIbge}/escolas-index.json?v=${versao}`, { signal }).then((d) =>
          validarIndiceMunicipal(d, versao, codigoIbge),
        ),
      opcoes.signal,
    );
    return { versao, indice };
  }

  async function getParticao(codigoIbge: string, arquivo: string, opcoes: CarregarOpcoes = {}): Promise<{ versao: string; particao: Particao }> {
    const versao = await resolverVersao(opcoes);
    const particao = await cache.obter(
      `particao:${versao}:${codigoIbge}:${arquivo}`,
      (signal) =>
        buscarJson(fetchImpl, `${baseUrl}/municipios/${codigoIbge}/particoes/${arquivo}?v=${versao}`, { signal }).then((d) =>
          validarParticao(d, versao, codigoIbge, arquivo),
        ),
      opcoes.signal,
    );
    return { versao, particao };
  }

  /**
   * Recuperação após mudança de versão (V1 → V2): esquece a versão conhecida e todo o cache.
   * A próxima chamada busca current.json de novo, sem cache HTTP (getVersaoAtual já usa
   * `cache: "no-store"`), e nada que dependia de V1 pode repovoar o cache depois disso — as
   * entradas em voo de V1 são abortadas aqui, então mesmo uma resposta de V1 ainda a caminho não
   * tem como ser gravada no cache após reiniciar() (ver teste "reiniciar durante uma requisição
   * em voo"). Chamado por SaebConsulta.tsx ao detectar SaebVersionMismatchError em qualquer parte
   * do fluxo — ver "Recuperação após mudança de versão" no relatório para a UI que usa isto.
   */
  function reiniciar(): void {
    cacheVersao.limparTudo();
    cache.limparTudo();
  }

  return { getVersaoAtual, getIndiceNacional, getIndiceMunicipal, getParticao, reiniciar };
}

export type SaebClient = ReturnType<typeof createSaebClient>;
