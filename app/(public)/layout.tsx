import Header from "@/components/layout/Header";
import Footer from "@/components/layout/Footer";
import DaytimeTheme from "@/components/providers/DaytimeTheme";

export default function PublicLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <DaytimeTheme>
      <div style={{ display: "flex", flexDirection: "column", minHeight: "100vh" }}>
        <Header />
        <main style={{ flex: 1 }}>{children}</main>
        <Footer />
      </div>
    </DaytimeTheme>
  );
}
