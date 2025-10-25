import Header from "./components/Header";
import Footer from "./components/Footer";
import "./globals.css";
import type { Metadata } from "next";

export const metadata: Metadata = {
  title: "Corazones Cruzados",
  icons: {
    icon: "/Logo CC.ico",
  },
  description: "Proyecto en Next.js",
};

export default function RootLayout({ children }: { children: React.ReactNode }) {
  return (
    <html lang="es">
      <body>
        <Header />
        <main>{children}</main> {/* ocupa todo el espacio disponible */}
        <Footer /> {/* siempre al final */}
      </body>
    </html>
  );
}