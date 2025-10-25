"use client";
import React, { useState } from "react";
import { useRouter, usePathname } from "next/navigation";
import styles from "../styles/Header.module.css";


const Header = () => {
  const [menuOpen, setMenuOpen] = useState(false);
  const router = useRouter();
  const pathname = usePathname(); // ✅ ruta actual

  const menuItems = [
    { label: "Inicio", icon: "/IcInicio.png", href: "/" },
    { label: "Paquetes", icon: "/IcPaquetes.png", href: "/paquetes" },
    { label: "Nosotros", icon: "/IcNosotros.png", href: "/nosotros" },
    { label: "Ayuda", icon: "/IcAyuda.png", href: "/ayuda" }
  ];

  const handleClick = (href: string) => {
    router.push(href);
    setMenuOpen(false);
  };

  return (
    <>
      <div className={styles.BarraSuperior}>
        <img
          src="/LogoCC.png"
          alt=""
          onClick={() => setMenuOpen(!menuOpen)}
          className={`${styles.Logo} ${menuOpen ? styles["Logo-Activo"] : ""}`}
        />
        <h2 className={styles["BarraSuperior-Titulo"]}>Corazones Cruzados</h2>
      </div>

      <div className={`${styles.Menu} ${menuOpen ? styles["Menu-Abierto"] : ""}`}>
        <ul className={styles["Menu-Lista"]}>
          {menuItems.map((opcion) => (
            <li
              key={opcion.label}
              className={`${styles["Menu-Elemento"]} ${
                opcion.href === pathname ? styles["Menu-Elemento-Activo"] : ""
              }`}
              onClick={() => handleClick(opcion.href)}
              onMouseOver={e => {
                if (opcion.label !== "Inicio") {
                  (e.currentTarget as HTMLElement).classList.add(styles["Menu-Elemento-Hover"]);
                }
              }}
              onMouseOut={e => {
                if (opcion.label !== "Inicio") {
                  (e.currentTarget as HTMLElement).classList.remove(styles["Menu-Elemento-Hover"]);
                }
              }}
            >
              <div className={styles["Menu-Elemento-Contenido"]}>

                {opcion.href === pathname ?
                <img src={opcion.icon} alt={opcion.label} className={styles.MenuElementoIconoSeleccionado} />
                :
                <img src={opcion.icon} alt={opcion.label} className={styles["Menu-Elemento-Icono"]} />
                }


                {opcion.label}
              </div>
            </li>
          ))}
        </ul>
      </div>
    </>
  );
};

export default Header;