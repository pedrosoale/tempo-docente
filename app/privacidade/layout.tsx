import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "./privacidade.css";

export default function PrivacidadeLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="privacidade-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
