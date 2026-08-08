import { BookOpenCheck, Database, ShieldCheck } from "lucide-react";
import Link from "next/link";
import { bnccMetadata } from "@/lib/bncc/data";

type BnccIntroProps = {
  title?: string;
  subtitle?: string;
  currentYear?: string;
  scopeComponent?: string;
  scopeSegmento?: string;
  scopeTotal?: string;
  scopeGrades?: string;
  scopeVersaoFonte?: string;
};

export function BnccIntro({
  title = "Consulte a BNCC",
  subtitle = "Encontre habilidades da Base Nacional Comum Curricular por código, ano ou conteúdo.",
  currentYear,
  scopeComponent = "Matemática",
  scopeSegmento = "Ensino Fundamental — Anos Finais",
  scopeTotal = "121 habilidades",
  scopeGrades = "6º, 7º, 8º e 9º anos",
  scopeVersaoFonte = bnccMetadata.versao_fonte,
}: BnccIntroProps) {
  return (
    <section className="bncc-intro">
      <div className="container">
        <nav className="bncc-breadcrumb" aria-label="Breadcrumb">
          <Link href="/">Início</Link><span aria-hidden="true">/</span>
          <Link href="/bncc">BNCC</Link>
          {currentYear && <><span aria-hidden="true">/</span><span aria-current="page">{currentYear}</span></>}
        </nav>

        <div className="bncc-intro-grid">
          <div>
            <div className="section-kicker"><span /> Base curricular oficial</div>
            <h1>{title}</h1>
            <p>{subtitle}</p>
          </div>
          <aside className="bncc-scope-card" aria-label="Escopo da consulta">
            <div><BookOpenCheck size={20} aria-hidden="true" /><span><strong>{scopeComponent}</strong>{scopeSegmento}</span></div>
            <div><Database size={20} aria-hidden="true" /><span><strong>{scopeTotal}</strong>{scopeGrades}</span></div>
            <div><ShieldCheck size={20} aria-hidden="true" /><span><strong>Fonte oficial</strong>{scopeVersaoFonte}</span></div>
          </aside>
        </div>
      </div>
    </section>
  );
}
