package org.grupocc.gccworld;

import android.content.Context;

/**
 * GCC Progreso, la app de las tiendas, no trae Control Psicosocial: sin ubicación en segundo plano
 * ni micrófono continuo. Eso vive en el sabor `centralizado`, que implementa esto mismo.
 */
public final class Extras {
    private Extras() {}

    /** Qué app es. La web lo lee de la cookie `gcc_app` para pintar su inicio de sesión. */
    public static final String APP = "progreso";

    public static void registrarPlugins(MainActivity actividad) {}

    /**
     * Un miembro con solo esta app no tiene la alarma de auxilio, pero el aviso no se puede perder:
     * sale como notificación normal.
     */
    public static void mostrarAuxilio(Context c, String titulo, String cuerpo, String ruta) {
        org.grupocc.gccworld.reloj.Relojes.mostrarAviso(c, titulo, cuerpo, ruta);
    }
}
