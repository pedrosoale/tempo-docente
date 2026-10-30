import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, BookOpenText, Layers, School, Search, Sparkles } from "lucide-react";
import { AREAS_ENSINO_MEDIO, getAllRegistros } from "@/lib/bncc/data";
import { filterSkills } from "@/lib/bncc/search.mjs";
import { lerBuscaHub } from "@/lib/bncc/busca-hub";
import type { BnccRegistro } from "@/lib/bncc/types";
import { buscar as buscarComputacao, contarPorEtapa as contarComputacao, ETAPA_TODAS, lerConsulta as lerConsultaComputacao } from "@/lib/bncc/computacao-consulta";
import { ComputacaoAcesso, ComputacaoResultadosPrevia, ComputacaoSaltoNoResumo } from "@/app/bncc/components/ComputacaoDescoberta";

const AREA_MEDIO_SLUGS: Record<string, string> = Object.fromEntries(AREAS_ENSINO_MEDIO.map((area) => [area.nome, area.slug]));

export const metadata: Metadata = {
  title: "Consulte a BNCC | Tempo Docente",
  description: "Encontre competências, habilidades, objetivos de aprendizagem e conteúdos da Base Nacional Comum Curricular.",
  alternates: { canonical: "/bncc" },
  openGraph: {
    title: "Consulte a BNCC | Tempo Docente",
    description: "Competências, habilidades e conteúdos oficiais da Base Nacional Comum Curricular, organizados para consulta.",
    url: "/bncc",
  },
};

// `q` repetido (?q=a&q=b) chega como array; qualquer formato inesperado também é aceito (ver lib/bncc/busca-hub.ts).
type BnccHubPageProps = { searchParams?: Promise<Record<string, string | string[] | undefined>> };

function registroMeta(registro: BnccRegistro): string {
  if (registro.tipo === "competencia_geral") return `Competência geral · Competência ${registro.numero} de 10`;
  if (registro.tipo === "competencia_especifica") return `Competência específica · ${registro.area} · Competência ${registro.numero}`;
  // Nunca "Habilidade" para Educação Infantil — a BNCC reserva esse rótulo
  // para Fundamental/Médio; aqui os rótulos oficiais são "objetivo" e
  // "direito de aprendizagem e desenvolvimento".
  if (registro.tipo === "direito_aprendizagem") return "Direito de aprendizagem e desenvolvimento · Educação Infantil";
  if (registro.tipo === "objetivo_aprendizagem") return `Objetivo de aprendizagem e desenvolvimento · Educação Infantil · ${registro.campo_experiencia} · ${registro.faixa_etaria}`;
  if (registro.etapa === "Ensino Médio") return `Habilidade · Ensino Médio · ${registro.area} · ${registro.componente}`;
  return `Habilidade · ${registro.etapa} · ${registro.ano} · ${registro.componente}`;
}

function registroHref(registro: BnccRegistro): string {
  if (registro.tipo === "competencia_geral") return `/bncc/competencias-gerais#competencia-${registro.numero}`;
  if (registro.tipo === "competencia_especifica") return `/bncc/ensino-medio/${AREA_MEDIO_SLUGS[registro.area] ?? ""}#competencia-${registro.numero}`;
  // Direitos não têm código oficial nem página própria — âncora estável no
  // hub da Educação Infantil, nunca uma rota /bncc/[codigo] inventada.
  if (registro.tipo === "direito_aprendizagem") return `/bncc/educacao-infantil#direito-${registro.slug}`;
  return `/bncc/${registro.codigo.toLowerCase()}`;
}

function AvisosBusca({ avisos }: { avisos: string[] }) {
  if (avisos.length === 0) return null;
  return (
    <div className="bncc-avisos" role="status" aria-label="Avisos sobre a busca">
      {avisos.map((aviso) => (
        <p key={aviso}>{aviso}</p>
      ))}
    </div>
  );
}

export default async function BnccHubPage({ searchParams }: BnccHubPageProps) {
  const params = await searchParams;
  const { q: query, avisos } = lerBuscaHub(params);
  const results = query ? filterSkills(getAllRegistros(), { query }) : [];

  // BNCC Computação (complemento oficial): consultada na biblioteca própria, nunca copiada para lib/bncc/data.ts,
  // e só quando há termo — sem busca nenhum resultado de Computação é calculado nem renderizado.
  const consultaComputacao = query ? lerConsultaComputacao({ q: query }) : null;
  const resultadosComputacao =
    consultaComputacao && consultaComputacao.filtros.q !== ""
      ? buscarComputacao({ ...consultaComputacao.filtros, etapa: ETAPA_TODAS })
      : [];
  const totalComputacao = contarComputacao().reduce((soma, etapa) => soma + etapa.total, 0);

  return (
    <>
      <section className="bncc-intro">
        <div className="container">
          <div className="bncc-intro-grid">
            <div>
              <div className="section-kicker"><span /> Base curricular oficial</div>
              <h1>Consulte a BNCC</h1>
              <p>Encontre competências, habilidades, objetivos de aprendizagem e conteúdos da Base Nacional Comum Curricular.</p>
            </div>
            <form action="/bncc" method="get" role="search">
              <div className="bncc-search-input">
                <Search size={21} aria-hidden="true" />
                <label className="sr-only" htmlFor="bncc-hub-search">Buscar na BNCC</label>
                <input
                  id="bncc-hub-search"
                  type="search"
                  name="q"
                  defaultValue={query}
                  placeholder="Ex.: EF07MA18, frações, argumentação…"
                  autoComplete="off"
                />
                <button type="submit" aria-label="Buscar"><ArrowRight size={20} /></button>
              </div>
              <div className="bncc-search-examples" aria-label="Exemplos de busca">
                <span>Experimente:</span>
                {["EF07MA18", "frações", "argumentação"].map((example) => (
                  <a key={example} href={`/bncc?q=${encodeURIComponent(example)}`}>{example}</a>
                ))}
              </div>
            </form>
          </div>
        </div>
      </section>

      {query ? (
        <section className="bncc-explorer-section">
          <div className="container">
            <div className="bncc-results-summary" aria-live="polite">
              <div>
                <strong>{results.length}</strong>
                <span>{results.length === 1 ? "registro encontrado" : "registros encontrados"}</span>
              </div>
              <span>Busca em toda a BNCC importada</span>
              {resultadosComputacao.length > 0 ? <ComputacaoSaltoNoResumo total={resultadosComputacao.length} /> : null}
            </div>

            <AvisosBusca avisos={avisos} />

            {resultadosComputacao.length > 0 ? (
              <ComputacaoResultadosPrevia itens={resultadosComputacao} q={consultaComputacao?.filtros.q ?? ""} />
            ) : null}

            <section className="bncc-curricular-secao" aria-labelledby="bncc-curricular-titulo">
              <div className="bncc-curricular-cabecalho">
                <h2 id="bncc-curricular-titulo">Resultados na BNCC curricular</h2>
                <strong>
                  {results.length} {results.length === 1 ? "registro" : "registros"}
                </strong>
              </div>

              {results.length === 0 ? (
                <div className="bncc-empty-state">
                  <BookOpenText size={30} aria-hidden="true" />
                  <h3 className="bncc-empty-state-title">Nenhum registro encontrado.</h3>
                  <p>Tente outro código ou termo de busca.{resultadosComputacao.length > 0 ? " Há resultados na BNCC Computação, logo acima." : ""}</p>
                  <a className="button button-secondary" href="/bncc">Limpar busca</a>
                </div>
              ) : (
                <div className="bncc-results-list">
                  {results.map((registro) => (
                    <article className="bncc-result-card" key={registro.id}>
                      <div className="bncc-result-meta">
                        {registro.codigo && <code>{registro.codigo}</code>}
                        <span>{registroMeta(registro)}</span>
                      </div>
                      <p className="bncc-result-skill">{registro.texto}</p>
                      <div className="bncc-result-footer">
                        <div />
                        <a href={registroHref(registro)}>Ver registro <ArrowRight size={17} aria-hidden="true" /></a>
                      </div>
                    </article>
                  ))}
                </div>
              )}
            </section>
          </div>
        </section>
      ) : (
        <section className="section quick-access" id="etapas">
          <div className="container">
            <AvisosBusca avisos={avisos} />
            <div className="section-heading">
              <div>
                <span className="section-kicker">Etapas</span>
                <h2>O que você quer consultar?</h2>
              </div>
              <p>Escolha uma etapa da Educação Básica ou busque diretamente acima.</p>
            </div>
            <div className="access-grid">
              <a className="access-card" href="/bncc/competencias-gerais">
                <div className="access-card-top">
                  <span className="access-icon"><Sparkles size={22} aria-hidden="true" /></span>
                  <span className="access-label">Toda a Educação Básica</span>
                </div>
                <div>
                  <h3>Competências Gerais</h3>
                  <p>Consulte as 10 competências gerais que orientam a Educação Infantil, o Ensino Fundamental e o Ensino Médio.</p>
                </div>
                <span className="card-action">Ver competências <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>

              <a className="access-card" href="/bncc/educacao-infantil">
                <div className="access-card-top">
                  <span className="access-icon"><Layers size={22} aria-hidden="true" /></span>
                  <span className="access-label">Bebês a crianças pequenas</span>
                </div>
                <div>
                  <h3>Educação Infantil</h3>
                  <p>Campos de experiências e objetivos de aprendizagem e desenvolvimento.</p>
                </div>
                <span className="card-action">Explorar campos <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>

              <a className="access-card" href="/bncc/ensino-fundamental">
                <div className="access-card-top">
                  <span className="access-icon"><BookOpenText size={22} aria-hidden="true" /></span>
                  <span className="access-label">1º ao 9º ano</span>
                </div>
                <div>
                  <h3>Ensino Fundamental</h3>
                  <p>Habilidades por ano, área e componente — Anos Iniciais e Anos Finais completos, do 1º ao 9º ano, nos 9 componentes curriculares.</p>
                </div>
                <span className="card-action">Explorar componentes <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>

              <a className="access-card" href="/bncc/ensino-medio">
                <div className="access-card-top">
                  <span className="access-icon"><School size={22} aria-hidden="true" /></span>
                  <span className="access-label">1ª à 3ª série</span>
                </div>
                <div>
                  <h3>Ensino Médio</h3>
                  <p>Competências específicas e habilidades por área do conhecimento — Formação Geral Básica completa, sem recorte por série.</p>
                </div>
                <span className="card-action">Explorar áreas <ArrowUpRight size={17} aria-hidden="true" /></span>
              </a>

              <ComputacaoAcesso total={totalComputacao} />
            </div>
          </div>
        </section>
      )}
    </>
  );
}
