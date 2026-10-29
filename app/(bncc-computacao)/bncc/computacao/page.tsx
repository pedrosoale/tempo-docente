import type { Metadata } from "next";
import { ArrowRight, Search } from "lucide-react";
import {
  ETAPAS_URL,
  ETAPA_TODAS,
  EIXOS_URL,
  TAMANHO_MAXIMO_BUSCA,
  agruparResultados,
  buscar,
  contarPorEtapa,
  descreverSelecao,
  lerConsulta,
  listarNumerosCompetenciaMedio,
  listarOpcoesAno,
  montarQueryString,
  obterFontesPublicas,
  paginar,
} from "@/lib/bncc/computacao-consulta";
import { NOME_OFICIAL_COMPUTACAO } from "@/lib/bncc/computacao";
import Paginacao from "./components/Paginacao";
import PremissasCompetencias from "./components/PremissasCompetencias";
import ResultadoItem from "./components/ResultadoItem";
import "./computacao.css";

const CAMINHO = "/bncc/computacao";
const TITULO = "BNCC Computação: habilidades e objetivos oficiais | Tempo Docente";
const DESCRICAO =
  "Consulte o complemento nacional à BNCC “Computação na Educação Básica”: objetivos e habilidades da Educação Infantil ao Ensino Médio, com explicações e exemplos do documento oficial.";

export const metadata: Metadata = {
  title: TITULO,
  description: DESCRICAO,
  alternates: { canonical: CAMINHO },
  openGraph: { title: TITULO, description: DESCRICAO, url: CAMINHO },
  twitter: { card: "summary", title: TITULO, description: DESCRICAO },
};

type ComputacaoPageProps = {
  searchParams?: Promise<Record<string, string | string[] | undefined>>;
};

export default async function BnccComputacaoPage({ searchParams }: ComputacaoPageProps) {
  // Nenhum parâmetro quebra a página: repetidos, inválidos, incompatíveis ou de formato inesperado
  // são saneados em lerConsulta() (lib/bncc/computacao-consulta.ts) e viram avisos visíveis.
  const params = await searchParams;
  const consulta = lerConsulta(params);
  const { filtros } = consulta;
  const todosOsResultados = consulta.ativa ? buscar(filtros) : [];
  // Só a página atual é renderizada: explicações e exemplos dos demais resultados não vão para o HTML.
  const pagina = paginar(todosOsResultados, consulta.pagina);
  const avisos = pagina.aviso ? [...consulta.avisos, pagina.aviso] : consulta.avisos;
  const grupos = agruparResultados(pagina.itens);
  const etapas = contarPorEtapa();
  const total = etapas.reduce((soma, e) => soma + e.total, 0);
  const selecao = descreverSelecao(filtros);
  const opcoesAno = listarOpcoesAno();
  const fontes = obterFontesPublicas();

  return (
    <>
      <section className="comp-intro">
        <div className="container">
          <nav className="bncc-breadcrumb comp-breadcrumb" aria-label="Breadcrumb">
            <a href="/">Início</a><span aria-hidden="true">/</span>
            <a href="/bncc">BNCC</a><span aria-hidden="true">/</span>
            <span aria-current="page">BNCC Computação</span>
          </nav>

          <div className="comp-intro-grid">
            <div>
              <div className="section-kicker"><span /> BNCC Computação</div>
              <h1>{NOME_OFICIAL_COMPUTACAO}</h1>
              <p className="comp-lede">
                Consulte os objetivos de aprendizagem e desenvolvimento da Educação Infantil e as habilidades do Ensino Fundamental e do Ensino
                Médio, com as explicações e os exemplos do documento oficial.
              </p>
            </div>
            <aside className="comp-sobre" aria-labelledby="comp-sobre-titulo">
              <h2 id="comp-sobre-titulo">Sobre este documento</h2>
              <ul>
                <li>É um complemento nacional à BNCC, instituído pela Resolução CNE/CEB nº 1/2022.</li>
                <li>Abrange a Educação Infantil, o Ensino Fundamental e o Ensino Médio.</li>
                <li>Traz objetivos de aprendizagem e desenvolvimento (Educação Infantil) ou habilidades (Ensino Fundamental e Médio).</li>
                <li>
                  Habilidades, objetivos, explicações e exemplos foram transcritos do documento oficial e conferidos com ele página a página.
                  Normalizações apenas tipográficas e divergências do próprio documento são sinalizadas nesta consulta.
                </li>
                <li>Não é o Currículo Paulista nem o currículo de qualquer rede de ensino.</li>
                <li>Não é a matriz do SAEB e não representa associação automática com avaliações externas.</li>
              </ul>
            </aside>
          </div>
        </div>
      </section>

      <section className="comp-secao comp-secao-docs" aria-labelledby="comp-docs-titulo">
        <div className="container">
          <h2 id="comp-docs-titulo">Premissas e competências do documento</h2>
          <p className="comp-secao-lede">
            Texto introdutório do documento, separado dos resultados da consulta: as premissas da Educação Infantil e as competências específicas
            do Ensino Fundamental e do Ensino Médio.
          </p>
          <PremissasCompetencias />
        </div>
      </section>

      <section className="comp-secao comp-secao-consulta" aria-labelledby="comp-consulta-titulo">
        <div className="container">
          <h2 id="comp-consulta-titulo">Consultar habilidades e objetivos</h2>

          <form className="comp-form" action={`${CAMINHO}#resultados`} method="get" role="search" aria-label="Consultar a BNCC Computação">
            <div className="comp-field comp-field-busca">
              <label htmlFor="comp-q">Código ou palavras</label>
              <div className="comp-busca">
                <Search size={18} aria-hidden="true" />
                <input
                  id="comp-q"
                  type="search"
                  name="q"
                  defaultValue={filtros.q}
                  maxLength={TAMANHO_MAXIMO_BUSCA}
                  placeholder="Ex.: EF05CO11, algoritmo, dados…"
                  autoComplete="off"
                />
              </div>
            </div>

            <div className="comp-field">
              <label htmlFor="comp-etapa">Etapa</label>
              <select id="comp-etapa" name="etapa" defaultValue={filtros.etapa ?? ETAPA_TODAS}>
                <option value={ETAPA_TODAS}>Todas as etapas</option>
                {ETAPAS_URL.map((e) => (
                  <option key={e.valor} value={e.valor}>{e.rotulo}</option>
                ))}
              </select>
            </div>

            <div className="comp-field">
              <label htmlFor="comp-ano">Ano (Ensino Fundamental)</label>
              <select id="comp-ano" name="ano" defaultValue={filtros.ano?.valor ?? ""}>
                <option value="">Todos os anos</option>
                {ETAPAS_URL.filter((e) => opcoesAno.some((o) => o.escopo === e.valor)).map((e) => (
                  <optgroup key={e.valor} label={e.rotulo}>
                    {opcoesAno
                      .filter((o) => o.escopo === e.valor)
                      .map((o) => (
                        <option key={o.valor} value={o.valor}>{o.bloco ? `Somente o bloco ${o.rotulo}` : o.rotulo}</option>
                      ))}
                  </optgroup>
                ))}
              </select>
            </div>

            <div className="comp-field">
              <label htmlFor="comp-eixo">Eixo</label>
              <select id="comp-eixo" name="eixo" defaultValue={filtros.eixo?.valor ?? ""}>
                <option value="">Todos os eixos</option>
                {EIXOS_URL.map((e) => (
                  <option key={e.valor} value={e.valor}>{e.rotulo}</option>
                ))}
              </select>
            </div>

            <div className="comp-field">
              <label htmlFor="comp-competencia">Competência específica (Ensino Médio)</label>
              <select id="comp-competencia" name="competencia" defaultValue={filtros.competencia ? String(filtros.competencia) : ""}>
                <option value="">Todas</option>
                {listarNumerosCompetenciaMedio().map((n) => (
                  <option key={n} value={n}>Competência {n}</option>
                ))}
              </select>
            </div>

            <div className="comp-form-acoes">
              <button type="submit" className="comp-botao comp-botao-primario">Consultar <ArrowRight size={17} aria-hidden="true" /></button>
              <a className="comp-botao comp-botao-secundario" href={CAMINHO}>Limpar filtros</a>
            </div>

            <p className="comp-form-ajuda">
              A busca ignora acentos e procura no código, no texto, no objeto de conhecimento, na explicação e nos exemplos. Ao escolher um ano,
              aparecem também as habilidades do bloco que o inclui (1º ao 5º ano ou 6º ao 9º ano). O Ensino Médio não tem eixos nem anos neste
              documento; use a competência específica.
            </p>
          </form>

          <div className="comp-resultados" id="resultados" tabIndex={-1}>
            {avisos.length > 0 && (
              <ul className="comp-avisos" aria-label="Avisos sobre os filtros">
                {avisos.map((aviso) => (
                  <li key={aviso}>{aviso}</li>
                ))}
              </ul>
            )}

            {consulta.ativa ? (
              <>
                <div className="comp-resumo">
                  <p className="comp-contagem" role="status">
                    <strong>{pagina.total}</strong> {pagina.total === 1 ? "resultado" : "resultados"} <span>de {total}</span>
                    {pagina.totalPaginas > 1 && (
                      <span className="comp-intervalo">{` · mostrando ${pagina.de}–${pagina.ate} (página ${pagina.pagina} de ${pagina.totalPaginas})`}</span>
                    )}
                  </p>
                  {selecao.length > 0 && (
                    <p className="comp-selecao">
                      <span>Seleção atual:</span> {selecao.join(" · ")}
                    </p>
                  )}
                </div>

                {pagina.total === 0 ? (
                  <div className="comp-vazio">
                    <h3>Nenhum resultado para esta seleção.</h3>
                    <p>Tente outro código ou outras palavras, ou remova algum filtro.</p>
                    <a className="comp-botao comp-botao-secundario" href={CAMINHO}>Limpar filtros</a>
                  </div>
                ) : (
                  grupos.map((grupo) => (
                    <section className="comp-grupo" key={`${grupo.contexto}|${grupo.rotulo}`} aria-labelledby={`g-${grupo.itens[0].codigo.toLowerCase()}`}>
                      <h3 id={`g-${grupo.itens[0].codigo.toLowerCase()}`}>
                        {grupo.rotulo} <small>{grupo.contexto}</small>
                      </h3>
                      <ul className="comp-lista">
                        {grupo.itens.map((item) => (
                          <ResultadoItem key={item.codigo} item={item} />
                        ))}
                      </ul>
                    </section>
                  ))
                )}
                {pagina.totalPaginas > 1 && <Paginacao filtros={filtros} pagina={pagina.pagina} totalPaginas={pagina.totalPaginas} />}
              </>
            ) : (
              <div className="comp-etapas">
                <h3>Escolha uma etapa</h3>
                <p>{total} objetivos e habilidades no documento. Escolha uma etapa ou use a busca acima.</p>
                <ul>
                  {etapas.map((e) => (
                    <li key={e.escopo}>
                      <a href={`${CAMINHO}${montarQueryString({ etapa: e.escopo })}#resultados`}>
                        <span>{e.rotulo}</span>
                        <strong>{e.total}</strong>
                      </a>
                    </li>
                  ))}
                </ul>
                <a className="comp-todas" href={`${CAMINHO}${montarQueryString({ etapa: ETAPA_TODAS })}#resultados`}>
                  Ver todos os {total} <ArrowRight size={16} aria-hidden="true" />
                </a>
              </div>
            )}
          </div>

          <aside className="comp-fontes" aria-labelledby="comp-fontes-titulo">
            <h2 id="comp-fontes-titulo">Fontes oficiais</h2>
            <ul>
              {fontes.map((f) => (
                <li key={f.url}>
                  <a href={f.url} target="_blank" rel="noopener noreferrer">{f.titulo}</a>
                </li>
              ))}
            </ul>
            <p>
              Os textos foram transcritos do documento oficial do MEC/CNE. Esta página é uma ferramenta de consulta e não substitui o documento.
            </p>
          </aside>
        </div>
      </section>
    </>
  );
}
