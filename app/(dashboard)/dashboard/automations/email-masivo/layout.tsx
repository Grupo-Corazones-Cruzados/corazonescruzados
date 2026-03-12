import PageHeader from "@/components/layout/PageHeader";

export const metadata = {
  title: "Envío masivo de correos — Corazones Cruzados",
};

export default function EmailMasivoLayout({ children }: { children: React.ReactNode }) {
  return (
    <div>
      <PageHeader
        title="Envío masivo de correos"
        description="Crea listas de contactos, diseña campañas y envía emails masivos."
      />
      {children}
    </div>
  );
}
