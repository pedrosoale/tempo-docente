import { ArrowUpRight, BookOpenText, LayoutGrid, MapPinned, TrendingUp, type LucideIcon } from "lucide-react";

type PrimaryAccess = {
  title: string;
  description: string;
  action: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

// As quatro tarefas reais da plataforma — nunca misturadas, na mesma grade,
// com as etapas da BNCC (ver EtapaLink/etapas abaixo): a intenção aqui é
// "o que consultar" (BNCC, matrizes, SAEB, SARESP), não "qual etapa
// curricular", que é uma navegação secundária e mais compacta.
const primaryAccess: PrimaryAccess[] = [
  {
    title: "Consultar habilidades da BNCC",
    description: "Localize habilidades por código, etapa ou palavra-chave.",
    action: "Explorar a BNCC",
    href: "/bncc",
    label: "Base curricular",
    icon: BookOpenText,
  },
  {
    title: "Consultar matrizes do SAEB",
    description: "Compare a matriz tradicional e a matriz alinhada à BNCC.",
    action: "Explorar matrizes",
    href: "/saeb/matriz",
    label: "Matriz de referência",
    icon: LayoutGrid,
  },
  {
    title: "Consultar resultados do SAEB",
    description: "Consulte por escola ou município e acompanhe as edições.",
    action: "Explorar SAEB",
    href: "/saeb",
    label: "Avaliação nacional",
    icon: TrendingUp,
  },
  {
    title: "Consultar resultados do SARESP",
    description: "Compare resultados por escola e interprete o desempenho.",
    action: "Explorar SARESP",
    href: "/saresp",
    label: "Avaliação estadual",
    icon: MapPinned,
  },
];

type EtapaLink = { title: string; href: string };

const etapas: EtapaLink[] = [
  { title: "Educação Infantil", href: "/bncc/educacao-infantil" },
  { title: "Ensino Fundamental", href: "/bncc/ensino-fundamental" },
  { title: "Ensino Médio", href: "/bncc/ensino-medio" },
  { title: "Competências Gerais", href: "/bncc/competencias-gerais" },
];

function PrimaryAccessCard({ item }: { item: PrimaryAccess }) {
  const Icon = item.icon;
  return (
    <a className="access-card" href={item.href}>
      <div className="access-card-top">
        <span className="access-icon"><Icon size={22} aria-hidden="true" /></span>
        <span className="access-label">{item.label}</span>
      </div>
      <div>
        <h3>{item.title}</h3>
        <p>{item.description}</p>
      </div>
      <span className="card-action">{item.action} <ArrowUpRight size={17} aria-hidden="true" /></span>
    </a>
  );
}

export function QuickAccess() {
  return (
    <section className="section quick-access" id="acessos">
      <div className="container home-rail">
        <div className="section-heading">
          <div>
            <span className="section-kicker">Acessos principais</span>
            <h2>O que você quer consultar?</h2>
          </div>
          <p>Quatro ferramentas disponíveis agora — escolha uma para começar.</p>
        </div>
        <div className="access-grid quick-access-grid">
          {primaryAccess.map((item) => <PrimaryAccessCard key={item.title} item={item} />)}
        </div>

        <div className="etapas-secundarias">
          <span className="etapas-kicker">Etapas da BNCC</span>
          <nav className="etapas-lista" aria-label="Etapas da BNCC">
            {etapas.map((etapa) => (
              <a className="etapa-link" href={etapa.href} key={etapa.title}>
                {etapa.title} <ArrowUpRight size={13} aria-hidden="true" />
              </a>
            ))}
          </nav>
        </div>
      </div>
    </section>
  );
}
