"use client";

import { useEffect, useMemo, useRef, useState } from "react";
import { AlertTriangle, HelpCircle, Loader2, RotateCcw, School, TrendingUp, X } from "lucide-react";
import { buscarEscolasNaParticao, buscarEscolasNoIndiceMunicipal, buscarMunicipios } from "@/lib/saeb/busca";
import { createSaebClient, SaebVersionMismatchError, type SaebClient } from "@/lib/saeb/client";
import { mensagemDeErro } from "@/lib/saeb/erros";
import { ETAPA_LABEL, INDICADOR_LABEL, ORDEM_INDICADORES_IDEB, ORDEM_INDICADORES_SAEB } from "@/lib/saeb/labels";
import { edicoesDisponiveis, etapasDisponiveis, formatarValorIndicador, resolverIndicador } from "@/lib/saeb/registro";
import { createSelectionController, eDescartado } from "@/lib/saeb/selection";
import type {
  CampoIndicador,
  Escola,
  EntradaIndiceMunicipal,
  EntradaIndiceNacional,
  Etapa,
  IndiceMunicipal,
  IndiceNacional,
  Municipio,
  Particao,
  RegistroEdicao,
} from "@/lib/saeb/types";
import Combobox from "./Combobox";
import HistoricoEscola from "./HistoricoEscola";

type Carregavel<T> = { status: "loading" } | { status: "error"; erro: string } | { status: "ok"; dados: T };

type ResultadoMunicipio = { tipo: "unica"; particao: Particao } | { tipo: "subdividido"; indice: IndiceMunicipal };

type FluxoMunicipio = { status: "idle" } | { status: "loading" } | { status: "error"; erro: string } | { status: "ok"; dados: ResultadoMunicipio };

type FluxoEscola = { status: "idle" } | { status: "loading" } | { status: "error"; erro: string } | { status: "ok"; dados: Particao };

function StatePanel({ tipo, children }: { tipo: "loading" | "error"; children: React.ReactNode }) {
  return (
    <div className={tipo === "error" ? "saeb-state-panel error" : "saeb-state-panel"}>
      {tipo === "loading" ? <Loader2 className="saeb-spin" size={22} aria-hidden="true" /> : <AlertTriangle size={22} aria-hidden="true" />}
      <span>{children}</span>
    </div>
  );
}

function RetryButton({ onClick }: { onClick: () => void }) {
  return (
    <button type="button" className="saeb-retry" onClick={onClick}>
      <RotateCcw size={15} aria-hidden="true" /> Tentar novamente
    </button>
  );
}

export default function SaebConsulta() {
  // Inicializador preguiçoso do useState (chamado uma única vez, nunca de novo): o cliente
  // precisa ser estável durante toda a vida do componente, mas ler/escrever `.current` de um ref
  // diretamente no corpo do render não é permitido (react-hooks/refs).
  const [client] = useState<SaebClient>(() => createSaebClient());

  const municipioControllerRef = useRef(createSelectionController<ResultadoMunicipio>());
  const escolaControllerRef = useRef(createSelectionController<Particao>());

  // ---- Recuperação após mudança de versão (V1 → V2) ----
  //
  // current.json só é resolvido uma vez por instância do cliente (ver lib/saeb/client.ts) — se a
  // versão mudar enquanto a página está aberta, um "Tentar novamente" comum continuaria usando a
  // versão antiga para sempre e repetindo a mesma falha. Em vez disso, QUALQUER
  // SaebVersionMismatchError detectado em qualquer parte do fluxo (carga inicial, município ou
  // escola) substitui a ferramenta inteira por um aviso e um botão de recarregar — nunca um retry
  // comum, que nunca resolveria isto. Um recarregamento completo da página é deliberado: garante
  // que nenhuma resposta presa à versão antiga possa repovoar o estado depois da recuperação,
  // sem precisar reconstruir manualmente cada pedaço de estado do componente.
  const [versaoDesatualizada, setVersaoDesatualizada] = useState(false);

  function registrarErro(error: unknown): string {
    if (error instanceof SaebVersionMismatchError) {
      client.reiniciar(); // impede novas chamadas de criar mais entradas presas à versão antiga
      setVersaoDesatualizada(true);
    }
    return mensagemDeErro(error);
  }

  // ---- Carregamento inicial: current.json + índice nacional (2 requisições, uma vez) ----
  const [indiceNacional, setIndiceNacional] = useState<Carregavel<IndiceNacional>>({ status: "loading" });
  const [tentativaInicial, setTentativaInicial] = useState(0);

  useEffect(() => {
    let cancelado = false;
    async function carregar() {
      setIndiceNacional({ status: "loading" });
      try {
        const { indice } = await client.getIndiceNacional();
        if (!cancelado) setIndiceNacional({ status: "ok", dados: indice });
      } catch (error) {
        if (!cancelado) setIndiceNacional({ status: "error", erro: registrarErro(error) });
      }
    }
    carregar();
    return () => {
      cancelado = true;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps -- client é estável (useState preguiçoso); tentativaInicial só existe para forçar um novo efeito no retry.
  }, [tentativaInicial]);

  // ---- Seleção de município ----
  const [queryMunicipio, setQueryMunicipio] = useState("");
  const [municipioSelecionado, setMunicipioSelecionado] = useState<EntradaIndiceNacional | null>(null);
  const [fluxoMunicipio, setFluxoMunicipio] = useState<FluxoMunicipio>({ status: "idle" });

  const opcoesMunicipio = useMemo(() => {
    if (indiceNacional.status !== "ok") return [];
    return buscarMunicipios(indiceNacional.dados.municipios, queryMunicipio).map((m) => ({
      key: m.codigoIbge,
      label: m.nome,
      sublabel: m.uf,
      value: m,
    }));
  }, [indiceNacional, queryMunicipio]);

  function limparEscola() {
    escolaControllerRef.current.cancelar();
    setQueryEscola("");
    setEscolaSelecionadaCodigo(null);
    setFluxoEscola({ status: "idle" });
    setEtapaEscolhida(null);
    setEdicaoEscolhida(null);
    setHistoricoAberto(false);
  }

  async function selecionarMunicipio(entrada: EntradaIndiceNacional) {
    setMunicipioSelecionado(entrada);
    setQueryMunicipio(entrada.nome);
    limparEscola();
    setFluxoMunicipio({ status: "loading" });

    try {
      const resultado = await municipioControllerRef.current.run(async (signal) => {
        if (entrada.particoes === 1) {
          const { particao } = await client.getParticao(entrada.codigoIbge, "001.json", { signal });
          return { tipo: "unica" as const, particao };
        }
        const { indice } = await client.getIndiceMunicipal(entrada.codigoIbge, { signal });
        return { tipo: "subdividido" as const, indice };
      });
      if (eDescartado(resultado)) return;
      setFluxoMunicipio({ status: "ok", dados: resultado });
    } catch (error) {
      setFluxoMunicipio({ status: "error", erro: registrarErro(error) });
    }
  }

  function limparMunicipio() {
    municipioControllerRef.current.cancelar();
    setMunicipioSelecionado(null);
    setQueryMunicipio("");
    setFluxoMunicipio({ status: "idle" });
    limparEscola();
  }

  // ---- Seleção de escola ----
  const [queryEscola, setQueryEscola] = useState("");
  const [escolaSelecionadaCodigo, setEscolaSelecionadaCodigo] = useState<string | null>(null);
  const [fluxoEscola, setFluxoEscola] = useState<FluxoEscola>({ status: "idle" });
  // Painel de evolução histórica (ver HistoricoEscola.tsx) — abrir/fechar não mexe em nenhuma
  // seleção acima; trocar de escola fecha o painel para nunca exibir histórico de uma escola que
  // não é mais a selecionada (o componente também é remontado por key={escolaAtual.codigoInep}).
  const [historicoAberto, setHistoricoAberto] = useState(false);

  const municipioAtual: Municipio | null = useMemo(() => {
    if (fluxoMunicipio.status !== "ok") return null;
    return fluxoMunicipio.dados.tipo === "unica" ? fluxoMunicipio.dados.particao.municipio : fluxoMunicipio.dados.indice.municipio;
  }, [fluxoMunicipio]);

  const opcoesEscolaSubdividido = useMemo(() => {
    if (fluxoMunicipio.status !== "ok" || fluxoMunicipio.dados.tipo !== "subdividido") return [];
    return buscarEscolasNoIndiceMunicipal(fluxoMunicipio.dados.indice.escolas, queryEscola).map((e) => ({
      key: e.codigoInep,
      label: e.nome,
      sublabel: `INEP ${e.codigoInep} · ${e.rede}`,
      value: e,
    }));
  }, [fluxoMunicipio, queryEscola]);

  const opcoesEscolaUnica = useMemo(() => {
    if (fluxoMunicipio.status !== "ok" || fluxoMunicipio.dados.tipo !== "unica") return [];
    return buscarEscolasNaParticao(fluxoMunicipio.dados.particao.escolas, queryEscola).map((e) => ({
      key: e.codigoInep,
      label: e.nome,
      sublabel: `INEP ${e.codigoInep} · ${e.rede}`,
      value: e,
    }));
  }, [fluxoMunicipio, queryEscola]);

  async function selecionarEscolaSubdividida(entrada: EntradaIndiceMunicipal) {
    if (!municipioSelecionado) return;
    setEscolaSelecionadaCodigo(entrada.codigoInep);
    setQueryEscola(entrada.nome);
    setEtapaEscolhida(null);
    setEdicaoEscolhida(null);
    setHistoricoAberto(false);
    setFluxoEscola({ status: "loading" });
    try {
      const resultado = await escolaControllerRef.current.run(async (signal) => {
        const { particao } = await client.getParticao(municipioSelecionado.codigoIbge, entrada.particao, { signal });
        return particao;
      });
      if (eDescartado(resultado)) return;
      setFluxoEscola({ status: "ok", dados: resultado });
    } catch (error) {
      setFluxoEscola({ status: "error", erro: registrarErro(error) });
    }
  }

  function selecionarEscolaUnica(entrada: Escola) {
    setEscolaSelecionadaCodigo(entrada.codigoInep);
    setQueryEscola(entrada.nome);
    setEtapaEscolhida(null);
    setEdicaoEscolhida(null);
    setHistoricoAberto(false);
  }

  // Escola efetivamente resolvida — vem de fontes diferentes conforme o tipo de município, mas o
  // resto da tela (etapas, edições, indicadores) trata as duas da mesma forma a partir daqui.
  const escolaAtual: Escola | null = useMemo(() => {
    if (!escolaSelecionadaCodigo) return null;
    if (fluxoMunicipio.status === "ok" && fluxoMunicipio.dados.tipo === "unica") {
      return fluxoMunicipio.dados.particao.escolas.find((e) => e.codigoInep === escolaSelecionadaCodigo) ?? null;
    }
    if (fluxoEscola.status === "ok") {
      return fluxoEscola.dados.escolas.find((e) => e.codigoInep === escolaSelecionadaCodigo) ?? null;
    }
    return null;
  }, [escolaSelecionadaCodigo, fluxoMunicipio, fluxoEscola]);

  // ---- Etapa e edição ----
  const [etapaEscolhida, setEtapaEscolhida] = useState<Etapa | null>(null);
  const [edicaoEscolhida, setEdicaoEscolhida] = useState<string | null>(null);

  const etapasPossiveis = useMemo(() => (escolaAtual ? etapasDisponiveis(escolaAtual) : []), [escolaAtual]);
  const etapaEfetiva = etapaEscolhida && etapasPossiveis.includes(etapaEscolhida) ? etapaEscolhida : (etapasPossiveis[0] ?? null);

  const edicoesPossiveis = useMemo(
    () => (escolaAtual && etapaEfetiva ? edicoesDisponiveis(escolaAtual, etapaEfetiva) : []),
    [escolaAtual, etapaEfetiva],
  );
  const edicaoEfetiva =
    edicaoEscolhida && edicoesPossiveis.includes(edicaoEscolhida) ? edicaoEscolhida : (edicoesPossiveis[edicoesPossiveis.length - 1] ?? null);

  const registroAtual = escolaAtual && etapaEfetiva && edicaoEfetiva ? escolaAtual.etapas[etapaEfetiva]?.[edicaoEfetiva] : undefined;

  // ---- Renderização ----

  // Prioridade máxima: uma incompatibilidade de versão detectada em QUALQUER parte do fluxo
  // (carga inicial, município ou escola) substitui a ferramenta inteira por este aviso — nunca um
  // retry comum, que nunca resolveria isto (ver registrarErro acima).
  if (versaoDesatualizada) {
    return (
      <div className="saeb-tool">
        <StatePanel tipo="error">
          Os dados foram atualizados enquanto esta página estava aberta. Para continuar sem misturar informações de
          versões diferentes, é preciso recarregar a página.
        </StatePanel>
        <button type="button" className="saeb-retry" onClick={() => window.location.reload()}>
          <RotateCcw size={15} aria-hidden="true" /> Recarregar página
        </button>
      </div>
    );
  }

  if (indiceNacional.status === "loading") {
    return (
      <div className="saeb-tool">
        <StatePanel tipo="loading">Carregando lista de municípios…</StatePanel>
      </div>
    );
  }
  if (indiceNacional.status === "error") {
    return (
      <div className="saeb-tool">
        <StatePanel tipo="error">{indiceNacional.erro}</StatePanel>
        <RetryButton onClick={() => setTentativaInicial((n) => n + 1)} />
      </div>
    );
  }

  return (
    <div className="saeb-tool">
      <div className="saeb-field">
        <label htmlFor="saeb-municipio">Município</label>
        <div className="saeb-field-row">
          {municipioSelecionado ? (
            <div className="saeb-selected-chip">
              <span>
                {municipioSelecionado.nome} <small>{municipioSelecionado.uf}</small>
              </span>
              <button type="button" onClick={limparMunicipio} aria-label="Trocar município">
                <X size={16} aria-hidden="true" />
              </button>
            </div>
          ) : (
            <SaebComboboxMunicipio
              query={queryMunicipio}
              onQueryChange={setQueryMunicipio}
              onSelect={selecionarMunicipio}
              opcoes={opcoesMunicipio}
            />
          )}
        </div>
        {!municipioSelecionado && queryMunicipio.trim() !== "" && opcoesMunicipio.length === 0 && (
          <p className="saeb-hint">
            <HelpCircle size={15} aria-hidden="true" /> Nenhum município encontrado para “{queryMunicipio}”.
          </p>
        )}
      </div>

      {municipioSelecionado && fluxoMunicipio.status === "loading" && <StatePanel tipo="loading">Carregando escolas de {municipioSelecionado.nome}…</StatePanel>}
      {municipioSelecionado && fluxoMunicipio.status === "error" && (
        <>
          <StatePanel tipo="error">{fluxoMunicipio.erro}</StatePanel>
          <RetryButton onClick={() => selecionarMunicipio(municipioSelecionado)} />
        </>
      )}

      {municipioSelecionado && fluxoMunicipio.status === "ok" && (
        <div className="saeb-field">
          <label htmlFor="saeb-escola">Escola</label>
          {fluxoMunicipio.dados.tipo === "unica" ? (
            <SaebComboboxEscola query={queryEscola} onQueryChange={setQueryEscola} onSelect={selecionarEscolaUnica} opcoes={opcoesEscolaUnica} />
          ) : (
            <SaebComboboxEscolaIndice query={queryEscola} onQueryChange={setQueryEscola} onSelect={selecionarEscolaSubdividida} opcoes={opcoesEscolaSubdividido} />
          )}
          {queryEscola.trim() !== "" &&
            !escolaAtual &&
            (fluxoMunicipio.dados.tipo === "unica" ? opcoesEscolaUnica.length === 0 : opcoesEscolaSubdividido.length === 0) && (
              <p className="saeb-hint">
                <HelpCircle size={15} aria-hidden="true" /> Nenhuma escola encontrada para “{queryEscola}”.
              </p>
            )}
        </div>
      )}

      {fluxoEscola.status === "loading" && <StatePanel tipo="loading">Carregando dados da escola…</StatePanel>}
      {fluxoEscola.status === "error" && (
        <>
          <StatePanel tipo="error">{fluxoEscola.erro}</StatePanel>
          {municipioSelecionado && (
            <RetryButton
              onClick={() => {
                const indice = fluxoMunicipio.status === "ok" && fluxoMunicipio.dados.tipo === "subdividido" ? fluxoMunicipio.dados.indice : null;
                const entrada = indice?.escolas.find((e) => e.codigoInep === escolaSelecionadaCodigo);
                if (entrada) selecionarEscolaSubdividida(entrada);
              }}
            />
          )}
        </>
      )}

      {escolaAtual && (
        <section className="saeb-resultado" aria-live="polite">
          <div className="saeb-escola-id">
            <School size={20} aria-hidden="true" />
            <div>
              <strong>{escolaAtual.nome}</strong>
              <span>
                Código INEP {escolaAtual.codigoInep} · Rede {escolaAtual.rede}
              </span>
            </div>
          </div>

          {etapasPossiveis.length === 0 ? (
            <p className="saeb-hint">
              <HelpCircle size={15} aria-hidden="true" /> Esta escola não tem nenhum resultado divulgado nos pacotes oficiais consultados.
            </p>
          ) : (
            <>
              <div className="saeb-selects">
                <label>
                  Etapa
                  <select value={etapaEfetiva ?? ""} onChange={(e) => setEtapaEscolhida(e.target.value as Etapa)}>
                    {etapasPossiveis.map((etapa) => (
                      <option key={etapa} value={etapa}>
                        {ETAPA_LABEL[etapa]}
                      </option>
                    ))}
                  </select>
                </label>
                <label>
                  Edição
                  <select value={edicaoEfetiva ?? ""} onChange={(e) => setEdicaoEscolhida(e.target.value)} disabled={edicoesPossiveis.length === 0}>
                    {edicoesPossiveis.map((edicao) => (
                      <option key={edicao} value={edicao}>
                        {edicao}
                      </option>
                    ))}
                  </select>
                </label>
              </div>

              {edicoesPossiveis.length === 0 ? (
                <p className="saeb-hint">
                  <HelpCircle size={15} aria-hidden="true" /> Sem edições divulgadas para {ETAPA_LABEL[etapaEfetiva as Etapa]}.
                </p>
              ) : (
                <div className="saeb-indicadores-grid">
                  <IndicadorGrupo titulo="Proficiência do SAEB" campos={ORDEM_INDICADORES_SAEB} registro={registroAtual} />
                  <IndicadorGrupo titulo="Ideb e componentes" campos={ORDEM_INDICADORES_IDEB} registro={registroAtual} />
                </div>
              )}

              <p className="saeb-fonte">
                Fonte: MEC/Inep · edição {edicaoEfetiva} · {ETAPA_LABEL[etapaEfetiva as Etapa]}. Um único ponto isolado diz pouco — veja a
                seção acima sobre uso responsável antes de tirar conclusões.
              </p>

              {etapasPossiveis.length > 0 && !historicoAberto && (
                <button type="button" className="saeb-retry saeb-historico-abrir" onClick={() => setHistoricoAberto(true)}>
                  <TrendingUp size={15} aria-hidden="true" /> Ver evolução da escola
                </button>
              )}

              {historicoAberto && (
                <HistoricoEscola
                  key={escolaAtual.codigoInep}
                  escola={escolaAtual}
                  municipio={municipioAtual}
                  etapaInicial={etapaEfetiva}
                  onFechar={() => setHistoricoAberto(false)}
                />
              )}
            </>
          )}
        </section>
      )}
    </div>
  );
}

function IndicadorGrupo({
  titulo,
  campos,
  registro,
}: {
  titulo: string;
  campos: CampoIndicador[];
  registro: RegistroEdicao | undefined;
}) {
  return (
    <div className="saeb-indicador-grupo">
      <h4>{titulo}</h4>
      <dl>
        {campos.map((campo) => {
          const resolvido = resolverIndicador(registro, campo);
          const info = INDICADOR_LABEL[campo];
          return (
            <div key={campo} className="saeb-indicador-linha">
              <dt>{info.label}</dt>
              <dd>
                {resolvido.tipo === "valor" && (
                  <>
                    <span className="saeb-valor">{formatarValorIndicador(resolvido.valor)}</span>
                    {resolvido.observacao && <small>{resolvido.observacao}</small>}
                  </>
                )}
                {resolvido.tipo === "ausente_oficial" && (
                  <span className="saeb-ausente" title={resolvido.motivo}>
                    Não divulgado — {resolvido.motivo}
                  </span>
                )}
                {resolvido.tipo === "nao_informado" && <span className="saeb-nao-informado">Não informado nesta divulgação</span>}
              </dd>
            </div>
          );
        })}
      </dl>
    </div>
  );
}

// Pequenos adaptadores para o Combobox genérico — cada um só formata as opções já filtradas por
// lib/saeb/busca.ts (ver os useMemo acima), sem duplicar a lógica de teclado/ARIA.

function SaebComboboxMunicipio({
  query,
  onQueryChange,
  onSelect,
  opcoes,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (v: EntradaIndiceNacional) => void;
  opcoes: { key: string; label: string; sublabel?: string; value: EntradaIndiceNacional }[];
}) {
  return (
    <Combobox
      id="saeb-municipio"
      query={query}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      options={opcoes}
      placeholder="Digite o nome do município"
      ariaLabel="Buscar município"
    />
  );
}

function SaebComboboxEscola({
  query,
  onQueryChange,
  onSelect,
  opcoes,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (v: Escola) => void;
  opcoes: { key: string; label: string; sublabel?: string; value: Escola }[];
}) {
  return (
    <Combobox
      id="saeb-escola"
      query={query}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      options={opcoes}
      placeholder="Digite o nome da escola"
      ariaLabel="Buscar escola"
    />
  );
}

function SaebComboboxEscolaIndice({
  query,
  onQueryChange,
  onSelect,
  opcoes,
}: {
  query: string;
  onQueryChange: (v: string) => void;
  onSelect: (v: EntradaIndiceMunicipal) => void;
  opcoes: { key: string; label: string; sublabel?: string; value: EntradaIndiceMunicipal }[];
}) {
  return (
    <Combobox
      id="saeb-escola"
      query={query}
      onQueryChange={onQueryChange}
      onSelect={onSelect}
      options={opcoes}
      placeholder="Digite o nome da escola"
      ariaLabel="Buscar escola"
    />
  );
}
