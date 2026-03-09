import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import DaytimeTheme from "@/components/providers/DaytimeTheme";
import PromoBanner from "@/components/layout/PromoBanner";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DaytimeTheme>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <PromoBanner />
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </div>
    </DaytimeTheme>
  );
}
