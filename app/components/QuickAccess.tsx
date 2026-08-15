import { ArrowUpRight, BarChart3, BookOpenText, GitCompareArrows, MapPinned, type LucideIcon } from "lucide-react";

type AccessItem = {
  title: string;
  description: string;
  action: string;
  href: string;
  label: string;
  icon: LucideIcon;
  comingSoon?: boolean;
};

const items: AccessItem[] = [
  {
    title: "BNCC",
    description: "Consulte competências, unidades temáticas, objetos de conhecimento e habilidades da Educação Básica.",
    action: "Explorar BNCC",
    href: "/bncc",
    label: "Documento curricular",
    icon: BookOpenText,
  },
  {
    title: "BNCC + SAEB",
    description: "Explore relações entre habilidades da BNCC e descritores das matrizes de avaliação.",
    action: "Ver relações",
    href: "#avaliacoes",
    label: "Relações pedagógicas",
    icon: GitCompareArrows,
    comingSoon: true,
  },
  {
    title: "Resultados educacionais",
    description: "Explore indicadores e resultados de avaliações externas de forma visual.",
    action: "Ver dashboards",
    href: "#dados",
    label: "Indicadores e dados",
    icon: BarChart3,
  },
  {
    title: "SARESP",
    description: "Consulte e compare resultados educacionais do Estado de São Paulo.",
    action: "Explorar SARESP",
    href: "/saresp",
    label: "Avaliação estadual",
    icon: MapPinned,
  },
];

function QuickAccessCard({ item }: { item: AccessItem }) {
  const Icon = item.icon;
  const content = (
    <>
      <div className="access-card-top">
        <span className="access-icon"><Icon size={22} aria-hidden="true" /></span>
        <span className="access-label">{item.label}</span>
        {item.comingSoon && <span className="soon-badge">Em breve</span>}
      </div>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      {item.comingSoon ? (
        <span className="card-action card-action-soon">{item.action}</span>
      ) : (
        <span className="card-action">{item.action} <ArrowUpRight size={17} aria-hidden="true" /></span>
      )}
    </>
  );

  if (item.comingSoon) {
    return (
      <div className="access-card access-card-soon" aria-disabled="true">
        {content}
      </div>
    );
  }

  return (
    <a className="access-card" href={item.href}>
      {content}
    </a>
  );
}

export function QuickAccess() {
  return (
    <section className="section quick-access" id="ferramentas">
      <div className="container">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Acesso rápido</span>
            <h2>O que você quer consultar?</h2>
          </div>
          <p>Comece pelos principais recursos do Tempo Docente.</p>
        </div>
        <div className="access-grid" id="bncc">
          {items.map((item) => <QuickAccessCard key={item.title} item={item} />)}
        </div>
      </div>
    </section>
  );
}
