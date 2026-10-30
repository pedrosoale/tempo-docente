import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "@/app/bncc/bncc.css";

// A página principal /bncc vive neste grupo de rotas — e NÃO em app/bncc/page.tsx — de propósito:
// app/bncc/loading.tsx envolve tudo o que está sob app/bncc num <Suspense>, e o React só embute no
// HTML inicial um limite de Suspense pequeno; acima disso o conteúdo (inclusive o formulário de busca)
// vai para um segmento oculto (<div hidden id="S:n">) que só aparece depois que o JavaScript o revela.
// O acesso à BNCC Computação levou a página principal além desse limite e a busca por GET precisa
// funcionar sem JavaScript, então ela fica fora dele. O resto é igual ao layout de app/bncc/layout.tsx
// (mesmo Header, Footer, <main> e bncc.css); as páginas filhas de /bncc continuam em app/bncc.
export default function BnccHubLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="bncc-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
