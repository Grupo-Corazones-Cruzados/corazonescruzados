"use client";

import React from "react";
import style from "app/styles/Encabezado.module.css"
import Image from "next/image";

export default function Encabezado() {
    return (

<div className={style.EncabezadoContenedor}>
  <div className={style.EncabezadoTexto}>
    <h1 className={style.EncabezadoTexto}>Un corazón puede cruzar el mundo</h1>
    <p className={style.EncabezadoSubtitulo}>"Proyecto de desarrollo humano"</p>
  </div>
  <div className={style.EncabezadoImagen}>
    <img src="/animacion-corazon.gif" alt="Corazón" />
  </div>
</div>

    );

}