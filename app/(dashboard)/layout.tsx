import Sidebar from "@/components/layout/Sidebar";

export default function DashboardLayout({
  children,
}: {
  children: React.ReactNode;
}) {
  return (
    <div style={{ display: "flex", minHeight: "100vh" }}>
      <Sidebar />
      <main
        style={{
          flex: 1,
          marginLeft: "var(--sidebar-width)",
          padding: "var(--space-8)",
          background: "var(--bg-secondary)",
          minHeight: "100vh",
        }}
      >
        {children}
      </main>
    </div>
  );
}
