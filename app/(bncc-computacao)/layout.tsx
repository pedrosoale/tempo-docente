import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "@/app/bncc/bncc.css";

// A rota /bncc/computacao vive neste grupo de rotas — e NÃO em app/bncc/computacao — de propósito:
// app/bncc/loading.tsx envolve tudo o que está sob app/bncc num <Suspense>, e o React só embute
// no HTML inicial um limite de Suspense com menos de ~12,8 KB; acima disso o conteúdo vai para um
// segmento oculto (<div hidden id="S:n">) que só aparece depois que o JavaScript o revela. Esta
// página tem dezenas de KB e a consulta por GET precisa funcionar sem JavaScript, então ela fica fora
// desse limite. O resto é igual ao layout de app/bncc/layout.tsx (mesmo Header, Footer e bncc.css).
export default function BnccComputacaoLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="bncc-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
