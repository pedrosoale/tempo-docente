import type { Metadata } from "next";
import { ArrowRight, ArrowUpRight, BookOpenText, Layers, School, Search, Sparkles } from "lucide-react";
import { getAllRegistros } from "@/lib/bncc/data";
import { filterSkills } from "@/lib/bncc/search.mjs";
import type { BnccRegistro } from "@/lib/bncc/types";

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

type BnccHubPageProps = { searchParams?: Promise<{ q?: string }> };

function registroMeta(registro: BnccRegistro): string {
  if (registro.tipo === "competencia_geral") return `Competência geral · Competência ${registro.numero} de 10`;
  return `Habilidade · ${registro.etapa} · ${registro.ano} · ${registro.componente}`;
}

function registroHref(registro: BnccRegistro): string {
  if (registro.tipo === "competencia_geral") return `/bncc/competencias-gerais#competencia-${registro.numero}`;
  return `/bncc/${registro.codigo.toLowerCase()}`;
}

export default async function BnccHubPage({ searchParams }: BnccHubPageProps) {
  const params = await searchParams;
  const query = params?.q?.trim() ?? "";
  const results = query ? filterSkills(getAllRegistros(), { query }) : [];

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
            </div>

            {results.length === 0 ? (
              <div className="bncc-empty-state">
                <BookOpenText size={30} aria-hidden="true" />
                <h2>Nenhum registro encontrado.</h2>
                <p>Tente outro código ou termo de busca.</p>
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
          </div>
        </section>
      ) : (
        <section className="section quick-access" id="etapas">
          <div className="container">
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

              <div className="access-card access-card-soon" aria-disabled="true">
                <div className="access-card-top">
                  <span className="access-icon"><Layers size={22} aria-hidden="true" /></span>
                  <span className="access-label">Bebês a crianças pequenas</span>
                  <span className="soon-badge">Em breve</span>
                </div>
                <div>
                  <h3>Educação Infantil</h3>
                  <p>Campos de experiências e objetivos de aprendizagem e desenvolvimento.</p>
                </div>
                <span className="card-action card-action-soon">Em breve</span>
              </div>

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

              <div className="access-card access-card-soon" aria-disabled="true">
                <div className="access-card-top">
                  <span className="access-icon"><School size={22} aria-hidden="true" /></span>
                  <span className="access-label">1ª à 3ª série</span>
                  <span className="soon-badge">Em breve</span>
                </div>
                <div>
                  <h3>Ensino Médio</h3>
                  <p>Competências e habilidades por área do conhecimento.</p>
                </div>
                <span className="card-action card-action-soon">Em breve</span>
              </div>
            </div>
          </div>
        </section>
      )}
    </>
  );
}
