import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "./sobre.css";

export default function SobreLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="sobre-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
