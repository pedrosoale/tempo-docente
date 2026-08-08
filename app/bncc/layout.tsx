import { Footer } from "@/app/components/Footer";
import { Header } from "@/app/components/Header";
import "./bncc.css";

export default function BnccLayout({ children }: Readonly<{ children: React.ReactNode }>) {
  return (
    <>
      <Header />
      <main className="bncc-main">{children}</main>
      <Footer />
    </>
  );
}
