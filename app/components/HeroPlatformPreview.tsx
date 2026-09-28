import { ArrowUpRight, BookOpenText, LayoutGrid, MapPinned, TrendingUp, type LucideIcon } from "lucide-react";

type PreviewLink = {
  title: string;
  description: string;
  href: string;
  icon: LucideIcon;
};

// Os quatro links abaixo são os destinos reais da plataforma hoje — sem
// gráfico ilustrativo, sem valor demonstrativo. Cada linha é um <a> de
// verdade, navegável, não um elemento decorativo que aparenta ser clicável.
const links: PreviewLink[] = [
  {
    title: "BNCC",
    description: "Habilidades por etapa, código ou busca livre.",
    href: "/bncc",
    icon: BookOpenText,
  },
  {
    title: "Matrizes do SAEB",
    description: "Matriz tradicional e matriz alinhada à BNCC.",
    href: "/saeb/matriz",
    icon: LayoutGrid,
  },
  {
    title: "Resultados do SAEB",
    description: "Consulta por escola e por município, por edição.",
    href: "/saeb",
    icon: TrendingUp,
  },
  {
    title: "Resultados do SARESP",
    description: "Comparação de resultados por escola.",
    href: "/saresp",
    icon: MapPinned,
  },
];

export function HeroPlatformPreview() {
  return (
    <div className="hero-preview" aria-label="Ferramentas disponíveis no Tempo Docente">
      <div className="preview-label"><span />Disponível agora</div>
      <nav className="preview-links" aria-label="Ferramentas disponíveis">
        {links.map((link) => {
          const Icon = link.icon;
          return (
            <a className="preview-link-item" href={link.href} key={link.title}>
              <span className="preview-link-icon"><Icon size={20} aria-hidden="true" /></span>
              <span className="preview-link-text">
                <strong>{link.title}</strong>
                <span>{link.description}</span>
              </span>
              <ArrowUpRight size={16} aria-hidden="true" className="preview-link-arrow" />
            </a>
          );
        })}
      </nav>
    </div>
  );
}
