import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "./saresp.css";

export default function SarespLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="saresp-main" id="main-content">{children}</main>
      <Footer />
    </>
  );
}
