import type { Metadata } from "next";
import { ArrowLeft, ArrowRight, BookOpenText, Sparkles } from "lucide-react";
import Link from "next/link";
import { notFound } from "next/navigation";
import { COMPONENTES_ANOS_FINAIS, getAdjacentSkills, getAllRegistros, getRelatedSkills, getRegistroByCode } from "@/lib/bncc/data";

type SkillPageProps = { params: Promise<{ codigo: string }> };

const COMPONENT_SLUGS: Record<string, string> = Object.fromEntries(
  COMPONENTES_ANOS_FINAIS.map((componente) => [componente.nome, componente.slug]),
);

function componentSlug(componente: string): string {
  return COMPONENT_SLUGS[componente] ?? componente
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "");
}

export function generateStaticParams() {
  return getAllRegistros()
    .filter((registro) => registro.codigo)
    .map((registro) => ({ codigo: registro.codigo!.toLowerCase() }));
}

export async function generateMetadata({ params }: SkillPageProps): Promise<Metadata> {
  const { codigo } = await params;
  const registro = getRegistroByCode(codigo);
  if (!registro || registro.tipo !== "habilidade") return { title: "Habilidade não encontrada | Tempo Docente" };
  const skill = registro;
  const contexto = skill.unidade_tematica ?? skill.campo_atuacao ?? skill.componente;
  return {
    title: `${skill.codigo} — Habilidade BNCC de ${skill.componente} do ${skill.ano} | Tempo Docente`,
    description: `Consulte a habilidade ${skill.codigo} da BNCC de ${skill.componente} e suas informações curriculares.`,
    alternates: { canonical: `/bncc/${skill.codigo.toLowerCase()}` },
    openGraph: {
      title: `${skill.codigo} — BNCC de ${skill.componente} do ${skill.ano}`,
      description: `Habilidade oficial da BNCC em ${contexto}.`,
      url: `/bncc/${skill.codigo.toLowerCase()}`,
    },
  };
}

function displayObject(value: string) {
  return value.split("\n");
}

export default async function SkillPage({ params }: SkillPageProps) {
  const { codigo } = await params;
  const registro = getRegistroByCode(codigo);
  // Only "habilidade" (Fundamental) records resolve here today. Other tipos in
  // the union will get their own render branch when they gain a codigo-bearing
  // route; until then, treat them as not-found rather than rendering a mismatched page.
  if (!registro || registro.tipo !== "habilidade") notFound();
  const skill = registro;

  const { previous, next } = getAdjacentSkills(skill.codigo);
  const related = getRelatedSkills(skill);
  const basePath = `/bncc/${componentSlug(skill.componente)}`;
  const primaryGrade = (skill.anos_aplicaveis[0] ?? skill.ano)[0];
  const gradeSlug = `${primaryGrade}-ano`;
  const groupLabel = skill.unidade_tematica ? "unidade temática" : "campo de atuação";

  return (
    <article className="bncc-skill-page">
      <div className="container">
        <nav className="bncc-breadcrumb" aria-label="Breadcrumb">
          <Link href="/bncc">BNCC</Link><span aria-hidden="true">/</span>
          <Link href={basePath}>{skill.componente}</Link><span aria-hidden="true">/</span>
          <Link href={`${basePath}/${gradeSlug}`}>{skill.ano}</Link><span aria-hidden="true">/</span>
          <span aria-current="page">{skill.codigo}</span>
        </nav>

        <header className="bncc-skill-header">
          <div>
            <span className="bncc-official-label">Dado oficial · BNCC/MEC</span>
            <code>{skill.codigo}</code>
            <h1>{skill.texto}</h1>
          </div>
          <aside className="bncc-skill-context">
            {skill.unidade_tematica && <><span>Unidade temática</span><strong>{skill.unidade_tematica}</strong></>}
            {skill.campo_atuacao && <><span>Campo de atuação</span><strong>{skill.campo_atuacao}</strong></>}
            {skill.objeto_conhecimento && (
              <>
                <span>Objeto de conhecimento</span>
                <strong>{displayObject(skill.objeto_conhecimento).map((line) => <span key={line}>{line}</span>)}</strong>
              </>
            )}
          </aside>
        </header>

        <div className="bncc-detail-grid">
          <section className="bncc-curriculum-card" aria-labelledby="curriculum-title">
            <div className="bncc-card-heading"><BookOpenText size={20} aria-hidden="true" /><h2 id="curriculum-title">Informações curriculares</h2></div>
            <dl>
              {[
                ["Etapa", skill.etapa],
                ["Segmento", skill.segmento],
                ["Área", skill.area],
                ["Componente", skill.componente],
                ["Ano", skill.ano],
                skill.unidade_tematica ? ["Unidade temática", skill.unidade_tematica] : null,
                skill.campo_atuacao ? ["Campo de atuação", skill.campo_atuacao] : null,
              ].filter((row): row is [string, string] => row !== null).map(([term, value]) => <div key={term}><dt>{term}</dt><dd>{value}</dd></div>)}
              {skill.objeto_conhecimento && <div className="full"><dt>Objeto de conhecimento</dt><dd>{skill.objeto_conhecimento}</dd></div>}
            </dl>
          </section>

          <aside className="bncc-source-panel" id="fonte">
            <span>Fonte primária</span>
            <h2>Base Nacional Comum Curricular</h2>
            <p>Ministério da Educação · {skill.versao_fonte}</p>
            <dl><div><dt>Página</dt><dd>{skill.pagina_fonte}</dd></div><div><dt>Classificação</dt><dd>Dado oficial</dd></div></dl>
          </aside>
        </div>

        <nav className="bncc-adjacent" aria-label="Navegação entre habilidades">
          {previous ? <Link href={`/bncc/${previous.codigo.toLowerCase()}`}><ArrowLeft size={18} /><span>Habilidade anterior<strong>{previous.codigo}</strong></span></Link> : <span />}
          {next ? <Link href={`/bncc/${next.codigo.toLowerCase()}`}><span>Próxima habilidade<strong>{next.codigo}</strong></span><ArrowRight size={18} /></Link> : <span />}
        </nav>

        {related.length > 0 && (
          <section className="bncc-related" aria-labelledby="related-title">
            <div className="bncc-section-heading">
              <div><span>Estrutura curricular</span><h2 id="related-title">Outras habilidades deste {groupLabel}</h2></div>
              <Link href={`${basePath}/${gradeSlug}`}>Ver todas do {skill.ano} <ArrowRight size={16} /></Link>
            </div>
            <div className="bncc-related-grid">
              {related.map((item) => (
                <Link key={item.codigo} href={`/bncc/${item.codigo.toLowerCase()}`}>
                  <code>{item.codigo}</code>
                  <p>{item.texto}</p>
                  <span>Mesmo ano e {groupLabel} <ArrowRight size={15} /></span>
                </Link>
              ))}
            </div>
          </section>
        )}

        <aside className="bncc-coming-soon">
          <Sparkles size={22} aria-hidden="true" />
          <div><span>Em breve</span><h2>Ferramentas pedagógicas</h2><p>Atividades, planos de aula, avaliações e sequências didáticas conectadas à habilidade.</p></div>
        </aside>
      </div>
    </article>
  );
}
