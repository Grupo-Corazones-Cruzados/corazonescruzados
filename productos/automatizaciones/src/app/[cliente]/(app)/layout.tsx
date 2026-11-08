import type { CSSProperties } from 'react';
import { exigirContexto } from '@/lib/inquilino';
import { prisma } from '@/lib/db';
import { perfilGcc } from '@/lib/cuentaGcc';
import { AplicaMarca } from '@/componentes/Marca';
import { urlLogo } from '@/lib/marca';
import { BarraLateral, BarraInferior, HuecoBarraAcciones } from '@/componentes/Navegacion';
import { AvisoEscaparate } from '@/componentes/AvisoEscaparate';
import { AvisoVistaComo } from '@/componentes/AvisoVistaComo';

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

  // La foto de quien entra con su cuenta de GCC World (2026-11-08), servida por `/<cliente>/foto`
  // (en la plataforma es un `data:` grande: no se mete en cada página).
  const yo = await prisma.usuario.findUnique({ where: { id: sesion.uid }, select: { origen: true, email: true, usuario: true } });
  const perfil = yo?.origen === 'GCC' ? await perfilGcc(yo.email ?? yo.usuario) : null;
  const foto = perfil?.tieneFoto ? `/${cliente}/foto?u=${sesion.uid}` : null;

  // La franja de aviso: demostración o «ver como». En escritorio va a TODO el ancho, por encima
  // del menú y del contenido, para que las dos cabeceras sigan alineadas (Fernando, 2026-11-08);
  // en el teléfono, dentro de la columna, como siempre.
  const aviso = inquilino.soloLectura
    ? <AvisoEscaparate />
    : sesion.suplantadoPor
      ? <AvisoVistaComo slug={cliente} nombre={sesion.nombre} rol={sesion.rol} />
      : null;

  return (
    <AplicaMarca>
      <div className="contents" style={{ '--alto-aviso': aviso ? '2rem' : '0px' } as CSSProperties}>
      {aviso && <div className="hidden h-8 overflow-hidden lg:block [&>*]:h-8 [&>*]:py-0">{aviso}</div>}
      <BarraLateral
        slug={cliente}
        cliente={inquilino.nombre}
        logoUrl={urlLogo(inquilino)}
        usuario={perfil?.nombre ?? sesion.nombre}
        rol={sesion.rol}
        montados={montados}
        foto={foto}
        enVista={!!sesion.suplantadoPor}
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
        (64 px) y no salta al desplegarse. El `pb-` reserva la barra táctil y la barrita de inicio del iPhone.

        `main` es `flex-col` por la barra de acciones del teléfono: su hueco va como ÚLTIMO
        hijo y con `mt-auto` baja al fondo aunque la página sea corta. Una pantalla que pide
        `h-full` sigue midiendo exactamente lo que queda (el alto de `main` es definido).
      */}
      <div className="flex h-[calc(100dvh-env(safe-area-inset-top))] flex-col lg:ml-16 lg:h-[calc(100dvh-env(safe-area-inset-top)-var(--alto-aviso,0px))]">
        {aviso && <div className="lg:hidden">{aviso}</div>}
        <main className="desplaza flex min-h-0 flex-1 flex-col overflow-y-auto pb-[calc(4rem+env(safe-area-inset-bottom))] lg:pb-0">
          {children}
          <HuecoBarraAcciones />
        </main>
      </div>
      <BarraInferior
        slug={cliente}
        cliente={inquilino.nombre}
        logoUrl={urlLogo(inquilino)}
        usuario={perfil?.nombre ?? sesion.nombre}
        rol={sesion.rol}
        montados={montados}
        foto={foto}
        enVista={!!sesion.suplantadoPor}
      />
      </div>
    </AplicaMarca>
  );
}
