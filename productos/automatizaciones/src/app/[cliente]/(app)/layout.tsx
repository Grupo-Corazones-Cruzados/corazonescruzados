import { exigirContexto } from '@/lib/inquilino';
import { AplicaMarca } from '@/componentes/Marca';
import { BarraLateral, BarraInferior } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';

export const dynamic = 'force-dynamic';

/**
 * Armazón de la aplicación del cliente. `exigirContexto` decide si esta pantalla
 * llega a existir: sin sesión manda a acceder y con la mensualidad vencida manda a la
 * pantalla de suscripción. Las páginas de dentro ya no comprueban nada de eso.
 */
export default async function LayoutApp({
  children,
  params,
}: {
  children: React.ReactNode;
  params: Promise<{ cliente: string }>;
}) {
  const { cliente } = await params;
  const { inquilino, sesion, montados } = await exigirContexto(cliente);

  return (
    <AplicaMarca colorAcento={inquilino.colorAcento} tema={inquilino.tema}>
      <BarraLateral
        slug={cliente}
        cliente={inquilino.nombre}
        logoUrl={inquilino.logoUrl}
        usuario={sesion.nombre}
        rol={sesion.rol}
        montados={montados}
      />
      {/*
        ⭐⭐ EL ALTO SE HEREDA; NO SE CALCULA RESTANDO PÍXELES A MANO.
        (Fernando, 2026-09-23, y con razón: «terminas generando un desbordamiento».)

        Antes cada pantalla que quería ocupar la página escribía su propio
        `h-[calc(100dvh-4rem)]`, y eso **siempre** acaba mal: la resta tiene que acertar
        con la cabecera de la página, con el relleno, con la barra táctil y con el aviso
        de escaparate —que a veces está y a veces no—. Basta que cambie uno para que
        sobre o falte espacio, y lo que se ve es una barra de desplazamiento en la página
        entera.

        Ahora el alto se declara AQUÍ y en un solo sitio: esta columna mide exactamente la
        ventana, el aviso ocupa lo suyo, y `main` se queda con lo que sobre. Una pantalla
        que quiera llenarla pide `h-full` y el navegador hace la resta, que para eso está.

        ⚠️ `min-h-0` no es decorativo: sin él, un hijo alto estira el `flex-1` y el
        desbordamiento vuelve por la puerta de atrás.

        El menú se monta ENCIMA, así que el contenido conserva el margen del raíl estrecho
        (64 px) y no salta al desplegarse. El `pb-16` reserva la barra táctil.
      */}
      <div className="flex h-dvh flex-col lg:ml-16">
        {inquilino.soloLectura && <AvisoEscaparate />}
        <main className="desplaza min-h-0 flex-1 overflow-y-auto pb-16 lg:pb-0">{children}</main>
      </div>
      <BarraInferior slug={cliente} rol={sesion.rol} montados={montados} />
    </AplicaMarca>
  );
}
