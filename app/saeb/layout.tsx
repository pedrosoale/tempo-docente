import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "./saeb.css";

export default function SaebLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="saeb-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
