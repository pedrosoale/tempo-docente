import { DashboardPreview } from "./components/DashboardPreview";
import { DataFlow } from "./components/DataFlow";
import { EducationSearch } from "./components/EducationSearch";
import { Footer } from "./components/Footer";
import { Header } from "./components/Header";
import { Hero } from "./components/Hero";
import { QuickAccess } from "./components/QuickAccess";
import { SourceTrust } from "./components/SourceTrust";

export default function Home() {
  return (
    <>
      <Header />
      <main>
        <Hero />
        <QuickAccess />
        <EducationSearch />
        <DataFlow />
        <DashboardPreview />
        <SourceTrust />
      </main>
      <Footer />
    </>
  );
}
