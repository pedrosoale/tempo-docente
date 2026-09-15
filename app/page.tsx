import type { Metadata } from "next";
import { DashboardPreview } from "./components/DashboardPreview";
import { DataFlow } from "./components/DataFlow";
import { EducationSearch } from "./components/EducationSearch";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { QuickAccess } from "./components/QuickAccess";
import { SourceTrust } from "./components/SourceTrust";

// Só o canonical é definido aqui — title/description/Open Graph/Twitter já
// vêm corretos do metadata do layout raiz (app/layout.tsx) para a própria
// home, e o Next mescla os dois por campo. Colocar o canonical no layout raiz
// em vez de aqui vazaria "/" para qualquer página futura que não defina o
// próprio canonical, já que o layout envolve todas as rotas.
export const metadata: Metadata = {
  alternates: { canonical: "/" },
};

// Dados estruturados da home: só o aprovado para publicação — sem Organization,
// sem alternateName, sem e-mail/telefone/endereço. Person espelha o mesmo nome,
// cargo e Lattes já publicados em /sobre, mas como WebSite.creator, não como um
// ProfilePage duplicado. Escapar "<" evita fechamento prematuro da tag <script>.
const websiteJsonLd = {
  "@context": "https://schema.org",
  "@type": "WebSite",
  name: "Tempo Docente",
  url: "https://tempodocente.com.br",
  description: "Dados, planejamento e inteligência para a educação.",
  inLanguage: "pt-BR",
  creator: {
    "@type": "Person",
    name: "Alexandre Pedroso",
    jobTitle: "Professor de Matemática",
    url: "https://tempodocente.com.br/sobre",
    sameAs: ["https://lattes.cnpq.br/9478556199676330"],
  },
};
const websiteJsonLdScript = JSON.stringify(websiteJsonLd).replace(/</g, "\\u003c");

export default function Home() {
  return (
    <>
      {/* JSON-LD estático, sem entrada de usuário — ver websiteJsonLdScript acima para o escape de segurança. */}
      <script type="application/ld+json" dangerouslySetInnerHTML={{ __html: websiteJsonLdScript }} />
      <Header />
      <main id="main-content" className="home-page">
        <Hero />
        <EducationSearch />
        <QuickAccess />
        <SourceTrust />
        <DataFlow />
        <DashboardPreview />
      </main>
      <Footer />
    </>
  );
}
