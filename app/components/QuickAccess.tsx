import { ArrowUpRight, BookOpenText, Layers, MapPinned, School, Sparkles, TrendingUp, type LucideIcon } from "lucide-react";

type AccessItem = {
  title: string;
  description: string;
  action: string;
  href: string;
  label: string;
  icon: LucideIcon;
};

// Cada item aqui é um destino real e navegável agora — nenhum cartão "Em
// breve" ou de conteúdo demonstrativo. A grade geral /bncc continua acessível
// pelo Header, pelo Hero e pela busca abaixo; esta seção lista as 6 etapas/
// ferramentas específicas, não a página guarda-chuva.
const items: AccessItem[] = [
  {
    title: "Educação Infantil",
    description: "Campos de experiências e objetivos de aprendizagem e desenvolvimento.",
    action: "Explorar campos",
    href: "/bncc/educacao-infantil",
    label: "Bebês a crianças pequenas",
    icon: Layers,
  },
  {
    title: "Ensino Fundamental",
    description: "Habilidades por ano, área e componente — Anos Iniciais e Anos Finais completos, do 1º ao 9º ano, nos 9 componentes curriculares.",
    action: "Explorar componentes",
    href: "/bncc/ensino-fundamental",
    label: "1º ao 9º ano",
    icon: BookOpenText,
  },
  {
    title: "Ensino Médio",
    description: "Competências específicas e habilidades por área do conhecimento — Formação Geral Básica completa, sem recorte por série.",
    action: "Explorar áreas",
    href: "/bncc/ensino-medio",
    label: "Formação Geral Básica",
    icon: School,
  },
  {
    title: "Competências Gerais",
    description: "As 10 competências gerais que orientam a Educação Infantil, o Ensino Fundamental e o Ensino Médio.",
    action: "Ver competências",
    href: "/bncc/competencias-gerais",
    label: "Toda a Educação Básica",
    icon: Sparkles,
  },
  {
    title: "SARESP",
    description: "Compare resultados de proficiência por escola, com benchmark do recorte e diagnóstico automático.",
    action: "Explorar SARESP",
    href: "/saresp",
    label: "Avaliação estadual",
    icon: MapPinned,
  },
  {
    title: "SAEB",
    description: "Consulte resultados por município e escola, com histórico por edição em gráfico e tabela.",
    action: "Explorar SAEB",
    href: "/saeb",
    label: "Avaliação nacional",
    icon: TrendingUp,
  },
];

function QuickAccessCard({ item }: { item: AccessItem }) {
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
            <span className="section-kicker">Acesso rápido</span>
            <h2>O que você quer consultar?</h2>
          </div>
          <p>Seis recursos disponíveis agora — escolha um para começar.</p>
        </div>
        <div className="access-grid quick-access-grid">
          {items.map((item) => <QuickAccessCard key={item.title} item={item} />)}
        </div>
      </div>
    </section>
  );
}
